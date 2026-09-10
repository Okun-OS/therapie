/**
 * §113 Entgeltabrechnung als PDF.
 *
 * Bis hierher wurde gerechnet, aber kein Beleg erzeugt — der Mitarbeiter bekam
 * nie etwas in die Hand. Diese Datei erzeugt die Abrechnung als PDF; abgelegt
 * wird sie über die Personalakte, wo Lohnabrechnungen für den Mitarbeiter
 * ohnehin freigegeben sind.
 *
 * Inhalt nach §108 GewO in Verbindung mit der Entgeltbescheinigungsverordnung:
 * Angaben zu Arbeitgeber und Arbeitnehmer, Abrechnungszeitraum, Steuer- und
 * Sozialversicherungsmerkmale, Bruttobezüge, gesetzliche Abzüge einzeln
 * ausgewiesen, Nettoentgelt und Auszahlungsbetrag.
 *
 * Was hier bewusst NICHT passiert: eine Meldung an Finanzamt oder
 * Sozialversicherung. Das braucht zertifizierte Übermittlungswege (ELSTER,
 * ITSG) und läuft über den Steuerberater — dafür gibt es den DATEV-Export.
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'

export interface BelegArbeitgeber {
  name: string
  strasse?: string | null
  plz?: string | null
  ort?: string | null
  betriebsnummer?: string | null
  steuernummer?: string | null
}

export interface BelegArbeitnehmer {
  name: string
  strasse?: string | null
  plz?: string | null
  ort?: string | null
  geburtsdatum?: string | null
  personalnummer?: string | null
  eintrittsdatum?: string | null
  steuerId?: string | null
  steuerklasse?: number | null
  kinderfreibetraege?: number | null
  konfession?: string | null
  sozialversicherungsnummer?: string | null
  krankenkasse?: string | null
  versicherungsart?: string | null
  iban?: string | null
}

export interface BelegAbrechnung {
  jahr: number
  monat: number
  brutto: number
  surchargesTotal: number
  steuerfreieZuschlaege?: number
  /** Woher die Rechengrößen stammen — gehört auf den Beleg, nicht nur ins Log. */
  grundlage?: string
  steuerBrutto?: number
  svBrutto?: number
  regularHours: number
  overtimeHours: number
  lohnsteuer: number
  kirchensteuer: number
  soli: number
  rvAN: number
  kvAN: number
  pvAN: number
  avAN: number
  totalDeductions: number
  netto: number
  rvAG: number
  kvAG: number
  pvAG: number
  avAG: number
  totalAgCost: number
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const KONFESSION: Record<string, string> = {
  keine: 'keine', ev: 'evangelisch', rk: 'römisch-katholisch', sonstige: 'sonstige',
}

/** Betrag in deutscher Schreibweise, z.B. 3.400,00 */
export function euro(betrag: number): string {
  return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function datum(iso?: string | null): string {
  if (!iso) return '—'
  const [j, m, t] = iso.split('-')
  return t && m && j ? `${t}.${m}.${j}` : iso
}

/** Kürzt Text, der sonst über den Rand liefe. */
function passend(text: string, font: PDFFont, groesse: number, breite: number): string {
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(t, groesse) > breite) t = t.slice(0, -1)
  return t.length < text.length ? t.slice(0, -1) + '…' : t
}

export async function erzeugeLohnbeleg(
  arbeitgeber: BelegArbeitgeber,
  arbeitnehmer: BelegArbeitnehmer,
  abrechnung: BelegAbrechnung,
): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Entgeltabrechnung ${MONATE[abrechnung.monat - 1]} ${abrechnung.jahr} — ${arbeitnehmer.name}`)
  pdf.setProducer('OKUN Workforce')

  const seite = pdf.addPage([595.28, 841.89]) // DIN A4
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold)

  const RAND = 50
  const BREITE = 595.28 - RAND * 2
  const tinte = rgb(0.07, 0.09, 0.15)
  const grau = rgb(0.45, 0.47, 0.52)
  const linie = rgb(0.82, 0.83, 0.86)
  let y = 841.89 - RAND

  const text = (s: string, x: number, groesse = 9, font = normal, farbe = tinte) =>
    seite.drawText(s, { x, y, size: groesse, font, color: farbe })

  const rechts = (s: string, xRechts: number, groesse = 9, font = normal, farbe = tinte) =>
    seite.drawText(s, { x: xRechts - font.widthOfTextAtSize(s, groesse), y, size: groesse, font, color: farbe })

  const trennlinie = (staerke = 0.5, farbe = linie) => {
    seite.drawLine({
      start: { x: RAND, y: y + 4 }, end: { x: RAND + BREITE, y: y + 4 },
      thickness: staerke, color: farbe,
    })
  }

  // ── Kopf ─────────────────────────────────────────────────────────────────
  text('Entgeltabrechnung', RAND, 18, fett)
  rechts(`${MONATE[abrechnung.monat - 1]} ${abrechnung.jahr}`, RAND + BREITE, 12, fett, grau)
  y -= 26
  trennlinie(1.2, tinte)
  y -= 20

  // ── Arbeitgeber und Arbeitnehmer nebeneinander ───────────────────────────
  const SPALTE2 = RAND + BREITE / 2 + 10
  const kopfY = y

  text('ARBEITGEBER', RAND, 7, fett, grau)
  y -= 13
  text(passend(arbeitgeber.name, fett, 10, BREITE / 2 - 20), RAND, 10, fett)
  y -= 12
  if (arbeitgeber.strasse) { text(arbeitgeber.strasse, RAND); y -= 11 }
  if (arbeitgeber.plz || arbeitgeber.ort) { text(`${arbeitgeber.plz ?? ''} ${arbeitgeber.ort ?? ''}`.trim(), RAND); y -= 11 }
  if (arbeitgeber.betriebsnummer) { text(`Betriebsnummer ${arbeitgeber.betriebsnummer}`, RAND, 8, normal, grau); y -= 10 }
  if (arbeitgeber.steuernummer) { text(`Steuernummer ${arbeitgeber.steuernummer}`, RAND, 8, normal, grau); y -= 10 }
  const endeLinks = y

  y = kopfY
  text('ARBEITNEHMER', SPALTE2, 7, fett, grau)
  y -= 13
  text(passend(arbeitnehmer.name, fett, 10, BREITE / 2 - 20), SPALTE2, 10, fett)
  y -= 12
  if (arbeitnehmer.strasse) { text(arbeitnehmer.strasse, SPALTE2); y -= 11 }
  if (arbeitnehmer.plz || arbeitnehmer.ort) { text(`${arbeitnehmer.plz ?? ''} ${arbeitnehmer.ort ?? ''}`.trim(), SPALTE2); y -= 11 }
  if (arbeitnehmer.personalnummer) { text(`Personalnummer ${arbeitnehmer.personalnummer}`, SPALTE2, 8, normal, grau); y -= 10 }
  if (arbeitnehmer.geburtsdatum) { text(`geboren am ${datum(arbeitnehmer.geburtsdatum)}`, SPALTE2, 8, normal, grau); y -= 10 }
  if (arbeitnehmer.eintrittsdatum) { text(`Eintritt ${datum(arbeitnehmer.eintrittsdatum)}`, SPALTE2, 8, normal, grau); y -= 10 }

  y = Math.min(endeLinks, y) - 14
  trennlinie()
  y -= 16

  // ── Steuer- und Sozialversicherungsmerkmale ──────────────────────────────
  text('BESTEUERUNG UND SOZIALVERSICHERUNG', RAND, 7, fett, grau)
  y -= 14

  const merkmale: [string, string][] = [
    ['Steuerklasse', arbeitnehmer.steuerklasse ? String(arbeitnehmer.steuerklasse) : '—'],
    ['Kinderfreibeträge', arbeitnehmer.kinderfreibetraege != null ? String(arbeitnehmer.kinderfreibetraege) : '—'],
    ['Konfession', KONFESSION[arbeitnehmer.konfession ?? ''] ?? '—'],
    ['Steuer-ID', arbeitnehmer.steuerId ?? '—'],
    ['SV-Nummer', arbeitnehmer.sozialversicherungsnummer ?? '—'],
    ['Krankenkasse', arbeitnehmer.versicherungsart === 'PKV' ? 'privat versichert' : (arbeitnehmer.krankenkasse ?? '—')],
  ]
  for (let i = 0; i < merkmale.length; i += 3) {
    const zeile = merkmale.slice(i, i + 3)
    zeile.forEach(([label, wert], j) => {
      const x = RAND + j * (BREITE / 3)
      seite.drawText(label, { x, y, size: 7, font: normal, color: grau })
      seite.drawText(passend(wert, fett, 9, BREITE / 3 - 12), { x, y: y - 11, size: 9, font: fett, color: tinte })
    })
    y -= 26
  }
  y -= 2
  trennlinie()
  y -= 16

  // ── Bezüge ───────────────────────────────────────────────────────────────
  const SP_BETRAG = RAND + BREITE

  text('BEZÜGE', RAND, 7, fett, grau)
  y -= 15

  const grundlohn = abrechnung.brutto - abrechnung.surchargesTotal
  const posten: [string, number, string?][] = [
    ['Grundentgelt', grundlohn, abrechnung.regularHours ? `${euro(abrechnung.regularHours)} Std.` : undefined],
  ]
  const steuerfrei = abrechnung.steuerfreieZuschlaege ?? 0
  if (abrechnung.surchargesTotal > 0) {
    // §3b EStG verlangt, dass der steuerfreie Anteil erkennbar ist — sonst kann
    // niemand nachvollziehen, warum weniger versteuert wurde als ausgezahlt.
    posten.push(['Zuschläge', abrechnung.surchargesTotal])
    if (steuerfrei > 0) posten.push(['davon steuerfrei (§3b EStG)', steuerfrei])
  }
  if (abrechnung.overtimeHours > 0) posten.push(['davon Überstunden', 0, `${euro(abrechnung.overtimeHours)} Std.`])

  for (const [label, betrag, zusatz] of posten) {
    text(label, RAND)
    if (zusatz) seite.drawText(zusatz, { x: RAND + 180, y, size: 8, font: normal, color: grau })
    if (betrag > 0) rechts(euro(betrag), SP_BETRAG)
    y -= 14
  }

  y -= 2
  trennlinie(0.8, grau)
  y -= 13
  text('Gesamtbrutto', RAND, 10, fett)
  rechts(`${euro(abrechnung.brutto)} EUR`, SP_BETRAG, 10, fett)
  y -= 14
  if (steuerfrei > 0) {
    text('Steuerpflichtiges Brutto', RAND, 8, normal, grau)
    rechts(`${euro(abrechnung.steuerBrutto ?? abrechnung.brutto)} EUR`, SP_BETRAG, 8, normal, grau)
    y -= 12
    text('Beitragspflichtiges Brutto', RAND, 8, normal, grau)
    rechts(`${euro(abrechnung.svBrutto ?? abrechnung.brutto)} EUR`, SP_BETRAG, 8, normal, grau)
    y -= 12
  }
  y -= 6

  // ── Gesetzliche Abzüge ───────────────────────────────────────────────────
  text('GESETZLICHE ABZÜGE', RAND, 7, fett, grau)
  y -= 15

  const abzuege: [string, number][] = [
    ['Lohnsteuer', abrechnung.lohnsteuer],
    ['Kirchensteuer', abrechnung.kirchensteuer],
    ['Solidaritätszuschlag', abrechnung.soli],
    ['Rentenversicherung', abrechnung.rvAN],
    ['Krankenversicherung', abrechnung.kvAN],
    ['Pflegeversicherung', abrechnung.pvAN],
    ['Arbeitslosenversicherung', abrechnung.avAN],
  ]
  for (const [label, betrag] of abzuege) {
    if (betrag <= 0) continue
    text(label, RAND)
    // §113 Bewusst der einfache Bindestrich: das typografische Minuszeichen
    // (U+2212) laesst sich in der PDF-Standardschrift nicht darstellen.
    rechts(`- ${euro(betrag)}`, SP_BETRAG)
    y -= 14
  }

  y -= 2
  trennlinie(0.8, grau)
  y -= 13
  text('Summe der Abzüge', RAND, 10, fett)
  rechts(`- ${euro(abrechnung.totalDeductions)} EUR`, SP_BETRAG, 10, fett)
  y -= 22

  // ── Auszahlung ───────────────────────────────────────────────────────────
  seite.drawRectangle({
    x: RAND - 8, y: y - 10, width: BREITE + 16, height: 32,
    color: rgb(0.95, 0.96, 0.97),
  })
  y += 4
  text('Auszahlungsbetrag', RAND, 12, fett)
  rechts(`${euro(abrechnung.netto)} EUR`, SP_BETRAG, 14, fett)
  y -= 14
  if (arbeitnehmer.iban) {
    text(`Überweisung auf ${arbeitnehmer.iban}`, RAND, 8, normal, grau)
  }
  y -= 30

  // ── Arbeitgeberanteile (nachrichtlich) ───────────────────────────────────
  text('ARBEITGEBERANTEILE (nachrichtlich, kein Abzug)', RAND, 7, fett, grau)
  y -= 14
  const ag: [string, number][] = [
    ['Rentenversicherung', abrechnung.rvAG],
    ['Krankenversicherung', abrechnung.kvAG],
    ['Pflegeversicherung', abrechnung.pvAG],
    ['Arbeitslosenversicherung', abrechnung.avAG],
  ]
  for (const [label, betrag] of ag) {
    if (betrag <= 0) continue
    text(label, RAND, 8, normal, grau)
    rechts(euro(betrag), SP_BETRAG, 8, normal, grau)
    y -= 12
  }
  y -= 2
  text('Gesamtaufwand des Arbeitgebers', RAND, 9, fett, grau)
  rechts(`${euro(abrechnung.totalAgCost)} EUR`, SP_BETRAG, 9, fett, grau)

  // ── Fuß ──────────────────────────────────────────────────────────────────
  // §116 Die Rechtsgrundlage gehört auf den Beleg. Wer die Abrechnung prüft,
  // muss ohne Rückfrage sehen, nach welchem Stand gerechnet wurde.
  seite.drawText(
    'Lohnsteuer nach dem amtlichen Programmablaufplan des BMF'
    + (abrechnung.grundlage ? ` · ${abrechnung.grundlage.split(' · geprüft')[0]}` : ''),
    { x: RAND, y: RAND - 2, size: 7, font: normal, color: grau },
  )
  seite.drawText(
    'Erstellt mit OKUN Workforce. Diese Abrechnung ist maschinell erzeugt und ohne Unterschrift gültig.',
    { x: RAND, y: RAND - 12, size: 7, font: normal, color: grau },
  )

  return Buffer.from(await pdf.save())
}

/** Dateiname der Abrechnung — sortiert sich in der Akte von selbst. */
export function belegDateiname(jahr: number, monat: number, name: string): string {
  const kurz = name.replace(/[^A-Za-zÄÖÜäöüß ]/g, '').trim().replace(/\s+/g, '-')
  return `Entgeltabrechnung-${jahr}-${String(monat).padStart(2, '0')}-${kurz}.pdf`
}
