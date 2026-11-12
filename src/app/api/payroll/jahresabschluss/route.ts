import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'
import { notifyEmployee } from '@/lib/notify'
import { dateiSpeichern } from '@/lib/file-storage'
import { jahresWerte, zeitraumText, type MonatsWerte } from '@/lib/jahresabschluss'
import { erzeugeJahresbeleg, jahresbelegDateiname } from '@/lib/jahresbeleg'

export const dynamic = 'force-dynamic'

/**
 * §125 Jahresabschluss.
 *
 * GET  ?jahr=&art=uebersicht   → die Jahreswerte je Mitarbeiter, zum Ansehen
 * GET  ?jahr=&art=steuerberater → CSV mit allen Werten für die Bescheinigung
 * POST { jahr }                 → Jahresübersicht als PDF in die Personalakte
 *
 * Was hier NICHT entsteht: ein Ausdruck der elektronischen
 * Lohnsteuerbescheinigung. Der trägt die Kennung der Übermittlung, und die
 * haben wir nicht — der Steuerberater übermittelt. Er bekommt von hier die
 * vollständigen Werte, der Mitarbeiter eine ehrlich benannte Übersicht.
 */

async function werteSammeln(customerId: string, jahr: number, standortFilter: object) {
  const eintraege = await prisma.payrollEntry.findMany({
    where: { customerId, year: jahr, ...standortFilter },
    orderBy: [{ employeeName: 'asc' }, { month: 'asc' }],
  })

  const jeMitarbeiter = new Map<string, MonatsWerte[]>()
  const namen = new Map<string, string>()
  for (const e of eintraege) {
    namen.set(e.employeeId, e.employeeName ?? e.employeeId)
    const liste = jeMitarbeiter.get(e.employeeId) ?? []
    liste.push({
      month: e.month,
      brutto: e.brutto, steuerBrutto: e.steuerBrutto, svBrutto: e.svBrutto,
      steuerfreieZuschlaege: e.steuerfreieZuschlaege, sonstigeBezuege: e.sonstigeBezuege,
      lohnsteuer: e.lohnsteuer, kirchensteuer: e.kirchensteuer, soli: e.soli,
      rvAN: e.rvAN, kvAN: e.kvAN, pvAN: e.pvAN, avAN: e.avAN,
      rvAG: e.rvAG, kvAG: e.kvAG, pvAG: e.pvAG, avAG: e.avAG,
      pauschsteuerAG: e.pauschsteuerAG,
      beschaeftigungsart: e.beschaeftigungsart,
      svTage: e.svTage,
      insuranceType: e.insuranceType,
    })
    jeMitarbeiter.set(e.employeeId, liste)
  }

  return Array.from(jeMitarbeiter.entries()).map(([employeeId, monate]) => ({
    employeeId,
    name: namen.get(employeeId) ?? employeeId,
    werte: jahresWerte(jahr, monate),
  }))
}

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const p = req.nextUrl.searchParams
  const jahr = Number(p.get('jahr')) || new Date().getFullYear()
  const art = p.get('art') ?? 'uebersicht'

  const scope = await allowedLocationScope(session)
  const standortFilter = scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }
  const alle = await werteSammeln(customerId, jahr, standortFilter)

  if (art === 'uebersicht') {
    return NextResponse.json({
      jahr,
      mitarbeiter: alle.map(m => ({ ...m, zeitraum: zeitraumText(m.werte) })),
      hinweis: alle.length === 0
        ? `Für ${jahr} gibt es keine Abrechnungen.`
        : `${alle.length} Mitarbeiter, davon ${alle.filter(m => m.werte.bescheinigungspflichtig).length} `
          + 'mit zu bescheinigendem Arbeitslohn.',
    })
  }

  if (art !== 'steuerberater') {
    return NextResponse.json({ error: 'art muss "uebersicht" oder "steuerberater" sein' }, { status: 400 })
  }

  // ── CSV für den Steuerberater ────────────────────────────────────────────
  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: alle.map(m => m.employeeId) } },
  })
  const profilVon = new Map(profile.map(x => [x.employeeId, x]))

  const feld = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const zahl = (n: number) => `"${n.toFixed(2).replace('.', ',')}"`

  const kopf = [
    'Personalnummer', 'Name', 'Steuer-ID', 'Steuerklasse', 'Kinderfreibeträge', 'Konfession',
    'Zeitraum von', 'Zeitraum bis', 'SV-Tage',
    'Bruttoarbeitslohn', 'Lohnsteuer', 'Solidaritätszuschlag', 'Kirchensteuer',
    'RV Arbeitgeber', 'RV Arbeitnehmer', 'KV Arbeitnehmer', 'PV Arbeitnehmer', 'AV Arbeitnehmer',
    'KV Arbeitgeber', 'PV Arbeitgeber', 'AV Arbeitgeber',
    'Steuerfreie Zuschläge §3b', 'Pauschal versteuert §40a', 'Pauschsteuer Arbeitgeber',
    'Zu bescheinigen', 'Hinweise',
  ]
  const zeilen = [kopf.map(feld).join(';')]

  for (const m of alle) {
    const p2 = profilVon.get(m.employeeId)
    const w = m.werte
    zeilen.push([
      feld(p2?.personalnummer ?? m.employeeId.slice(-8)),
      feld(m.name),
      feld(p2?.steuerId),
      feld(p2?.steuerklasse),
      feld(p2?.kinderfreibetraege),
      feld(p2?.konfession),
      feld(w.vonMonat), feld(w.bisMonat), feld(w.svTageGesamt),
      zahl(w.bruttoarbeitslohn), zahl(w.lohnsteuer), zahl(w.soli), zahl(w.kirchensteuer),
      zahl(w.rvAG), zahl(w.rvAN), zahl(w.kvAN), zahl(w.pvAN), zahl(w.avAN),
      zahl(w.kvAG), zahl(w.pvAG), zahl(w.avAG),
      zahl(w.steuerfreieZuschlaege), zahl(w.pauschalVersteuert), zahl(w.pauschsteuerAG),
      feld(w.bescheinigungspflichtig ? 'ja' : 'nein'),
      feld(w.hinweise.join(' | ')),
    ].join(';'))
  }

  const name = `Jahreswerte-Lohnsteuerbescheinigung-${jahr}.csv`
  return new NextResponse('﻿' + zeilen.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const { jahr, employeeId } = await req.json().catch(() => ({})) as {
    jahr?: number; employeeId?: string
  }
  const j = Number(jahr)
  if (!j) return NextResponse.json({ error: 'Jahr ist erforderlich' }, { status: 400 })

  if (employeeId) {
    const verweigert = await assertEmployeeAccess(session, employeeId)
    if (verweigert) return verweigert
  }

  const scope = await allowedLocationScope(session)
  const standortFilter = scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }
  const alle = (await werteSammeln(customerId, j, standortFilter))
    .filter(m => !employeeId || m.employeeId === employeeId)

  if (alle.length === 0) {
    return NextResponse.json(
      { error: `Für ${j} sind keine Abrechnungen vorhanden.` }, { status: 404 })
  }

  const orgSettings = await prisma.orgSettings.findUnique({ where: { customerId } })
  const kunde = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } })
  const arbeitgeber = {
    name: orgSettings?.organizationName ?? kunde?.name ?? 'Arbeitgeber',
    strasse: orgSettings?.strasse, plz: orgSettings?.plz, ort: orgSettings?.ort,
    steuernummer: orgSettings?.steuernummer,
  }

  const erzeugt: string[] = []
  const uebersprungen: { name: string; grund: string }[] = []

  for (const m of alle) {
    const mitarbeiter = await prisma.employee.findUnique({
      where: { id: m.employeeId },
      select: { id: true, name: true, locationId: true },
    })
    if (!mitarbeiter) {
      uebersprungen.push({ name: m.name, grund: 'Mitarbeiter nicht gefunden' })
      continue
    }
    const profil = await prisma.employeePayrollProfile.findUnique({
      where: { employeeId: m.employeeId },
    })

    try {
      const pdf = await erzeugeJahresbeleg(
        arbeitgeber,
        {
          name: mitarbeiter.name,
          personalnummer: profil?.personalnummer,
          steuerId: profil?.steuerId,
          strasse: profil?.strasse, plz: profil?.plz, ort: profil?.ort,
        },
        m.werte,
      )

      await dateiSpeichern({
        customerId,
        locationId: mitarbeiter.locationId,
        ownerType: 'employee',
        ownerId: mitarbeiter.id,
        kategorie: 'lohnabrechnung',
        dateiname: jahresbelegDateiname(j, mitarbeiter.name),
        mimeType: 'application/pdf',
        daten: pdf,
        hochgeladenVon: session.employeeId ?? session.userId,
        hochgeladenVonName: session.name ?? null,
        notiz: `Jahresübersicht ${j}`,
        sichtbarFuerMitarbeiter: true,
      })

      await notifyEmployee(mitarbeiter.id, {
        type: 'lohnabrechnung',
        title: `Jahresübersicht ${j}`,
        body: `Deine Jahresübersicht für ${j} liegt in deinen Unterlagen bereit.`,
        url: '/employee/profile',
      }).catch(() => null)

      erzeugt.push(mitarbeiter.name)
    } catch (err) {
      console.error('[jahresbeleg] fehlgeschlagen für', m.name, err)
      uebersprungen.push({
        name: m.name,
        grund: err instanceof Error ? err.message : 'Unbekannter Fehler',
      })
    }
  }

  return NextResponse.json({
    erzeugt: erzeugt.length,
    uebersprungen,
    hinweis: `${erzeugt.length} Jahresübersichten erstellt und zugestellt.`
      + (uebersprungen.length > 0 ? ` ${uebersprungen.length} nicht — siehe Liste.` : '')
      + ' Die amtliche Lohnsteuerbescheinigung übermittelt der Steuerberater.',
  })
}
