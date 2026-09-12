import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess, locationFilter } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { notifyEmployee } from '@/lib/notify'
import { dateiSpeichern } from '@/lib/file-storage'
import { erzeugeLohnbeleg, belegDateiname } from '@/lib/lohnbeleg'
import { korrekturText } from '@/lib/aufrollung'

export const dynamic = 'force-dynamic'

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/**
 * §113 POST /api/payroll/beleg
 *   { year, month, employeeId? }   employeeId weglassen = alle des Standorts
 *
 * Erzeugt die Entgeltabrechnung als PDF, legt sie in der Personalakte ab und
 * benachrichtigt den Mitarbeiter. Lohnabrechnungen sind in der Akte für den
 * Mitarbeiter freigegeben — er sieht sie damit sofort unter „Meine Unterlagen".
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const { year, month, employeeId, locationId } = await req.json().catch(() => ({})) as {
    year?: number; month?: number; employeeId?: string; locationId?: string
  }
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Jahr und Monat sind erforderlich' }, { status: 400 })
  }

  if (employeeId) {
    const verweigert = await assertEmployeeAccess(session, employeeId)
    if (verweigert) return verweigert
  } else if (locationId) {
    const erlaubt = await locationFilter(session, locationId)
    if (erlaubt instanceof NextResponse) return erlaubt
  }

  // Abrechnungen laden, für die ein Beleg erzeugt werden soll
  const abrechnungen = await prisma.payrollEntry.findMany({
    where: {
      customerId, year, month,
      ...(employeeId ? { employeeId } : {}),
      ...(locationId ? { locationId } : {}),
    },
  })
  if (abrechnungen.length === 0) {
    return NextResponse.json(
      { error: 'Für diesen Monat sind keine Abrechnungen vorhanden. Zuerst „Abrechnung vorbereiten" ausführen.' },
      { status: 404 },
    )
  }

  const orgSettings = await prisma.orgSettings.findUnique({ where: { customerId } })
  const kunde = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } })

  const arbeitgeber = {
    name: orgSettings?.organizationName ?? kunde?.name ?? 'Arbeitgeber',
    strasse: orgSettings?.strasse, plz: orgSettings?.plz, ort: orgSettings?.ort,
    betriebsnummer: orgSettings?.betriebsnummer, steuernummer: orgSettings?.steuernummer,
  }

  // §119 Wofuer die Korrektur auf dem Beleg steht — aus den ausgeglichenen
  // Korrekturen dieses Monats.
  const korrekturen = await prisma.payrollCorrection.findMany({
    where: {
      customerId, ausgleichJahr: year, ausgleichMonat: month,
      employeeId: { in: abrechnungen.map(a => a.employeeId) },
    },
  })
  const korrekturHinweis = new Map<string, string>()
  for (const k of korrekturen) {
    const bisher = korrekturHinweis.get(k.employeeId)
    const text = korrekturText(k.jahr, k.monat, k.differenzNetto)
    korrekturHinweis.set(k.employeeId, bisher ? `${bisher}, ${text}` : text)
  }

  // §120 Wofuer die Einmalzahlung stand — steht so auf dem Beleg.
  const einmalzahlungen = await prisma.payrollBonus.findMany({
    where: { customerId, jahr: year, monat: month, employeeId: { in: abrechnungen.map(a => a.employeeId) } },
  })
  const einmalHinweis = new Map<string, string>()
  for (const b of einmalzahlungen) {
    const bisher = einmalHinweis.get(b.employeeId)
    einmalHinweis.set(b.employeeId, bisher ? `${bisher}, ${b.bezeichnung}` : b.bezeichnung)
  }

  const erzeugt: { name: string; dateiId: string }[] = []
  const uebersprungen: { name: string; grund: string }[] = []

  for (const a of abrechnungen) {
    const mitarbeiter = await prisma.employee.findUnique({
      where: { id: a.employeeId },
      select: { id: true, name: true, birthDate: true, locationId: true },
    })
    if (!mitarbeiter) {
      uebersprungen.push({ name: a.employeeName ?? a.employeeId, grund: 'Mitarbeiter nicht gefunden' })
      continue
    }
    const profil = await prisma.employeePayrollProfile.findUnique({ where: { employeeId: a.employeeId } })

    try {
      const pdf = await erzeugeLohnbeleg(
        arbeitgeber,
        {
          name: mitarbeiter.name,
          strasse: profil?.strasse, plz: profil?.plz, ort: profil?.ort,
          geburtsdatum: mitarbeiter.birthDate,
          personalnummer: profil?.personalnummer,
          eintrittsdatum: profil?.eintrittsdatum,
          steuerId: profil?.steuerId,
          steuerklasse: a.taxClass ?? profil?.steuerklasse,
          kinderfreibetraege: a.childCount ?? profil?.kinderfreibetraege,
          konfession: profil?.konfession,
          sozialversicherungsnummer: profil?.sozialversicherungsnummer,
          krankenkasse: profil?.krankenkasse,
          versicherungsart: a.insuranceType ?? profil?.versicherungsart,
          iban: profil?.iban,
        },
        {
          jahr: year, monat: month,
          brutto: a.brutto, surchargesTotal: a.surchargesTotal,
          steuerfreieZuschlaege: a.steuerfreieZuschlaege,
          grundlage: a.grundlage ?? undefined,
          korrekturNetto: a.korrekturNetto,
          auszahlungsbetrag: a.auszahlungsbetrag || a.netto,
          korrekturText: korrekturHinweis.get(a.employeeId),
          sonstigeBezuege: a.sonstigeBezuege,
          sonstigeBezuegeText: einmalHinweis.get(a.employeeId),
          lohnsteuerSonstige: a.lohnsteuerSonstige,
          svTage: a.svTage,
          beschaeftigungsart: a.beschaeftigungsart,
          pauschsteuerAG: a.pauschsteuerAG,
          steuerBrutto: a.steuerBrutto, svBrutto: a.svBrutto,
          regularHours: a.regularHours, overtimeHours: a.overtimeHours,
          lohnsteuer: a.lohnsteuer, kirchensteuer: a.kirchensteuer, soli: a.soli,
          rvAN: a.rvAN, kvAN: a.kvAN, pvAN: a.pvAN, avAN: a.avAN,
          totalDeductions: a.totalDeductions, netto: a.netto,
          rvAG: a.rvAG, kvAG: a.kvAG, pvAG: a.pvAG, avAG: a.avAG,
          totalAgCost: a.totalAgCost,
        },
      )

      const datei = await dateiSpeichern({
        customerId,
        locationId: mitarbeiter.locationId,
        ownerType: 'employee',
        ownerId: mitarbeiter.id,
        kategorie: 'lohnabrechnung',
        dateiname: belegDateiname(year, month, mitarbeiter.name),
        mimeType: 'application/pdf',
        daten: pdf,
        hochgeladenVon: session.employeeId ?? session.userId,
        hochgeladenVonName: session.name ?? null,
        notiz: `Entgeltabrechnung ${MONATE[month - 1]} ${year}`,
        // §113 Zustellung: Der Mitarbeiter soll den Beleg sehen, sobald er da ist.
        sichtbarFuerMitarbeiter: true,
      })

      // §113 Und er soll davon erfahren — ohne Nachricht bliebe der Beleg
      // in der Akte liegen, ohne dass jemand hineinschaut.
      await notifyEmployee(mitarbeiter.id, {
        type: 'lohnabrechnung',
        title: `Abrechnung ${MONATE[month - 1]} ${year}`,
        body: `Deine Entgeltabrechnung für ${MONATE[month - 1]} ${year} liegt bereit. `
          + `Auszahlungsbetrag: ${(a.auszahlungsbetrag || a.netto).toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR.`,
        url: '/employee/profile',
      }).catch(() => null)

      erzeugt.push({ name: mitarbeiter.name, dateiId: datei.id })
    } catch (err) {
      console.error('[lohnbeleg] fehlgeschlagen für', mitarbeiter.name, err)
      uebersprungen.push({
        name: mitarbeiter.name,
        grund: err instanceof Error ? err.message : 'Unbekannter Fehler',
      })
    }
  }

  return NextResponse.json({
    erzeugt: erzeugt.length,
    uebersprungen,
    hinweis: uebersprungen.length > 0
      ? `${erzeugt.length} Abrechnungen zugestellt, ${uebersprungen.length} nicht — siehe Liste.`
      : `${erzeugt.length} Abrechnungen erzeugt und den Mitarbeitern zugestellt.`,
  })
}
