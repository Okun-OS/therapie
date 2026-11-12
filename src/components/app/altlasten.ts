/**
 * §288 Was die App beim Start von früher wegräumt.
 *
 * GEMELDET: „Er hat bei sich eingetragen, dass er sich über Fingerabdruck
 * anmeldet, und das funktioniert nicht. Er kann sich mit seinem Fingerabdruck
 * nicht anmelden, es wird immer eine Fehlermeldung angezeigt, er kommt nicht
 * mehr rein in die App."
 *
 * WARUM ER NICHT MEHR HINEINKAM — und das ist der eigentliche Fund:
 *
 * Die Gerätesperre (§139) merkte sich ihren Zustand in `localStorage` unter
 * `okun_geraetesperre`. Das war Absicht: Die Sperre gehört zum GERÄT, nicht
 * zum Konto. Ihr einziger Ausweg hieß „Stattdessen abmelden". Nur räumt
 * `logout()` die Sitzung ab (`sessionStorage`) und nicht diesen Schlüssel.
 * Also:
 *
 *     Sperre fragt  →  Sensor meldet einen Fehler  →  bleibt gesperrt
 *     „Abmelden"    →  Anmeldung  →  angemeldet
 *     Sperre fragt  →  derselbe Fehler  →  bleibt gesperrt  →  …
 *
 * Der Notausgang führte zurück in die Falle. Im Quelltext stand sogar
 * daneben, warum es ihn geben muss: „Wer sein Telefon weitergibt oder dessen
 * Gesichtserkennung nicht mehr funktioniert, säße sonst fest." Genau das ist
 * passiert — der Ausgang war gebaut, aber er führte im Kreis.
 *
 * Dazu kam, dass die Sperre keinen Schalter „aus" hatte, solange sie zu war.
 * Ein Sensor, der einmal nicht mehr antwortet, sperrt damit dauerhaft aus.
 *
 * WARUM DIE SPERRE GANZ VERSCHWINDET statt dass der Ausgang repariert wird:
 * Entscheidung des Eigentümers. „Wenn wir es selber anbieten, muss es doch
 * funktionieren, ansonsten machen wir das, was das Handy von alleine sowieso
 * anbietet."
 *
 * WARUM HIER TROTZDEM CODE STEHT
 * Die Hülle lädt die Anwendung vom Server (`server.url`). Sobald diese
 * Fassung ausgeliefert ist, gibt es die Sperre auf jedem Telefon nicht mehr,
 * ohne dass jemand eine neue App aus dem Store laden muss — der gesperrte
 * Mensch ist also sofort wieder drin. Der alte Schlüssel bliebe aber auf
 * seinem Gerät liegen. Er wird deshalb einmal aktiv entfernt: Ein
 * Wahrheitswert, den niemand mehr liest, ist eine Falle für den Nächsten,
 * der eine Sperre baut.
 */

/** Der Schlüssel, unter dem die Gerätesperre (§139) ihren Zustand hielt. */
export const ALTE_SPERRE = 'okun_geraetesperre'

/**
 * Hinterlassenschaften früherer Fassungen entfernen.
 *
 * Läuft bei jedem Start, kostet nichts und ist gegen jeden Zustand
 * unempfindlich — auch gegen einen Browser, der `localStorage` verweigert.
 */
export function altlastenRaeumen(): void {
  try { window.localStorage.removeItem(ALTE_SPERRE) } catch { /* dann eben nicht */ }
}
