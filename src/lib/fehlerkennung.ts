/**
 * §252 Eine Kennung, mit der sich ein Fehler zurückverfolgen lässt.
 *
 * DAS PROBLEM, DAS DAMIT GELÖST WERDEN SOLL
 * Gemeldet wurde: „Die Datei ließ sich nicht senden (Fehler 500, 204 kB)."
 *
 * 500 heißt: Die Anwendung ist über etwas gestolpert. Welche Zeile das war,
 * steht im Protokoll des Servers — und an das komme ich von hier aus nicht.
 * Örtlich ließ sich der Fall nicht nachstellen: Dieselbe Datei geht durch
 * jedes Gespräch mit HTTP 200.
 *
 * Damit war ich blind, und das ist nach drei Runden „geht immer noch nicht"
 * der eigentliche Mangel. Nicht der Fehler selbst — dass ich ihn nicht sehen
 * kann.
 *
 * WAS DIESE DATEI TUT
 * Sie vergibt für jeden unerwarteten Fehler eine kurze Kennung, schreibt sie
 * zusammen mit dem vollen Fehler ins Protokoll und gibt NUR die Kennung nach
 * außen. Ein Mensch sieht dann:
 *
 *     Die Datei ließ sich nicht speichern. (Kennung: a7f3c1)
 *
 * Damit ist ein Screenshot wieder eine Spur: Dieselbe Kennung steht im
 * Protokoll neben Fehlertext, Herkunft und Zeitpunkt.
 *
 * WARUM NICHT EINFACH DIE FEHLERMELDUNG ZEIGEN
 * Weil §234 dafür den Grund schon aufgeschrieben hat: Ein Prisma-Fehler nennt
 * Wirtsnamen, Port, Tabellen- und Spaltennamen. Das gehört nicht auf den
 * Bildschirm einer Pflegekraft und erst recht nicht in einen Screenshot, der
 * anschließend in einem Chat landet.
 *
 * WAS DOCH NACH AUSSEN GEHT
 * Die ART des Fehlers in einem Wort, wo sie eindeutig und harmlos ist — ob
 * die Datenbank nicht erreichbar war, ob eine Spalte fehlt, ob etwas zu groß
 * war. Das sagt nichts über die Anlage und erspart im besten Fall die ganze
 * Rückfrage.
 */

/** Kurze, eindeutige Kennung für einen Vorfall. */
function kennung(): string {
  return Math.random().toString(16).slice(2, 8)
}

/**
 * Die Art eines Fehlers in einem Wort — soweit sie sich sicher sagen lässt.
 *
 * Bewusst grob: Jede Zeile hier muss für sich beantworten, ob sie etwas über
 * die Anlage verrät. „Datenbank nicht erreichbar" tut das nicht; ein
 * Verbindungsstring täte es.
 */
function art(fehler: unknown): string | null {
  const text = fehler instanceof Error ? `${fehler.name}: ${fehler.message}` : String(fehler)
  if (/P1001|P1002|Can't reach database|ECONNREFUSED/i.test(text)) {
    return 'Datenbank nicht erreichbar'
  }
  if (/Timed out fetching a new connection|P2024/i.test(text)) {
    return 'Datenbank überlastet'
  }
  if (/P2021|P2022|does not exist in the current database|Unknown argument/i.test(text)) {
    return 'Datenbankstand veraltet'
  }
  if (/P2000|too long for the column|value too long/i.test(text)) {
    return 'Inhalt zu groß für die Ablage'
  }
  if (/ENOSPC|disk full|no space left/i.test(text)) {
    return 'Speicher voll'
  }
  if (/heap out of memory|allocation failed/i.test(text)) {
    return 'Arbeitsspeicher erschöpft'
  }
  /*
   * §255 Ein abgebrochener Anfragerumpf. Am Telefon der häufigste Fall, den
   * man für eine Störung der Anlage halten könnte — er ist aber einer der
   * Leitung, und die Antwort darauf lautet „noch einmal versuchen".
   */
  if (/aborted|ECONNRESET|socket hang up|terminated|premature close|stream/i.test(text)) {
    return 'Übertragung unterbrochen'
  }
  return null
}

export interface Vorfall {
  /** Der Satz für den Menschen, samt Kennung. */
  text: string
  /** Die Kennung allein — für das Protokoll und für Rückfragen. */
  kennung: string
}

/**
 * Einen unerwarteten Fehler protokollieren und einen Satz dafür zurückgeben.
 *
 * `wo` ist die Stelle im Programm, etwa `chat/datei`. Sie steht im Protokoll,
 * nicht in der Antwort.
 */
export function vorfall(wo: string, fehler: unknown, satz: string): Vorfall {
  const k = kennung()
  const a = art(fehler)

  // Ins Protokoll alles, was bei der Suche hilft.
  console.error(`[${k}] ${wo}:`, fehler)

  return {
    kennung: k,
    text: a ? `${satz} ${a}. (Kennung: ${k})` : `${satz} (Kennung: ${k})`,
  }
}

/**
 * §252 Den Vorfall zusätzlich als Fund eintragen.
 *
 * WARUM NICHT NUR INS PROTOKOLL
 * Weil an das Protokoll des Servers niemand herankommt, der das Problem
 * meldet. Als Fund steht der Vorfall unter „Funde" im OKUN-Bereich, mit
 * vollem Fehlertext und Zeitpunkt — und zwar sofort, ohne dass jemand
 * nachfragen muss.
 *
 * Das ist der Unterschied zwischen „es ging wieder nicht" und „es ging nicht,
 * weil die Datenbank überlastet war, um 16:31, Kennung a7f3c1".
 *
 * ALLES HIER IST FREIWILLIG
 * Scheitert das Eintragen — etwa weil genau die Datenbank das Problem ist —,
 * passiert nichts weiter. Ein Protokollierungsversuch darf eine Anfrage nie
 * zum zweiten Mal scheitern lassen.
 *
 * KEINE DATEN AUS DEM VORGANG
 * Eingetragen werden Kennung, Stelle und Fehlertext. Nicht die Datei, nicht
 * ihr Name, nicht der Inhalt der Nachricht — ein Fundbericht wird von
 * mehreren Menschen gelesen.
 */
export async function vorfallMelden(
  wo: string,
  fehler: unknown,
  k: string,
  wer?: { userId?: string; name?: string; role?: string; customerId?: string },
): Promise<void> {
  try {
    const { prisma } = await import('./prisma')
    const text = fehler instanceof Error
      ? `${fehler.name}: ${fehler.message}\n\n${fehler.stack ?? ''}`
      : String(fehler)
    await prisma.bugReport.create({
      data: {
        ticketId: `AUTO-${k}`,
        status: 'open',
        priority: 'high',
        severity: 'high',
        art: 'fehler',
        bereich: wo.startsWith('chat') ? 'nachrichten' : 'akte',
        title: `Automatisch erfasst: ${wo} (${k})`,
        description: 'Von der Anwendung selbst erfasst — ein unerwarteter '
          + 'Fehler beim Verarbeiten einer Anfrage.',
        schritte: `Stelle im Programm: ${wo}`,
        erwartet: 'Die Anfrage hätte durchlaufen sollen.',
        haeufigkeit: 'manchmal',
        consoleErrors: text.slice(0, 8000),
        userId: wer?.userId ?? null,
        userName: wer?.name ?? null,
        userRole: wer?.role ?? null,
        customerId: wer?.customerId ?? null,
      },
    })
  } catch {
    // Ein Protokollierungsversuch darf eine Anfrage nie zum zweiten Mal
    // scheitern lassen.
  }
}
