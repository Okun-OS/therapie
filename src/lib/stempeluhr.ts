/**
 * §137 Die Stempeluhr — eine Stelle, an der gestempelt wird.
 *
 * Bisher lag das Stempeln im Browser verteilt: erst eine Zeitbuchung anlegen,
 * dann eine Erfassung starten, beim Ausstempeln die Buchung ergänzen und die
 * Erfassung schließen. Vier Aufrufe, und der Browser musste sich merken,
 * welcher davon geklappt hat.
 *
 * Auf der Startseite der Mitarbeiter-App war deshalb ein Knopf „Einstempeln",
 * der NICHTS GETAN HAT — er hat nur die Anzeige umgeschaltet. Wer darauf
 * gedrückt hat und weggegangen ist, war nicht eingestempelt. In einem System,
 * in dem die gestempelte Zeit direkt Geld wird, ist das der schlimmste Fehler
 * von allen: Er sieht aus wie Erfolg.
 *
 * Ab hier gibt es einen Aufruf je Handgriff. Der Server führt beide Seiten
 * nach und antwortet mit dem neuen Zustand. Das ist auch die Voraussetzung für
 * den Offlinebetrieb: Was nachgereicht werden muss, ist genau ein Aufruf, nicht
 * eine Kette, die in der Mitte abbrechen kann.
 *
 * DER ZEITPUNKT VOM GERÄT
 * -----------------------
 * Im Funkloch entsteht der Stempel auf dem Telefon und wird später
 * übertragen. Dann zählt die Zeit, zu der jemand wirklich gekommen ist — nicht
 * die des Hochladens. Sonst wäre die Zeiterfassung wertlos.
 *
 * Ein mitgeschickter Zeitpunkt wird deshalb angenommen, aber eng geführt:
 *   – niemals in der Zukunft
 *   – höchstens 24 Stunden zurück
 *   – und immer als NACHGEREICHT gekennzeichnet
 *
 * Die Standortleitung sieht beim Monatsabschluss, welcher Eintrag vom Gerät kam
 * und welcher aus dem Funkloch. Ohne diese Kennzeichnung wäre der Zeitpunkt
 * eine Behauptung, die niemand prüfen kann — und sie entscheidet über Lohn.
 */

export type Stempelaktion = 'kommen' | 'gehen' | 'pause-start' | 'pause-ende'

/** Woher ein Zeiteintrag stammt. */
export type Quelle =
  /** Direkt in der App gestempelt */
  | 'app'
  /** Im Funkloch entstanden und später übertragen */
  | 'offline'
  /** Von der Standortleitung nachgetragen */
  | 'leitung'

export const QUELLE_TEXT: Record<Quelle, string> = {
  app: 'in der App gestempelt',
  offline: 'ohne Netz gestempelt, später übertragen',
  leitung: 'von der Leitung nachgetragen',
}

/** So weit darf ein nachgereichter Stempel zurückliegen. */
export const MAX_NACHREICHUNG_STUNDEN = 24

/** Kleine Abweichung nach vorn, die Uhren zwischen Gerät und Server haben. */
const UHREN_TOLERANZ_MINUTEN = 2

export interface Uhrzustand {
  /** Läuft gerade eine Erfassung? */
  laeuft: boolean
  /** Läuft gerade eine Pause? */
  pause: boolean
}

export interface Pruefung {
  erlaubt: boolean
  /** Warum nicht — in der Sprache des Mitarbeiters */
  text?: string
}

/**
 * Darf dieser Handgriff jetzt gemacht werden?
 *
 * Absichtlich als reine Funktion: Die Reihenfolge der Handgriffe entscheidet
 * darüber, ob am Monatsende die richtige Zahl herauskommt, und gehört zu den
 * Stellen, die man einzeln nachrechnen können muss.
 */
export function pruefeAktion(aktion: Stempelaktion, zustand: Uhrzustand): Pruefung {
  switch (aktion) {
    case 'kommen':
      if (zustand.laeuft) {
        return {
          erlaubt: false,
          text: 'Du bist bereits eingestempelt. Stemple erst aus, bevor du neu anfängst.',
        }
      }
      return { erlaubt: true }

    case 'gehen':
      if (!zustand.laeuft) {
        return { erlaubt: false, text: 'Du bist gerade nicht eingestempelt.' }
      }
      return { erlaubt: true }

    case 'pause-start':
      if (!zustand.laeuft) {
        return {
          erlaubt: false,
          text: 'Eine Pause gibt es nur während der Arbeitszeit. Stemple zuerst ein.',
        }
      }
      if (zustand.pause) {
        return { erlaubt: false, text: 'Deine Pause läuft schon.' }
      }
      return { erlaubt: true }

    case 'pause-ende':
      if (!zustand.pause) {
        return { erlaubt: false, text: 'Es läuft gerade keine Pause.' }
      }
      return { erlaubt: true }
  }
}

export interface Zeitpruefung {
  zeitpunkt: Date
  quelle: Quelle
  /** Hinweis, wenn der mitgeschickte Zeitpunkt nicht übernommen wurde */
  hinweis?: string
}

/**
 * Welcher Zeitpunkt gilt — der vom Gerät oder der des Servers?
 *
 * Ohne Angabe: jetzt. Mit Angabe: die des Geräts, sofern sie plausibel ist.
 * Ein Zeitpunkt aus der Zukunft oder von vorgestern wird verworfen, nicht
 * korrigiert — wer die Uhr seines Telefons verstellt, soll nicht bestimmen,
 * was am Monatsende ausgezahlt wird.
 */
export function bestimmeZeitpunkt(
  gemeldet: string | null | undefined,
  jetzt: Date = new Date(),
): Zeitpruefung {
  if (!gemeldet) return { zeitpunkt: jetzt, quelle: 'app' }

  const wert = new Date(gemeldet)
  if (Number.isNaN(wert.getTime())) {
    return {
      zeitpunkt: jetzt, quelle: 'app',
      hinweis: 'Der mitgeschickte Zeitpunkt war unlesbar — es gilt die Uhrzeit des Servers.',
    }
  }

  const minutenVoraus = (wert.getTime() - jetzt.getTime()) / 60000
  if (minutenVoraus > UHREN_TOLERANZ_MINUTEN) {
    return {
      zeitpunkt: jetzt, quelle: 'app',
      hinweis: 'Der mitgeschickte Zeitpunkt lag in der Zukunft — es gilt die Uhrzeit des Servers.',
    }
  }

  const stundenZurueck = (jetzt.getTime() - wert.getTime()) / 3600000
  if (stundenZurueck > MAX_NACHREICHUNG_STUNDEN) {
    return {
      zeitpunkt: jetzt, quelle: 'app',
      hinweis: `Der mitgeschickte Zeitpunkt lag mehr als ${MAX_NACHREICHUNG_STUNDEN} Stunden `
        + 'zurück. So etwas trägt die Standortleitung nach, damit es jemand ansieht.',
    }
  }

  // Innerhalb der Toleranz nach vorn: die Uhren gehen leicht auseinander, das
  // ist kein Nachreichen. Deutlich zurück: im Funkloch entstanden.
  const quelle: Quelle = stundenZurueck * 60 > UHREN_TOLERANZ_MINUTEN ? 'offline' : 'app'
  return { zeitpunkt: quelle === 'offline' ? wert : jetzt, quelle }
}

/** Uhrzeit als "HH:MM", wie sie in der Zeitbuchung steht. */
export function alsUhrzeit(d: Date): string {
  return d.toTimeString().slice(0, 5)
}

/** Der Tag, zu dem ein Stempel gehört — der Tag, an dem er entsteht. */
export function alsTag(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    + `-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Gearbeitete Minuten zwischen zwei Zeitpunkten.
 *
 * Über Mitternacht hinweg: Eine Nachtschicht von 22:00 bis 06:00 ist acht
 * Stunden, nicht minus sechzehn. Der Tag bleibt dabei der des Beginns —
 * so zählt ihn auch die Lohnabrechnung (§136).
 */
export function gearbeiteteMinuten(von: Date, bis: Date): number {
  const roh = Math.round((bis.getTime() - von.getTime()) / 60000)
  return Math.max(0, roh)
}
