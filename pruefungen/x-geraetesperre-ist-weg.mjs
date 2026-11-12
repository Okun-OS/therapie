// Nachweis §288: Die Gerätesperre ist aus dem Programm verschwunden.
//
//     node pruefungen/x-geraetesperre-ist-weg.mjs
//
// WARUM DIESE PRÜFUNG IM QUELLTEXT SUCHT UND NICHT AUF DEM BILDSCHIRM
// Die Sperre lag hinter der nativen Hülle: Sie erschien nur, wenn
// `istApp()` wahr war UND ein Capacitor-Zusatzpaket antwortete. In einem
// Browser ist sie nie erschienen — auch nicht, als es sie noch gab. Eine
// Prüfung „es erscheint kein Sperrbildschirm" wäre dort grün gewesen, ohne
// irgendetwas zu zeigen, und eine grüne Prüfung, die nichts zeigt, ist
// schlimmer als keine.
//
// Was sich belegen lässt, ist, dass der Weg dorthin nicht mehr existiert:
// kein Bauteil, kein Aufruf, kein Zusatzpaket, keine Berechtigung. Das ist
// kein Ersatz für einen Lauf auf dem Gerät — es ist das, was von hier aus
// geht, und es ist vollständig.
//
// WORUM ES GING
// Gemeldet: „Er hat eingetragen, dass er sich über Fingerabdruck anmeldet,
// und das funktioniert nicht. Es wird immer eine Fehlermeldung angezeigt, er
// kommt nicht mehr rein in die App."
//
// Der einzige Ausweg aus der Sperre hieß „Stattdessen abmelden" — und führte
// zurück in die Sperre, weil der Schalter zum Gerät gehörte (`localStorage`)
// und das Abmelden nur die Sitzung abräumte. Siehe
// `src/components/app/altlasten.ts`.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pruefer } from './helfer.mjs'

const { check, bilanz } = pruefer()
const WURZEL = new URL('..', import.meta.url).pathname

function lies(pfad) {
  const voll = join(WURZEL, pfad)
  return existsSync(voll) ? readFileSync(voll, 'utf8') : null
}

/** Alle Quelltextdateien unter einem Verzeichnis. */
function dateien(verzeichnis, endungen = ['.ts', '.tsx']) {
  const raus = []
  const gehen = (ort) => {
    for (const name of readdirSync(ort)) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      const voll = join(ort, name)
      if (statSync(voll).isDirectory()) gehen(voll)
      else if (endungen.some(e => name.endsWith(e))) raus.push(voll)
    }
  }
  gehen(join(WURZEL, verzeichnis))
  return raus
}

// ── Das Bauteil ────────────────────────────────────────────────────────────

check('Das Bauteil der Gerätesperre gibt es nicht mehr',
  !existsSync(join(WURZEL, 'src/components/app/Geraetesperre.tsx')),
  'src/components/app/Geraetesperre.tsx')

const quellen = dateien('src')
const nennenSperre = quellen.filter(f => /Geraetesperre/.test(readFileSync(f, 'utf8')))
check('Und niemand bindet es mehr ein', nennenSperre.length === 0,
  nennenSperre.map(f => f.replace(WURZEL, '')).join(', ') || 'keine Stelle')

// ── Die Brücke zum Sensor ──────────────────────────────────────────────────

const nativ = lies('src/lib/nativ.ts') ?? ''
check('Die Brücke zum Sensor ist aus `nativ.ts` entfernt',
  !/export async function biometrie/.test(nativ),
  nativ.match(/export async function biometrie\w*/)?.[0] ?? 'keine Ausfuhr')

const nennenBrücke = quellen.filter(f =>
  /biometriePruefen|biometrielage/.test(readFileSync(f, 'utf8')))
check('Und niemand ruft sie mehr auf', nennenBrücke.length === 0,
  nennenBrücke.map(f => f.replace(WURZEL, '')).join(', ') || 'keine Stelle')

// ── Das Zusatzpaket und die Berechtigung ───────────────────────────────────

const paket = lies('package.json') ?? ''
check('Das Zusatzpaket ist keine Abhängigkeit mehr',
  !/capacitor-biometric-auth/.test(paket),
  paket.match(/"[^"]*biometric[^"]*"/)?.[0] ?? 'nicht aufgeführt')

for (const [was, pfad] of [
  ['Android-Projekt', 'android/capacitor.settings.gradle'],
  ['Android-Abhängigkeiten', 'android/app/capacitor.build.gradle'],
  ['iOS-Projekt', 'ios/App/CapApp-SPM/Package.swift'],
]) {
  const inhalt = lies(pfad)
  check(`Und auch nicht mehr im ${was}`,
    inhalt !== null && !/biometric|Biometric/i.test(inhalt),
    inhalt === null ? `${pfad} fehlt` : (inhalt.match(/[^\n]*[Bb]iometric[^\n]*/)?.[0] ?? pfad))
}

const manifest = lies('android/app/src/main/AndroidManifest.xml') ?? ''
check('Die Berechtigung USE_BIOMETRIC wird nicht mehr verlangt',
  !/<uses-permission[^>]*USE_BIOMETRIC/.test(manifest),
  manifest.match(/<uses-permission[^>]*USE_BIOMETRIC[^>]*>/)?.[0] ?? 'nicht verlangt')

// ── Der Schlüssel auf dem Gerät ────────────────────────────────────────────

/*
 * Das Räumen MUSS es geben: Ohne es bliebe auf jedem Telefon, das die Sperre
 * je eingeschaltet hatte, ein Wahrheitswert liegen, den niemand mehr liest —
 * eine Falle für den Nächsten, der eine Sperre baut.
 */
const altlasten = lies('src/components/app/altlasten.ts') ?? ''
check('Der alte Schlüssel wird beim Start geräumt',
  /removeItem\(ALTE_SPERRE\)/.test(altlasten) && /okun_geraetesperre/.test(altlasten),
  altlasten ? 'altlasten.ts räumt ihn' : 'altlasten.ts fehlt')

const rahmen = lies('src/components/app/AppRahmen.tsx') ?? ''
check('Und das Räumen wird beim Start auch aufgerufen',
  /altlastenRaeumen\(\)/.test(rahmen), 'AppRahmen ruft es')

/*
 * Die Gegenprobe zu allem oben: Dieselbe Suche muss etwas FINDEN können.
 * Sonst bewiese eine Reihe grüner Häkchen nur, dass hier niemand hinsieht.
 */
check('Gegenprobe — die Suche findet einen Begriff, den es wirklich gibt',
  quellen.filter(f => /pushAnmelden/.test(readFileSync(f, 'utf8'))).length > 0,
  'pushAnmelden ist auffindbar')

// ── Und was öffentlich behauptet wird ──────────────────────────────────────

/*
 * Der Ladentext hat die Sperre beworben. Eine Funktion zu entfernen und
 * weiter mit ihr zu werben, ist keine Nachlässigkeit, sondern eine falsche
 * Angabe gegenüber dem Kunden.
 */
const laden = lies('STORE-TEXTE.md') ?? ''
check('Der Ladentext wirbt nicht mehr mit der Sperre',
  !/Face ID oder Fingerabdruck/.test(laden),
  laden.match(/[^\n]*Fingerabdruck[^\n]*/)?.[0] ?? 'nicht beworben')

const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
