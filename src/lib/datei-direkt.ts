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
  /**
   * §261 Die Unterschrift über diesen Platz. Sie geht unverändert zurück —
   * die Anwendung erkennt daran, dass sie den Platz selbst ausgegeben hat.
   */
  nachweis?: string
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
  /**
   * §261 Wohin die Datei gehört. Geht an BEIDE Stellen — an die, die den
   * Platz ausgibt, und an die, die ihn einlöst.
   *
   * Das ist nicht Bequemlichkeit: Die Zugriffsprüfung muss an beiden Stellen
   * laufen, und sie kann nur prüfen, was sie kennt. Für die Personalakte
   * stehen hier `ownerType`, `ownerId` und `kategorie`; beim Chat steckt der
   * Raum schon im Pfad.
   */
  kontext?: Record<string, string>
  /** Zusätzliche Felder nur für die Meldung, etwa der Begleittext. */
  zusatz?: Record<string, string | boolean>
  /** Nur für die Prüfung einsetzbar. */
  holen?: typeof fetch
}): Promise<DirektErgebnis> {
  const hole = opts.holen ?? fetch

  // ── 1. Platz erfragen ──────────────────────────────────────────────────
  const anfrage = await hole(opts.adressePfad, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...opts.kontext,
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
  const melden = () => hole(opts.vermerkPfad, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...opts.kontext,
      objektSchluessel: platz.schluessel,
      nachweis: platz.nachweis,
      dateiname: platz.dateiname ?? opts.datei.name,
      mimeType: platz.typ,
      ...opts.zusatz,
    }),
  }).catch(() => null)

  let vermerk = await melden()

  /*
   * §262 Ein zweiter Versuch — und zwar nur HIER.
   *
   * Das ist der unangenehmste Punkt im ganzen Ablauf: Die Datei liegt im
   * Speicher, aber die Meldung darüber kam nicht durch. Den alten Weg zu
   * nehmen hieße, dieselbe Datei ein zweites Mal hochzuladen, und das erste
   * Objekt bliebe liegen, ohne dass irgendein Eintrag davon weiß.
   *
   * Die Meldung ist dagegen klein — ein paar hundert Bytes JSON. Dass sie
   * scheitert, während der Upload gerade gelungen ist, spricht für ein kurzes
   * Loch in der Verbindung, nicht für ein dauerhaftes. Also einmal warten und
   * noch einmal.
   *
   * Zweimal zu melden ist dabei unbedenklich: Der Platz lässt sich nur einmal
   * einlösen (§261, eindeutiger Index), der zweite Versuch bekäme „bereits
   * gesendet".
   */
  if (!vermerk) {
    await new Promise(fertig => setTimeout(fertig, 1500))
    vermerk = await melden()
  }

  if (!vermerk) {
    /*
     * Jetzt ist es ehrlich gesagt: Das Objekt BLEIBT liegen. Es kostet Platz
     * und niemand kommt an es heran — einen Durchgang, der verwaiste Objekte
     * wegräumt, gibt es noch nicht. Genau deshalb steht hier kein
     * beruhigender Satz, sondern der Hinweis, was der Mensch tun soll.
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
