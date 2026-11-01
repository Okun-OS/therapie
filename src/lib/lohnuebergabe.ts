/**
 * §275 Die Übergabe ans Lohnbüro.
 *
 * WOZU
 * Der Betrieb behält sein Lohnprogramm. Was er am Monatsende braucht, sind
 * die Zahlen daraus: Stunden, Mehrarbeit, Zuschläge, Fehltage — je Person,
 * je Monat, in einer Datei, die sich einlesen lässt statt abgetippt zu
 * werden.
 *
 * WAS DIESES MODUL NICHT TUT
 * Rechnen. Die Zahlen kommen aus `monatsGrundlagen()`, also aus derselben
 * Quelle, aus der auch eine Abrechnung entstünde. Hier wird nur noch
 * umgeformt. Das ist Absicht: Eine zweite Rechnung neben der ersten wäre
 * eine zweite Wahrheit.
 *
 * WARUM NICHT DER EXPORT, DEN ES SCHON GAB
 * Auf der Zuschlagsseite lag ein CSV-Knopf. Was er erzeugte, war zum
 * Ansehen gedacht und fürs Lohnbüro unbrauchbar — nachgesehen am
 * 01.11.2026:
 *
 *   — keine Personalnummer, nur der Name. Jedes Lohnprogramm ordnet über
 *     die Personalnummer zu; zwei „M. Müller" sind nicht dasselbe.
 *   — „480min / 120.00€" in EINER Zelle. Das ist keine Zahl, das ist ein
 *     Satz. Weder Excel noch DATEV können damit rechnen.
 *   — steuerfrei und steuerpflichtig nicht getrennt. Ein Lohnbüro bucht
 *     beides auf verschiedene Lohnarten; zusammengeworfen muss es die
 *     Trennung selbst nachbauen — und zwar aus Zahlen, die es nicht hat.
 *   — keine Abwesenheiten. Urlaub und Krankheit entscheiden über
 *     Entgeltfortzahlung; ohne sie ist der Monat nicht abzurechnen.
 *   — Komma als Trennzeichen bei deutschen Dezimalzahlen. Eine deutsche
 *     Excel-Installation zerlegt das in die falschen Spalten.
 *
 * Dieses Modul erzeugt deshalb etwas anderes, und der alte Knopf bleibt, wo
 * er ist: Die Übersicht am Bildschirm hat ihren eigenen Zweck.
 */

import type { MonatsGrundlage } from './payroll-monat'
import { zuschlagSteuerfrei } from './zuschlag-steuerfrei'

export interface UebergabePerson {
  name: string
  /** Aus der Lohn-Stammdatenkarte. Fehlt sie, ist die Zeile nicht zuzuordnen. */
  personalnummer?: string | null
}

export interface UebergabeZeile {
  personalnummer: string | null
  name: string
  stundenGesamt: number
  stundenMehrarbeit: number
  /** In `stundenGesamt` enthalten: bezahlte Fehlzeit, nicht gearbeitet. */
  stundenFehlzeit: number
  nachtStunden: number
  samstagStunden: number
  sonntagStunden: number
  feiertagStunden: number
  zuschlagNacht: number
  zuschlagSamstag: number
  zuschlagSonntag: number
  zuschlagFeiertag: number
  /** Mehrarbeits- und sonstige Zuschläge — nie nach §3b begünstigt. */
  zuschlagSonstige: number
  zuschlaegeGesamt: number
  zuschlaegeSteuerfrei: number
  zuschlaegeSteuerpflichtig: number
  urlaubstage: number
  krankheitstage: number
  grundlohn: number | null
}

const auf2 = (n: number) => Math.round(n * 100) / 100

/**
 * Eine Zeile aus den Monatsgrundlagen.
 *
 * Die Aufteilung in steuerfrei und steuerpflichtig läuft über dasselbe Modul
 * wie in der Abrechnung (`zuschlag-steuerfrei.ts`) — sonst stünde im Export
 * eine andere Zahl als auf dem Lohnzettel desselben Monats.
 */
export function uebergabeZeile(
  person: UebergabePerson,
  g: MonatsGrundlage,
): UebergabeZeile {
  const zuschlagSonstige = auf2(g.overtimeSurcharge + g.otherSurcharge)
  const gesamt = auf2(
    g.nightSurcharge + g.saturdaySurcharge + g.sundaySurcharge
    + g.holidaySurcharge + zuschlagSonstige,
  )

  const frei = zuschlagSteuerfrei({
    grundlohn: g.zuschlagsStundenlohn ?? 0,
    nachtBetrag: g.nightSurcharge, nachtStunden: g.nightHours,
    sonntagBetrag: g.sundaySurcharge, sonntagStunden: g.sundayHours,
    feiertagBetrag: g.holidaySurcharge, feiertagStunden: g.holidayHours,
  })

  return {
    personalnummer: person.personalnummer?.trim() || null,
    name: person.name,
    stundenGesamt: auf2(g.regularHours + g.overtimeHours),
    stundenMehrarbeit: auf2(g.overtimeHours),
    stundenFehlzeit: auf2(g.ausfallHours),
    nachtStunden: auf2(g.nightHours),
    samstagStunden: auf2(g.saturdayHours),
    sonntagStunden: auf2(g.sundayHours),
    feiertagStunden: auf2(g.holidayHours),
    zuschlagNacht: auf2(g.nightSurcharge),
    zuschlagSamstag: auf2(g.saturdaySurcharge),
    zuschlagSonntag: auf2(g.sundaySurcharge),
    zuschlagFeiertag: auf2(g.holidaySurcharge),
    zuschlagSonstige,
    zuschlaegeGesamt: gesamt,
    zuschlaegeSteuerfrei: frei.steuerfrei,
    // Nicht noch einmal gerechnet, sondern abgezogen: So ist die Summe der
    // beiden Spalten immer der Gesamtbetrag, und niemand muss sich fragen,
    // welche der drei Zahlen die richtige ist.
    zuschlaegeSteuerpflichtig: auf2(gesamt - frei.steuerfrei),
    urlaubstage: auf2(g.vacationDays),
    krankheitstage: auf2(g.sickDays),
    grundlohn: g.zuschlagsStundenlohn,
  }
}

// ── Die Datei ───────────────────────────────────────────────────────────────

export interface UebergabeKopf {
  betrieb: string
  jahr: number
  monat: number
}

/** Die Spalten, in dieser Reihenfolge. Einmal hier, nicht dreimal verstreut. */
const SPALTEN: [string, (z: UebergabeZeile) => string | number | null][] = [
  ['Personalnummer', z => z.personalnummer],
  ['Name', z => z.name],
  ['Stunden gesamt', z => z.stundenGesamt],
  ['davon Mehrarbeit', z => z.stundenMehrarbeit],
  ['davon bezahlte Fehlzeit', z => z.stundenFehlzeit],
  ['Nachtstunden', z => z.nachtStunden],
  ['Samstagsstunden', z => z.samstagStunden],
  ['Sonntagsstunden', z => z.sonntagStunden],
  ['Feiertagsstunden', z => z.feiertagStunden],
  ['Zuschlag Nacht', z => z.zuschlagNacht],
  ['Zuschlag Samstag', z => z.zuschlagSamstag],
  ['Zuschlag Sonntag', z => z.zuschlagSonntag],
  ['Zuschlag Feiertag', z => z.zuschlagFeiertag],
  ['Zuschlag sonstige', z => z.zuschlagSonstige],
  ['Zuschläge gesamt', z => z.zuschlaegeGesamt],
  ['davon steuerfrei', z => z.zuschlaegeSteuerfrei],
  ['davon steuerpflichtig', z => z.zuschlaegeSteuerpflichtig],
  ['Urlaubstage', z => z.urlaubstage],
  ['Krankheitstage', z => z.krankheitstage],
  ['Grundlohn je Stunde', z => z.grundlohn],
]

/**
 * Das Zahlenformat, an dem solche Dateien üblicherweise scheitern.
 *
 * Deutsch heißt: Komma als Dezimalzeichen. Damit scheidet das Komma als
 * Spaltentrenner aus — es bleibt das Semikolon, und genau das erwarten
 * deutsche Excel-Installationen, DATEV und Lexware auch.
 */
function zahl(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function feld(wert: string | number | null): string {
  if (wert === null || wert === undefined) return ''
  if (typeof wert === 'number') return zahl(wert)
  // Anführungszeichen verdoppeln, sonst reißt ein Name wie O"Brien die Zeile
  // auseinander. Semikolon und Zeilenumbruch im Namen ebenso.
  return `"${wert.replace(/"/g, '""')}"`
}

/**
 * Die Datei zum Herunterladen.
 *
 * Mit Byte-Order-Mark, weil Excel eine UTF-8-Datei ohne sie als Westeuropäisch
 * liest und aus „Müller" ein „MÃ¼ller" macht. Mit CRLF, weil dieselbe
 * Excel-Installation sonst alles in eine Zeile schreibt.
 */
export function uebergabeCsv(kopf: UebergabeKopf, zeilen: UebergabeZeile[]): string {
  const zeitraum = `${String(kopf.monat).padStart(2, '0')}/${kopf.jahr}`
  const aus: string[] = []

  // Eine Kopfzeile, damit die Datei ohne Begleitmail erklärt, wohin sie
  // gehört. Sie steht VOR den Spaltenüberschriften; wer sie nicht braucht,
  // löscht eine Zeile.
  aus.push([feld('OKUN Workforce — Übergabe ans Lohnbüro'), feld(kopf.betrieb), feld(zeitraum)].join(';'))
  aus.push(SPALTEN.map(([name]) => feld(name)).join(';'))

  for (const z of zeilen) {
    aus.push(SPALTEN.map(([, lies]) => feld(lies(z))).join(';'))
  }

  return '﻿' + aus.join('\r\n') + '\r\n'
}

/**
 * Der Dateiname, unter dem das Lohnbüro die Datei wiederfindet.
 *
 * Erlaubt sind Buchstaben, Ziffern und Umlaute; alles andere wird zum
 * Bindestrich. Ausdrücklich aufgezählt statt mit `\p{L}` abgekürzt: Die
 * Unicode-Eigenschaften brauchen ein neueres Übersetzungsziel, als dieses
 * Projekt setzt, und ein Dateiname mit Schrägstrich oder Doppelpunkt darin
 * wird je nach Betriebssystem still abgeschnitten.
 */
export function uebergabeDateiname(kopf: UebergabeKopf): string {
  const betrieb = kopf.betrieb
    .replace(/[^A-Za-z0-9ÄÖÜäöüß]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `lohnuebergabe-${betrieb}-${kopf.jahr}-${String(kopf.monat).padStart(2, '0')}.csv`
}

// ── Was die Datei unbrauchbar macht ─────────────────────────────────────────

export interface Mangel {
  art: 'personalnummer' | 'grundlohn'
  text: string
  betroffen: string[]
}

/**
 * Die Mängel, die beim Einlesen auffallen würden — vorher gesagt.
 *
 * Eine Datei, die stillschweigend halb richtig ist, kostet das Lohnbüro einen
 * Rückruf und den Betrieb einen Tag. Beide Fälle hier sind nicht Geschmack,
 * sondern machen die Datei an dieser Stelle wirklich unbrauchbar:
 *
 *   Ohne Personalnummer lässt sich die Zeile keinem Personalstamm zuordnen.
 *   Ohne Grundlohn lässt sich nicht sagen, welcher Teil der Zuschläge
 *   steuerfrei ist — dann steht alles als steuerpflichtig da, und das ist für
 *   den Mitarbeiter bares Geld.
 */
export function uebergabeMaengel(zeilen: UebergabeZeile[]): Mangel[] {
  const maengel: Mangel[] = []

  const ohneNummer = zeilen.filter(z => !z.personalnummer).map(z => z.name)
  if (ohneNummer.length > 0) {
    maengel.push({
      art: 'personalnummer',
      text: 'Ohne Personalnummer kann das Lohnprogramm die Zeile keinem '
        + 'Mitarbeiter zuordnen. Sie steht in der Personalakte unter Lohndaten.',
      betroffen: ohneNummer,
    })
  }

  const ohneGrundlohn = zeilen
    .filter(z => z.zuschlaegeGesamt > 0 && !(z.grundlohn && z.grundlohn > 0))
    .map(z => z.name)
  if (ohneGrundlohn.length > 0) {
    maengel.push({
      art: 'grundlohn',
      text: 'Ohne Grundlohn je Stunde lässt sich die Steuerfreiheit der '
        + 'Zuschläge (§3b EStG) nicht bestimmen — sie stehen deshalb '
        + 'vollständig als steuerpflichtig in der Datei.',
      betroffen: ohneGrundlohn,
    })
  }

  return maengel
}
