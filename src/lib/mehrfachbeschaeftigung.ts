import type { Lohnjahr } from './lohnjahre'

/**
 * §158 Mehrfachbeschäftigung (§22 Abs. 2 SGB IV).
 *
 * WARUM DAS IN DER PFLEGE HÄUFIGER IST ALS ANDERSWO
 * Zwei halbe Stellen in zwei Häusern, eine Festanstellung plus Wochenenddienst
 * beim Nachbarträger, Teilzeit plus Minijob — das ist der Normalfall, nicht die
 * Ausnahme. Jeder dieser Fälle rechnet anders als eine einzelne Beschäftigung.
 *
 * DER FEHLER: JEDER ARBEITGEBER RECHNET FÜR SICH
 * Die Beitragsbemessungsgrenze gilt pro Person, nicht pro Arbeitgeber. Wer sie
 * nur auf das eigene Entgelt anwendet, führt insgesamt zu viel ab — bei zwei
 * Arbeitgebern und zusammen mehr als der Grenze zahlt die Person doppelt auf
 * denselben Euro oberhalb der Grenze.
 *
 * §22 Abs. 2 SGB IV teilt die Grenze deshalb im VERHÄLTNIS der Entgelte auf:
 * Wer die Hälfte des Gesamtentgelts zahlt, verbeitragt die Hälfte der Grenze.
 *
 * WORAUF SICH DAS PROGRAMM NICHT VERLÄSST
 * Auf eine geratene Zahl. Ohne Angabe des anderen Entgelts wird ganz normal
 * gerechnet — mit voller Grenze. Das ist der sichere Weg: Zu viel abgeführte
 * Beiträge holt sich die Person über die Krankenkasse zurück, zu wenig
 * abgeführte holt sich die Rentenversicherung beim Betrieb.
 *
 * Und die Krankenkasse hat das letzte Wort: Sie stellt das Gesamtentgelt fest
 * und teilt es beiden Arbeitgebern mit (§28i SGB IV). Was hier steht, ist die
 * Angabe des Beschäftigten, bis die Kasse geantwortet hat.
 */

export interface AnteiligeGrenze {
  /** Die Grenze, die für diesen Arbeitgeber gilt */
  grenze: number
  /** Das Gesamtentgelt aus allen Beschäftigungen */
  gesamt: number
  /** Der Anteil dieses Arbeitgebers am Gesamtentgelt */
  anteil: number
  /** Greift die Aufteilung überhaupt? */
  geteilt: boolean
}

/**
 * Die anteilige Beitragsbemessungsgrenze eines Arbeitgebers.
 *
 * Solange die Summe unter der Grenze bleibt, ändert sich nichts — dann
 * verbeitragt jeder sein volles Entgelt. Erst darüber wird geteilt.
 */
export function anteiligeGrenze(
  eigenesEntgelt: number,
  weiteresEntgelt: number,
  bbg: number,
): AnteiligeGrenze {
  const eigen = Math.max(0, eigenesEntgelt)
  const weiter = Math.max(0, weiteresEntgelt)
  const gesamt = runde(eigen + weiter)

  if (weiter <= 0 || gesamt <= bbg || gesamt === 0) {
    return { grenze: bbg, gesamt, anteil: gesamt > 0 ? eigen / gesamt : 1, geteilt: false }
  }

  const anteil = eigen / gesamt
  return { grenze: runde(bbg * anteil), gesamt, anteil, geteilt: true }
}

export interface Lage {
  hinweise: string[]
  /** Muss die Krankenkasse befragt werden? */
  kasseFragen: boolean
}

/**
 * Was zu einer Mehrfachbeschäftigung gesagt werden muss.
 *
 * Die Hinweise sind nicht Beiwerk: Ohne die Meldung an die Krankenkasse bleibt
 * die Aufteilung eine Behauptung, und ohne Steuerklasse VI besteuert das
 * zweite Arbeitsverhältnis zu niedrig.
 */
export function lage(
  eigenesEntgelt: number,
  weiteresEntgelt: number,
  steuerklasse: number,
  jahr: Lohnjahr,
  /** Ist dieses Verhältnis das zweite (oder spätere) der Person? */
  istNebenbeschaeftigung: boolean,
): Lage {
  const hinweise: string[] = []
  const gesamt = runde(eigenesEntgelt + weiteresEntgelt)
  const ueberRv = gesamt > jahr.bbgRvAvMonat
  const ueberKv = gesamt > jahr.bbgKvPvMonat

  if (weiteresEntgelt > 0) {
    hinweise.push(
      `Mehrfachbeschäftigung: Neben diesem Entgelt sind `
      + `${euro(weiteresEntgelt)} aus einer weiteren Beschäftigung angegeben, `
      + `zusammen ${euro(gesamt)}.`,
    )
  }
  if (ueberKv || ueberRv) {
    hinweise.push(
      'Das Gesamtentgelt übersteigt eine Beitragsbemessungsgrenze. Die '
      + 'Beiträge werden im Verhältnis der Entgelte aufgeteilt '
      + '(§22 Abs. 2 SGB IV) — sonst zahlt die Person auf denselben Euro '
      + 'zweimal.',
    )
  }
  if (istNebenbeschaeftigung && steuerklasse !== 6) {
    hinweise.push(
      `Dies ist das zweite Arbeitsverhältnis, die Steuerklasse steht aber auf `
      + `${steuerklasse}. Ein zweites Dienstverhältnis wird nach Steuerklasse VI `
      + 'besteuert (§38b Abs. 1 Satz 2 Nr. 6 EStG) — sonst fehlt am Jahresende '
      + 'Lohnsteuer, die die Person nachzahlen muss.',
    )
  }

  return { hinweise, kasseFragen: weiteresEntgelt > 0 && (ueberKv || ueberRv) }
}

/**
 * Minijob neben einer Hauptbeschäftigung (§8 Abs. 2 SGB IV).
 *
 * Die Regel, die am häufigsten überrascht: EIN Minijob neben einer
 * versicherungspflichtigen Hauptbeschäftigung bleibt geringfügig. Ein ZWEITER
 * wird mit der Hauptbeschäftigung zusammengerechnet und damit in der Kranken-,
 * Pflege- und Rentenversicherung versicherungspflichtig — nur die
 * Arbeitslosenversicherung bleibt außen vor.
 *
 * Für den zweiten Betrieb heißt das: Er zahlt keine Pauschalbeiträge mehr,
 * sondern normale Beiträge. Wer das übersieht, bekommt es bei der
 * Betriebsprüfung rückwirkend für vier Jahre.
 */
export function minijobNeben(
  weitereMinijobs: number,
  hatHauptbeschaeftigung: boolean,
): { pflichtig: boolean; hinweis: string | null } {
  if (!hatHauptbeschaeftigung) {
    // Mehrere Minijobs ohne Hauptbeschäftigung werden zusammengerechnet; über
    // der Geringfügigkeitsgrenze sind alle versicherungspflichtig.
    return weitereMinijobs > 0
      ? {
          pflichtig: false,
          hinweis:
            'Mehrere Minijobs ohne Hauptbeschäftigung werden zusammengerechnet '
            + '(§8 Abs. 2 SGB IV). Übersteigt die Summe die '
            + 'Geringfügigkeitsgrenze, sind alle versicherungspflichtig — das '
            + 'stellt die Minijob-Zentrale fest.',
        }
      : { pflichtig: false, hinweis: null }
  }

  if (weitereMinijobs === 0) {
    return {
      pflichtig: false,
      hinweis:
        'Ein Minijob neben einer versicherungspflichtigen Hauptbeschäftigung '
        + 'bleibt geringfügig (§8 Abs. 2 Satz 1 SGB IV).',
    }
  }

  return {
    pflichtig: true,
    hinweis:
      'Dies ist mindestens der zweite Minijob neben einer Hauptbeschäftigung. '
      + 'Er wird mit ihr zusammengerechnet und ist in der Kranken-, Pflege- '
      + 'und Rentenversicherung versicherungspflichtig (§8 Abs. 2 Satz 1 '
      + 'SGB IV) — nur die Arbeitslosenversicherung bleibt außen vor. Es sind '
      + 'keine Pauschalbeiträge mehr abzuführen.',
  }
}

export function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100
}

function euro(betrag: number): string {
  return `${betrag.toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })} €`
}
