/**
 * §266 Wie lang ein Dienst ist — an einer Stelle.
 *
 * DER FUND
 * Auf einem Bildschirmfoto für den App Store stand beim Dienstplan einer
 * Pflegekraft:
 *
 *     4 Dienste diese Woche          −58h Stunden geplant
 *
 * Eine negative Zahl geplanter Stunden. Darunter siebenmal „Frei", obwohl
 * vier Dienste eingetragen waren.
 *
 * DIE URSACHE
 * Ein Nachtdienst geht von 21:00 bis 06:30. Rechnet man `Ende − Anfang`, kommt
 * `6·60+30 − 21·60 = −870` heraus: minus vierzehneinhalb Stunden. Mal vier
 * Dienste sind das die −58 Stunden.
 *
 * Diese Rechnung stand an SECHS Stellen im Programm. Vier davon hatten die
 * eine Zeile, auf die es ankommt — `wenn negativ, dann plus 24 Stunden`. Zwei
 * nicht: der Dienstplan des Mitarbeiters und seine Zeiterfassung.
 *
 * Also ausgerechnet die beiden Ansichten, die der Mensch sieht, um den es
 * geht. In der Leitungsansicht und auf dem Ausdruck stimmte es.
 *
 * WARUM DAS KEIN ZUFALL IST
 * Sechs Abschriften derselben Vorschrift laufen auseinander — das ist in
 * §229, §232 und §235 dreimal als Fehler aufgefallen, und hier ist es wieder
 * passiert. Eine Abschrift zu verbessern hilft nichts, solange es fünf weitere
 * gibt. Deshalb steht die Rechnung ab jetzt hier, einmal.
 *
 * WARUM NUR DIE SPANNE UND NICHT DIE PAUSE
 * Weil die Pausenregel nicht überall gleich ist: Die Leitungsansicht zieht
 * nach den Vorgaben des Standorts ab, der Ausdruck für die Akte nicht, und
 * der Prüfer des Dienstplans rundet anders. Diese Unterschiede sind gewollt.
 * Falsch war nur die Spanne — und genau die steht hier.
 *
 * ────────────────────────────────────────────────────────────────────────
 * §284 NACHTRAG: Die Pause gehört doch hierher.
 *
 * GEMELDET: „Oben sind 42,5 Stunden eingeplant. Wenn der 7 bis 15:30
 * arbeitet, sind es ja 8 Arbeitsstunden. Die halbe Stunde zählt nicht rein,
 * weil das Pause ist."
 *
 * Fünf Dienste von 07:00 bis 15:30 sind 42,5 Stunden Anwesenheit und 40
 * Stunden Arbeit. In der Leitungsansicht standen 40, beim Mitarbeiter 42,5.
 * Zwei Zahlen für dieselbe Woche — und die falsche stand ausgerechnet dort,
 * wo jemand seine eigene Arbeitszeit nachliest.
 *
 * Der Absatz oben hat die Pause absichtlich draußen gelassen, weil jede
 * Stelle sie selbst abziehen sollte. Genau das ist der Fehler gewesen: Von
 * vier Anzeigestellen zogen zwei ab und zwei nicht. „Jede Stelle entscheidet
 * selbst" heißt in der Praxis „die Hälfte vergisst es".
 *
 * Deshalb gibt es jetzt `geplanteMinuten` — die Zahl, die ein Mensch meint,
 * wenn er fragt, wie viel er diese Woche arbeitet. Die Pausenregel ist ein
 * PFLICHTARGUMENT: Wer die Spanne will, ruft `dienstMinuten`; wer die
 * Arbeitszeit will, muss sagen, nach welcher Regel. Vergessen kann man es
 * nicht mehr, das verhindert der Übersetzer.
 */

/**
 * Die Dauer eines Dienstes in Minuten, Mitternacht eingerechnet.
 *
 * `21:00` bis `06:30` sind neuneinhalb Stunden, nicht minus vierzehneinhalb.
 *
 * Ein Dienst, der zur selben Uhrzeit endet, an der er beginnt, gilt als
 * voller Tag — das ist die einzige Lesart, die Sinn ergibt: Eine Dauer von
 * null Minuten stünde in keinem Dienstplan.
 */
export function dienstMinuten(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if ([sh, sm, eh, em].some(z => !Number.isFinite(z))) return 0

  let minuten = (eh * 60 + em) - (sh * 60 + sm)
  if (minuten <= 0) minuten += 24 * 60
  return minuten
}

/**
 * Ab welcher Dauer wie viel Pause abgezogen wird.
 *
 * Kommt aus den Planungsregeln des Standorts
 * (`LocationPlanningRules.breakThresholdMinutes` / `…DeductionMinutes`).
 */
export interface Pausenregel {
  thresholdMinutes: number
  deductionMinutes: number
}

/**
 * Was gilt, solange der Standort nichts anderes hinterlegt hat.
 *
 * § 4 ArbZG: ab sechs Stunden mindestens 30 Minuten. Dieselben Zahlen stehen
 * als Vorgabewert an der Datenbankspalte — hier noch einmal, damit eine
 * Anzeige auch dann rechnen kann, wenn die Regeln (noch) nicht geladen sind.
 */
export const GESETZLICHE_PAUSE: Pausenregel = {
  thresholdMinutes: 360,
  deductionMinutes: 30,
}

/**
 * §284 Die geplante ARBEITSZEIT eines Dienstes in Minuten — ohne Pause.
 *
 * Das ist die Zahl, die ein Mensch meint, wenn er fragt, wie viel er diese
 * Woche arbeitet: 07:00 bis 15:30 sind 480 Minuten, nicht 510.
 *
 * Warum die Pause IMMER abgezogen wird, auch wenn der Standort
 * `autoBreakDeduction = false` gesetzt hat: Dieser Schalter entscheidet, ob
 * die Stempeluhr beim Ausstempeln selbsttätig eine Pause abzieht, wenn
 * niemand sie gestempelt hat. Mit dem PLAN hat er nichts zu tun. Ein Dienst
 * über sechs Stunden verlangt die Pause von Gesetzes wegen — ob sie
 * gestempelt oder gerechnet wird, ändert nichts daran, dass sie nicht
 * gearbeitet wird. Die Leitungsansicht und der Dienstplanprüfer rechnen seit
 * jeher so; neu ist nur, dass die Ansichten des Mitarbeiters es auch tun.
 *
 * Abgezogen wird nie mehr, als der Dienst lang ist — sonst stünde bei einer
 * falsch gepflegten Regel eine negative Arbeitszeit auf dem Bildschirm.
 */
export function geplanteMinuten(
  startTime: string,
  endTime: string,
  pausen: Pausenregel,
): number {
  const minuten = dienstMinuten(startTime, endTime)
  if (minuten < pausen.thresholdMinutes) return minuten
  return Math.max(0, minuten - Math.max(0, pausen.deductionMinutes))
}

/**
 * Dieselbe Dauer in Stunden, auf eine Nachkommastelle.
 *
 * Mit `pausen` wird abgezogen, was der Standort vorgibt — ab welcher Dauer
 * und wie viel. Ohne Angabe wird nichts abgezogen; die Stelle entscheidet,
 * nicht diese Datei.
 */
export function dienstStunden(
  startTime: string,
  endTime: string,
  pausen?: Pausenregel,
): number {
  const minuten = pausen
    ? geplanteMinuten(startTime, endTime, pausen)
    : dienstMinuten(startTime, endTime)
  return Math.round(minuten * 10 / 60) / 10
}

/**
 * Die Pausenregel aus dem, was `/api/planning-rules` liefert.
 *
 * Eigene Funktion, weil beide Mitarbeiter-Ansichten sie brauchen und zwei
 * Abschriften derselben Umrechnung genau der Fehler sind, den §266 und §284
 * schon beschrieben haben.
 */
export function pausenregelAus(rules: {
  breakThresholdMinutes?: number | null
  breakDeductionMinutes?: number | null
} | null | undefined): Pausenregel {
  const schwelle = rules?.breakThresholdMinutes
  const abzug = rules?.breakDeductionMinutes
  return {
    thresholdMinutes: typeof schwelle === 'number' && schwelle > 0
      ? schwelle : GESETZLICHE_PAUSE.thresholdMinutes,
    deductionMinutes: typeof abzug === 'number' && abzug >= 0
      ? abzug : GESETZLICHE_PAUSE.deductionMinutes,
  }
}
