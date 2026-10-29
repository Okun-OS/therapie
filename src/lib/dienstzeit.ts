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
 * Dieselbe Dauer in Stunden, auf eine Nachkommastelle.
 *
 * Mit `pausen` wird abgezogen, was der Standort vorgibt — ab welcher Dauer
 * und wie viel. Ohne Angabe wird nichts abgezogen; die Stelle entscheidet,
 * nicht diese Datei.
 */
export function dienstStunden(
  startTime: string,
  endTime: string,
  pausen?: { thresholdMinutes: number; deductionMinutes: number },
): number {
  let minuten = dienstMinuten(startTime, endTime)
  if (pausen && minuten >= pausen.thresholdMinutes) minuten -= pausen.deductionMinutes
  return Math.round(minuten * 10 / 60) / 10
}
