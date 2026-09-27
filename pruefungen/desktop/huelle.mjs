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
// Nicht, ob die Anwendung funktioniert — das tun die 1401 Nachweise daneben.
// Sondern die vier Entscheidungen, die NUR in der Hülle stecken und die man
// sonst erst beim Kunden bemerkt:
//
//   1. Die Hülle zeigt die eingestellte Anlage.
//   2. Sie geht nirgendwo anders hin. Eine fremde Seite darf nicht in dem
//      Fenster aufgehen, in dem gerade Lohndaten stehen.
//   3. Antwortet die Anlage nicht, steht das im Klartext da — nicht weiß.
//   4. Die geladene Seite bekommt kein Node und kein Dateisystem, sondern
//      genau die kurze Liste aus bruecke.js.

import { _electron as electron } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
