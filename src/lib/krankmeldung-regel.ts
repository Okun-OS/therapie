/**
 * §242 Die gesetzliche Grenze — ohne Datenbankbezug.
 *
 * Steht in einer eigenen Datei, weil beide Seiten sie brauchen: der Server in
 * `krankmeldung.ts` und die Krankmeldeseite im Browser. `krankmeldung.ts`
 * zieht Prisma nach; ein Browser-Bauteil, das von dort importiert, hängt davon
 * ab, dass der Bündler das wegoptimiert. Es tut es heute — aber eine
 * Zusicherung, die am Aufräumverhalten eines Werkzeugs hängt, ist keine.
 *
 * §5 Abs.1 EntgFG: Die Bescheinigung ist spätestens am vierten Kalendertag
 * vorzulegen. Satz 3 erlaubt dem Arbeitgeber, sie früher zu verlangen — das
 * steht dann im Arbeitsvertrag und ist deshalb einstellbar.
 */
export const NACHWEIS_AB_TAG_STANDARD = 4
