/**
 * §260 Eine Datei direkt in den Objektspeicher laden — die Seite des Browsers.
 *
 * DER WEG IN DREI SCHRITTEN
 *   1. Bei der Anwendung einen Platz erfragen. Sie prüft Name und Art und
 *      gibt eine Adresse heraus, die fünf Minuten gilt.
 *   2. Die Datei an diese Adresse legen. Das geht direkt zum Speicher; die
 *      Anwendung sieht sie nie.
 *   3. Der Anwendung melden, wo sie liegt. Erst dann entsteht der Eintrag.
 *
 * WARUM NICHT EINFACH EINE ANFRAGE
 * Weil es genau die eine Anfrage war, die dreimal gescheitert ist. Beim alten
 * Weg lud das Telefon zur Anwendung, die Anwendung las die Datei vollständig
 * in den Arbeitsspeicher und schrieb sie in die Datenbank. Jede dieser drei
 * Stationen ist eine Stelle, an der eine mobile Verbindung abbrechen oder eine
 * Grenze zuschlagen kann — gemeldet wurde „Fehler 500, 204 kB" (§252), und
 * dann noch zweimal dasselbe.
 *
 * WARUM DER ALTE WEG TROTZDEM BLEIBT
 * Ist kein Objektspeicher eingerichtet, antwortet Schritt 1 mit
 * `speicher: 'aus'`. Dann meldet diese Stelle `kein-speicher`, und der Aufrufer
 * nimmt den alten Weg. Eine Umstellung, die ohne Einrichtung das Senden von
 * Dateien anhält, wäre schlimmer als der Zustand vorher.
 *
 * WAS DER UNTERSCHIED ZWISCHEN `abgewiesen` UND `kein-speicher` BEDEUTET
 * Das ist die wichtigste Unterscheidung hier.
 *
 *   `abgewiesen`    — die Datei selbst ist das Problem: zu groß, falsche Art,
 *                     Inhalt passt nicht zum Namen. Der alte Weg würde sie
 *                     mit derselben Begründung abweisen; ihn trotzdem zu
 *                     versuchen hieße, dieselbe Datei zweimal durch eine
 *                     mobile Verbindung zu schieben, um am Ende dieselbe
 *                     Meldung zu zeigen.
 *   `kein-speicher` — der direkte Weg stand nicht zur Verfügung. Über die
 *                     Datei ist damit nichts gesagt, und der alte Weg darf es
 *                     versuchen.
 */

export interface Platz {
  speicher: 'an' | 'aus'
  adresse?: string
  schluessel?: string
  typ?: string
  dateiname?: string
}

export type DirektErgebnis =
  /** Fertig — die Antwort der Anwendung auf die Meldung aus Schritt 3. */
  | { art: 'ok'; antwort: Record<string, unknown> }
  /** Die Datei wurde abgewiesen. Der alte Weg würde daran nichts ändern. */
  | { art: 'abgewiesen'; fehler: string }
  /** Der direkte Weg war nicht möglich. Der Aufrufer nimmt den alten. */
  | { art: 'kein-speicher' }

export async function direktHochladen(opts: {
  /** Wo ein Platz erfragt wird, etwa `/api/chat/<raum>/datei/adresse`. */
  adressePfad: string
  /** Wo gemeldet wird, wo die Datei liegt, etwa `/api/chat/<raum>/datei`. */
  vermerkPfad: string
  datei: File
  /** Zusätzliche Felder für die Meldung, etwa der Begleittext. */
  zusatz?: Record<string, string>
  /** Nur für die Prüfung einsetzbar. */
  holen?: typeof fetch
}): Promise<DirektErgebnis> {
  const hole = opts.holen ?? fetch

  // ── 1. Platz erfragen ──────────────────────────────────────────────────
  const anfrage = await hole(opts.adressePfad, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      dateiname: opts.datei.name,
      mimeType: opts.datei.type,
      groesse: opts.datei.size,
    }),
  }).catch(() => null)

  if (!anfrage) return { art: 'kein-speicher' }

  if (!anfrage.ok) {
    const d = await anfrage.json().catch(() => ({})) as { error?: string }
    /*
     * 400 heißt: Unsere eigene Prüfung hat Name oder Art abgewiesen. Das ist
     * eine Aussage über die Datei, nicht über den Speicher — siehe oben.
     */
    if (anfrage.status === 400 && d.error) return { art: 'abgewiesen', fehler: d.error }
    return { art: 'kein-speicher' }
  }

  const platz = await anfrage.json().catch(() => ({})) as Platz
  if (platz.speicher !== 'an' || !platz.adresse || !platz.schluessel || !platz.typ) {
    return { art: 'kein-speicher' }
  }

  // ── 2. Die Datei direkt ablegen ────────────────────────────────────────
  /*
   * Der Typ MUSS genau der sein, der in der Adresse steht — er ist
   * mitsigniert. Ein anderer ergibt eine Absage von Cloudflare, und die nennt
   * den Grund nicht.
   */
  const ablage = await hole(platz.adresse, {
    method: 'PUT',
    headers: { 'content-type': platz.typ },
    body: opts.datei,
  }).catch(() => null)

  // Scheitert das Ablegen, ist über die Datei nichts gesagt: alter Weg.
  if (!ablage || !ablage.ok) return { art: 'kein-speicher' }

  // ── 3. Melden, wo sie liegt ────────────────────────────────────────────
  const vermerk = await hole(opts.vermerkPfad, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      objektSchluessel: platz.schluessel,
      dateiname: platz.dateiname ?? opts.datei.name,
      mimeType: platz.typ,
      ...opts.zusatz,
    }),
  }).catch(() => null)

  if (!vermerk) {
    /*
     * Hier liegt die Datei im Speicher, aber die Meldung kam nicht durch. Den
     * alten Weg zu nehmen hieße, sie ein zweites Mal hochzuladen — und das
     * erste Objekt bliebe als Leiche liegen. Besser ehrlich sein: Die
     * Anwendung räumt verwaiste Objekte beim nächsten Durchgang weg.
     */
    return {
      art: 'abgewiesen',
      fehler: 'Die Datei wurde übertragen, die Bestätigung kam aber nicht an. '
        + 'Bitte die Ansicht neu laden — wenn sie dort fehlt, noch einmal senden.',
    }
  }

  const d = await vermerk.json().catch(() => ({})) as Record<string, unknown>
  if (!vermerk.ok) {
    return {
      art: 'abgewiesen',
      fehler: typeof d.error === 'string' ? d.error
        : `Die Datei ließ sich nicht senden (Fehler ${vermerk.status}).`,
    }
  }
  return { art: 'ok', antwort: d }
}
