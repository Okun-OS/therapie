/**
 * §143 Was der Melder zu hören bekommt.
 *
 * DAS PROBLEM, DAS DAS LÖST
 * Bisher verschwand eine Meldung im Nichts. Wer einen Fehler meldet, weiß
 * danach nicht, ob ihn jemand gelesen hat, ob daran gearbeitet wird, und ob es
 * jemals behoben wurde. Beim zweiten Mal meldet man dann nichts mehr — und
 * genau die Leute, die den Betrieb kennen, hören auf, uns zu sagen, was kaputt
 * ist.
 *
 * DER MOMENT, UM DEN ES GEHT
 * Jemand meldet sonntags um elf, dass ein Knopf nicht funktioniert. Eine Stunde
 * später steht in seinem Kanal: „Ist behoben." Das ist kein Beiwerk, das ist
 * der Unterschied zwischen einem Werkzeug, dem man etwas erzählt, und einem,
 * dem man nichts mehr erzählt.
 *
 * DREI NACHRICHTEN, NICHT MEHR
 *   eingegangen  sofort beim Melden
 *   dran         wenn wir die Stelle gefunden haben und bauen
 *   behoben      wenn es draußen ist
 *
 * Die mittlere gibt es NUR, wenn es länger dauert — bei einer Kleinigkeit, die
 * in derselben Stunde rausgeht, wären zwei Nachrichten hintereinander nur
 * Lärm. Wer drei Nachrichten für einen Tippfehler bekommt, stellt sie ab.
 *
 * WAS NICHT DRINSTEHT
 * Keine Dateinamen, keine Commits, keine Fachbegriffe. Der Melder ist eine
 * Pflegekraft, keine Entwicklerin. Was technisch passiert ist, steht auf der
 * Fundeseite — dort, wo jemand es lesen will.
 */

export type Meldeanlass = 'eingegangen' | 'dran' | 'behoben' | 'nicht_umgesetzt'

export interface Meldetext {
  /** Was im Kanal steht */
  text: string
  /** Der Betreff der E-Mail — fehlt er, geht keine raus */
  betreff?: string
}

/** Ein Titel, kurz genug, um ihn in einem Satz zu zitieren. */
function kurz(titel: string, max = 70): string {
  const sauber = titel.trim().replace(/\s+/g, ' ')
  return sauber.length <= max ? sauber : `${sauber.slice(0, max - 1)}…`
}

/**
 * Der Text zu einem Anlass.
 *
 * `kennung` ist die Nummer des Funds (F-…) — sie steht dabei, damit jemand
 * nachfragen kann, ohne den Fehler noch einmal zu beschreiben.
 */
export function meldetext(
  anlass: Meldeanlass,
  fund: { kennung: string; titel: string; art?: string },
): Meldetext {
  const titel = kurz(fund.titel)
  const nr = fund.kennung

  switch (anlass) {
    case 'eingegangen':
      return {
        betreff: `Deine Meldung ist da (${nr})`,
        text:
          `Danke, dass du das gemeldet hast:\n„${titel}"\n\n`
          + 'Wir kümmern uns darum und melden uns hier, sobald es erledigt ist. '
          + `Du musst nichts weiter tun.\n\nDeine Nummer dazu: ${nr}`,
      }

    case 'dran':
      return {
        betreff: `Wir sind dran (${nr})`,
        text:
          `Kurze Zwischenmeldung zu „${titel}":\n\n`
          + 'Wir haben die Ursache gefunden und sind gerade dabei, sie zu beheben. '
          + 'Sobald die Änderung draußen ist, sagen wir hier Bescheid.',
      }

    case 'behoben':
      return {
        betreff: `Behoben (${nr})`,
        text:
          `Danke noch mal für deine Meldung „${titel}".\n\n`
          + 'Wir haben den Fehler behoben — es sollte jetzt funktionieren. '
          + 'Falls du die Seite gerade offen hast, lade sie einmal neu.\n\n'
          + 'Wenn es bei dir immer noch klemmt, schreib einfach hier zurück.',
      }

    case 'nicht_umgesetzt':
      return {
        betreff: `Zu deiner Meldung (${nr})`,
        text:
          `Zu „${titel}" haben wir uns entschieden, es vorerst nicht zu ändern.\n\n`
          + 'Deine Meldung war trotzdem richtig und ist nicht verloren — wenn du '
          + 'wissen willst, woran es lag, schreib hier zurück.',
      }
  }
}

/**
 * Lohnt sich eine Zwischenmeldung?
 *
 * Nur, wenn zwischen Melden und Beheben genug Zeit liegt, dass jemand sich
 * fragt, ob überhaupt etwas passiert. Eine Kleinigkeit, die in derselben
 * Viertelstunde rausgeht, braucht keine Ankündigung.
 */
export const ZWISCHENMELDUNG_AB_MINUTEN = 20

export function brauchtZwischenmeldung(gemeldetAm: Date, jetzt = new Date()): boolean {
  return (jetzt.getTime() - gemeldetAm.getTime()) / 60000 >= ZWISCHENMELDUNG_AB_MINUTEN
}
