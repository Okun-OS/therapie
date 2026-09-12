#!/usr/bin/env node
/**
 * §123 Alle Nachweise am laufenden System, in einem Durchlauf.
 *
 * Warum es diese Datei gibt: Bis heute lagen über 280 Prüfungen nur im
 * Arbeitsverzeichnis einer Sitzung. Der wurde einmal komplett gelöscht — und
 * damit war der einzige Beweis weg, dass die Lohnabrechnung stimmt. Für ein
 * Programm, das Gehälter rechnet und automatisch ausgerollt wird, ist das
 * untragbar.
 *
 * Diese Prüfungen sind bewusst KEINE Modultests. Sie sprechen mit dem
 * laufenden System über dieselben Schnittstellen wie der Browser, mit echten
 * Anmeldungen, echter Datenbank und mehreren Mandanten. Nur so fällt auf, wenn
 * eine fremde Leitung an fremde Daten kommt.
 *
 *   npm run pruefen              alles
 *   npm run pruefen -- d         nur die Lohn-Prüfungen
 *   npm run pruefen -- d9 d10    einzelne
 *
 * Voraussetzung: Datenbank steht, `npm run seed` gelaufen, `npm run dev` läuft.
 * Fehlt eine davon, sagt der Läufer das — statt mit unverständlichen Fehlern
 * abzubrechen.
 */

import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HIER = dirname(fileURLToPath(import.meta.url))
const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'

const filter = process.argv.slice(2).map(a => a.toLowerCase())

const dateien = readdirSync(HIER)
  .filter(f => (f.endsWith('.mjs') || f.endsWith('.mts')) && f !== 'lauf.mjs' && f !== 'helfer.mjs')
  .sort()
  .filter(f => filter.length === 0 || filter.some(x => f.startsWith(x)))

if (dateien.length === 0) {
  console.error(`Keine Prüfung gefunden${filter.length ? ` für "${filter.join(' ')}"` : ''}.`)
  process.exit(1)
}

/** Läuft das System überhaupt? Sonst schlagen alle Prüfungen aus demselben Grund fehl. */
async function systemErreichbar() {
  try {
    const r = await fetch(`${BASIS}/api/auth/me`, { signal: AbortSignal.timeout(5000) })
    // 401 ist die richtige Antwort ohne Anmeldung — das System läuft
    return r.status === 401 || r.ok
  } catch { return false }
}

async function testdatenVorhanden() {
  try {
    const r = await fetch(`${BASIS}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gf@rheinblick-reha.de', password: 'Test1234!' }),
      signal: AbortSignal.timeout(10000),
    })
    return r.ok
  } catch { return false }
}

function ausfuehren(datei) {
  return new Promise(fertig => {
    const pfad = join(HIER, datei)
    const [befehl, argumente] = datei.endsWith('.mts')
      ? ['npx', ['tsx', '--env-file-if-exists=.env', pfad]]
      : ['node', [pfad]]

    const kind = spawn(befehl, argumente, {
      cwd: join(HIER, '..'),
      env: { ...process.env, PRUEF_BASIS: BASIS },
    })
    let ausgabe = ''
    kind.stdout.on('data', d => { ausgabe += d })
    kind.stderr.on('data', d => { ausgabe += d })
    kind.on('close', code => {
      const bilanz = ausgabe.match(/(\d+)\/(\d+) Checks bestanden/)
      fertig({
        datei, code, ausgabe,
        bestanden: bilanz ? Number(bilanz[1]) : 0,
        gesamt: bilanz ? Number(bilanz[2]) : 0,
      })
    })
  })
}

// ── Los ────────────────────────────────────────────────────────────────────
console.log(`\nNachweise gegen ${BASIS}\n${'─'.repeat(60)}`)

if (!await systemErreichbar()) {
  console.error(
    `\nDas System ist unter ${BASIS} nicht erreichbar.\n\n`
    + `  1. Datenbank starten\n`
    + `  2. npm run dev\n`
    + `  3. npm run pruefen\n`,
  )
  process.exit(1)
}
if (!await testdatenVorhanden()) {
  console.error(
    `\nDie Testdaten fehlen — die Anmeldung als gf@rheinblick-reha.de schlägt fehl.\n\n`
    + `  npm run seed\n`,
  )
  process.exit(1)
}

const ergebnisse = []
for (const datei of dateien) {
  process.stdout.write(`${datei.padEnd(28)} `)
  const r = await ausfuehren(datei)
  ergebnisse.push(r)
  const ok = r.code === 0 && r.gesamt > 0
  console.log(ok
    ? `✓ ${r.bestanden}/${r.gesamt}`
    : `✗ ${r.bestanden}/${r.gesamt || '?'}`)
}

// ── Was schiefging, im Klartext ────────────────────────────────────────────
const gescheitert = ergebnisse.filter(r => r.code !== 0 || r.gesamt === 0)
for (const r of gescheitert) {
  console.log(`\n${'─'.repeat(60)}\n${r.datei}\n${'─'.repeat(60)}`)
  // Nur die fehlgeschlagenen Zeilen und den Abbruchgrund — nicht alles
  const zeilen = r.ausgabe.split('\n')
  const wichtig = zeilen.filter((z, i) =>
    z.includes('✗ FAIL')
    || (i > 0 && zeilen[i - 1].includes('✗ FAIL'))
    || z.includes('Error')
    || z.includes('Checks bestanden'))
  console.log(wichtig.length > 0 ? wichtig.join('\n') : r.ausgabe.slice(-2000))
}

const bestanden = ergebnisse.reduce((s, r) => s + r.bestanden, 0)
const gesamt = ergebnisse.reduce((s, r) => s + r.gesamt, 0)

console.log(`\n${'─'.repeat(60)}`)
console.log(`${bestanden}/${gesamt} Checks in ${ergebnisse.length} Prüfungen`)
if (gescheitert.length > 0) {
  console.log(`${gescheitert.length} Prüfungen fehlgeschlagen: ${gescheitert.map(r => r.datei).join(', ')}`)
}
console.log('')

process.exit(gescheitert.length > 0 ? 1 : 0)
