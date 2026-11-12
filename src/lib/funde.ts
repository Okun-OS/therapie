/**
 * §133 Funde: Fehler, Verbesserungen, Fragen und Wünsche aus dem Betrieb.
 *
 * Bisher gab es einen Fehlermelder mit drei Feldern — Titel, Beschreibung,
 * Schwere — und daneben eine Tabelle in einem Google-Sheet. Beides hat dasselbe
 * Problem: Was ankommt, reicht nicht, um den Fund nachzustellen. „Gruppen gehen
 * nicht" ist nach zwei Wochen wertlos; niemand weiß mehr, welche Rolle, welcher
 * Standort, welche Version.
 *
 * DIE EINE EINSICHT, DIE ALLES BESTIMMT
 * -------------------------------------
 * Wie gut eine Behebung wird, hängt fast ausschließlich an der Qualität der
 * Meldung. Nicht an dem, was danach damit geschieht. Deshalb ist das Formular
 * der eigentliche Teil der Arbeit, und deshalb steht in dieser Datei mehr über
 * Fragen als über Abläufe.
 *
 * Das wichtigste Feld ist WAS HÄTTEST DU ERWARTET. Ohne es lässt sich nicht
 * entscheiden, ob etwas kaputt ist oder nur anders, als der Melder dachte —
 * und genau daran hängt, ob aus einer Meldung ein Fehler oder ein
 * Verbesserungsvorschlag wird.
 *
 * VERBESSERUNGEN SIND KEINE FEHLER
 * --------------------------------
 * Ein Fehler wird behoben. Ein Verbesserungsvorschlag ist eine Entscheidung
 * darüber, wie das Produkt sein soll — die trifft nicht der Melder und nicht
 * das Programm, sondern OKUN. Deshalb warten Verbesserungen und Wünsche auf
 * eine ausdrückliche Freigabe, und ohne die geschieht nichts.
 *
 * WAS NIEMALS VON SELBST PASSIERT
 * -------------------------------
 * Alles, was Geld oder Recht berührt: Lohnrechnung, Arbeitszeiten,
 * Löschfristen, Zugriffsrechte. Dort gibt es immer einen Vorschlag zum
 * Bestätigen, egal wie klein er aussieht. Dieselbe Grenze gilt schon heute für
 * Änderungen an bestehenden Daten.
 */

export type Art = 'fehler' | 'verbesserung' | 'frage' | 'wunsch'

export const ARTEN: { wert: Art; text: string; hilfe: string }[] = [
  {
    wert: 'fehler', text: 'Fehler',
    hilfe: 'Etwas funktioniert nicht so, wie es soll.',
  },
  {
    wert: 'verbesserung', text: 'Verbesserungsvorschlag',
    hilfe: 'Es funktioniert, ist aber umständlich, unklar oder fehlt ganz.',
  },
  {
    wert: 'frage', text: 'Frage',
    hilfe: 'Unklar, ob das so gedacht ist.',
  },
  {
    wert: 'wunsch', text: 'Wunsch',
    hilfe: 'Etwas, das es noch gar nicht gibt.',
  },
]

export const BEREICHE: { wert: string; text: string }[] = [
  { wert: 'dienstplan', text: 'Dienstplanung' },
  { wert: 'zeit', text: 'Zeiterfassung' },
  { wert: 'urlaub', text: 'Urlaub und Abwesenheit' },
  { wert: 'lohn', text: 'Lohn und Zuschläge' },
  { wert: 'nachrichten', text: 'Nachrichten' },
  { wert: 'akte', text: 'Personalakte und Dokumente' },
  { wert: 'datenschutz', text: 'Datenschutz' },
  { wert: 'einrichtung', text: 'Einrichtung und Stammdaten' },
  { wert: 'anmeldung', text: 'Anmeldung und Zugänge' },
  { wert: 'sonstiges', text: 'Sonstiges' },
]

export const EBENEN: { wert: string; text: string }[] = [
  { wert: 'mitarbeiter', text: 'als Mitarbeiter' },
  { wert: 'admin', text: 'als Standortleitung' },
  { wert: 'company', text: 'als Unternehmen' },
  { wert: 'okun', text: 'als OKUN' },
]

export const HAEUFIGKEITEN: { wert: string; text: string; hilfe: string }[] = [
  { wert: 'immer', text: 'Immer', hilfe: 'Lässt sich jederzeit wiederholen.' },
  {
    wert: 'manchmal', text: 'Manchmal',
    hilfe: 'Dann hängt es fast immer an bestimmten Daten — das ändert die Suche.',
  },
  { wert: 'einmal', text: 'Bisher einmal', hilfe: 'Noch nicht wieder aufgetreten.' },
]

/**
 * Bereiche, in denen niemals ohne ausdrückliche Bestätigung gehandelt wird.
 *
 * Hier geht es um Geld und um Recht. Ein falsch gerechneter Lohn, eine zu früh
 * gelöschte Unterlage, ein aufgerissenes Zugriffsrecht — das sind keine Fehler,
 * die man nachträglich geradezieht, sondern Schäden.
 */
export const HEIKLE_BEREICHE = ['lohn', 'zeit', 'datenschutz', 'anmeldung']

export type Status =
  | 'open'            // Fehler, neu eingegangen
  | 'wartet_freigabe' // Verbesserung oder Wunsch, wartet auf OKUN
  | 'freigegeben'     // freigegeben, wartet auf Umsetzung
  | 'rueckfrage'      // die Meldung reicht nicht, eine Frage ist offen
  | 'in_progress'     // wird bearbeitet
  | 'resolved'        // erledigt
  | 'abgelehnt'       // bewusst nicht umgesetzt

export const STATUS_TEXT: Record<string, string> = {
  open: 'Neu',
  wartet_freigabe: 'Wartet auf Freigabe',
  freigegeben: 'Freigegeben',
  rueckfrage: 'Rückfrage offen',
  in_progress: 'In Arbeit',
  resolved: 'Erledigt',
  abgelehnt: 'Abgelehnt',
}

/** Arten, die ohne Freigabe nicht umgesetzt werden. */
export const FREIGABEPFLICHTIG: Art[] = ['verbesserung', 'wunsch']

export function brauchtFreigabe(art: string): boolean {
  return FREIGABEPFLICHTIG.includes(art as Art)
}

/** Der Status, mit dem eine neue Meldung startet. */
export function startStatus(art: string): Status {
  return brauchtFreigabe(art) ? 'wartet_freigabe' : 'open'
}

// ── Die Qualität der Meldung ───────────────────────────────────────────────

export interface Meldung {
  art?: string | null
  bereich?: string | null
  ebene?: string | null
  title?: string | null
  description?: string | null
  schritte?: string | null
  erwartet?: string | null
  haeufigkeit?: string | null
}

export interface Bewertung {
  /** gruen = damit lässt sich arbeiten */
  stufe: 'gruen' | 'gelb'
  /** Was noch fehlt — in der Sprache des Melders, höchstens zwei Sätze */
  fehlt: string[]
  /** Ein Satz für die Anzeige unter dem Formular */
  text: string
}

const LANG_GENUG = 12

const gefuellt = (wert?: string | null) => !!wert && wert.trim().length >= LANG_GENUG

/**
 * Reicht diese Meldung zum Arbeiten?
 *
 * Bewusst wohlwollend: Eine gelbe Meldung wird trotzdem angenommen. Eine
 * abgelehnte Meldung ist eine verlorene Meldung — wer zweimal abgewiesen wird,
 * meldet beim dritten Mal gar nicht mehr. Markiert wird sie trotzdem, damit die
 * fehlende Angabe später gezielt nachgefragt werden kann.
 */
export function bewerten(m: Meldung): Bewertung {
  const fehlt: string[] = []

  if (!gefuellt(m.title)) {
    fehlt.push('Eine Überschrift in einem Satz — woran hast du es gemerkt?')
  }

  if (m.art === 'fehler' || m.art === 'frage') {
    if (!gefuellt(m.schritte)) {
      fehlt.push('Was hast du getan, bevor es passiert ist?')
    }
    if (!gefuellt(m.description)) {
      fehlt.push('Was ist stattdessen passiert?')
    }
    // Das entscheidende Feld: ohne es ist nicht zu klären, ob überhaupt etwas
    // kaputt ist — oder ob es nur anders ist, als der Melder erwartet hat.
    if (!gefuellt(m.erwartet)) {
      fehlt.push('Was hättest du an der Stelle erwartet?')
    }
    if (!m.haeufigkeit) {
      fehlt.push('Tritt es immer auf oder nur manchmal?')
    }
  } else {
    // Verbesserung und Wunsch: die Schritte sind hier nebensächlich, der
    // Zielzustand ist alles.
    if (!gefuellt(m.description)) {
      fehlt.push('Was stört heute daran?')
    }
    if (!gefuellt(m.erwartet)) {
      fehlt.push('Wie sollte es stattdessen sein?')
    }
  }

  if (!m.bereich || m.bereich === 'sonstiges') {
    fehlt.push('Welchen Bereich betrifft es?')
  }

  const stufe = fehlt.length === 0 ? 'gruen' : 'gelb'
  const text = stufe === 'gruen'
    ? 'Damit kann ich arbeiten.'
    : fehlt.length === 1
      ? `Eine Angabe fehlt noch: ${fehlt[0]}`
      : `Noch nicht vollständig — es fehlt: ${fehlt.join(' ')}`

  return { stufe, fehlt, text }
}

/**
 * Berührt dieser Fund Geld oder Recht?
 *
 * Wird aus dem Bereich abgeleitet und kann vom Melder zusätzlich gesetzt
 * werden — niemals aber zurückgenommen. Wer sich unsicher ist, soll ankreuzen
 * dürfen; wer es vergisst, wird vom Bereich aufgefangen.
 */
export function istHeikel(bereich?: string | null, angekreuzt?: boolean): boolean {
  if (angekreuzt) return true
  return !!bereich && HEIKLE_BEREICHE.includes(bereich)
}

/**
 * In welchen Topf gehört der Fund?
 *
 *   selbst      kann ohne Rückfrage erledigt werden
 *   vorschlag   verändert Verhalten — braucht eine Bestätigung
 *   freigabe    Verbesserung oder Wunsch — braucht eine Entscheidung
 *   rueckfrage  die Meldung reicht nicht
 */
export type Topf = 'selbst' | 'vorschlag' | 'freigabe' | 'rueckfrage'

export function topf(f: {
  art: string
  bereich?: string | null
  heikel?: boolean
  meldeQualitaet?: string | null
  freigabe?: string | null
}): Topf {
  if (brauchtFreigabe(f.art) && f.freigabe !== 'freigegeben') return 'freigabe'
  if (f.meldeQualitaet !== 'gruen') return 'rueckfrage'
  if (istHeikel(f.bereich, f.heikel)) return 'vorschlag'
  return 'selbst'
}

export const TOPF_TEXT: Record<Topf, string> = {
  selbst: 'Kann ich selbst erledigen',
  vorschlag: 'Vorschlag — du bestätigst',
  freigabe: 'Wartet auf deine Freigabe',
  rueckfrage: 'Rückfrage nötig',
}

/** Eine neue Kennung für einen Fund. */
export function neueKennung(art: string): string {
  const praefix = art === 'fehler' ? 'F' : art === 'verbesserung' ? 'V' : art === 'wunsch' ? 'W' : 'Q'
  const zeit = Date.now().toString(36).toUpperCase()
  const zufall = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${praefix}-${zeit}-${zufall}`
}
