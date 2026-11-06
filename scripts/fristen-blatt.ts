/**
 * §213 Das Blatt zum Gegenzeichnen — aus dem Katalog gerechnet, nicht getippt.
 *
 * WOFÜR
 * Im Brief an den Steuerberater (`ANFRAGEN.md`, Frage 5) steht: „Eine Seite
 * zum Gegenlesen." Diese Seite gab es nicht. Sie lässt sich auch nicht von
 * Hand schreiben, ohne dass sie beim nächsten neuen Datenfeld still falsch
 * wird — und ein Blatt, das jemand mit Berufshaftpflicht unterschreibt, darf
 * genau das nicht.
 *
 * Darum wird es aus `src/lib/dsgvo-katalog.ts` gerechnet. Was im Programm
 * wirklich gilt, steht auf dem Blatt; was nicht im Katalog steht, kann nicht
 * aufs Blatt geraten.
 *
 * WARUM ZWEI BLÖCKE
 * Die Fristen stammen aus zwei verschiedenen Rechtsgebieten, und dafür haftet
 * nicht derselbe Berufsstand. Ein Steuerberater steht für §41 EStG und §147 AO
 * ein — für Art. 5 Abs. 2 DSGVO steht er nicht ein, auch wenn er freundlich
 * nickt. Das Blatt trennt deshalb, was wer unterschreiben kann, statt eine
 * Unterschrift einzuholen, die hinterher nicht trägt.
 *
 * AUFRUF
 *   npm run fristen:blatt
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import { DATENARTEN, type Datenart } from '../src/lib/dsgvo-katalog'

const ZIEL = join(process.cwd(), 'AUFBEWAHRUNGSFRISTEN.md')

/**
 * Welcher Berufsstand kann diese Zeile unterschreiben?
 *
 * Entschieden wird nach der Fundstelle, nicht nach dem Gefühl: Steht dort eine
 * Steuer- oder Sozialversicherungsvorschrift, ist es der Steuerberater; steht
 * dort die DSGVO, das Arbeitszeitgesetz oder das AGG, ist es der
 * Datenschutzbeauftragte oder ein Fachanwalt.
 */
function zustaendig(d: Datenart): 'steuer' | 'datenschutz' {
  const g = d.grundlage ?? ''
  const steuerlich = /EStG|AO\b|HGB|LStDV|SGB\s*(III|IV)|ZPO/.test(g)
  const anderes = /DSGVO|ArbZG|MiLoG|AGG|ArbGG|BGB|SGB\s*IX|IfSG|ArbSchG/.test(g)
  // Wo beides zutrifft, zählt die steuerliche Seite — sie ist die, aus der die
  // Jahreszahl folgt. Die DSGVO begrenzt dann nur noch die Verwendung.
  if (steuerlich) return 'steuer'
  if (anderes) return 'datenschutz'
  return 'datenschutz'
}

const mitFrist = DATENARTEN.filter(d => d.fristJahre > 0)
const ohneFrist = DATENARTEN.filter(d => d.fristJahre === 0)
const steuer = mitFrist.filter(d => zustaendig(d) === 'steuer')
const datenschutz = mitFrist.filter(d => zustaendig(d) === 'datenschutz')

const heute = new Date().toISOString().slice(0, 10).split('-').reverse().join('.')

function zeile(d: Datenart): string {
  return `| **${d.bezeichnung}** | ${d.fristJahre} Jahre | ${d.grundlage ?? '—'} | ☐ ja ☐ nein: ______ |`
}

function block(titel: string, arten: Datenart[], einleitung: string): string {
  return [
    `### ${titel}`,
    '',
    einleitung,
    '',
    '| Datenart | Frist nach Austritt | Fundstelle im Gesetz | Trifft zu? |',
    '|---|---|---|---|',
    ...arten.map(zeile),
    '',
    ...arten.map(d => `**${d.bezeichnung}** — ${d.beschreibung}\n\n> ${d.begruendung}\n`),
  ].join('\n')
}

const blatt = `# Aufbewahrungsfristen im Programm OKUN Workforce

**Blatt zum Gegenlesen und Gegenzeichnen** · erzeugt am ${heute}
aus \`src/lib/dsgvo-katalog.ts\` · ${DATENARTEN.length} Datenarten,
davon ${mitFrist.length} mit Aufbewahrungsfrist und ${ohneFrist.length} ohne.

> Dieses Blatt wird **gerechnet, nicht geschrieben**: \`npm run fristen:blatt\`
> liest den Katalog, aus dem das Programm tatsächlich löscht. Was hier steht,
> gilt im Programm — und umgekehrt.

---

## Worum gebeten wird

OKUN Systems UG (haftungsbeschränkt) betreibt eine Personalsoftware, die
Dienstplanung, Zeiterfassung und Entgeltabrechnung führt. Beim Ausscheiden
einer beschäftigten Person löscht das Programm nicht alles: Was eine
gesetzliche Aufbewahrungspflicht trifft, wird **gesperrt** (Art. 18 DSGVO) und
nur noch für Prüfungen von Finanzamt, Rentenversicherung und Agentur für
Arbeit verwendet. Erst nach Ablauf der Frist wird es entfernt.

Die Fristen unten sind nach bestem Wissen eingetragen und jeweils mit der
Vorschrift belegt, aus der sie folgen. Geprüft hat sie bisher **niemand mit
Berufshaftpflicht**. Genau darum geht es hier.

**Gebeten wird um eine kurze schriftliche Bestätigung**, dass die Fristen und
die Fundstellen zutreffen — oder, wo nicht, welche Frist richtig wäre und
warum. Ein Satz je Zeile genügt; die rechte Spalte ist dafür da.

**Nicht gebeten wird um** eine Prüfung der Rechenergebnisse. Das ist eine
eigene Anfrage (prüferische Durchsicht einer Entgeltabrechnung) und hat mit
diesem Blatt nichts zu tun.

---

${block(
  'Block A — Steuer- und Sozialversicherungsrecht',
  steuer,
  'Diese Fristen folgen aus Steuer- und Sozialversicherungsvorschriften. Sie '
    + 'sind der Teil, für den ein **Steuerberater oder ein Lohnbüro** einstehen kann.',
)}
---

${block(
  'Block B — Datenschutz- und Arbeitsrecht',
  datenschutz,
  'Diese Fristen folgen **nicht** aus dem Steuerrecht. Für sie steht ein '
    + 'Steuerberater nicht ein — hier gehört die Unterschrift eines '
    + '**Datenschutzbeauftragten oder eines Fachanwalts** (IT- oder Arbeitsrecht) hin.',
)}
---

## Block C — Wo das Programm löscht, statt aufzubewahren

Eine Bestätigung nur der Aufbewahrung wäre die halbe Antwort. Zu früh zu
löschen ist der teurere Fehler: Was weg ist, kann bei einer Prüfung niemand
mehr vorlegen. Darum stehen hier die Datenarten, die beim Ausscheiden
**gelöscht oder anonymisiert** werden — mit der Frage, ob das richtig ist.

| Datenart | Was geschieht | Fundstelle | Richtig so? |
|---|---|---|---|
${ohneFrist.map(d => `| **${d.bezeichnung}** | ${({ loeschen: 'gelöscht', anonymisieren: 'anonymisiert, bleibt ohne Namen', sperren: 'gesperrt' })[d.behandlung]} | ${d.grundlage ?? '—'} | ☐ ja ☐ nein: ______ |`).join('\n')}

> Eine Besonderheit, die in der Tabelle nicht sichtbar wird: **Bewerbungen**
> werden nicht beim Austritt, sondern **sechs Monate nach Abschluss des
> Verfahrens** gelöscht — so lange, wie Ansprüche nach §15 Abs. 4 AGG geltend
> gemacht werden können. Auch diese Zahl gehört gegengelesen.

---

## Wie gezählt wird

Alle Fristen laufen **ab dem Ende des Kalenderjahres**, in dem die
Beschäftigung endete — so, wie die steuerlichen Fristen zählen. Wer am
3. Februar ausscheidet, dessen Sechsjahresfrist beginnt am 31. Dezember
desselben Jahres und endet am 31. Dezember sechs Jahre später.

Ist das für eine der Zeilen oben **nicht** die richtige Zählweise, bitte hier
vermerken:

______________________________________________________________________

---

## Bestätigung

Hiermit bestätige ich, die oben aufgeführten Aufbewahrungsfristen und
Fundstellen geprüft zu haben. Abweichungen sind in der jeweiligen Zeile
vermerkt.

| | |
|---|---|
| Name, Berufsbezeichnung | ______________________________________ |
| Kanzlei / Unternehmen | ______________________________________ |
| Geprüfte Fassung dieses Blattes | vom ${heute} |
| Ort, Datum | ______________________________________ |
| Unterschrift | ______________________________________ |

> **Warum das Datum des Blattes mit auf die Unterschrift gehört:** Der Katalog
> wächst mit dem Programm. Eine Bestätigung ohne Fassungsdatum ließe in zwei
> Jahren nicht mehr erkennen, was eigentlich geprüft wurde.

---

*OKUN Systems UG (haftungsbeschränkt) · Potsdamer Platz 1 · 10785 Berlin ·
vertreten durch Felix Okun · kontakt@okun-systems.com ·
Amtsgericht Charlottenburg HRB 292175 B*
`

writeFileSync(ZIEL, blatt, 'utf8')

console.log(`Blatt geschrieben: ${ZIEL}`)
console.log(`  ${DATENARTEN.length} Datenarten im Katalog`)
console.log(`  Block A (Steuer/SV):      ${steuer.length} Fristen`)
console.log(`  Block B (Datenschutz):    ${datenschutz.length} Fristen`)
console.log(`  Block C (ohne Frist):     ${ohneFrist.length} Datenarten`)
