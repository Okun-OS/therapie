/**
 * §125 Jahresübersicht für den Mitarbeiter.
 *
 * Sie heißt bewusst „Jahresübersicht" und nicht „Lohnsteuerbescheinigung":
 * Solange wir nicht selbst an die Finanzverwaltung übermitteln, gibt es keinen
 * gültigen Ausdruck der elektronischen Lohnsteuerbescheinigung. Ein Papier, das
 * so aussieht, wäre eine Behauptung, die wir nicht halten können.
 *
 * Was drinsteht, ist trotzdem genau das, was der Mitarbeiter braucht: was er im
 * Jahr verdient hat, was abgezogen wurde, und der Hinweis, woher die amtliche
 * Bescheinigung kommt.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { euro } from './lohnbeleg'
import { bescheinigungsZeilen, zeitraumText, type JahresWerte } from './jahresabschluss'

export interface JahresbelegArbeitgeber {
  name: string
  strasse?: string | null
  plz?: string | null
  ort?: string | null
  steuernummer?: string | null
}

export interface JahresbelegArbeitnehmer {
  name: string
  personalnummer?: string | null
  steuerId?: string | null
  strasse?: string | null
  plz?: string | null
  ort?: string | null
}

export async function erzeugeJahresbeleg(
  arbeitgeber: JahresbelegArbeitgeber,
  arbeitnehmer: JahresbelegArbeitnehmer,
  werte: JahresWerte,
): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const seite = pdf.addPage([595.28, 841.89])   // A4
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold)

  const RAND = 50
  const BREITE = 495.28
  const tinte = rgb(0.07, 0.09, 0.15)
  const grau = rgb(0.45, 0.47, 0.52)

  let y = 792

  const text = (s: string, x = RAND, groesse = 9, font = normal, farbe = tinte) =>
    seite.drawText(s, { x, y, size: groesse, font, color: farbe })
  const rechts = (s: string, xRechts: number, groesse = 9, font = normal, farbe = tinte) =>
    seite.drawText(s, {
      x: xRechts - font.widthOfTextAtSize(s, groesse), y, size: groesse, font, color: farbe,
    })
  const trennlinie = (dicke = 1.2, farbe = tinte) => {
    seite.drawLine({
      start: { x: RAND, y }, end: { x: RAND + BREITE, y },
      thickness: dicke, color: farbe,
    })
  }

  // ── Kopf ─────────────────────────────────────────────────────────────────
  text('Jahresübersicht', RAND, 18, fett)
  rechts(String(werte.jahr), RAND + BREITE, 12, fett, grau)
  y -= 22
  trennlinie()
  y -= 16

  text('ARBEITGEBER', RAND, 7, fett, grau)
  text('ARBEITNEHMER', RAND + BREITE / 2, 7, fett, grau)
  y -= 13
  const agZeilen = [
    arbeitgeber.name,
    [arbeitgeber.strasse, [arbeitgeber.plz, arbeitgeber.ort].filter(Boolean).join(' ')]
      .filter(Boolean).join(', '),
    arbeitgeber.steuernummer ? `Steuernummer ${arbeitgeber.steuernummer}` : '',
  ].filter(Boolean)
  const anZeilen = [
    arbeitnehmer.name,
    [arbeitnehmer.strasse, [arbeitnehmer.plz, arbeitnehmer.ort].filter(Boolean).join(' ')]
      .filter(Boolean).join(', '),
    arbeitnehmer.personalnummer ? `Personalnummer ${arbeitnehmer.personalnummer}` : '',
    arbeitnehmer.steuerId ? `Steuer-ID ${arbeitnehmer.steuerId}` : '',
  ].filter(Boolean)
  const hoehe = Math.max(agZeilen.length, anZeilen.length)
  for (let i = 0; i < hoehe; i++) {
    if (agZeilen[i]) text(agZeilen[i], RAND, 9, i === 0 ? fett : normal)
    if (anZeilen[i]) text(anZeilen[i], RAND + BREITE / 2, 9, i === 0 ? fett : normal)
    y -= 12
  }

  y -= 6
  text('Bescheinigungszeitraum', RAND, 7, fett, grau)
  y -= 11
  text(zeitraumText(werte), RAND, 10, fett)
  rechts(`${werte.svTageGesamt} SV-Tage`, RAND + BREITE, 9, normal, grau)
  y -= 20
  trennlinie(0.8, grau)
  y -= 16

  // ── Die Werte ────────────────────────────────────────────────────────────
  const SP = RAND + BREITE
  text('JAHRESWERTE', RAND, 7, fett, grau)
  y -= 15

  for (const zeile of bescheinigungsZeilen(werte)) {
    text(zeile.bezeichnung, RAND)
    rechts(`${euro(zeile.betrag)} EUR`, SP)
    y -= 14
  }

  // Steuerfreie Zuschläge gehören nicht in den Bruttoarbeitslohn — aber der
  // Mitarbeiter hat sie bekommen und soll sie wiederfinden.
  if (werte.steuerfreieZuschlaege > 0) {
    y -= 4
    text('Steuerfreie Zuschläge (§3b EStG, nicht im Bruttoarbeitslohn)', RAND, 8, normal, grau)
    rechts(`${euro(werte.steuerfreieZuschlaege)} EUR`, SP, 8, normal, grau)
    y -= 13
  }
  if (werte.pauschalVersteuert > 0) {
    text('Pauschal versteuerter Arbeitslohn (§40a EStG, nicht bescheinigt)', RAND, 8, normal, grau)
    rechts(`${euro(werte.pauschalVersteuert)} EUR`, SP, 8, normal, grau)
    y -= 13
  }

  y -= 6
  trennlinie(0.8, grau)
  y -= 14
  text('Ausgezahlt insgesamt', RAND, 10, fett)
  rechts(
    `${euro(werte.gesamtbrutto - werte.lohnsteuer - werte.kirchensteuer - werte.soli
      - werte.rvAN - werte.kvAN - werte.pvAN - werte.avAN)} EUR`,
    SP, 12, fett,
  )
  y -= 24

  // ── Hinweise ─────────────────────────────────────────────────────────────
  if (werte.hinweise.length > 0) {
    text('HINWEISE', RAND, 7, fett, grau)
    y -= 13
    for (const h of werte.hinweise) {
      for (const zeile of umbrechen(h, 95)) {
        text(zeile, RAND, 8, normal, grau)
        y -= 11
      }
      y -= 2
    }
  }

  // ── Fuß ──────────────────────────────────────────────────────────────────
  // §125 Der wichtigste Satz auf diesem Papier: es ist keine Bescheinigung.
  seite.drawText(
    'Diese Übersicht ist KEINE Lohnsteuerbescheinigung. Die elektronische',
    { x: RAND, y: RAND + 22, size: 7.5, font: fett, color: tinte },
  )
  seite.drawText(
    'Lohnsteuerbescheinigung wird von der Lohnbuchhaltung an die Finanzverwaltung übermittelt;',
    { x: RAND, y: RAND + 12, size: 7.5, font: normal, color: grau },
  )
  seite.drawText(
    'den Ausdruck davon erhalten Sie von dort. Erstellt mit OKUN Workforce, maschinell erzeugt.',
    { x: RAND, y: RAND + 2, size: 7.5, font: normal, color: grau },
  )

  return Buffer.from(await pdf.save())
}

/** Text auf eine Zeilenlänge umbrechen, ohne Wörter zu zerreißen. */
function umbrechen(text: string, zeichen: number): string[] {
  const woerter = text.split(' ')
  const zeilen: string[] = []
  let aktuell = ''
  for (const wort of woerter) {
    if ((aktuell + ' ' + wort).trim().length > zeichen) {
      if (aktuell) zeilen.push(aktuell)
      aktuell = wort
    } else {
      aktuell = (aktuell + ' ' + wort).trim()
    }
  }
  if (aktuell) zeilen.push(aktuell)
  return zeilen
}

/** Dateiname der Jahresübersicht. */
export function jahresbelegDateiname(jahr: number, name: string): string {
  const kurz = name.replace(/[^A-Za-zÄÖÜäöüß ]/g, '').trim().replace(/\s+/g, '-')
  return `Jahresuebersicht-${jahr}-${kurz}.pdf`
}
