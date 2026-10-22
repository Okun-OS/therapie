import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import {
  datevCsv, datevZeilenAusAbrechnung, sepaXml, ibanGueltig, zahlungsKennung,
  type DatevZeile, type SepaZahlung,
} from '@/lib/lohn-export'
import { logAudit } from '@/lib/audit'
import {
  entscheideLauf, naechsterBankarbeitstag, pruefeAusfuehrung,
} from '@/lib/zahllauf'

export const dynamic = 'force-dynamic'

/**
 * §217 Welche Abrechnungen in eine Zahlung dürfen.
 *
 * `draft` ist ausgeschlossen, und das ist der ganze Punkt: Ein Entwurf ist
 * eine Rechnung, die noch niemand bestätigt hat. Bis hierher konnte er
 * ausgezahlt werden — die Regel „kein Lohn ohne freigegebenen Monat" (§136)
 * greift beim Rechnen, nicht beim Überweisen.
 *
 * `paid` bleibt drin, damit eine bereits bezahlte Datei noch einmal
 * heruntergeladen werden kann. Sie trägt dann dieselbe Kennung wie beim
 * ersten Mal (siehe `zahlungsKennung`), die Bank erkennt sie als Dublette,
 * und es wird nicht zweimal gezahlt.
 */
const ZAHLBAR = ['approved', 'paid']

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/**
 * §114 GET /api/payroll/export?art=datev|sepa&year=&month=[&locationId=][&datum=]
 *
 * datev — Übergabedatei für den Steuerberater (CSV)
 * sepa  — Überweisungsdatei für die Bank des Kunden (pain.001.001.03)
 *
 * Beides sind Dateien zum Weitergeben. Wir melden nichts an Behörden und lösen
 * keine Zahlung aus — siehe src/lib/lohn-export.ts.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const p = req.nextUrl.searchParams
  const art = p.get('art')
  const year = Number(p.get('year'))
  const month = Number(p.get('month'))
  const locationId = p.get('locationId')

  if (art !== 'datev' && art !== 'sepa') {
    return NextResponse.json({ error: 'art muss "datev" oder "sepa" sein' }, { status: 400 })
  }
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Jahr und Monat sind erforderlich' }, { status: 400 })
  }
  /*
   * §217 Der Standortbezug gilt IMMER, nicht nur bei ausdrücklicher Angabe.
   *
   * Vorher wurde `locationFilter` nur aufgerufen, wenn ein Standort
   * mitgegeben wurde — und sein Ergebnis dann weggeworfen. Ohne den
   * Parameter lautete die Abfrage schlicht `{ customerId, year, month }`:
   * Eine Standortleitung konnte damit eine Datei herunterladen, in der Name,
   * IBAN und Auszahlungsbetrag JEDER beschäftigten Person des ganzen Trägers
   * stehen. Sechs andere Wege der Lohnabrechnung schränken längst ein; dieser
   * war die Ausnahme.
   *
   * Jetzt wird das Ergebnis benutzt: `undefined` heißt „keine Einschränkung"
   * und kommt nur für die Rolle `okun` ohne Standortwunsch vor.
   */
  const erlaubteStandorte = await locationFilter(session, locationId)
  if (erlaubteStandorte instanceof NextResponse) return erlaubteStandorte
  const standortFilter = erlaubteStandorte
    ? { locationId: { in: erlaubteStandorte } }
    : {}

  const abrechnungen = await prisma.payrollEntry.findMany({
    where: { customerId, year, month, ...standortFilter },
    orderBy: { employeeName: 'asc' },
  })
  if (abrechnungen.length === 0) {
    return NextResponse.json(
      { error: `Für ${MONATE[month - 1]} ${year} sind keine Abrechnungen vorhanden.` },
      { status: 404 },
    )
  }

  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: abrechnungen.map(a => a.employeeId) } },
  })
  const profilVon = new Map(profile.map(x => [x.employeeId, x]))
  const orgSettings = await prisma.orgSettings.findUnique({ where: { customerId } })
  const kunde = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } })
  const mandantName = orgSettings?.organizationName ?? kunde?.name ?? 'Mandant'

  // ── DATEV ────────────────────────────────────────────────────────────────
  if (art === 'datev') {
    const zeilen: DatevZeile[] = []
    for (const a of abrechnungen) {
      zeilen.push(...datevZeilenAusAbrechnung({
        ...a,
        personalnummer: profilVon.get(a.employeeId)?.personalnummer ?? null,
        auszahlungsbetrag: a.auszahlungsbetrag || a.netto,
        sonstigeBezuege: a.sonstigeBezuege,
        lohnsteuerSonstige: a.lohnsteuerSonstige,
        rvAG: a.rvAG, kvAG: a.kvAG, pvAG: a.pvAG, avAG: a.avAG,
        pauschsteuerAG: a.pauschsteuerAG,
        beschaeftigungsart: a.beschaeftigungsart,
        svTage: a.svTage,
      }))
    }
    const csv = datevCsv(
      {
        beraternummer: orgSettings?.datevBeraternummer,
        mandantennummer: orgSettings?.datevMandantennummer,
        jahr: year, monat: month, mandantName,
      },
      zeilen,
    )
    const name = `DATEV-Lohn-${year}-${String(month).padStart(2, '0')}.csv`
    await logAudit({
      userId: session.userId, userEmail: session.email, userRole: session.role,
      action: 'export', entityType: 'LohnExport', entityId: `datev-${year}-${month}`,
      customerId,
      details: {
        art: 'datev', jahr: year, monat: month,
        standort: locationId ?? 'alle erlaubten',
        abrechnungen: abrechnungen.length,
      },
    })
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }

  // ── SEPA ─────────────────────────────────────────────────────────────────
  if (!orgSettings?.iban) {
    return NextResponse.json({
      error: 'Für die SEPA-Datei fehlt die Bankverbindung des Unternehmens. '
        + 'Sie wird in den Unternehmenseinstellungen hinterlegt.',
    }, { status: 400 })
  }
  if (!ibanGueltig(orgSettings.iban)) {
    return NextResponse.json({
      error: 'Die hinterlegte IBAN des Unternehmens ist ungültig (Prüfsumme stimmt nicht).',
    }, { status: 400 })
  }

  const zahlungen: SepaZahlung[] = []
  const ohneBankverbindung: string[] = []
  // §217 Entwürfe werden nicht ausgezahlt — siehe ZAHLBAR oben.
  const entwuerfe = abrechnungen.filter(a => !ZAHLBAR.includes(a.status))
  for (const a of abrechnungen.filter(a => ZAHLBAR.includes(a.status))) {
    const profil = profilVon.get(a.employeeId)
    const iban = profil?.iban?.replace(/\s+/g, '').toUpperCase()
    if (!iban) { ohneBankverbindung.push(`${a.employeeName ?? a.employeeId}: keine IBAN hinterlegt`); continue }
    if (!ibanGueltig(iban)) { ohneBankverbindung.push(`${a.employeeName ?? a.employeeId}: IBAN ungültig`); continue }
    // §119 Ueberwiesen wird der Auszahlungsbetrag — Netto plus ausgeglichene
    // Korrekturen aus aufgerollten Monaten. Wer hier das Netto naehme, zahlte
    // die Korrektur nie aus.
    const betrag = a.auszahlungsbetrag || a.netto
    if (betrag <= 0) { ohneBankverbindung.push(`${a.employeeName ?? a.employeeId}: kein Auszahlungsbetrag`); continue }
    zahlungen.push({
      name: profil?.kontoinhaber || a.employeeName || 'Mitarbeiter',
      iban, bic: profil?.bic,
      betrag,
      verwendungszweck: `Gehalt ${MONATE[month - 1]} ${year}`,
    })
  }

  if (zahlungen.length === 0) {
    // §217 Der häufigste Grund ist jetzt ein anderer als früher, und er
    // gehört benannt: Wer nichts freigegeben hat, soll nicht nach einer
    // fehlenden Bankverbindung suchen.
    return NextResponse.json({
      error: entwuerfe.length === abrechnungen.length
        ? `Für ${MONATE[month - 1]} ${year} ist keine Abrechnung freigegeben. `
          + 'Entwürfe werden nicht ausgezahlt — erst freigeben, dann zahlen.'
        : 'Keine Zahlung möglich — bei keinem Mitarbeiter ist eine gültige Bankverbindung hinterlegt.',
      details: ohneBankverbindung,
      entwuerfe: entwuerfe.length,
    }, { status: 400 })
  }

  /*
   * §218 Das Ausführungsdatum kennt jetzt auch die Feiertage.
   *
   * Vorher wurden nur Samstag und Sonntag übersprungen. Am 1. Mai oder an
   * Weihnachten stand damit ein Datum in der Datei, das die Bank zurückweist
   * — und zwar erst beim Einreichen, also dann, wenn niemand mehr Zeit hat.
   * Maßgeblich ist das Bundesland des Standorts: Fronleichnam ist in
   * Nordrhein-Westfalen ein Feiertag und in Berlin nicht.
   *
   * Ein Wunschdatum wird NICHT stillschweigend verschoben, sondern abgelehnt.
   * Wer einen Zahltag nennt, soll nicht an einem anderen zahlen.
   */
  const bundesland = (await prisma.location.findFirst({
    where: { customerId, ...(locationId ? { id: locationId } : {}) },
    select: { bundesland: true },
  }))?.bundesland ?? null

  const wunsch = p.get('datum')
  let ausfuehrung: string
  if (wunsch) {
    const geprueft = pruefeAusfuehrung(wunsch, bundesland)
    if (!geprueft.ok) {
      return NextResponse.json(
        { error: `Als Ausführungstag geht der ${wunsch} nicht: ${geprueft.grund}` },
        { status: 400 },
      )
    }
    ausfuehrung = wunsch
  } else {
    ausfuehrung = naechsterBankarbeitstag(new Date(), 2, bundesland)
  }

  // §217 Die Kennung wird aus dem Inhalt gerechnet und ist damit bei einem
  // zweiten Abruf desselben Laufs dieselbe. Erst das gibt der Bank die
  // Möglichkeit, eine doppelt eingereichte Datei als Dublette zu erkennen.
  const kennung = zahlungsKennung(
    { customerId, jahr: year, monat: month, locationId },
    zahlungen,
  )

  /*
   * §218 Aus dem Download wird ein Vorgang.
   *
   * Bis hierher endete die Zahlung in einem Download, über den die Anlage
   * nichts mehr wusste: nicht, ob er eingereicht wurde, nicht, was in ihm
   * stand. Jetzt entscheidet `entscheideLauf`, was zu tun ist — und der
   * wichtigste der vier Fälle ist der dritte: Ist schon ein Lauf bei der Bank
   * eingereicht, entsteht keine zweite Datei.
   */
  const vorhandene = await prisma.zahllauf.findMany({
    where: { customerId, jahr: year, monat: month, locationId: locationId ?? null },
    select: { kennung: true, status: true },
  })
  const entscheidung = entscheideLauf(kennung, vorhandene)

  if (entscheidung.art === 'blockiert') {
    return NextResponse.json(
      { error: entscheidung.grund, offenerLauf: entscheidung.kennung }, { status: 409 },
    )
  }

  const name = `SEPA-Gehalt-${year}-${String(month).padStart(2, '0')}.xml`
  const kopf = (zusatz: Record<string, string>) => ({
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': 'private, no-store',
    'X-Okun-Zahlungen': String(zahlungen.length),
    'X-Okun-Uebersprungen': String(ohneBankverbindung.length),
    'X-Okun-Entwuerfe': String(entwuerfe.length),
    'X-Okun-Kennung': kennung,
    ...zusatz,
  })

  if (entscheidung.art === 'wiederholung') {
    // Die gespeicherte Datei erneut ausgeben statt eine neue zu erzeugen:
    // Eine neu erzeugte trüge einen neuen Erstellungszeitpunkt und wäre Byte
    // für Byte eine andere — wer zwei Dateien vergleicht, sähe Unterschiede,
    // wo keine sind.
    const alt = await prisma.zahllauf.findFirst({
      where: { customerId, kennung }, select: { id: true, datei: true, status: true },
    })
    if (alt?.datei) {
      await logAudit({
        userId: session.userId, userEmail: session.email, userRole: session.role,
        action: 'export', entityType: 'Zahllauf', entityId: kennung,
        customerId, details: { art: 'sepa', wiederholung: true, stand: alt.status },
      })
      return new NextResponse(Buffer.from(alt.datei), {
        headers: kopf({ 'X-Okun-Wiederholung': '1', 'X-Okun-Lauf': alt.id }),
      })
    }
  }

  const xml = sepaXml(
    { name: orgSettings.kontoinhaber || mandantName, iban: orgSettings.iban, bic: orgSettings.bic },
    zahlungen, ausfuehrung, kennung,
  )

  // Ein nur erzeugter, nie eingereichter Lauf wird abgelöst — heruntergeladen
  // heißt nicht eingereicht, und der häufigste Fall ist: Fehler bemerkt,
  // korrigiert, neu heruntergeladen.
  if (entscheidung.art === 'abloesen') {
    const alt = await prisma.zahllauf.findFirst({
      where: { customerId, jahr: year, monat: month, locationId: locationId ?? null,
        kennung: entscheidung.kennung },
      select: { id: true },
    })
    if (alt) {
      await prisma.zahllauf.update({
        where: { id: alt.id },
        data: {
          status: 'verworfen', statusAm: new Date(),
          notiz: `Abgelöst durch ${kennung}`,
        },
      })
      await prisma.payrollEntry.updateMany({
        where: { zahllaufId: alt.id }, data: { zahllaufId: null },
      })
    }
  }

  const bezahlte = abrechnungen
    .filter(a => ZAHLBAR.includes(a.status))
    .filter(a => {
      const iban = profilVon.get(a.employeeId)?.iban?.replace(/\s+/g, '').toUpperCase()
      return Boolean(iban) && ibanGueltig(iban!) && (a.auszahlungsbetrag || a.netto) > 0
    })

  /*
   * §218 Angelegt oder wiederbelebt.
   *
   * Die Kennung ist je Mandant eindeutig — sie IST der Inhalt. Wurde ein Lauf
   * mit genau diesem Inhalt einmal verworfen und entsteht er später erneut,
   * ist das kein zweiter Auftrag, sondern derselbe noch einmal. Ein blindes
   * `create` liefe hier in die Eindeutigkeitssperre und endete in einem
   * Serverfehler — gefunden genau dadurch.
   */
  const laufDaten = {
    locationId: locationId ?? null, jahr: year, monat: month,
    anzahl: zahlungen.length,
    summe: Number(zahlungen.reduce((s, z) => s + z.betrag, 0).toFixed(2)),
    ausfuehrung,
    datei: Buffer.from(xml, 'utf8'),
    erzeugtVon: session.userId,
    erzeugtVonName: session.name ?? session.email,
  }
  const lauf = await prisma.zahllauf.upsert({
    where: { customerId_kennung: { customerId, kennung } },
    create: { customerId, kennung, ...laufDaten },
    update: { ...laufDaten, status: 'erzeugt', statusAm: new Date(), notiz: null },
    select: { id: true },
  })
  await prisma.payrollEntry.updateMany({
    where: { id: { in: bezahlte.map(a => a.id) } },
    data: { zahllaufId: lauf.id },
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'export', entityType: 'Zahllauf', entityId: kennung,
    customerId,
    details: {
      art: 'sepa', jahr: year, monat: month,
      standort: locationId ?? 'alle erlaubten',
      zahlungen: zahlungen.length,
      // Die Summe gehört ins Protokoll: Sie ist die eine Zahl, an der eine
      // nachträglich veränderte Datei auffällt.
      summe: Number(zahlungen.reduce((s, z) => s + z.betrag, 0).toFixed(2)),
      ausfuehrung,
      ohneBankverbindung: ohneBankverbindung.length,
      entwuerfeUebersprungen: entwuerfe.length,
    },
  })

  return new NextResponse(xml, { headers: kopf({ 'X-Okun-Lauf': lauf.id }) })
}
