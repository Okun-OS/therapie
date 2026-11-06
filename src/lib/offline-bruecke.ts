/**
 * §280 Die Brücke zwischen der App und der Seite, die ohne Netz erscheint.
 *
 * WARUM ES SIE GEBEN MUSS
 * Die Hülle lädt die Anwendung vom Server. Ohne Netz scheitert dieser Aufruf
 * UNTERHALB des Dienst-Arbeiters: In einer Android-WebView greift er nur in
 * Nachladungen einer bereits geladenen Seite ein, nicht in die oberste
 * Navigation. Gemessen am 02.11.2026 auf einem echten Telefon — die App zeigte
 * im Flugmodus einen schwarzen Bildschirm.
 *
 * Was ohne Netz noch da ist, ist allein das, was IM Programm liegt: die Seite
 * `native/web/fehler.html`. Die wird von Capacitor aus dem Paket ausgeliefert
 * und läuft unter `https://localhost` — also unter einem ANDEREN Ursprung als
 * die Anwendung. Sie sieht deren `localStorage` nicht, und die Capacitor-
 * Brücke wird dort nicht eingesetzt (nachgelesen in `WebViewLocalServer`:
 * eine Fehlerseite wird roh ausgeliefert, ohne eingespritztes Programm).
 *
 * Deshalb eine eigene, winzige Brücke in der Hülle: ein Java-Objekt namens
 * `OkunOffline`, das in JEDER Seite der WebView erreichbar ist, gleich unter
 * welchem Ursprung. Darüber legt die Anwendung ab, was die Offline-Seite
 * zeigen soll, und holt sich, was dort gestempelt wurde.
 *
 * WAS HIER NICHT PASSIERT
 * Senden. Was die Offline-Seite aufnimmt, wandert beim nächsten Start in die
 * BESTEHENDE Warteschlange (`warteschlange.ts`) — die kennt Wiederholung,
 * Reihenfolge und Beurteilung der Antwort schon. Eine zweite Übertragung
 * daneben wäre eine zweite Wahrheit darüber, was abgeschickt wurde.
 */

/** Die Aktionen, die die Stempeluhr kennt. Mehr nimmt die Brücke nicht an. */
export const STEMPEL_AKTIONEN = ['kommen', 'gehen', 'pause-start', 'pause-ende'] as const
export type StempelAktion = (typeof STEMPEL_AKTIONEN)[number]

/** Wie viele gemerkte Stempel höchstens übernommen werden. */
export const HOECHSTENS = 50

export interface Schnappschuss {
  /** Wann dieser Stand entstand — die Offline-Seite sagt das dazu. */
  stand: string
  /** Nur der Rufname. Mehr braucht die Seite nicht, und mehr liegt dann auch nicht im Gerät. */
  name: string
  zustand: { laeuft: boolean; pause: boolean }
  /** Der heutige Dienst, falls geplant. */
  dienst: { von: string; bis: string; name: string } | null
}

export interface OfflineStempel {
  aktion: StempelAktion
  zeitpunkt: string
}

/** Das Java-Objekt, das die Hülle in jede Seite legt. Im Browser fehlt es. */
interface Bruecke {
  schnappschussSchreiben?: (json: string) => void
  schnappschussLesen?: () => string
  stempelMerken?: (json: string) => void
  stempelHolen?: () => string
  stempelLeeren?: () => void
}

export function bruecke(): Bruecke | null {
  if (typeof window === 'undefined') return null
  const b = (window as unknown as { OkunOffline?: Bruecke }).OkunOffline
  return b ?? null
}

// ── Was die Anwendung hinterlegt ───────────────────────────────────────────

/**
 * Den Rufnamen aus einem vollen Namen.
 *
 * Nur der Vorname wandert ins Gerät. „Guten Morgen, Deniz" reicht der
 * Offline-Seite; ein vollständiger Name in einem unverschlüsselten
 * Gerätespeicher wäre mehr, als die Begrüßung wert ist.
 */
export function rufname(voll: string | null | undefined): string {
  return (voll ?? '').trim().split(/\s+/)[0] ?? ''
}

export function schnappschussSchreiben(s: Schnappschuss): boolean {
  const b = bruecke()
  if (!b?.schnappschussSchreiben) return false
  try {
    b.schnappschussSchreiben(JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

// ── Was von der Offline-Seite zurückkommt ──────────────────────────────────

/**
 * Prüfen, was aus dem Gerätespeicher kommt — bevor es in die Warteschlange geht.
 *
 * Diese Angaben stammen aus einer Datei auf dem Telefon, nicht aus unserer
 * Anwendung. Fehlerhafte Einträge dürfen nicht in die Warteschlange: Die
 * wiederholt bis zu zwanzigmal, und eine kaputte Zeile würde zwanzigmal gegen
 * den Server laufen und dabei die gültigen Stempel hinter sich aufhalten.
 *
 * Verworfen wird still — aber nicht spurlos: Der Aufrufer bekommt die Zahl.
 */
export function stempelPruefen(roh: unknown): {
  gueltig: OfflineStempel[]
  verworfen: number
} {
  if (!Array.isArray(roh)) return { gueltig: [], verworfen: 0 }

  const gueltig: OfflineStempel[] = []
  let verworfen = 0

  for (const eintrag of roh.slice(0, HOECHSTENS)) {
    const e = eintrag as Partial<OfflineStempel>
    const aktionOk = typeof e?.aktion === 'string'
      && (STEMPEL_AKTIONEN as readonly string[]).includes(e.aktion)
    const zeitOk = typeof e?.zeitpunkt === 'string'
      && !Number.isNaN(Date.parse(e.zeitpunkt))

    if (aktionOk && zeitOk) {
      gueltig.push({ aktion: e.aktion as StempelAktion, zeitpunkt: e.zeitpunkt as string })
    } else {
      verworfen++
    }
  }

  verworfen += Math.max(0, roh.length - HOECHSTENS)
  return { gueltig, verworfen }
}

/**
 * Nach der Zeit des Stempelns sortieren.
 *
 * Die Reihenfolge ist nicht Kosmetik: „gehen" vor „kommen" ergibt eine
 * negative Arbeitszeit. Die Offline-Seite schreibt zwar der Reihe nach, aber
 * verlassen wird sich darauf nicht — die Datei kann auch von einem früheren
 * Lauf stammen.
 */
export function nachZeit(stempel: OfflineStempel[]): OfflineStempel[] {
  return [...stempel].sort((a, b) => Date.parse(a.zeitpunkt) - Date.parse(b.zeitpunkt))
}

/**
 * Was die Offline-Seite aufgenommen hat, aus dem Gerät holen.
 *
 * Geleert wird erst, wenn der Aufrufer bestätigt hat, dass er die Stempel
 * übernommen hat — sonst wäre ein Absturz zwischen Holen und Einreihen ein
 * verlorener Arbeitstag.
 */
export function offeneStempel(): { gueltig: OfflineStempel[]; verworfen: number } {
  const b = bruecke()
  if (!b?.stempelHolen) return { gueltig: [], verworfen: 0 }
  try {
    const roh = b.stempelHolen()
    if (!roh) return { gueltig: [], verworfen: 0 }
    const liste = stempelPruefen(JSON.parse(roh))
    return { gueltig: nachZeit(liste.gueltig), verworfen: liste.verworfen }
  } catch {
    return { gueltig: [], verworfen: 0 }
  }
}

export function stempelLeeren(): void {
  try { bruecke()?.stempelLeeren?.() } catch { /* dann eben beim nächsten Mal */ }
}
