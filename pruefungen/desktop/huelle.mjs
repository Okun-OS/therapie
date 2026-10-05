// Nachweis (Desktop): Die Hülle für den Rechner.
//
// WARUM DIESE PRÜFUNG NICHT IM GESAMTLAUF STECKT
// Sie startet ein echtes Fenster. Dafür braucht es Electron und Playwright,
// beides nur auf der Entwicklungsmaschine. Eine Prüfung, die in der
// Ablaufkette aus Umgebungsgründen rot wird, wird nach zwei Wochen ignoriert.
//
//     npm run desktop:pruefen
//
// WAS SIE PRÜFT
// Nicht, ob die Anwendung funktioniert — das tun die Nachweise daneben.
// Sondern die fünf Entscheidungen, die NUR in der Hülle stecken und die man
// sonst erst beim Kunden bemerkt:
//
//   1. Die Hülle zeigt die eingestellte Anlage.
//   2. Sie geht nirgendwo anders hin. Eine fremde Seite darf nicht in dem
//      Fenster aufgehen, in dem gerade Lohndaten stehen.
//   3. Antwortet die Anlage nicht, steht das im Klartext da — nicht weiß.
//   4. Die geladene Seite bekommt kein Node und kein Dateisystem, sondern
//      genau die kurze Liste aus bruecke.js.
//   5. §187 Die Bauanleitung passt zum Paketbauer, den das Projekt wirklich
//      benutzt — und die Angaben darin stimmen mit dem Impressum überein.

import { _electron as electron } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

// Playwright liegt hier außerhalb des Projekts und findet Electron deshalb
// nicht von selbst. Der Pfad steht in dessen eigenem Paket.
const ELECTRON = join(
  process.cwd(), 'node_modules/electron/dist',
  readFileSync(join(process.cwd(), 'node_modules/electron/path.txt'), 'utf8').trim(),
)

let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

/*
 * §187 Die Bauanleitung gegen das Schema des Paketbauers.
 *
 * WARUM DAS EINE EIGENE PRÜFUNG IST
 * Beim Einhängen der Signatur stand der Haken unter `win.sign` — der Platz,
 * den electron-builder bis Fassung 24 hatte. Seit 25 liegt er unter
 * `win.signtoolOptions.sign`. Der Paketbauer ignoriert den alten Platz nicht
 * still, er bricht ab, aber mit einer Meldung, die nichts verrät:
 * „configuration.win should be one of these: null". Gemerkt habe ich es nach
 * einem vollständigen Bau; diese Prüfung braucht zwei Sekunden.
 *
 * Geprüft wird nicht gegen eine Liste in dieser Datei, sondern gegen
 * `scheme.json` DES INSTALLIERTEN PAKETBAUERS. Zieht die nächste Fassung
 * einen Schlüssel um, wird die Prüfung rot, ohne dass hier jemand etwas
 * nachträgt — eine fest eingetippte Liste würde genau das verpassen.
 */
console.log('=== Die Bauanleitung passt zum Paketbauer ===')

// Zwei Ladewege: einer vom Hauptverzeichnis für das Schema des Paketbauers,
// einer aus `desktop/` — denn die Bauanleitung lädt mit eigenen relativen
// Pfaden, und von woanders aus gelesen zeigen die ins Leere.
const hole = createRequire(join(process.cwd(), 'paket.cjs'))
const holeHuelle = createRequire(join(process.cwd(), 'desktop/paket.cjs'))
const schema = hole('app-builder-lib/scheme.json')
const bauplan = holeHuelle('./electron-builder.js')
const huellenPaket = holeHuelle('./package.json')

const erlaubt = (name) => Object.keys(schema.definitions[name]?.properties ?? {})

// Oben stehen die gemeinsamen Angaben — die liegen im Schema direkt unter
// `properties`. Je Betriebssystem gibt es darunter eine eigene Definition.
// Welcher Abschnitt zu welcher gehört, weiß nur das Schema; deshalb steht
// hier die Zuordnung und nicht die Liste der Schlüssel.
const abschnitte = [
  ['(oben)', bauplan, Object.keys(schema.properties ?? {})],
  ['win', bauplan.win, erlaubt('WindowsConfiguration')],
  ['win.signtoolOptions', bauplan.win?.signtoolOptions, erlaubt('WindowsSigntoolConfiguration')],
  ['linux', bauplan.linux, erlaubt('LinuxConfiguration')],
  ['nsis', bauplan.nsis, erlaubt('NsisOptions')],
  ['mac', bauplan.mac, erlaubt('MacConfiguration')],
]

for (const [wo, teil, gueltig] of abschnitte) {
  if (!teil) { check(`${wo}: Abschnitt vorhanden`, false, 'fehlt in der Bauanleitung'); continue }
  if (!gueltig.length) { check(`${wo}: Schema gefunden`, false, 'keine Definition im Schema'); continue }
  const fremd = Object.keys(teil).filter(k => !gueltig.includes(k))
  check(`${wo}: jeder Schlüssel steht im Schema`, fremd.length === 0,
    fremd.length ? `kennt der Paketbauer nicht: ${fremd.join(', ')}` : `${Object.keys(teil).length} geprüft`)
}

// Der Haken selbst — vorhanden und aufrufbar, auch ohne Zertifikat.
check('Der Platz für die Signatur ist eingehängt',
  typeof bauplan.win?.signtoolOptions?.sign === 'function',
  `vorgefunden: ${typeof bauplan.win?.signtoolOptions?.sign}`)

// Gegenprobe: Ohne Befehl wird nicht still signiert, sondern gewarnt.
const warnungen = []
const echteWarnung = console.warn
console.warn = (...t) => warnungen.push(t.join(' '))
const vorher = process.env.OKUN_SIGN_BEFEHL
delete process.env.OKUN_SIGN_BEFEHL
await bauplan.win.signtoolOptions.sign({ path: '/pfad/zur/Datei.exe' })
console.warn = echteWarnung
if (vorher !== undefined) process.env.OKUN_SIGN_BEFEHL = vorher

check('Ohne Zertifikat warnt der Bau, statt still unsigniert zu bauen',
  warnungen.some(w => /UNSIGNIERT/.test(w) && w.includes('/pfad/zur/Datei.exe')),
  warnungen.join(' | ').slice(0, 200) || 'keine Warnung')

/*
 * §187 Und die Angaben, die der Kunde im Installationsprogramm liest.
 *
 * WAS HIER VORHER FALSCH WAR
 * In `desktop/package.json` stand „für Pflege, Kita und Eingliederungshilfe"
 * — eine Branchenverengung, die die Website längst abgelegt hatte — und eine
 * Absenderadresse auf einer Domain, die es nicht gibt. In der Bauanleitung
 * daneben waren genau dieselben erfundenen Angaben als Rückfallwert
 * eingetragen, und weil `OKUN_FIRMA` nur in der Umgebung des Servers steht,
 * griff bei jedem Bau der Rückfallwert. Solche Zeilen liest niemand nach;
 * sie fallen erst auf, wenn sie auf dem Bildschirm eines Kunden stehen.
 *
 * WARUM HIER NICHT GEGEN DAS IMPRESSUM GEPRÜFT WIRD
 * Das wäre das Naheliegende — und wäre falsch. Das Impressum liest seine
 * Angaben aus der Umgebung (`OKUN_FIRMA`, `OKUN_KONTAKT`); die stehen bei
 * Railway und nicht in diesem Behälter. Eine Prüfung, die davon abhängt,
 * wäre hier dauerhaft rot, ohne dass irgendetwas kaputt ist — und würde nach
 * zwei Wochen ignoriert.
 *
 * Geprüft wird deshalb, was ohne Umgebung feststeht: dass das Paket und die
 * Bauanleitung dieselbe Angabe benutzen (eine Quelle, nicht zwei), dass die
 * Domain darin die ist, unter der die Anlage läuft, und dass keine
 * Platzhalter-Domain mehr darin steht.
 */
check('Paket und Bauanleitung nennen denselben Verantwortlichen',
  bauplan.linux.maintainer === huellenPaket.author,
  `.deb: ${bauplan.linux.maintainer}\n           package.json: ${huellenPaket.author}`)
check('Der Herausgeber ist die Firma, nicht nur die Marke',
  /\bUG\b|\bGmbH\b|\bAG\b|\be\.\s?K\.\b/.test(huellenPaket.author),
  `${huellenPaket.author} — dieser Name muss wortgleich im Signaturzertifikat `
  + 'stehen, sonst zeigt Windows zwei verschiedene Herausgeber')
check('Keine Platzhalter-Domain in den Paketangaben',
  !/okun\.de|beispiel|example|invalid|localhost/.test(
    [huellenPaket.author, huellenPaket.homepage, bauplan.linux.maintainer].join(' ')),
  `${huellenPaket.author} · ${huellenPaket.homepage}`)
check('Die Webadresse ist die, unter der die Anlage läuft',
  huellenPaket.homepage === 'https://okun-workforce.com', huellenPaket.homepage)
check('Die Beschreibung verengt das Produkt nicht auf eine Branche',
  !/Pflege|Kita|Eingliederungshilfe/.test(
    [huellenPaket.description, bauplan.linux.synopsis].join(' ')),
  `${huellenPaket.description}\n           .deb: ${bauplan.linux.synopsis}`)

// Gegenprobe: Fehlt die Angabe im Paket, bricht die Bauanleitung ab, statt
// einen erfundenen Absender einzusetzen. Genau das war der Fehler.
let geplatzt = null
const echtesAuthor = huellenPaket.author
try {
  const quelle = readFileSync('desktop/electron-builder.js', 'utf8')
    .replace("require('./package.json')", 'JSON.parse(\'{"author":""}\')')
  const { runInNewContext } = await import('node:vm')
  const schein = { exports: {} }
  runInNewContext(quelle, {
    module: schein, exports: schein.exports, require: holeHuelle, process, Date, console,
  })
} catch (e) { geplatzt = e.message }
check('Ohne Absender im Paket bricht der Bau ab, statt einen zu erfinden',
  geplatzt !== null && /author/.test(geplatzt), geplatzt ?? 'kein Abbruch')
check('Die Gegenprobe hat die echte Angabe nicht verändert',
  huellenPaket.author === echtesAuthor, huellenPaket.author)

console.log('')

// Eine winzige Anlage, die genau das tut, was die Hülle von ihr erwartet.
// Gegen die echte zu prüfen hieße, eine Datenbank und einen Rechendienst
// vorauszusetzen — geprüft wird hier die Hülle, nicht die Anwendung.
let angefragt = []
const anlage = createServer((req, res) => {
  angefragt.push(req.url)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><html><body>
    <h1 data-test="anlage">Angemeldet bei OKUN Workforce</h1>
    <a id="nachaussen" href="https://beispiel.invalid/fremd">Ein Link nach außen</a>
  </body></html>`)
})
await new Promise(f => anlage.listen(0, '127.0.0.1', f))
const ADRESSE = `http://127.0.0.1:${anlage.address().port}`

// §173 Jeder Lauf beginnt mit einem leeren Benutzerordner. Sonst bestünde die
// Prüfung nur beim ersten Mal — die Adresse und die Fensterlage bleiben ja
// absichtlich gespeichert. (Regel 1 der Nachweis-README.)
const heim = mkdtempSync(join(tmpdir(), 'okun-desktop-'))

async function starten(adresse) {
  return electron.launch({
    executablePath: ELECTRON,
    args: [
      'desktop/haupt.js',
      `--user-data-dir=${heim}`,
      // Ohne Bildschirm in diesem Behälter.
      '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    ],
    env: { ...process.env, OKUN_APP_URL: adresse },
  })
}

console.log('=== Die Hülle zeigt die Anlage ===')
let programm = await starten(ADRESSE)
let fenster = await programm.firstWindow()
await fenster.waitForLoadState('domcontentloaded')

check('Das Fenster öffnet sich', !!fenster)
check('Es zeigt die eingestellte Anlage',
  await fenster.locator('[data-test="anlage"]').count() === 1,
  await fenster.title())
check('Und hat es auch wirklich dort abgeholt', angefragt.length > 0,
  angefragt.join(', '))
check('Der Fenstertitel nennt das Programm',
  /OKUN/i.test(await programm.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getTitle())),
  await programm.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()))

console.log('\n=== Was die Seite auf diesem Rechner darf ===')
const bruecke = await fenster.evaluate(() => ({
  da: typeof window.okun === 'object' && window.okun !== null,
  schluessel: window.okun ? Object.keys(window.okun).sort() : [],
  node: typeof window.require,
  prozess: typeof window.process,
}))
check('Die Seite erkennt, dass sie im Programm läuft', bruecke.da)
check('Sie bekommt genau die vorgesehene Liste',
  bruecke.schluessel.join(',') === 'adresse,adresseSetzen,drucken,imProgramm,version',
  bruecke.schluessel.join(','))
check('Sie bekommt KEIN Node', bruecke.node === 'undefined', bruecke.node)
check('Und keinen Prozess', bruecke.prozess === 'undefined', bruecke.prozess)

const gemeldet = await fenster.evaluate(() => window.okun.adresse())
check('Sie kann die eigene Anlage erfragen', gemeldet === ADRESSE, gemeldet)

console.log('\n=== Fremde Adressen bleiben draußen ===')
//
// Der Punkt, an dem eine Hülle gefährlich wird: Eine fremde Seite, die im
// selben Fenster aufgeht, sieht für den Benutzer aus wie ein Teil des
// Programms. Sie muss in den Systembrowser.
await fenster.evaluate(() => { window.location.href = 'https://beispiel.invalid/fremd' })
await fenster.waitForTimeout(1500)
check('Eine fremde Adresse wird nicht im Fenster geöffnet',
  await fenster.locator('[data-test="anlage"]').count() === 1,
  fenster.url())
check('Das Fenster steht noch auf der Anlage',
  fenster.url().startsWith(ADRESSE), fenster.url())

// §173 Eine Adresse ohne Verschlüsselung wird nicht angenommen — außer auf
// dem eigenen Rechner, wo es kein Netz gibt, über das mitgelesen werden kann.
const abgelehnt = await fenster.evaluate(() =>
  window.okun.adresseSetzen('http://fremde-anlage.example/'))
check('Eine unverschlüsselte fremde Adresse wird abgelehnt',
  abgelehnt.ok === false, JSON.stringify(abgelehnt))
const unsinn = await fenster.evaluate(() => window.okun.adresseSetzen('kein-url'))
check('Und Unsinn auch', unsinn.ok === false, JSON.stringify(unsinn))
const nochDa = await fenster.evaluate(() => window.okun.adresse())
check('Die eingestellte Anlage ist unverändert', nochDa === ADRESSE, nochDa)

await programm.close()

console.log('\n=== Wenn die Anlage nicht antwortet ===')
//
// Ohne diese Seite stünde der Benutzer vor einer weißen Fläche und wüsste
// nicht, ob sein Rechner kaputt ist oder der Server.
programm = await starten('https://gibt-es-nicht.invalid')
fenster = await programm.firstWindow()
await fenster.waitForSelector('[data-test="nicht-erreichbar"]', { timeout: 30_000 })
  .catch(() => {})
const text = await fenster.locator('body').innerText().catch(() => '')
check('Es erscheint eine Seite statt einer weißen Fläche',
  /antwortet nicht/i.test(text), text.slice(0, 200))
check('Sie nennt die Adresse, die versucht wurde',
  text.includes('gibt-es-nicht.invalid'), text.slice(0, 300))
check('Und bietet an, sie zu ändern', /Adresse ändern/.test(text), text.slice(0, 300))

await programm.close()

// ── Aufräumen ──────────────────────────────────────────────────────────────
anlage.close()
rmSync(heim, { recursive: true, force: true })

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
process.exit(fail > 0 ? 1 : 0)
