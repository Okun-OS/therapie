/**
 * §239 Wohin eine Benachrichtigung führt.
 *
 * DIE MELDUNG
 * „Wenn man eine Benachrichtigung hat bei der Glocke, möchte ich bitte, dass es
 * möglich ist, dass man auf diese Benachrichtigung raufklickt. Man wird dahin
 * geleitet, worum es geht. Also beispielsweise, dich hat jemand angefragt für
 * einen Schichttausch, dann klicke ich rauf und dann möchte ich, dass ich zu
 * dieser Schichttauschanfrage hingeleitet werde."
 *
 * WARUM ES ZWEI WEGE GIBT UND NICHT EINEN
 * Ab §239 trägt jede neue Benachrichtigung ihre Adresse selbst (`url`). Das ist
 * der genauere Weg: Wer sie erzeugt, weiß, worum es geht.
 *
 * Nur haben alle BESTEHENDEN Zeilen keine. Hätte ich nur das Feld eingebaut,
 * wäre die Glocke für jeden, der heute hineinschaut, unverändert tot — die
 * Verbesserung käme erst bei der nächsten Benachrichtigung an. Deshalb die
 * Tabelle hier: Sie rechnet aus der ART ein Ziel aus, und zwar je nach Rolle.
 *
 * WARUM DIE ROLLE MITENTSCHEIDET
 * Dieselbe Art landet bei verschiedenen Leuten an verschiedenen Orten. Eine
 * gemeldete Abwesenheit führt die Leitung in die Zeiterfassung, wo sie sie
 * bearbeitet; dieselbe Meldung führt die betroffene Person zu ihrer eigenen
 * Krankmeldung. Eine Tabelle ohne Rolle träfe für die eine Hälfte daneben.
 *
 * WAS HIER NICHT STEHT
 * Kein Ziel ist auch eine Antwort. Eine Benachrichtigung, zu der es keinen Ort
 * gibt, bleibt ein Text — besser, als jemanden auf eine Seite zu schicken, auf
 * der er nicht findet, wovon die Rede war.
 */

export type Rolle = 'employee' | 'admin' | 'company' | 'okun'

/**
 * Je Art ein Ziel, getrennt nach dem, der es liest.
 *
 * `mitarbeiter` ist der Weg für die betroffene Person, `leitung` für die, die
 * etwas damit tun muss. Fehlt einer von beiden, gibt es für diese Rolle kein
 * Ziel — und dann wird nicht geraten.
 */
const ZIELE: Record<string, { mitarbeiter?: string; leitung?: string }> = {
  // ── Dienstplan und Tausch ───────────────────────────────────────────────
  schedule_published: { mitarbeiter: '/employee/schedule', leitung: '/admin/schedule' },
  // Die Reiternamen sind die der Seite selbst (`schedule`, `team`, `swaps`,
  // `wishes`) — nachgesehen, nicht geraten. Beim ersten Versuch stand hier
  // `?tab=tausch`, und das hätte still den Standardreiter geöffnet.
  swap_request: { mitarbeiter: '/employee/schedule?tab=swaps' },
  swap_accepted: { mitarbeiter: '/employee/schedule?tab=swaps' },
  swap_declined: { mitarbeiter: '/employee/schedule?tab=swaps' },
  wish_conflict: { mitarbeiter: '/employee/schedule?tab=wishes' },
  dienstausfall: { mitarbeiter: '/employee/schedule', leitung: '/admin/schedule' },
  dienstanfrage: { mitarbeiter: '/employee/substitutions', leitung: '/admin/substitutions' },
  dienst_uebernommen: { mitarbeiter: '/employee/schedule', leitung: '/admin/substitutions' },
  substitution_request: { mitarbeiter: '/employee/substitutions', leitung: '/admin/substitutions' },
  substitution_filled: { mitarbeiter: '/employee/substitutions', leitung: '/admin/substitutions' },

  // ── Urlaub ──────────────────────────────────────────────────────────────
  vacation_request_submitted: { mitarbeiter: '/employee/vacation', leitung: '/admin/urlaub' },
  vacation_request_approved: { mitarbeiter: '/employee/vacation', leitung: '/admin/urlaub' },
  vacation_request_denied: { mitarbeiter: '/employee/vacation', leitung: '/admin/urlaub' },
  vacation_plan_published: { mitarbeiter: '/employee/vacation', leitung: '/admin/urlaub' },
  vacation_plan_conflict: { mitarbeiter: '/employee/vacation', leitung: '/admin/urlaub' },
  'vacation-wishes-campaign': { mitarbeiter: '/employee/vacation', leitung: '/admin/urlaub' },

  // ── Zeiten ──────────────────────────────────────────────────────────────
  overtime_request_submitted: { mitarbeiter: '/employee/time-tracking', leitung: '/admin/time-tracking' },
  absence_reported: { mitarbeiter: '/employee/krank', leitung: '/admin/time-tracking' },
  sick_leave_reported: { mitarbeiter: '/employee/krank', leitung: '/admin/time-tracking' },

  // ── Nachweise und Belehrungen ───────────────────────────────────────────
  belehrung: { mitarbeiter: '/employee/nachweise', leitung: '/admin/nachweise' },
  belehrung_erinnerung: { mitarbeiter: '/employee/nachweise', leitung: '/admin/nachweise' },
  nachweis_angefordert: { mitarbeiter: '/employee/nachweise', leitung: '/admin/nachweise' },
  nachweis_erinnerung: { mitarbeiter: '/employee/nachweise', leitung: '/admin/nachweise' },
  nachweis_nachricht: { mitarbeiter: '/employee/nachweise', leitung: '/admin/nachweise' },
  nachweis_rueckfrage: { mitarbeiter: '/employee/nachweise', leitung: '/admin/nachweise' },
  nachweis_erledigt: { mitarbeiter: '/employee/nachweise', leitung: '/admin/nachweise' },

  // ── Lohn ────────────────────────────────────────────────────────────────
  lohnabrechnung: { mitarbeiter: '/employee/lohn', leitung: '/admin/payroll' },

  // ── Nachrichten ─────────────────────────────────────────────────────────
  colleague_message: { mitarbeiter: '/employee/nachrichten', leitung: '/admin/nachrichten' },
  announcement: { mitarbeiter: '/employee/nachrichten', leitung: '/admin/nachrichten' },

  // ── Frühwarnungen der Auswertung — nur für die Leitung ──────────────────
  'high-sickness-rate': { leitung: '/admin/auswertungen' },
  'high-overtime': { leitung: '/admin/auswertungen' },
  'personnel-shortage': { leitung: '/admin/auswertungen' },
  'critical-understaffing': { leitung: '/admin/auswertungen' },
  'missing-scheduling': { leitung: '/admin/schedule' },
  'open-vacation-requests': { leitung: '/admin/urlaub' },
  'vacation-planning-conflict': { leitung: '/admin/urlaub' },
}

/**
 * Das Ziel einer Benachrichtigung — die gespeicherte Adresse hat Vorrang.
 *
 * `null` heißt: kein Ziel. Dann bleibt der Eintrag ein Text und wird beim
 * Antippen nur als gelesen markiert, wie bisher.
 */
export function benachrichtigungsziel(
  // `type` wahlfrei: Die Oberfläche hält nicht überall den vollen Datensatz,
  // und ohne Art gibt es eben kein hergeleitetes Ziel — kein Grund, dafür
  // einen Typfehler zu bauen.
  benachrichtigung: { type?: string | null; url?: string | null },
  rolle: string | null | undefined,
): string | null {
  /*
   * Die mitgegebene Adresse zuerst — und nur, wenn sie innerhalb dieses
   * Programms liegt. Ein `https://…` aus einer Benachrichtigung wäre ein Weg,
   * jemanden aus der App heraus auf eine fremde Seite zu schicken; dass die
   * Adressen heute alle aus dem eigenen Code kommen, ist kein Grund, die
   * Prüfung wegzulassen.
   */
  const gespeichert = benachrichtigung.url?.trim()
  if (gespeichert && gespeichert.startsWith('/') && !gespeichert.startsWith('//')) {
    return gespeichert
  }

  if (!benachrichtigung.type) return null
  const eintrag = ZIELE[benachrichtigung.type]
  if (!eintrag) return null
  return rolle === 'employee'
    ? eintrag.mitarbeiter ?? null
    : eintrag.leitung ?? null
}
