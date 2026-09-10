/**
 * §114 Übergabe an Steuerberater und Bank.
 *
 * Zwei bewusste Grenzen, die hier eingehalten werden:
 *
 * 1. MELDEWESEN — Sozialversicherungsmeldungen und Lohnsteueranmeldung brauchen
 *    zertifizierte Übermittlungswege (ITSG, ELSTER). Die machen wir NICHT selbst.
 *    Der DATEV-Export gibt die Daten an den Steuerberater weiter, der sie über
 *    seine zertifizierte Software meldet.
 *
 * 2. ZAHLUNGSVERKEHR — Geld für andere zu bewegen ist erlaubnispflichtig
 *    (Zahlungsdiensteaufsichtsgesetz). Wir erzeugen deshalb eine SEPA-Datei,
 *    die der Kunde bei SEINER Bank hochlädt und dort freigibt. Für ihn ist das
 *    ein Klick mehr, für uns der Unterschied zwischen Software und BaFin.
 */

// ── DATEV ───────────────────────────────────────────────────────────────────

export interface DatevZeile {
  personalnummer: string
  name: string
  lohnart: string
  bezeichnung: string
  betrag: number
  anzahl?: number
}

export interface DatevKopf {
  beraternummer?: string | null
  mandantennummer?: string | null
  jahr: number
  monat: number
  mandantName: string
}

/**
 * DATEV-Lohnimport als CSV mit Bewegungsdaten.
 *
 * Aufbau nach dem Muster des LODAS-/Lohn-und-Gehalt-Imports: je Zeile eine
 * Lohnart mit Betrag, zugeordnet über die Personalnummer. Der Steuerberater
 * ordnet die Lohnarten einmalig seinem Mandantenstamm zu.
 *
 * Bewusst KEINE Behauptung einer Zertifizierung — es ist eine strukturierte
 * Übergabedatei, kein geprüftes DATEV-Format.
 */
export function datevCsv(kopf: DatevKopf, zeilen: DatevZeile[]): string {
  const trenn = ';'
  const zahl = (n: number) => n.toFixed(2).replace('.', ',')
  const feld = (s: string) => `"${String(s).replace(/"/g, '""')}"`

  const zeitraum = `${String(kopf.monat).padStart(2, '0')}.${kopf.jahr}`

  const aus: string[] = []
  // Kopfzeile mit Mandantenzuordnung — der Steuerberater erkennt daran, wohin
  // die Daten gehören.
  aus.push([
    feld('OKUN-Lohnexport'), feld(kopf.mandantName),
    feld(`Berater ${kopf.beraternummer ?? '—'}`),
    feld(`Mandant ${kopf.mandantennummer ?? '—'}`),
    feld(`Abrechnungszeitraum ${zeitraum}`),
  ].join(trenn))
  aus.push('')
  aus.push([
    feld('Personalnummer'), feld('Name'), feld('Lohnart'), feld('Bezeichnung'),
    feld('Anzahl'), feld('Betrag'), feld('Zeitraum'),
  ].join(trenn))

  for (const z of zeilen) {
    aus.push([
      feld(z.personalnummer), feld(z.name), feld(z.lohnart), feld(z.bezeichnung),
      feld(z.anzahl != null ? zahl(z.anzahl) : ''), feld(zahl(z.betrag)), feld(zeitraum),
    ].join(trenn))
  }

  // DATEV erwartet Windows-Zeilenenden und Windows-1252; wir liefern UTF-8 mit
  // BOM, das die gängigen Importe und Excel korrekt lesen.
  return '﻿' + aus.join('\r\n') + '\r\n'
}

/** Die Lohnarten, die aus einer Abrechnung entstehen. */
export function datevZeilenAusAbrechnung(a: {
  employeeName?: string | null
  personalnummer?: string | null
  employeeId: string
  brutto: number
  surchargesTotal: number
  steuerfreieZuschlaege?: number
  regularHours: number
  overtimeHours: number
  lohnsteuer: number
  kirchensteuer: number
  soli: number
  rvAN: number; kvAN: number; pvAN: number; avAN: number
  netto: number
  korrekturNetto?: number
  auszahlungsbetrag?: number
  sonstigeBezuege?: number
  lohnsteuerSonstige?: number
}): DatevZeile[] {
  const basis = {
    // Ohne Personalnummer nimmt der Steuerberater die interne Kennung —
    // besser als eine leere Spalte, die beim Import stillschweigend zuordnet.
    personalnummer: a.personalnummer?.trim() || a.employeeId.slice(-8),
    name: a.employeeName ?? '',
  }
  // §120 Einmalzahlungen sind kein Grundentgelt — sie werden anders besteuert
  // und anders verbeitragt und gehoeren deshalb auf eine eigene Lohnart.
  const einmal = a.sonstigeBezuege ?? 0
  const zeilen: DatevZeile[] = [
    { ...basis, lohnart: '0100', bezeichnung: 'Grundentgelt',
      betrag: a.brutto - a.surchargesTotal - einmal, anzahl: a.regularHours || undefined },
  ]
  if (einmal > 0) {
    zeilen.push({ ...basis, lohnart: '0300', bezeichnung: 'Sonstige Bezüge', betrag: einmal })
  }
  // Steuerfreie und steuerpflichtige Zuschläge gehören auf getrennte Lohnarten —
  // der Steuerberater müsste sie sonst von Hand auseinandersortieren.
  const steuerfrei = a.steuerfreieZuschlaege ?? 0
  const steuerpflichtig = Math.max(0, a.surchargesTotal - steuerfrei)
  if (steuerpflichtig > 0) {
    zeilen.push({ ...basis, lohnart: '0200', bezeichnung: 'Zuschläge', betrag: steuerpflichtig })
  }
  if (steuerfrei > 0) {
    zeilen.push({ ...basis, lohnart: '0210', bezeichnung: 'Steuerfreie Zuschläge (§3b EStG)', betrag: steuerfrei })
  }
  if (a.overtimeHours > 0) {
    zeilen.push({ ...basis, lohnart: '0110', bezeichnung: 'Überstunden', betrag: 0, anzahl: a.overtimeHours })
  }
  const steuerSonstige = a.lohnsteuerSonstige ?? 0
  const abzuege: [string, string, number][] = [
    ['5000', 'Lohnsteuer', a.lohnsteuer - steuerSonstige],
    ['5001', 'Lohnsteuer auf sonstige Bezüge', steuerSonstige],
    ['5010', 'Kirchensteuer', a.kirchensteuer],
    ['5020', 'Solidaritätszuschlag', a.soli],
    ['5100', 'Rentenversicherung AN', a.rvAN],
    ['5110', 'Krankenversicherung AN', a.kvAN],
    ['5120', 'Pflegeversicherung AN', a.pvAN],
    ['5130', 'Arbeitslosenversicherung AN', a.avAN],
  ]
  for (const [lohnart, bezeichnung, betrag] of abzuege) {
    if (betrag > 0) zeilen.push({ ...basis, lohnart, bezeichnung, betrag })
  }
  // §119 Korrekturen aus aufgerollten Monaten stehen als eigene Lohnart da.
  // Der Steuerberater muss sehen koennen, warum die Auszahlung vom Netto des
  // Monats abweicht — sonst sucht er den Fehler bei sich.
  const korrektur = a.korrekturNetto ?? 0
  if (Math.abs(korrektur) >= 0.005) {
    zeilen.push({
      ...basis, lohnart: '0900',
      bezeichnung: korrektur > 0 ? 'Nachzahlung aus Aufrollung' : 'Rückforderung aus Aufrollung',
      betrag: korrektur,
    })
  }
  zeilen.push({
    ...basis, lohnart: '9999', bezeichnung: 'Auszahlungsbetrag',
    betrag: a.auszahlungsbetrag ?? a.netto,
  })
  return zeilen
}

// ── SEPA ────────────────────────────────────────────────────────────────────

export interface SepaZahlung {
  name: string
  iban: string
  bic?: string | null
  betrag: number
  verwendungszweck: string
}

export interface SepaAuftraggeber {
  name: string
  iban: string
  bic?: string | null
}

/** IBAN grob prüfen: Länge, Zeichen und Prüfsumme nach ISO 7064 (Modulo 97). */
export function ibanGueltig(roh: string): boolean {
  const iban = roh.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  const umgestellt = iban.slice(4) + iban.slice(0, 4)
  const ziffern = umgestellt.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55))
  // Stückweise rechnen, weil die Zahl für Number zu groß wird
  let rest = 0
  for (const z of ziffern) rest = (rest * 10 + Number(z)) % 97
  return rest === 1
}

const xmlText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** Zeichen, die SEPA nicht kennt, ersetzen statt die Datei scheitern zu lassen. */
export function sepaZeichen(s: string): string {
  return s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * SEPA-Überweisungsdatei (pain.001.001.03) für die Gehaltszahlung.
 *
 * Die Datei lädt der Kunde bei seiner Bank hoch und gibt sie dort frei.
 * Wir lösen keine Zahlung aus — siehe Kopf dieser Datei.
 */
export function sepaXml(
  auftraggeber: SepaAuftraggeber,
  zahlungen: SepaZahlung[],
  ausfuehrungsdatum: string,
  nachrichtId = `OKUN-${Date.now()}`,
): string {
  const summe = zahlungen.reduce((s, z) => s + z.betrag, 0)
  const jetzt = new Date().toISOString().replace(/\.\d{3}Z$/, '')
  const betrag = (n: number) => n.toFixed(2)

  const posten = zahlungen.map((z, i) => `
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${xmlText(sepaZeichen(`GEHALT-${i + 1}-${z.name}`).slice(0, 35))}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${betrag(z.betrag)}</InstdAmt></Amt>${z.bic ? `
        <CdtrAgt><FinInstnId><BIC>${xmlText(z.bic.toUpperCase())}</BIC></FinInstnId></CdtrAgt>` : ''}
        <Cdtr><Nm>${xmlText(sepaZeichen(z.name).slice(0, 70))}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${xmlText(z.iban.replace(/\s+/g, '').toUpperCase())}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${xmlText(sepaZeichen(z.verwendungszweck).slice(0, 140))}</Ustrd></RmtInf>
      </CdtTrfTxInf>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${xmlText(nachrichtId)}</MsgId>
      <CreDtTm>${jetzt}</CreDtTm>
      <NbOfTxs>${zahlungen.length}</NbOfTxs>
      <CtrlSum>${betrag(summe)}</CtrlSum>
      <InitgPty><Nm>${xmlText(sepaZeichen(auftraggeber.name).slice(0, 70))}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${xmlText(nachrichtId)}-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${zahlungen.length}</NbOfTxs>
      <CtrlSum>${betrag(summe)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${ausfuehrungsdatum}</ReqdExctnDt>
      <Dbtr><Nm>${xmlText(sepaZeichen(auftraggeber.name).slice(0, 70))}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${xmlText(auftraggeber.iban.replace(/\s+/g, '').toUpperCase())}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId>${auftraggeber.bic
        ? `<BIC>${xmlText(auftraggeber.bic.toUpperCase())}</BIC>`
        : '<Othr><Id>NOTPROVIDED</Id></Othr>'}</FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${posten}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`
}
