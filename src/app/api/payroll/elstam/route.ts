import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import {
  listeLesen, abgleichen, feldName,
  type ElstamSatz, type BestandsProfil,
} from '@/lib/elstam'

export const dynamic = 'force-dynamic'

/**
 * §117 ELStAM-Änderungsliste einlesen.
 *
 * POST /api/payroll/elstam            → Vorschau: was würde sich ändern?
 * POST /api/payroll/elstam?uebernehmen=1 → die bestätigten Änderungen schreiben
 *
 * Bewusst zwei Schritte. Eine Steuerklasse still zu überschreiben, weil eine
 * Datei das so sagt, wäre genau die Art stiller Änderung, die später niemand
 * mehr erklären kann. Der Kunde sieht erst, was passieren würde, und bestätigt.
 *
 * Abgerufen wird die Liste nicht von uns — das braucht einen zertifizierten
 * Zugang, den der Arbeitgeber hat. Käme der später dazu, bliebe alles hinter
 * dieser Schnittstelle unverändert; nur die Herkunft der Sätze wechselte.
 */

async function bestandLaden(customerId: string, session: Awaited<ReturnType<typeof requireRole>>) {
  const scope = await allowedLocationScope(session as never)
  const standortFilter = scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }

  const mitarbeiter = await prisma.employee.findMany({
    where: { customerId, active: true, ...standortFilter },
    select: { id: true, name: true },
  })
  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: mitarbeiter.map(m => m.id) } },
  })
  const profilVon = new Map(profile.map(p => [p.employeeId, p]))

  const bestand: BestandsProfil[] = mitarbeiter.map(m => {
    const p = profilVon.get(m.id)
    return {
      employeeId: m.id, name: m.name,
      steuerId: p?.steuerId, personalnummer: p?.personalnummer,
      steuerklasse: p?.steuerklasse, kinderfreibetraege: p?.kinderfreibetraege,
      konfession: p?.konfession, freibetragMonat: p?.freibetragMonat,
      hinzurechnungMonat: p?.hinzurechnungMonat, faktor: p?.faktor,
    }
  })
  return { bestand, erlaubteIds: new Set(mitarbeiter.map(m => m.id)) }
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const uebernehmen = req.nextUrl.searchParams.get('uebernehmen') === '1'
  const body = await req.json().catch(() => ({})) as {
    inhalt?: string
    spalten?: Record<string, string>
    stand?: string
    quelle?: string
    uebernehmenFuer?: string[]
  }

  const { bestand, erlaubteIds } = await bestandLaden(customerId, session)

  // ── Vorschau ─────────────────────────────────────────────────────────────
  if (!uebernehmen) {
    if (!body.inhalt || body.inhalt.trim().length === 0) {
      return NextResponse.json({ error: 'Es wurde keine Datei übergeben.' }, { status: 400 })
    }
    const spalten = body.spalten
      ? Object.fromEntries(
          Object.entries(body.spalten)
            .filter(([, f]) => f)
            .map(([i, f]) => [Number(i), f as keyof ElstamSatz]),
        )
      : undefined

    const { saetze, kopf, zuordnung } = listeLesen(body.inhalt, spalten)
    if (saetze.length === 0) {
      return NextResponse.json({
        error: 'In der Datei wurde keine Zeile erkannt. Bitte die Spaltenzuordnung prüfen.',
        kopf, zuordnung,
      }, { status: 400 })
    }

    const abgleich = abgleichen(saetze, bestand)
    const mitAenderung = abgleich.filter(a => a.aenderungen.length > 0)
    const ohneZuordnung = abgleich.filter(a => !a.employeeId)

    return NextResponse.json({
      kopf,
      zuordnung,
      gelesen: saetze.length,
      abgleich,
      hinweis: mitAenderung.length === 0
        ? `${saetze.length} Sätze gelesen — keine Abweichung zum hinterlegten Stand.`
        : `${mitAenderung.length} von ${saetze.length} Sätzen weichen ab.`
          + (ohneZuordnung.length > 0 ? ` ${ohneZuordnung.length} ohne Zuordnung.` : ''),
    })
  }

  // ── Übernehmen ───────────────────────────────────────────────────────────
  if (!body.inhalt) {
    return NextResponse.json({ error: 'Es wurde keine Datei übergeben.' }, { status: 400 })
  }
  if (!Array.isArray(body.uebernehmenFuer) || body.uebernehmenFuer.length === 0) {
    return NextResponse.json(
      { error: 'Es wurde kein Mitarbeiter zur Übernahme bestätigt.' },
      { status: 400 },
    )
  }
  const stand = body.stand && /^\d{4}-\d{2}-\d{2}$/.test(body.stand)
    ? body.stand
    : new Date().toISOString().slice(0, 10)

  const spalten = body.spalten
    ? Object.fromEntries(
        Object.entries(body.spalten)
          .filter(([, f]) => f)
          .map(([i, f]) => [Number(i), f as keyof ElstamSatz]),
      )
    : undefined
  const { saetze } = listeLesen(body.inhalt, spalten)
  const abgleich = abgleichen(saetze, bestand)

  const bestaetigt = new Set(body.uebernehmenFuer)
  const uebernommen: { name: string; aenderungen: string[] }[] = []
  const abgelehnt: string[] = []

  for (const a of abgleich) {
    if (!a.employeeId || !bestaetigt.has(a.employeeId)) continue
    // Auch bei bestätigter Übernahme gilt die Berechtigungsgrenze: ein Standort
    // darf über eine hochgeladene Datei keine fremden Profile ändern.
    if (!erlaubteIds.has(a.employeeId)) { abgelehnt.push(a.name); continue }
    if (a.aenderungen.length === 0) continue

    // Nur Felder schreiben, die die Liste tatsächlich nennt. Eine fehlende
    // Spalte darf keinen bestehenden Freibetrag löschen.
    const daten: Record<string, unknown> = {
      elstamStand: stand,
      elstamQuelle: body.quelle?.trim() || 'Änderungsliste',
      elstamBestaetigtVon: session.name ?? session.userId,
    }
    for (const ae of a.aenderungen) daten[ae.feld] = a.satz[ae.feld]

    await prisma.employeePayrollProfile.upsert({
      where: { employeeId: a.employeeId },
      create: { employeeId: a.employeeId, customerId, ...daten },
      update: daten,
    })
    uebernommen.push({
      name: a.name,
      aenderungen: a.aenderungen.map(x => `${feldName(x.feld)}: ${x.bisher} → ${x.neu}`),
    })
  }

  // Wer bestätigt wurde, aber keine Abweichung hatte, bekommt trotzdem den
  // neuen Stand — er wurde ja nachweislich gegen die Liste geprüft.
  const ohneAenderung = abgleich.filter(
    a => a.employeeId && bestaetigt.has(a.employeeId)
      && erlaubteIds.has(a.employeeId) && a.aenderungen.length === 0,
  )
  for (const a of ohneAenderung) {
    await prisma.employeePayrollProfile.updateMany({
      where: { employeeId: a.employeeId! },
      data: {
        elstamStand: stand,
        elstamQuelle: body.quelle?.trim() || 'Änderungsliste',
        elstamBestaetigtVon: session.name ?? session.userId,
      },
    })
  }

  return NextResponse.json({
    uebernommen,
    bestaetigtOhneAenderung: ohneAenderung.length,
    abgelehnt,
    stand,
    hinweis: `${uebernommen.length} Profile geändert, `
      + `${ohneAenderung.length} unverändert bestätigt. Stand: ${stand}.`
      + (abgelehnt.length > 0 ? ` ${abgelehnt.length} außerhalb der Berechtigung übersprungen.` : ''),
  })
}
