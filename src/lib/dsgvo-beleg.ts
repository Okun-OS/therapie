/**
 * §128 Die beiden Papiere zum Datenschutz.
 *
 *   AUSKUNFT       Was wir über Sie gespeichert haben (Art.15 DSGVO).
 *   LÖSCHBERICHT   Was entfernt wurde — und was bleiben musste (Art.17/18).
 *
 * Warum überhaupt ein PDF, wenn es die Daten auch als Datei gibt: Eine Auskunft
 * ist an einen Menschen gerichtet, nicht an ein Programm. Wer nach dreißig
 * Jahren Arbeit fragt, was über ihn gespeichert ist, bekommt sonst eine
 * JSON-Datei — formal richtig und praktisch wertlos.
 *
 * Deshalb die Arbeitsteilung: Das PDF erklärt in Sätzen, welche Arten von Daten
 * es gibt, wie viele Einträge, wie lange sie bleiben und warum. Die vollständigen
 * Einzeldaten liegen daneben als Datei — maschinenlesbar, wie es Art.20 DSGVO
 * für die Datenübertragbarkeit verlangt. Das PDF sagt das auch ausdrücklich, damit
 * niemand glaubt, die Auskunft sei unvollständig.
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { BEHANDLUNG_TEXT } from './dsgvo-katalog'
import type { Auskunft } from './dsgvo-auskunft'
import type { Loeschbericht } from './dsgvo-loeschung'

export interface BelegAbsender {
  name: string
  strasse?: string | null
  plz?: string | null
  ort?: string | null
}

const RAND = 50
const BREITE = 495.28
const OBEN = 792
const UNTEN = 60

/** Ein Satz von Werkzeugen, der über Seitenumbrüche hinweg weiterschreibt. */
function blatt(pdf: PDFDocument, normal: PDFFont, fett: PDFFont) {
  const tinte = rgb(0.07, 0.09, 0.15)
  const grau = rgb(0.45, 0.47, 0.52)
  let seite: PDFPage = pdf.addPage([595.28, 841.89])
  let y = OBEN

  /** Platz für die nächsten Zeilen schaffen — notfalls auf einer neuen Seite. */
  function platz(hoehe: number) {
    if (y - hoehe < UNTEN) {
      seite = pdf.addPage([595.28, 841.89])
      y = OBEN
    }
  }

  function text(s: string, x = RAND, groesse = 9, font = normal, farbe = tinte) {
    seite.drawText(s, { x, y, size: groesse, font, color: farbe })
  }

  function rechts(s: string, xRechts: number, groesse = 9, font = normal, farbe = tinte) {
    seite.drawText(s, {
      x: xRechts - font.widthOfTextAtSize(s, groesse), y, size: groesse, font, color: farbe,
    })
  }

  function linie(dicke = 1.2, farbe = tinte) {
    seite.drawLine({
      start: { x: RAND, y }, end: { x: RAND + BREITE, y }, thickness: dicke, color: farbe,
    })
  }

  /** Fließtext mit Umbruch — und Seitenumbruch, wenn er nicht mehr passt. */
  function absatz(s: string, groesse = 9, font = normal, farbe = tinte, breite = BREITE) {
    const woerter = s.split(' ')
    let zeile = ''
    for (const wort of woerter) {
      const versuch = zeile ? `${zeile} ${wort}` : wort
      if (font.widthOfTextAtSize(versuch, groesse) > breite && zeile) {
        platz(groesse + 3)
        text(zeile, RAND, groesse, font, farbe)
        y -= groesse + 3
        zeile = wort
      } else {
        zeile = versuch
      }
    }
    if (zeile) {
      platz(groesse + 3)
      text(zeile, RAND, groesse, font, farbe)
      y -= groesse + 3
    }
  }

  return {
    tinte, grau,
    get y() { return y },
    set y(wert: number) { y = wert },
    platz, text, rechts, linie, absatz,
  }
}

function kopf(
  b: ReturnType<typeof blatt>, fett: PDFFont, titel: string, absender: BelegAbsender,
) {
  b.text(titel, RAND, 18, fett)
  b.y -= 22
  b.linie()
  b.y -= 16
  b.text(absender.name, RAND, 9, fett)
  b.y -= 12
  const anschrift = [
    absender.strasse, [absender.plz, absender.ort].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')
  if (anschrift) { b.text(anschrift, RAND, 9, undefined, b.grau); b.y -= 12 }
  b.y -= 6
}

const datum = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.')

// ── Auskunft ───────────────────────────────────────────────────────────────

export async function erzeugeAuskunftsbeleg(
  auskunft: Auskunft,
  absender: BelegAbsender,
  datenDateiname?: string,
): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold)
  const b = blatt(pdf, normal, fett)

  kopf(b, fett, 'Auskunft über Ihre Daten', absender)

  b.text('FÜR', RAND, 7, fett, b.grau)
  b.rechts(`Erstellt am ${datum(auskunft.erstelltAm)}`, RAND + BREITE, 8, normal, b.grau)
  b.y -= 13
  b.text(auskunft.person.name, RAND, 12, fett)
  b.y -= 14
  const angaben = [
    auskunft.person.personalnummer ? `Personalnummer ${auskunft.person.personalnummer}` : '',
    auskunft.person.eingetretenAm ? `eingetreten am ${datum(auskunft.person.eingetretenAm)}` : '',
    auskunft.person.ausgetretenAm ? `ausgetreten am ${datum(auskunft.person.ausgetretenAm)}` : '',
    auskunft.person.standort ?? '',
  ].filter(Boolean).join(' · ')
  if (angaben) { b.text(angaben, RAND, 8, normal, b.grau); b.y -= 14 }

  b.y -= 4
  b.linie(0.8, b.grau)
  b.y -= 16

  b.absatz(
    'Sie haben nach Artikel 15 der Datenschutz-Grundverordnung das Recht zu erfahren, '
    + 'welche Daten wir über Sie gespeichert haben, wozu wir sie verwenden und wie lange '
    + 'wir sie aufbewahren. Diese Auskunft beantwortet das.',
  )
  b.y -= 6

  b.text('WAS WIR ÜBER SIE GESPEICHERT HABEN', RAND, 7, fett, b.grau)
  b.y -= 15

  for (const block of auskunft.bloecke) {
    b.platz(58)
    b.text(block.bezeichnung, RAND, 10, fett)
    b.rechts(
      block.anzahl === 1 ? '1 Eintrag' : `${block.anzahl} Einträge`,
      RAND + BREITE, 9, normal, b.grau,
    )
    b.y -= 13
    b.absatz(block.beschreibung, 8, normal, b.grau)
    if (block.aufbewahrungBis) {
      b.absatz(
        `Aufbewahrung bis ${datum(block.aufbewahrungBis)}`
        + (block.grundlage ? ` — ${block.grundlage}` : ''),
        8, normal, b.grau,
      )
    }
    b.y -= 8
  }

  if (auskunft.ohneDaten.length > 0) {
    b.platz(40)
    b.y -= 4
    b.text('WOZU ES NICHTS GIBT', RAND, 7, fett, b.grau)
    b.y -= 13
    b.absatz(
      'Zu diesen Bereichen sind keine Daten über Sie gespeichert: '
      + auskunft.ohneDaten.join(', ') + '.',
      8, normal, b.grau,
    )
    b.y -= 8
  }

  b.platz(60)
  b.linie(0.8, b.grau)
  b.y -= 16
  b.text('HINWEISE', RAND, 7, fett, b.grau)
  b.y -= 13
  for (const hinweis of auskunft.hinweise) {
    b.absatz(hinweis, 8, normal, b.grau)
    b.y -= 3
  }

  if (datenDateiname) {
    b.y -= 3
    b.absatz(
      `Die vollständigen Einzeldaten liegen dieser Auskunft als Datei „${datenDateiname}" `
      + 'bei. Sie enthält jeden einzelnen Eintrag in einem Format, das Sie auch an einen '
      + 'anderen Anbieter weitergeben können (Artikel 20 DSGVO).',
      8, normal, b.grau,
    )
  }

  b.y -= 6
  b.absatz(
    'Wenn Sie meinen, dass Daten falsch sind, können Sie deren Berichtigung verlangen '
    + '(Artikel 16 DSGVO). Über die Löschung Ihrer Daten informiert Sie der Löschbericht, '
    + 'den Sie nach Ihrem Ausscheiden erhalten.',
    8, normal, b.grau,
  )

  return Buffer.from(await pdf.save())
}

// ── Löschbericht ───────────────────────────────────────────────────────────

export async function erzeugeLoeschbeleg(
  bericht: Loeschbericht,
  absender: BelegAbsender,
): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold)
  const b = blatt(pdf, normal, fett)

  kopf(b, fett, 'Löschbericht', absender)

  b.text('BETRIFFT', RAND, 7, fett, b.grau)
  b.rechts(`Ausgeführt am ${datum(bericht.ausgefuehrtAm)}`, RAND + BREITE, 8, normal, b.grau)
  b.y -= 13
  b.text(bericht.name, RAND, 12, fett)
  b.y -= 14
  const kopfzeile = [
    bericht.ausgetretenAm ? `ausgetreten am ${datum(bericht.ausgetretenAm)}` : '',
    `veranlasst von ${bericht.ausgefuehrtVon}`,
    bericht.art === 'aufraeumen' ? 'abgelaufene Aufbewahrungsfrist' : 'Löschung nach Austritt',
  ].filter(Boolean).join(' · ')
  b.text(kopfzeile, RAND, 8, normal, b.grau)
  b.y -= 18
  b.linie(0.8, b.grau)
  b.y -= 16

  b.absatz(
    'Löschen heißt nicht in jedem Fall: alles weg. Lohn- und Steuerunterlagen müssen '
    + 'gesetzlich aufbewahrt werden; sie zu löschen wäre nicht erlaubt. Solche Daten '
    + 'werden stattdessen gesperrt (Artikel 18 DSGVO) und nur noch für den Zweck '
    + 'verwendet, für den das Gesetz sie verlangt. Dieser Bericht sagt für jeden Bereich, '
    + 'was geschehen ist.',
  )
  b.y -= 10

  const ERGEBNIS: Record<string, string> = {
    geloescht: 'gelöscht',
    anonymisiert: 'anonymisiert',
    gesperrt: 'gesperrt',
    nichts: 'nichts vorhanden',
  }

  for (const zeile of bericht.zeilen) {
    b.platz(56)
    b.text(zeile.bezeichnung, RAND, 10, fett)
    const rechtsText = zeile.anzahl > 0
      ? `${zeile.anzahl} ${zeile.anzahl === 1 ? 'Eintrag' : 'Einträge'} ${ERGEBNIS[zeile.ergebnis]}`
      : ERGEBNIS.nichts
    b.rechts(rechtsText, RAND + BREITE, 9, fett,
      zeile.ergebnis === 'gesperrt' ? b.tinte : b.grau)
    b.y -= 13
    if (zeile.ergebnis === 'gesperrt') {
      b.absatz(zeile.begruendung, 8, normal, b.grau)
      if (zeile.aufbewahrungBis) {
        b.absatz(`Wird gelöscht nach dem ${datum(zeile.aufbewahrungBis)}.`, 8, normal, b.grau)
      }
    } else if (zeile.ergebnis === 'anonymisiert') {
      b.absatz(zeile.begruendung, 8, normal, b.grau)
    }
    b.y -= 6
  }

  b.platz(80)
  b.y -= 4
  b.linie(0.8, b.grau)
  b.y -= 16
  b.text('ERGEBNIS', RAND, 7, fett, b.grau)
  b.y -= 14

  if (bericht.person === 'geloescht') {
    b.absatz(
      'Es bestanden keine Aufbewahrungspflichten mehr. Sämtliche Daten wurden entfernt, '
      + 'auch der Personaldatensatz selbst. Erhalten bleibt allein dieser Bericht — er '
      + 'weist nach, dass gelöscht wurde, und enthält keine weiteren Angaben zur Person.',
      9, normal,
    )
  } else {
    b.absatz(
      'Alles, was nicht aufbewahrt werden muss, ist entfernt. Was bleibt, ist gesperrt: '
      + 'Es wird nicht mehr ausgewertet, erscheint in keiner Übersicht und wird nur noch '
      + 'auf Verlangen von Finanzamt, Rentenversicherung oder auf Ihren eigenen Wunsch '
      + 'herangezogen.',
      9, normal,
    )
    if (bericht.restlosAb) {
      b.y -= 4
      b.absatz(
        `Nach dem ${datum(bericht.restlosAb)} sind alle Fristen abgelaufen. Dann wird auch `
        + 'der Rest gelöscht.',
        9, normal, undefined,
      )
    }
  }

  b.y -= 10
  b.absatz(
    'Dieser Bericht wird aufbewahrt, um gegenüber der Aufsichtsbehörde nachweisen zu '
    + 'können, dass ordnungsgemäß gelöscht wurde (Artikel 5 Absatz 2 DSGVO).',
    8, normal, b.grau,
  )

  return Buffer.from(await pdf.save())
}
