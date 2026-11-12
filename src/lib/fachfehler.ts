/**
 * §234 Ein Fehler, dessen Satz für den Menschen gedacht ist.
 *
 * WARUM ES DAS BRAUCHT
 * Mehrere Schnittstellen gaben im Fehlerfall `err.message` ungeprüft heraus:
 *
 *     catch (err) {
 *       return NextResponse.json(
 *         { error: err instanceof Error ? err.message : 'Fehler beim Einstempeln' },
 *         { status: 400 })
 *     }
 *
 * Für die eigenen Fehler des Programms war das richtig — „Es läuft bereits
 * eine Zeiterfassung. Bitte zuerst ausstempeln." ist genau der Satz, den die
 * Person lesen soll. Für alles andere war es falsch, und zwar auf zwei Weisen
 * gleichzeitig:
 *
 *   Die Person liest Kauderwelsch. Fällt die Datenbank aus, steht beim
 *   Einstempeln „Can't reach database server at 127.0.0.1:5432" — englisch,
 *   technisch, und ohne jeden Hinweis, was zu tun ist.
 *
 *   Und es ist eine Auskunft über die Anlage. Wirtsname, Port, Tabellen- und
 *   Spaltennamen, bei einem Prisma-Fehler auch der Teil der Abfrage, der
 *   gescheitert ist. Das gehört nicht auf den Bildschirm einer Pflegekraft,
 *   und es gehört erst recht nicht in einen Screenshot, der danach in einem
 *   Chat landet.
 *
 * DIE REGEL
 * Wer eine Meldung für einen MENSCHEN wirft, wirft einen `Fachfehler`. Alles
 * andere wird nach außen zu einem festen Satz und innen protokolliert. Damit
 * ist die Richtung umgedreht: Vorher musste man an jeder Fundstelle daran
 * denken, einen technischen Fehler abzufangen; jetzt muss man daran denken,
 * einen gewollten Satz auszuzeichnen — und das merkt man sofort, weil der
 * eigene Satz sonst nicht ankommt.
 *
 * `ZugangKonflikt` in `invitations.ts` macht das seit Langem so, nur ohne
 * gemeinsame Grundlage. Diese Datei ist die Verallgemeinerung.
 */

export class Fachfehler extends Error {
  /** Der Statuscode, mit dem geantwortet werden soll. */
  readonly status: number

  constructor(nachricht: string, status = 400) {
    super(nachricht)
    this.name = 'Fachfehler'
    this.status = status
  }
}

/**
 * Was dem Menschen gesagt wird — und was nur ins Protokoll geht.
 *
 * `standard` ist der Satz für alles Unerwartete. Er soll sagen, was nicht
 * geklappt hat, nicht warum: Das „warum" steht im Protokoll, wo es jemand
 * lesen kann, der damit etwas anfangen kann.
 */
export function nutzerText(err: unknown, standard: string): string {
  if (err instanceof Fachfehler) return err.message
  // Bewusst `console.error`: Der echte Fehler darf nicht verloren gehen, nur
  // weil er nicht nach außen geht.
  console.error('[unerwarteter Fehler]', err)
  return standard
}

/** Der Statuscode eines `Fachfehler`s, sonst der übergebene. */
export function nutzerStatus(err: unknown, standard = 400): number {
  return err instanceof Fachfehler ? err.status : standard
}
