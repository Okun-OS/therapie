// Nachweis (Browser) §238: Dieselbe Stundenzahl überall.
//
//     node pruefungen/browser/zeiten-stimmen-ueberein.mjs
//
// DIE MELDUNG
// „Bitte auch mal checken, ob die Zeiten wenigstens alle überall stimmen."
//
// Gefragt nach dem Urlaub, bei dem drei Masken drei Rechnungen hatten. Die
// Frage ist berechtigt: Dieselbe Zahl steht beim Stundenkonto an sechs Stellen
// — „Mein Tag", Profil, Personalakte der Leitung, Belegschaftsliste, Berichte
// und die Unternehmensansicht.
//
// §247 WAS SICH GEÄNDERT HAT — UND WARUM ES JETZT ZWEI GRÖSSEN SIND
// Die Mitarbeiterseiten zeigen seit §247 den LAUFENDEN Stand: freigegeben plus
// alles, was seitdem offen ist. Die Listen der Leitung zeigen weiterhin den
// freigegebenen Stand — berechnet würde der laufende für eine ganze Belegschaft
// zu teuer, und für eine Abrechnungsliste ist der freigegebene auch die
// richtige Zahl. Damit das kein neuer Widerspruch wird, heißt er dort jetzt
// „abgerechnet" und nicht mehr „Konto".
//
// Diese Prüfung vergleicht deshalb: „Mein Tag" gegen „Mein Profil" (dieselbe
// Größe, muss gleich sein) — und sichert getrennt zu, dass die Leitungsliste
// den ABGERECHNETEN Stand zeigt.
//
// WAS DIESE PRÜFUNG MISST
// Nicht, ob die Zahl „richtig" ist — richtig ist, was im Stundenkonto steht.
// Sondern ob ÜBERALL DIESELBE steht, auch über zwei Rollen hinweg und über
// zwei Schreibweisen: „Mein Tag" zeigt Stunden und Minuten (+7:30), alle
// anderen Dezimalstunden (+7.5h). Beides ist derselbe Wert, und genau deshalb
// rechnet diese Prüfung sie auf Minuten um, statt Zeichenketten zu vergleichen
// — sonst meldete sie einen Unterschied, wo keiner ist.
//
// DER AUSGANGSZUSTAND, DEN SIE SELBST HERSTELLT
// Sie setzt einen eigenen, auffälligen Wert. Bei 0 wäre „überall gleich" auch
// dann grün, wenn eine Maske gar nichts läse und einfach 0 anzeigte — und 0
// ist genau der Wert, der im Betrieb am häufigsten dasteht.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { PrismaClient } from '@prisma/client'
import { login, hole } from '../helfer.mjs'

const prisma = new PrismaClient()
const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
let ok = 0, fail = 0
const check = (name, wahr, info = '') => {
  console.log(`  ${wahr ? '✓ PASS' : '✗ FAIL'}  ${name}${info ? `\n           ${info}` : ''}`)
  wahr ? ok++ : fail++
}

const anna = await login('anna.fischer@rheinblick-reha.de')
const annaId = (await hole(anna, '/api/auth/me')).body.user.employeeId
const vorher = await prisma.employee.findUnique({
  where: { id: annaId }, select: { hoursBalance: true, name: true },
})

/**
 * Eine angezeigte Stundenzahl in Minuten — gleich in welcher Schreibweise.
 *
 *     "+7.5h"  → 450        "+7:30" → 450
 *     "−3.25h" → −195       "−3:15" → −195
 *
 * Das Minuszeichen kann ein echtes „−" (U+2212) sein; die Masken setzen es
 * gemischt. Ein naiver Vergleich auf '-' hätte negative Werte als positiv
 * gelesen — und das wäre ein Fehler, den diese Prüfung selbst einbaut.
 */
function inMinuten(text) {
  if (!text) return null
  const sauber = text.trim().replace(/−/g, '-')
  const uhrzeit = sauber.match(/^([+-]?)(\d+):(\d{2})$/)
  if (uhrzeit) {
    const betrag = Number(uhrzeit[2]) * 60 + Number(uhrzeit[3])
    return uhrzeit[1] === '-' ? -betrag : betrag
  }
  const dezimal = sauber.match(/^([+-]?)(\d+(?:[.,]\d+)?)\s*h$/i)
  if (dezimal) {
    const betrag = Math.round(Number(dezimal[2].replace(',', '.')) * 60)
    return dezimal[1] === '-' ? -betrag : betrag
  }
  return null
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

/** Angemeldet bleiben und Seiten abfragen. */
async function sitzung(email) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await ctx.addInitScript(() => {
    localStorage.setItem('okun_whats_new_v2_location_model', '1')
    for (const r of ['employee', 'admin', 'company', 'okun']) {
      localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
    }
  })
  const seite = await ctx.newPage()
  await seite.goto(`${BASIS}/login`)
  await seite.fill('input[type="email"]', email)
  await seite.fill('input[type="password"]', 'Test1234!')
  await seite.click('button[type="submit"]')
  await seite.waitForTimeout(5000)
  return { ctx, seite }
}

/** Einen Messpunkt lesen, bis er eine Zahl zeigt. */
async function messe(seite, pfad, wahl) {
  await seite.goto(`${BASIS}${pfad}`, { waitUntil: 'domcontentloaded' })
  const ziel = seite.locator(wahl)
  for (let versuch = 0; versuch < 50; versuch++) {
    if (await ziel.count() > 0) {
      const minuten = inMinuten(await ziel.first().textContent())
      if (minuten !== null) return minuten
    }
    await seite.waitForTimeout(250)
  }
  return null
}

/**
 * Die Zahl in der Belegschaftsliste der Leitung.
 *
 * Beim ersten Lauf hat diese Funktion am DOM geraten — sie suchte nach einem
 * Element, dessen Text auf „Konto" endet und das keine Kinder hat. Das Feld
 * hat aber ein Symbol als Kind, und so kam `null` zurück: ein Fehler meiner
 * Prüfung, nicht der Seite. Jetzt trägt die Stelle einen Messpunkt, und hier
 * wird nur noch die richtige Karte gesucht.
 */
async function inDerListe(seite) {
  await seite.goto(`${BASIS}/admin/employees`, { waitUntil: 'domcontentloaded' })
  const name = vorher?.name ?? ''
  for (let versuch = 0; versuch < 60; versuch++) {
    const treffer = await seite.evaluate((gesucht) => {
      for (const feld of Array.from(document.querySelectorAll('[data-test="abgerechnet"]'))) {
        const karte = feld.closest('div[class*="rounded"]')
        if (karte && (karte.textContent ?? '').includes(gesucht)) {
          return (feld.textContent ?? '').trim()
        }
      }
      return null
    }, name)
    const minuten = inMinuten(treffer)
    if (minuten !== null) return minuten
    await seite.waitForTimeout(250)
  }
  return null
}

/** Alle Messpunkte für einen gesetzten Wert einsammeln. */
async function alleStellen() {
  const a = await sitzung('anna.fischer@rheinblick-reha.de')
  const meinTag = await messe(a.seite, '/employee/ich', '[data-test="stundenkonto"]')
  const profil = await messe(a.seite, '/employee/profile', '[data-test="stundenkonto"]')
  await a.ctx.close()

  const l = await sitzung('leitung@rheinblick-reha.de')
  const liste = await inDerListe(l.seite)
  await l.ctx.close()

  return { meinTag, profil, liste }
}

/** Den Wert setzen und alles neu messen. */
async function mitSaldo(stunden) {
  await prisma.employee.update({
    where: { id: annaId }, data: { hoursBalance: stunden },
  })
  return alleStellen()
}

// ── §238 Ein auffälliger positiver Wert ───────────────────────────────────
console.log('=== §238 Stundenkonto +7,5 h ===')

const a = await mitSaldo(7.5)
check('„Mein Tag" nennt eine Zahl', a.meinTag !== null, `${a.meinTag} Minuten`)
check('Das Profil auch', a.profil !== null, `${a.profil} Minuten`)
check('Die Belegschaftsliste der Leitung auch', a.liste !== null, `${a.liste} Minuten`)
check('Und alle drei meinen dasselbe', a.meinTag === 450 && a.profil === 450 && a.liste === 450,
  `Mein Tag ${a.meinTag} · Profil ${a.profil} · Liste ${a.liste} (erwartet 450)`)

// ── §238 Ein negativer Wert ───────────────────────────────────────────────
console.log('\n=== §238 Stundenkonto −3,25 h ===')

/*
 * Der negative Fall eigens, weil hier die Schreibweisen am weitesten
 * auseinandergehen: „Mein Tag" setzt ein echtes Minuszeichen (−3:15), die
 * anderen einen Bindestrich (-3.25h). Eine Prüfung, die nur den positiven
 * Fall misst, bestätigt die halbe Zusage.
 */
const b = await mitSaldo(-3.25)
check('Auch negativ nennt „Mein Tag" eine Zahl', b.meinTag !== null, `${b.meinTag} Minuten`)
check('Und alle drei meinen weiterhin dasselbe',
  b.meinTag === -195 && b.profil === -195 && b.liste === -195,
  `Mein Tag ${b.meinTag} · Profil ${b.profil} · Liste ${b.liste} (erwartet −195)`)
check('Und die Zahl hat sich wirklich bewegt', a.meinTag !== b.meinTag,
  `${a.meinTag} → ${b.meinTag} Minuten`)

// ── §238 Die Gegenprobe zur Umrechnung selbst ─────────────────────────────
console.log('\n=== §238 Gegenprobe — die Umrechnung ===')

check('Stunden-Minuten-Schreibweise', inMinuten('+7:30') === 450, `${inMinuten('+7:30')}`)
check('Dezimalschreibweise', inMinuten('+7.5h') === 450, `${inMinuten('+7.5h')}`)
check('Negativ mit Bindestrich', inMinuten('-3.25h') === -195, `${inMinuten('-3.25h')}`)
check('Negativ mit echtem Minuszeichen', inMinuten('−3:15') === -195, `${inMinuten('−3:15')}`)
/*
 * Ohne diese beiden wäre „überall gleich" auch dann grün, wenn die Umrechnung
 * bei allem `null` liefert und der Vergleich `null === null` lautet.
 */
check('Ein Strich ist keine Zahl', inMinuten('–') === null, `${inMinuten('–')}`)
check('Und Text auch nicht', inMinuten('keine Angabe') === null, `${inMinuten('keine Angabe')}`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
await prisma.employee.update({
  where: { id: annaId }, data: { hoursBalance: vorher?.hoursBalance ?? 0 },
})
await prisma.$disconnect()

console.log(`\n${ok}/${ok + fail} Checks bestanden`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
