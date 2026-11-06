import Start from '../start/page'

/**
 * §239 Die Startadresse der installierten App.
 *
 * DIE MELDUNG
 * „Wenn ich auf die App gehe, dann kommt immer erst diese Kack-Website. Das
 * darf aber nicht sein."
 *
 * §263 HIER STAND DERSELBE FEHLER WIE UNTER `/`
 * Diese Seite war eine reine Weiterleitung: Sitzung lesen, `redirect()`,
 * fertig. Kein Inhalt. Genau das hat §254 unter `/` als Ursache entlarvt —
 * eine Weiterleitung ZEICHNET NICHTS, und ein iPhone zeigt beim Öffnen einer
 * Adresse zuerst ein Standbild dessen, was dort zuletzt zu sehen war. Eine
 * Adresse, auf der nie etwas gezeichnet wird, friert ihr altes Standbild für
 * immer ein.
 *
 * §254 hat das unter `/` behoben und diese Seite übersehen — dabei ist sie
 * die Adresse, mit der die INSTALLIERTE App startet (`start_url` im
 * Manifest). Wer die App vom Startbildschirm öffnet, kommt hier an und
 * nirgends sonst.
 *
 * Jetzt steht hier dasselbe wie unter `/`: der dunkle Hintergrund der App mit
 * dem Wappen, und von dort geht es weiter. Nicht als Abschrift, sondern als
 * dieselbe Seite — zwei Abschriften derselben Startseite liefen auseinander,
 * und auffallen würde das daran, dass es an einer der beiden Adressen wieder
 * flackert.
 */

export const dynamic = 'force-dynamic'

export default Start
