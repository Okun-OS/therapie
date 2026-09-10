import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { monatsGrundlagen, abrechnungRechnen } from '@/lib/payroll-monat'
import {
  differenzBilden, werteAusErgebnis, ausgleichsMonat, korrekturText,
  type AbrechnungsWerte, type Differenz,
} from '@/lib/aufrollung'

export const dynamic = 'force-dynamic'

/**
 * §119 POST /api/payroll/aufrollen
 *   { jahr, monat?, locationId?, grund? }        → Vorschau
 *   ?uebernehmen=1 zusätzlich { fuer: [employeeId…] } → Korrekturen anlegen
 *
 * Rechnet freigegebene Monate mit den heutigen Daten noch einmal und zeigt, wo
 * das Ergebnis vom Freigegebenen abweicht. Ohne `monat` wird das ganze Jahr
 * geprüft — das ist der Regelfall, weil niemand weiß, welcher Monat betroffen
 * ist, wenn ein Krankenschein zwei Monate zu spät kommt.
 *
 * Die freigegebene Abrechnung wird dabei NIE überschrieben. Sie bleibt, wie sie
 * unterschrieben wurde; die Korrektur steht als eigener Datensatz daneben.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const uebernehmen = req.nextUrl.searchParams.get('uebernehmen') === '1'
  const body = await req.json().catch(() => ({})) as {
    jahr?: number; monat?: number; locationId?: string
    grund?: string; fuer?: string[]
  }
  const jahr = Number(body.jahr) || new Date().getFullYear()
  const monat = body.monat ? Number(body.monat) : null
  if (monat !== null && (monat < 1 || monat > 12)) {
    return NextResponse.json({ error: 'Monat muss zwischen 1 und 12 liegen' }, { status: 400 })
  }

  const scope = await allowedLocationScope(session)
  const standortFilter = body.locationId
    ? (scope.kind === 'all' || scope.ids.includes(body.locationId)
        ? { locationId: body.locationId }
        : null)
    : (scope.kind === 'all' ? {} : { locationId: { in: scope.ids } })
  if (standortFilter === null) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
  }

  // Nur freigegebene Monate werden aufgerollt. Entwürfe rechnet „Abrechnung
  // vorbereiten" ohnehin jedes Mal neu — dafür braucht es keine Korrektur.
  const freigegeben = await prisma.payrollEntry.findMany({
    where: {
      customerId, year: jahr, status: { not: 'draft' },
      ...(monat ? { month: monat } : {}),
      ...standortFilter,
    },
    orderBy: [{ month: 'asc' }, { employeeName: 'asc' }],
  })
  if (freigegeben.length === 0) {
    return NextResponse.json({
      abweichungen: [], geprueft: 0,
      hinweis: `Für ${jahr} gibt es keine freigegebenen Abrechnungen zum Aufrollen.`,
    })
  }

  const mitarbeiterIds = Array.from(new Set(freigegeben.map(e => e.employeeId)))
  const mitarbeiter = await prisma.employee.findMany({
    where: { id: { in: mitarbeiterIds } },
    select: { id: true, name: true, locationId: true, weeklyHours: true, hasChildren: true },
  })
  const mitarbeiterVon = new Map(mitarbeiter.map(m => [m.id, m]))
  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: mitarbeiterIds } },
  })
  const profilVon = new Map(profile.map(p => [p.employeeId, p]))

  // Die Grundlagen je Monat einmal sammeln statt je Abrechnung
  const monate = Array.from(new Set(freigegeben.map(e => e.month)))
  const grundlagenJeMonat = new Map<number, Awaited<ReturnType<typeof monatsGrundlagen>>>()
  for (const m of monate) {
    grundlagenJeMonat.set(m, await monatsGrundlagen(customerId, jahr, m,
      mitarbeiter.map(x => {
        const p = profilVon.get(x.id)
        return {
          employeeId: x.id, weeklyHours: x.weeklyHours, locationId: x.locationId,
          bundesland: p?.bundesland, lohnart: p?.lohnart,
          stundenlohn: p?.stundenlohn, monatsgehalt: p?.monatsgehalt,
        }
      })))
  }

  interface Abweichung {
    employeeId: string; name: string; jahr: number; monat: number
    ausgleichJahr: number; ausgleichMonat: number
    differenz: Differenz
    werteAlt: AbrechnungsWerte; werteNeu: AbrechnungsWerte
    bereitsOffen: boolean
  }
  const abweichungen: Abweichung[] = []
  const nichtRechenbar: { name: string; monat: number; grund: string }[] = []

  // Bereits angelegte, noch offene Korrekturen — damit ein zweiter Lauf nicht
  // dieselbe Differenz ein zweites Mal auszahlt.
  const offeneKorrekturen = await prisma.payrollCorrection.findMany({
    where: { customerId, jahr, status: 'offen' },
    select: { employeeId: true, monat: true },
  })
  const schonOffen = new Set(offeneKorrekturen.map(k => `${k.employeeId}|${k.monat}`))

  for (const e of freigegeben) {
    const m = mitarbeiterVon.get(e.employeeId)
    const p = profilVon.get(e.employeeId)
    if (!m || !p) {
      nichtRechenbar.push({
        name: e.employeeName ?? e.employeeId, monat: e.month,
        grund: !m ? 'Mitarbeiter nicht gefunden' : 'Lohn-Stammdaten fehlen',
      })
      continue
    }
    const grundlage = grundlagenJeMonat.get(e.month)?.get(e.employeeId)
    if (!grundlage) continue

    let neu
    try {
      neu = abrechnungRechnen(
        { ...p, hatKinder: p.hatKinder ?? m.hasChildren },
        grundlage, jahr, e.month,
      ).ergebnis
    } catch (fehler) {
      nichtRechenbar.push({
        name: m.name, monat: e.month,
        grund: fehler instanceof Error ? fehler.message : 'Berechnung nicht möglich',
      })
      continue
    }

    const werteAlt: AbrechnungsWerte = {
      brutto: e.brutto, steuerBrutto: e.steuerBrutto, svBrutto: e.svBrutto,
      steuerfreieZuschlaege: e.steuerfreieZuschlaege, surchargesTotal: e.surchargesTotal,
      regularHours: e.regularHours, overtimeHours: e.overtimeHours,
      lohnsteuer: e.lohnsteuer, kirchensteuer: e.kirchensteuer, soli: e.soli,
      rvAN: e.rvAN, kvAN: e.kvAN, pvAN: e.pvAN, avAN: e.avAN,
      rvAG: e.rvAG, kvAG: e.kvAG, pvAG: e.pvAG, avAG: e.avAG,
      totalDeductions: e.totalDeductions, netto: e.netto,
    }
    const werteNeu = werteAusErgebnis(neu, grundlage)
    const differenz = differenzBilden(werteAlt, werteNeu)
    if (!differenz) continue

    const ausgleich = ausgleichsMonat(jahr, e.month)
    abweichungen.push({
      employeeId: e.employeeId, name: m.name, jahr, monat: e.month,
      ausgleichJahr: ausgleich.jahr, ausgleichMonat: ausgleich.monat,
      differenz, werteAlt, werteNeu,
      bereitsOffen: schonOffen.has(`${e.employeeId}|${e.month}`),
    })
  }

  // ── Vorschau ─────────────────────────────────────────────────────────────
  if (!uebernehmen) {
    const neue = abweichungen.filter(a => !a.bereitsOffen)
    return NextResponse.json({
      geprueft: freigegeben.length,
      abweichungen,
      nichtRechenbar,
      hinweis: abweichungen.length === 0
        ? `${freigegeben.length} freigegebene Abrechnungen geprüft — alle stimmen noch.`
        : `${neue.length} Abweichungen gefunden`
          + (abweichungen.length > neue.length
            ? `, ${abweichungen.length - neue.length} bereits als Korrektur offen` : '')
          + `. Geprüft: ${freigegeben.length}.`,
    })
  }

  // ── Übernehmen ───────────────────────────────────────────────────────────
  if (!Array.isArray(body.fuer) || body.fuer.length === 0) {
    return NextResponse.json(
      { error: 'Es wurde keine Abweichung zur Übernahme bestätigt.' },
      { status: 400 },
    )
  }
  const grund = body.grund?.trim() || 'Rückwirkende Änderung der Abrechnungsgrundlage'
  const bestaetigt = new Set(body.fuer)
  const angelegt: { name: string; monat: number; differenzNetto: number }[] = []

  for (const a of abweichungen) {
    // Der Schlüssel enthält den Monat: eine Person kann in mehreren Monaten
    // abweichen, und der Kunde soll je Monat entscheiden können.
    if (!bestaetigt.has(`${a.employeeId}|${a.monat}`)) continue
    if (a.bereitsOffen) continue

    const m = mitarbeiterVon.get(a.employeeId)
    await prisma.payrollCorrection.create({
      data: {
        employeeId: a.employeeId, employeeName: a.name,
        customerId, locationId: m?.locationId ?? null,
        jahr: a.jahr, monat: a.monat,
        ausgleichJahr: a.ausgleichJahr, ausgleichMonat: a.ausgleichMonat,
        grund,
        werteAlt: a.werteAlt as unknown as object,
        werteNeu: a.werteNeu as unknown as object,
        differenzBrutto: a.differenz.brutto,
        differenzNetto: a.differenz.netto,
        differenzLohnsteuer: a.differenz.lohnsteuer,
        differenzSvAN: a.differenz.svAN,
        differenzSvAG: a.differenz.svAG,
        erstelltVon: session.name ?? session.userId,
      },
    })
    angelegt.push({ name: a.name, monat: a.monat, differenzNetto: a.differenz.netto })
  }

  const summe = angelegt.reduce((s, x) => s + x.differenzNetto, 0)
  return NextResponse.json({
    angelegt,
    summeNetto: Math.round(summe * 100) / 100,
    hinweis: angelegt.length === 0
      ? 'Keine neue Korrektur angelegt.'
      : `${angelegt.length} Korrekturen angelegt, zusammen `
        + `${summe >= 0 ? '+' : ''}${summe.toFixed(2)} EUR netto. `
        + 'Sie werden beim nächsten Abrechnungslauf des Ausgleichsmonats ausgezahlt.',
  })
}

/**
 * §119 PATCH: eine Korrektur verwerfen.
 *
 * Wer versehentlich eine Korrektur anlegt, muss sie zurücknehmen können —
 * sonst zahlt der nächste Abrechnungslauf Geld aus, das niemand wollte.
 * Eine bereits ausgeglichene Korrektur wird nicht mehr angefasst: das Geld ist
 * geflossen, dafür gibt es die Aufrollung des Ausgleichsmonats.
 */
export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const { id, status } = await req.json().catch(() => ({})) as { id?: string; status?: string }
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  if (status !== 'verworfen') {
    return NextResponse.json(
      { error: 'Nur das Verwerfen einer Korrektur ist möglich.' },
      { status: 400 },
    )
  }

  const korrektur = await prisma.payrollCorrection.findUnique({ where: { id } })
  // Gleiche Antwort für "gibt es nicht" und "gehört jemand anderem"
  if (!korrektur || korrektur.customerId !== customerId) {
    return NextResponse.json({ error: 'Korrektur nicht gefunden' }, { status: 404 })
  }
  const scope = await allowedLocationScope(session)
  if (scope.kind !== 'all' && korrektur.locationId && !scope.ids.includes(korrektur.locationId)) {
    return NextResponse.json({ error: 'Korrektur nicht gefunden' }, { status: 404 })
  }
  if (korrektur.status === 'ausgeglichen') {
    return NextResponse.json({
      error: 'Diese Korrektur ist bereits ausgezahlt und kann nicht mehr verworfen werden. '
        + 'Für eine Rücknahme den Ausgleichsmonat aufrollen.',
    }, { status: 409 })
  }

  const aktualisiert = await prisma.payrollCorrection.update({
    where: { id },
    data: { status: 'verworfen' },
  })
  return NextResponse.json({ korrektur: aktualisiert, hinweis: 'Korrektur verworfen.' })
}

/** GET: die offenen Korrekturen eines Monats — für die Anzeige. */
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const p = req.nextUrl.searchParams
  const jahr = Number(p.get('jahr')) || new Date().getFullYear()
  const monat = Number(p.get('monat')) || new Date().getMonth() + 1

  const scope = await allowedLocationScope(session)
  const standortFilter = scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }

  const korrekturen = await prisma.payrollCorrection.findMany({
    where: {
      customerId, ausgleichJahr: jahr, ausgleichMonat: monat,
      status: { not: 'verworfen' }, ...standortFilter,
    },
    orderBy: [{ employeeName: 'asc' }, { monat: 'asc' }],
  })
  return NextResponse.json({
    korrekturen: korrekturen.map(k => ({
      ...k,
      text: korrekturText(k.jahr, k.monat, k.differenzNetto),
    })),
  })
}
