import { brauchtFreigabe, istHeikel, topf } from './funde'

/**
 * §142 Stufe 3: Wann darf der Lauf selbst Hand anlegen — und wann geht das
 * Ergebnis ohne Rückfrage auf die laufende Anlage?
 *
 * Diese Datei ist die Grenze. Sie steht bewusst im Programm und nicht in der
 * Anweisung des Laufs: Eine Regel, die in einem Text steht, den ein Modell
 * liest, ist eine Bitte. Eine Regel, die der Server prüft, ist eine Regel.
 *
 * DREI SPUREN
 *
 *   direkt      Reine Anzeige. Text, Beschriftung, Darstellung, ein Knopf, der
 *               nichts tut. Alle Prüfungen grün → geht raus.
 *   sammeln     Alles, was auch nur eine Zeile Verhalten anfasst. Wird fertig
 *               gebaut und geprüft, wartet aber auf einen Menschen.
 *   abgelehnt   Rührt der Lauf nicht an.
 *
 * WARUM DER LAUF SEINE EIGENE EINSTUFUNG NICHT BESTIMMT
 * Er sagt, was er für eine Anzeigeänderung hält, und welche Dateien er
 * angefasst hat. Über die Einstufung entscheidet dann diese Datei anhand der
 * DATEIEN — nicht anhand seiner Einschätzung. Wer sich selbst einstuft, stuft
 * sich im Zweifel großzügig ein, und der Zweifel fällt hier auf Lohndaten.
 *
 * DIE EINE REGEL, DIE ALLES TRÄGT
 * Prüfungen und Tests sind unantastbar. Ein Lauf, der seine eigene Prüfung
 * ändern darf, kann jede Änderung grün bekommen — dann ist das Sicherheitsnetz
 * nur noch Dekoration. Das ist der einzige Verstoß, der nicht „sammeln"
 * auslöst, sondern rundheraus abgelehnt wird.
 */

export type Ausgang =
  /** Geht ohne Rückfrage raus */
  | 'direkt'
  /** Fertig gebaut und geprüft, wartet auf einen Menschen */
  | 'sammeln'
  /** Wird nicht angefasst */
  | 'abgelehnt'

export interface Urteil {
  ausgang: Ausgang
  /** Ein Satz, der auf der Fundeseite steht — für Menschen, nicht fürs Protokoll */
  grund: string
}

/** Was der Lauf über seine Änderung behauptet. */
export type Klasse =
  /** Nur Angezeigtes: Text, Beschriftung, Abstand, Farbe, ein toter Knopf */
  | 'anzeige'
  /** Verhalten: Bedingungen, Rechenwege, Abläufe, Schnittstellen */
  | 'logik'

export interface Vorhaben {
  fund: {
    art: string
    bereich?: string | null
    heikel?: boolean
    meldeQualitaet?: string | null
    freigabe?: string | null
  }
  klasse: Klasse
  /** Pfade relativ zur Wurzel des Projekts */
  dateien: string[]
  /** Wie viele Zeilen sich ändern (hinzugefügt + entfernt) */
  zeilen: number
}

// ── Was niemals automatisch angefasst wird ─────────────────────────────────

/**
 * Dateien, bei denen jede automatische Änderung abgelehnt wird — unabhängig
 * davon, wie harmlos sie aussieht.
 */
export const UNANTASTBAR: { muster: RegExp; grund: string }[] = [
  {
    muster: /^pruefungen\//,
    grund: 'Prüfungen ändert der Lauf nicht. Wer seine eigene Prüfung anpassen '
      + 'darf, bekommt jede Änderung grün.',
  },
  {
    muster: /__tests__\/|\.test\.(ts|tsx|mts)$/,
    grund: 'Modultests ändert der Lauf nicht — aus demselben Grund wie die Prüfungen.',
  },
  {
    muster: /^prisma\//,
    grund: 'An der Datenbank ändert der Lauf nichts. Eine Wanderung läuft beim '
      + 'nächsten Ausrollen gegen die echten Daten und ist nicht zurückzunehmen.',
  },
  {
    muster: /^src\/lib\/(session|scope|auth)/,
    grund: 'Anmeldung und Zugriffsrechte entscheiden, wer welche Daten sieht. '
      + 'Dort wird nichts automatisch geändert.',
  },
  {
    muster: /^src\/lib\/(lohn|payroll|zuschlag|elstam|datev|sepa)/,
    grund: 'Hier wird Geld gerechnet. Dort wird nichts automatisch geändert.',
  },
  {
    muster: /^src\/lib\/dsgvo/,
    grund: 'Löschung und Auskunft sind Rechtspflichten. Dort wird nichts '
      + 'automatisch geändert.',
  },
  {
    muster: /^src\/lib\/(funde|behebung)\.ts$/,
    grund: 'Das sind die Regeln dieses Ablaufs selbst. Sie ändert der Lauf nicht.',
  },
  {
    muster: /^(package\.json|package-lock\.json|next\.config|capacitor\.config|railway\.toml|\.github\/)/,
    grund: 'Aufbau und Auslieferung des Programms ändert der Lauf nicht.',
  },
  {
    muster: /^(ios|android|native)\//,
    grund: 'An der nativen Hülle ändert der Lauf nichts — sie lässt sich hier '
      + 'nicht prüfen, sondern nur auf einem Gerät.',
  },
]

/**
 * Dateien, die überhaupt als reine Anzeige durchgehen können.
 *
 * Bewusst eine Erlaubnisliste und keine Verbotsliste: Bei einer Verbotsliste
 * ist alles Neue erst einmal erlaubt, und neue Dateien entstehen hier jede
 * Woche. Eine Erlaubnisliste irrt in die sichere Richtung.
 */
const ANZEIGE_ERLAUBT = /^src\/(app|components)\/.*\.tsx$/

/** Höchstens so viele Zeilen darf eine Änderung haben, die ohne Rückfrage rausgeht. */
export const DIREKT_MAX_ZEILEN = 40

/** Höchstens so viele Dateien. Mehr ist kein Tippfehler mehr, sondern ein Umbau. */
export const DIREKT_MAX_DATEIEN = 3

/**
 * Liegt die Datei in einem Bereich, in dem nichts von selbst geschieht?
 *
 * Getrennt von UNANTASTBAR, weil hier nicht die Datei das Problem ist, sondern
 * der Gegenstand: Eine Lohnseite ist eine Seite wie jede andere — aber was
 * darauf steht, entscheidet über Geld.
 */
const HEIKLE_PFADE = /(lohn|payroll|zeit|time|dsgvo|datenschutz|login|anmeldung|stempel)/i

// ── Das Urteil ─────────────────────────────────────────────────────────────

/**
 * Darf der Lauf das, und darf es ohne Rückfrage raus?
 *
 * Die Reihenfolge der Prüfungen ist wichtig: Erst wird gefragt, ob der Fund
 * überhaupt bearbeitet werden darf, dann ob die Dateien angefasst werden
 * dürfen, und erst zuletzt, wie weit das Ergebnis gehen darf. So kann eine
 * späte, großzügige Regel keine frühe, strenge aushebeln.
 */
export function beurteileBehebung(v: Vorhaben): Urteil {
  // 1. Darf dieser Fund überhaupt bearbeitet werden?
  const t = topf(v.fund)

  if (t === 'freigabe') {
    return {
      ausgang: 'abgelehnt',
      grund: 'Verbesserungen und Wünsche werden erst nach einer Freigabe gebaut.',
    }
  }
  if (t === 'rueckfrage') {
    return {
      ausgang: 'abgelehnt',
      grund: 'Die Meldung reicht noch nicht — erst die Rückfrage klären.',
    }
  }

  // 2. Sind Dateien dabei, die niemals automatisch geändert werden?
  if (v.dateien.length === 0) {
    return { ausgang: 'abgelehnt', grund: 'Keine Datei genannt.' }
  }
  for (const datei of v.dateien) {
    const verboten = UNANTASTBAR.find(u => u.muster.test(datei))
    if (verboten) {
      return { ausgang: 'abgelehnt', grund: `${datei}: ${verboten.grund}` }
    }
  }

  // 3. Geld oder Recht: fertig bauen ja, von selbst ausrollen nie.
  //
  // Ein freigegebener heikler Fund darf gebaut werden — die Freigabe ist die
  // Bestätigung, die §133 verlangt. Rausgehen tut er trotzdem erst, wenn ein
  // Mensch das Ergebnis gesehen hat. Bestätigt wurde die Absicht, nicht der
  // Code.
  const heikelDurchBereich = istHeikel(v.fund.bereich, v.fund.heikel)
  const heikelDurchDatei = v.dateien.some(d => HEIKLE_PFADE.test(d))

  if (heikelDurchBereich && v.fund.freigabe !== 'freigegeben') {
    return {
      ausgang: 'abgelehnt',
      grund: 'Dieser Bereich berührt Geld oder Recht. Dafür braucht es erst '
        + 'eine ausdrückliche Freigabe.',
    }
  }
  if (heikelDurchBereich || heikelDurchDatei) {
    return {
      ausgang: 'sammeln',
      grund: 'Berührt Geld oder Recht — fertig gebaut und geprüft, wartet auf '
        + 'deine Freigabe.',
    }
  }

  // 4. Verhalten wartet immer.
  if (v.klasse !== 'anzeige') {
    return {
      ausgang: 'sammeln',
      grund: 'Ändert Verhalten — fertig gebaut und geprüft, wartet auf deine Freigabe.',
    }
  }

  // 5. „Anzeige" muss auch nach Anzeige aussehen.
  const nichtAnzeige = v.dateien.find(d => !ANZEIGE_ERLAUBT.test(d))
  if (nichtAnzeige) {
    return {
      ausgang: 'sammeln',
      grund: `${nichtAnzeige} ist keine reine Anzeigedatei — wartet auf deine Freigabe.`,
    }
  }
  if (v.dateien.length > DIREKT_MAX_DATEIEN) {
    return {
      ausgang: 'sammeln',
      grund: `${v.dateien.length} Dateien sind kein Tippfehler mehr — wartet auf `
        + 'deine Freigabe.',
    }
  }
  if (v.zeilen > DIREKT_MAX_ZEILEN) {
    return {
      ausgang: 'sammeln',
      grund: `${v.zeilen} geänderte Zeilen sind mehr als eine Kleinigkeit — wartet `
        + 'auf deine Freigabe.',
    }
  }

  return {
    ausgang: 'direkt',
    grund: 'Reine Anzeige, alle Prüfungen grün — ist raus.',
  }
}

// ── Der Prüfstand ──────────────────────────────────────────────────────────

export interface Pruefstand {
  /** Bestandene Nachweise am laufenden System */
  pruefungen?: number
  /** Fehlgeschlagene Nachweise */
  pruefungenFehler?: number
  modultests?: number
  modultestsFehler?: number
  build?: boolean
}

/**
 * Ist das geprüft genug, um es überhaupt in Betracht zu ziehen?
 *
 * Gilt für BEIDE Spuren, nicht nur für das direkte Ausrollen. Etwas, das nur
 * gesammelt wird, landet später genauso auf der Anlage — nur mit einem
 * Menschen dazwischen, und der kann einer roten Prüfung nicht ansehen, dass
 * sie rot ist.
 */
export function pruefstandReicht(p: Pruefstand): { ok: boolean; grund: string } {
  if (p.build !== true) {
    return { ok: false, grund: 'Der Build ist nicht durchgelaufen.' }
  }
  if ((p.pruefungenFehler ?? 0) > 0) {
    return {
      ok: false,
      grund: `${p.pruefungenFehler} Nachweis(e) am laufenden System sind rot.`,
    }
  }
  if ((p.modultestsFehler ?? 0) > 0) {
    return { ok: false, grund: `${p.modultestsFehler} Modultest(s) sind rot.` }
  }
  // Null bestandene Prüfungen heißt fast immer: Die Reihe ist gar nicht
  // gelaufen. Das sieht in einer Zusammenfassung aus wie „keine Fehler".
  if ((p.pruefungen ?? 0) < 1 || (p.modultests ?? 0) < 1) {
    return {
      ok: false,
      grund: 'Es wurde nichts geprüft — eine leere Prüfreihe ist kein grünes Ergebnis.',
    }
  }
  return { ok: true, grund: 'Alles grün.' }
}

// ── Anzeige ────────────────────────────────────────────────────────────────

export const AUSGANG_TEXT: Record<Ausgang, string> = {
  direkt: 'Automatisch behoben und ausgerollt',
  sammeln: 'Fertig — wartet auf deine Freigabe',
  abgelehnt: 'Nicht angefasst',
}

export type BehebungStatus =
  /** Gebaut und ausgerollt, ohne Rückfrage */
  | 'ausgerollt'
  /** Gebaut, geprüft, liegt auf einem Nebenzweig und wartet */
  | 'wartet'
  /** Der Mensch hat zugestimmt, der nächste Lauf führt es zusammen */
  | 'freigegeben'
  /** Der Mensch will es nicht */
  | 'verworfen'

export const STATUS_TEXT: Record<BehebungStatus, string> = {
  ausgerollt: 'Ausgerollt',
  wartet: 'Wartet auf dich',
  freigegeben: 'Freigegeben',
  verworfen: 'Verworfen',
}

/** Verbesserungen und Wünsche brauchen zusätzlich das zweite Tor: den Plan. */
export function brauchtPlanfreigabe(art: string): boolean {
  return brauchtFreigabe(art)
}
