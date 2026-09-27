/**
 * §173 Drucken — im Browser wie immer, im Programm ohne Kopf- und Fußzeile.
 *
 * Ein Browser druckt seinen eigenen Rand mit: Datum, Seitenzahl und die
 * Adresse der Anlage. Auf einem Lohnbeleg, der in eine Personalakte geht,
 * steht dann „1/2 — workforce.beispiel.de/company/payroll?id=…" am Rand. Das
 * ist unschön und im Zweifel sogar heikel: Die Zeile nennt eine Kennung, die
 * auf dem Papier nichts zu suchen hat.
 *
 * Das Programm für den Rechner (siehe `desktop/`) kann das abstellen; ein
 * Browser kann es nicht. Deshalb diese eine Stelle: Läuft die Seite im
 * Programm, druckt das Programm. Sonst bleibt alles, wie es war.
 *
 * Das Prüfstück dazu ist `pruefungen/desktop/huelle.mjs`.
 */

interface OkunBruecke {
  imProgramm: true
  adresse(): Promise<string>
  adresseSetzen(wert: string): Promise<{ ok: boolean; adresse?: string; fehler?: string }>
  drucken(): Promise<{ ok: boolean; fehler?: string }>
  version(): Promise<{ programm: string; plattform: string; electron: string }>
}

declare global {
  interface Window { okun?: OkunBruecke }
}

/** Läuft diese Seite im Programm für den Rechner? */
export function imProgramm(): boolean {
  return typeof window !== 'undefined' && window.okun?.imProgramm === true
}

/**
 * Drucken. Im Programm ohne Browserrand, sonst wie gewohnt.
 *
 * Schlägt der Weg über das Programm fehl — etwa weil kein Drucker
 * eingerichtet ist —, wird nicht still nichts getan, sondern der normale
 * Druckdialog geöffnet. Wer auf „Drucken" klickt, muss einen Dialog sehen.
 */
export async function drucken(): Promise<void> {
  if (typeof window === 'undefined') return
  const bruecke = window.okun
  if (!bruecke) { window.print(); return }
  try {
    const ergebnis = await bruecke.drucken()
    if (!ergebnis.ok) window.print()
  } catch {
    window.print()
  }
}
