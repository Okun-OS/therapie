import { createHash } from 'node:crypto'

/**
 * §150 Belehrungen digital — die Regeln dahinter.
 *
 * WAS EINE BELEHRUNG RECHTLICH BRAUCHT
 * Eine Unterweisung nach §12 ArbSchG, eine Belehrung nach §43 IfSG, eine
 * Einweisung nach DGUV Vorschrift 1 §4 — sie alle verlangen keinen bestimmten
 * Schriftträger. Verlangt wird der NACHWEIS: dass diese Person diesen Inhalt
 * zu diesem Zeitpunkt zur Kenntnis genommen hat. Papier ist dafür nur eine von
 * mehreren Möglichkeiten, und nicht die beste — ein Ordner mit
 * Unterschriftenlisten beantwortet die Frage „wer fehlt noch?" gar nicht.
 *
 * DIE DREI SÄULEN DES NACHWEISES, UND WARUM SIE KOPIEN SIND
 * Jeder Beleg trägt drei Dinge aus dem Zeitpunkt des Klicks: den Namen, den
 * bestätigten Wortlaut und den Fingerabdruck des Dokuments. Alle drei als
 * KOPIE, nie als Verweis. Ein Beleg, der auf die heutige Fassung zeigt, belegt
 * nichts — nach einer Änderung sähe er so aus, als hätte jemand etwas
 * bestätigt, das es damals nicht gab. Deshalb ist eine verteilte Belehrung
 * auch unveränderlich: Wer etwas ändern will, verteilt eine neue Runde.
 *
 * WAS „GELESEN" HIER EHRLICHERWEISE HEISST
 * Niemand kann prüfen, ob ein Mensch etwas gelesen hat — auf Papier genauso
 * wenig. Festgehalten wird, was sich feststellen lässt: wann das Dokument
 * geöffnet wurde und wann bestätigt. Liegt zwischen beidem keine Sekunde,
 * steht das im Beleg. Das ist mehr, als eine Unterschriftenliste hergibt.
 */

export const STAENDE = {
  entwurf: 'Entwurf',
  verteilt: 'Verteilt',
  geschlossen: 'Geschlossen',
} as const

export type Stand = keyof typeof STAENDE

export const WIEDERHOLUNGEN = {
  monatlich: 'monatlich',
  quartal: 'vierteljährlich',
  halbjaehrlich: 'halbjährlich',
  jaehrlich: 'jährlich',
} as const

export const WIEDERHOLUNG_MONATE: Record<string, number> = {
  monatlich: 1, quartal: 3, halbjaehrlich: 6, jaehrlich: 12,
}

/**
 * Der Satz, den man bestätigt — die Vorgabe.
 *
 * Er ist änderbar, weil genau dieser Wortlaut die rechtliche Wirkung trägt und
 * eine Hygienebelehrung anders lautet als die Einweisung in eine Maschine. Die
 * Vorgabe nennt beide Teile, auf die es ankommt: zur Kenntnis genommen UND
 * verstanden. „Gelesen" allein ist keine Unterweisung.
 */
export const STANDARDTEXT =
  'Ich habe die Belehrung gelesen, verstanden und erkenne sie an. '
  + 'Bei Unklarheiten wende ich mich an meine Leitung.'

/** Der kürzeste Wortlaut, der noch etwas aussagt. */
export const MIN_TEXT = 15

export interface Entwurf {
  titel?: string | null
  bestaetigungstext?: string | null
  dateiId?: string | null
}

/**
 * Was fehlt, bevor eine Belehrung verteilt werden darf.
 *
 * Bewusst eine Liste und kein `boolean`: „Verteilen nicht möglich" lässt den
 * Anwender raten. Hier steht, was fehlt.
 */
export function fehltZumVerteilen(e: Entwurf): string[] {
  const fehlt: string[] = []
  if (!e.titel?.trim()) fehlt.push('Ein Titel — er steht später auf jedem Beleg.')
  if (!e.dateiId) {
    fehlt.push(
      'Das Dokument. Ohne Inhalt wäre die Bestätigung eine Unterschrift '
      + 'unter ein leeres Blatt.',
    )
  }
  const text = (e.bestaetigungstext ?? '').trim()
  if (text.length < MIN_TEXT) {
    fehlt.push(
      'Der Satz, den die Leute bestätigen. Genau dieser Wortlaut ist später '
      + 'der Nachweis — er gehört ausformuliert.',
    )
  }
  return fehlt
}

/**
 * Was an einer verteilten Belehrung noch geändert werden darf.
 *
 * Fast nichts. Alles, was den Inhalt oder den bestätigten Wortlaut betrifft,
 * ist ab dem Verteilen festgeschrieben — sonst wäre jeder bereits abgegebene
 * Beleg wertlos. Änderbar bleibt, was niemandem den Boden unter den Füßen
 * wegzieht: die Frist (verlängern hilft) und der Hinweistext daneben.
 */
export const NACH_VERTEILEN_AENDERBAR = ['fristBis', 'beschreibung', 'wiederholung']

export function darfAendern(status: string, feld: string): boolean {
  if (status === 'entwurf') return true
  if (status === 'geschlossen') return false
  return NACH_VERTEILEN_AENDERBAR.includes(feld)
}

export function warumNichtAendern(status: string, feld: string): string {
  if (status === 'geschlossen') {
    return 'Diese Runde ist geschlossen. Für eine Änderung wird eine neue '
      + 'Runde verteilt — die alten Belege bleiben, wie sie sind.'
  }
  return `„${feld}“ ist festgeschrieben, seit die Belehrung verteilt wurde. `
    + 'Ließe sich der Inhalt nachträglich austauschen, wäre jede schon '
    + 'abgegebene Bestätigung wertlos. Für eine Änderung: schließen und eine '
    + 'neue Runde verteilen.'
}

/**
 * Der Fingerabdruck eines Dokuments.
 *
 * SHA-256 über den Dateiinhalt. Er steht im Beleg und beantwortet die Frage,
 * die sonst niemand beantworten kann: Ist das hier dieselbe Fassung, die
 * damals vorlag? Zwei verschiedene Dateien haben praktisch nie denselben Wert.
 */
export function pruefsumme(daten: Buffer | Uint8Array): string {
  return createHash('sha256').update(daten).digest('hex')
}

/** Kurzform für die Anzeige — die ganzen 64 Zeichen liest niemand. */
export function kurzeSumme(voll?: string | null): string | null {
  if (!voll) return null
  return `${voll.slice(0, 8)}…${voll.slice(-4)}`
}

export interface Beleg {
  personName: string
  bestaetigtAm?: Date | string | null
  angesehenAm?: Date | string | null
  wortlaut?: string | null
  pruefsumme?: string | null
}

/**
 * Wie belastbar ist dieser Beleg?
 *
 * Kein Urteil über den Menschen, sondern über das, was festgehalten wurde.
 * Der Betrieb soll vor einer Prüfung sehen, wo seine Belege dünn sind — und
 * niemand soll später überrascht werden.
 */
export type Guete = 'fehlt' | 'knapp' | 'belegt'

/** Unter dieser Zeit zwischen Öffnen und Bestätigen wurde nichts gelesen. */
export const KNAPP_SEKUNDEN = 5

export function guete(b: Beleg): { stufe: Guete; text: string } {
  if (!b.bestaetigtAm) {
    return { stufe: 'fehlt', text: 'Noch nicht bestätigt' }
  }
  if (!b.angesehenAm) {
    return {
      stufe: 'knapp',
      text: 'Bestätigt, ohne das Dokument zu öffnen',
    }
  }
  const sekunden = (new Date(b.bestaetigtAm).getTime()
    - new Date(b.angesehenAm).getTime()) / 1000
  if (sekunden < KNAPP_SEKUNDEN) {
    return {
      stufe: 'knapp',
      text: `Bestätigt ${Math.max(0, Math.round(sekunden))} Sekunden nach dem Öffnen`,
    }
  }
  return { stufe: 'belegt', text: 'Geöffnet und bestätigt' }
}

/** Darf diese Person jetzt bestätigen? */
export function darfBestaetigen(
  belehrung: { status: string; oeffnenNoetig: boolean },
  beleg: { bestaetigtAm?: Date | string | null; angesehenAm?: Date | string | null },
): { ok: boolean; grund?: string } {
  if (belehrung.status !== 'verteilt') {
    return {
      ok: false,
      grund: belehrung.status === 'geschlossen'
        ? 'Diese Belehrung ist abgeschlossen.'
        : 'Diese Belehrung ist noch nicht verteilt.',
    }
  }
  if (beleg.bestaetigtAm) {
    return { ok: false, grund: 'Du hast das schon bestätigt.' }
  }
  if (belehrung.oeffnenNoetig && !beleg.angesehenAm) {
    return {
      ok: false,
      grund: 'Bitte öffne zuerst das Dokument. Eine Bestätigung ohne den '
        + 'Inhalt wäre für beide Seiten wertlos.',
    }
  }
  return { ok: true }
}

/** Der Stand einer Runde in Zahlen — die Frage lautet: wer fehlt noch? */
export function stand(belege: Beleg[]): {
  gesamt: number
  bestaetigt: number
  offen: number
  knapp: number
  anteil: number
} {
  const bestaetigt = belege.filter(b => b.bestaetigtAm).length
  const knapp = belege.filter(b => guete(b).stufe === 'knapp').length
  return {
    gesamt: belege.length,
    bestaetigt,
    offen: belege.length - bestaetigt,
    knapp,
    anteil: belege.length === 0 ? 0 : Math.round((bestaetigt / belege.length) * 100),
  }
}

/**
 * Wann die nächste Runde fällig ist.
 *
 * Gerechnet ab dem Verteilen der laufenden Runde, nicht ab heute: Eine
 * monatliche Belehrung, die zwei Wochen zu spät verteilt wurde, soll die
 * Verspätung nicht für immer mitschleppen.
 */
export function naechsteRunde(
  verteiltAm: Date, wiederholung?: string | null,
): Date | null {
  const monate = WIEDERHOLUNG_MONATE[wiederholung ?? '']
  if (!monate) return null
  const d = new Date(verteiltAm.getTime())
  const tag = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + monate)
  const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .getUTCDate()
  d.setUTCDate(Math.min(tag, letzter))
  return d
}

/** Der Titel der nächsten Runde — mit Monat, damit man sie auseinanderhält. */
export function rundenTitel(titel: string, am = new Date()): string {
  // Ein schon vorhandener Monatszusatz wird ersetzt und nicht angehängt —
  // sonst hieße die dritte Runde „Hygiene (März) (April) (Mai)".
  const ohne = titel.replace(/\s*\((?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}\)\s*$/, '')
  const monat = am.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  return `${ohne} (${monat})`
}

/** Kurzform des Geräts für den Beleg — kein vollständiger Fingerabdruck. */
export function geraetKurz(userAgent?: string | null): string | null {
  if (!userAgent) return null
  const ua = userAgent.slice(0, 400)
  const app = /OkunWorkforce|Capacitor/i.test(ua) ? 'App' : 'Browser'
  const system = /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
      : /Macintosh|Mac OS/i.test(ua) ? 'Mac'
        : /Windows/i.test(ua) ? 'Windows'
          : /Linux/i.test(ua) ? 'Linux' : 'unbekannt'
  return `${app}, ${system}`
}
