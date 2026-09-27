/**
 * §175 Den Katalog der Umlagesätze einlesen.
 *
 *     npm run umlagen:import                       # prisma/daten/umlagen-2026.csv
 *     npm run umlagen:import -- pfad/zur/datei.csv
 *
 * Erwartet wird die Form, die `recherche-auftrag-umlagen.md` bestellt:
 *
 *     kasse;u1_erstattung_prozent;u1_satz_prozent;u2_satz_prozent;gueltig_ab;quelle
 *
 * WAS DER IMPORT NICHT TUT
 * Er glaubt nichts. Zeilen mit `?` überspringt er und nennt sie beim Namen,
 * statt sie mit einer Null zu füllen. Unplausible Sätze lässt er durch, sagt
 * es aber — eine Zahl, die nur seltsam aussieht, kann trotzdem richtig sein,
 * und ein Import, der eigenmächtig aussortiert, ist schlimmer als einer, der
 * laut ist.
 *
 * WARUM NICHTS ALS „GEPRÜFT" ANKOMMT
 * Alles landet mit `geprueft: false`. Der Haken kommt erst, wenn jemand die
 * Zahl gegen die Satzung gehalten hat. Bei den Pfändungstabellen waren zwei
 * von acht falsch — aufgefallen ist es nur, weil es dieses Feld gab.
 * Welche Kassen bereits geprüft sind, steht in `GEPRUEFT` unten, mit Datum.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const prisma = new PrismaClient()

/**
 * Kassen, deren Sätze gegen die eigene Veröffentlichung der Kasse gehalten
 * wurden — wer, wann, und was dabei herauskam, steht in FEATURES.md (§175).
 */
const GEPRUEFT: Record<string, string> = {
  'techniker krankenkasse': '2026-09-27, tk.de — alle drei Stufen und U2 deckungsgleich',
  'barmer': '2026-09-27, barmer.de — alle drei Stufen und U2 deckungsgleich',
  'dak-gesundheit': '2026-09-27, dak.de — beide Zeiträume deckungsgleich, auch die Absenkung zum 1.9.',
  'knappschaft': '2026-09-27, Merkblatt der Knappschaft (Jan 2026) — U1 0,80 % und U2 0,22 % bestätigt; '
    + 'die Erstattungsstufe von 80 % geht aus dem Merkblatt NICHT hervor und ist noch offen',
}

interface Zeile {
  kasse: string
  u1Erstattung: number
  u1Satz: number
  u2Satz: number | null
  gueltigAb: string
  quelle: string | null
}

const TAG = /^\d{4}-\d{2}-\d{2}$/

function zahl(roh: string): number | null {
  const t = roh.trim().replace(',', '.')
  if (!t || t === '?' || t === '-') return null
  const z = Number(t)
  return Number.isFinite(z) ? z : null
}

/** Prozentzahl zu Anteil: „2,1" → 0,021. Auf fünf Stellen, wie in der Maske. */
const anteil = (prozent: number) => Math.round(prozent * 1000) / 100000

function lesen(pfad: string): { zeilen: Zeile[]; uebersprungen: string[] } {
  // Das Byte-Order-Mark am Dateianfang macht aus „kasse" sonst „﻿kasse",
  // und dann findet der Import die erste Spalte nicht.
  const roh = readFileSync(pfad, 'utf8').replace(/^﻿/, '')
  const zeilen: Zeile[] = []
  const uebersprungen: string[] = []

  const alle = roh.split(/\r?\n/).filter(z => z.trim())
  const kopf = alle[0].split(';').map(s => s.trim())
  const spalte = (name: string) => kopf.indexOf(name)
  const iKasse = spalte('kasse')
  const iErst = spalte('u1_erstattung_prozent')
  const iU1 = spalte('u1_satz_prozent')
  const iU2 = spalte('u2_satz_prozent')
  const iAb = spalte('gueltig_ab')
  const iQ = spalte('quelle')
  if ([iKasse, iErst, iU1, iAb].some(i => i < 0)) {
    throw new Error(
      'Die Kopfzeile passt nicht. Erwartet werden mindestens: kasse, '
      + 'u1_erstattung_prozent, u1_satz_prozent, gueltig_ab. '
      + `Gefunden: ${kopf.join(', ')}`)
  }

  for (const [nr, z] of Array.from(alle.slice(1).entries())) {
    const f = z.split(';')
    const kasse = (f[iKasse] ?? '').trim()
    const erst = zahl(f[iErst] ?? '')
    const u1 = zahl(f[iU1] ?? '')
    const u2 = iU2 >= 0 ? zahl(f[iU2] ?? '') : null
    const ab = (f[iAb] ?? '').trim()

    const grund =
      !kasse ? 'keine Kasse'
        : erst == null ? 'Erstattungsstufe nicht belegt'
          : u1 == null ? 'U1-Satz nicht belegt'
            : !TAG.test(ab) ? `Datum „${ab}" ist nicht JJJJ-MM-TT`
              : null
    if (grund) {
      uebersprungen.push(`Zeile ${nr + 2}: ${grund} — ${z.slice(0, 90)}`)
      continue
    }

    zeilen.push({
      kasse,
      u1Erstattung: anteil(erst!),
      u1Satz: anteil(u1!),
      u2Satz: u2 == null ? null : anteil(u2),
      gueltigAb: ab,
      quelle: iQ >= 0 ? ((f[iQ] ?? '').trim() || null) : null,
    })
  }
  return { zeilen, uebersprungen }
}

async function main() {
  const pfad = resolve(process.argv[2] ?? 'prisma/daten/umlagen-2026.csv')
  const { zeilen, uebersprungen } = lesen(pfad)

  let neu = 0, geaendert = 0, gleich = 0
  const auffaellig: string[] = []

  for (const z of zeilen) {
    const pruefnotiz = GEPRUEFT[z.kasse.toLowerCase()] ?? null
    const daten = {
      ...z,
      geprueft: pruefnotiz !== null,
      notiz: pruefnotiz,
    }
    const vorher = await prisma.umlageKatalog.findUnique({
      where: {
        kasse_u1Erstattung_gueltigAb: {
          kasse: z.kasse, u1Erstattung: z.u1Erstattung, gueltigAb: z.gueltigAb,
        },
      },
    })
    await prisma.umlageKatalog.upsert({
      where: {
        kasse_u1Erstattung_gueltigAb: {
          kasse: z.kasse, u1Erstattung: z.u1Erstattung, gueltigAb: z.gueltigAb,
        },
      },
      create: daten,
      update: daten,
    })
    if (!vorher) neu++
    else if (vorher.u1Satz !== z.u1Satz || vorher.u2Satz !== z.u2Satz) geaendert++
    else gleich++

    // Kassen liegen bei der U1 meist zwischen 1 % und 4,5 %, bei der U2
    // zwischen 0,2 % und 0,7 %. Was daneben liegt, wird eingetragen UND
    // genannt — aussortieren wäre schlimmer als melden.
    if (z.u1Satz < 0.005 || z.u1Satz > 0.05) {
      auffaellig.push(
        `${z.kasse} (${(z.u1Erstattung * 100).toFixed(0)} % ab ${z.gueltigAb}): `
        + `U1 ${(z.u1Satz * 100).toLocaleString('de-DE')} % liegt außerhalb des Üblichen`)
    }
    if (z.u2Satz != null && (z.u2Satz < 0.001 || z.u2Satz > 0.01)) {
      auffaellig.push(
        `${z.kasse} ab ${z.gueltigAb}: `
        + `U2 ${(z.u2Satz * 100).toLocaleString('de-DE')} % liegt außerhalb des Üblichen`)
    }
  }

  const kassen = new Set(zeilen.map(z => z.kasse))
  const gepruefteKassen = Array.from(kassen).filter(k => GEPRUEFT[k.toLowerCase()])
  const wechsel = new Map<string, Set<string>>()
  for (const z of zeilen) {
    if (!wechsel.has(z.kasse)) wechsel.set(z.kasse, new Set())
    wechsel.get(z.kasse)!.add(z.gueltigAb)
  }
  const unterjaehrig = Array.from(wechsel.entries()).filter(([, d]) => d.size > 1)

  console.log(`\nKatalog eingelesen aus ${pfad}`)
  console.log(`  ${zeilen.length} Zeilen, ${kassen.size} Kassen`)
  console.log(`  neu ${neu} · geändert ${geaendert} · unverändert ${gleich}`)
  console.log(`  geprüft: ${gepruefteKassen.length} von ${kassen.size} `
    + `(${gepruefteKassen.join(', ') || 'keine'})`)

  if (unterjaehrig.length > 0) {
    console.log('\nKassen mit unterjährigem Wechsel — hier rechnet der Monat mit:')
    for (const [k, d] of unterjaehrig) {
      console.log(`  ${k}: ${Array.from(d).sort().join(', ')}`)
    }
  }
  if (auffaellig.length > 0) {
    console.log('\nEingetragen, aber einen zweiten Blick wert:')
    for (const a of auffaellig) console.log(`  ${a}`)
  }
  if (uebersprungen.length > 0) {
    console.log(`\n${uebersprungen.length} Zeilen übersprungen — nichts geraten:`)
    for (const u of uebersprungen) console.log(`  ${u}`)
  }
  console.log()
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
