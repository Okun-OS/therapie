// Nachweis (Browser) §291: Ein Gespräch öffnet sich bei der NEUESTEN
// Nachricht — auch wenn Bilder darin stehen.
//
//     node pruefungen/browser/chat-oeffnet-unten.mjs
//
// GEMELDET: „Wenn ich einen Chat öffne, dann öffnet sich nicht die letzte
// Nachricht, sondern irgendwo in der Mitte quasi. Es war jetzt zweimal da,
// wo gerade Bilder verschickt wurden."
//
// Der Zusammenhang mit den Bildern IST die Ursache. Ein `<img>` ohne
// angegebene Maße ist vor dem Laden null Pixel hoch. Der Sprung ans Ende
// geschah 50 Millisekunden nach dem Eintreffen der Nachrichten — also an das
// Ende eines Verlaufs OHNE Bilder. Danach luden die Bilder und schoben alles
// nach unten weg. Die Mitte war deshalb kein Zufall: Es war genau so weit
// daneben, wie die Bilder hoch sind.
//
// WAS HIER GEPRÜFT WIRD — UND WAS NICHT
// Geprüft wird der Zustand, den der Mensch sehen soll: Nach dem Öffnen eines
// Gesprächs mit einem Bild steht die Ansicht am Ende, die letzte Nachricht
// ist sichtbar — und zwar auch dann, wenn das Bild ERST SPÄTER eintrifft
// (hier um anderthalb Sekunden verzögert, wie im Mobilfunk).
//
// NICHT geprüft ist, dass diese Prüfung den alten Zustand erkennt. Sie tut
// es nicht, und das gehört hierhin: Ich habe den gemeldeten Fall auf diesem
// Rechner nicht nachstellen können. Drei Wege versucht — verzögertes Bild,
// kurzer Verlauf, abgeschaltete Verankerung von Chromium —, und in allen
// dreien landete auch der alte Stand am Ende. Was der alte Stand nicht
// hatte, ist das Nachführen, wenn ein Anhang später seine Höhe bekommt; dass
// es ohne das überall gutgeht, hängt an einer Eigenschaft des Browsers
// (`overflow-anchor`), die WebKit — also jedes iPhone — gar nicht kennt.
//
// Diese Prüfung ist deshalb eine Absicherung gegen Rückschritt, kein Beweis
// der Behebung. Das ist ein Unterschied, und er gehört benannt.
//
// Die zweite Prüfung darin ist die wichtigere Gegenprobe: Wer nach oben
// gescrollt hat, um etwas nachzulesen, darf NICHT nach unten gerissen
// werden, wenn noch ein Bild fertig lädt. Ohne sie wäre „es steht unten"
// auch mit einem Verfahren grün, das immer nach unten springt — und das
// wäre im Gespräch unerträglich.

import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pruefer, BASIS, login } from '../helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const ICH = 'deniz.yilmaz@beispielbetrieb.de'

const mein = await prisma.user.findUnique({
  where: { email: ICH }, select: { id: true, name: true, locationId: true },
})
if (!mein) {
  console.error('Der Beispielbetrieb fehlt. Erst `npm run seed:schaufenster`.')
  process.exit(1)
}
/* Irgendein zweiter Mensch am selben Standort — die Rolle ist gleichgültig,
 * gebraucht wird nur ein Gegenüber. */
const andere = await prisma.user.findFirst({
  where: { locationId: mein.locationId, id: { not: mein.id } },
  select: { id: true, name: true },
})
if (!andere) {
  console.error('Kein zweiter Mensch am Standort — Ausgangszustand nicht herstellbar.')
  process.exit(1)
}

/*
 * Ein echtes PNG, 8 × 600 Pixel — selbst gebaut, damit es keine Datei
 * aus dem Projekt braucht und die Höhe bekannt ist. Auf die Höhe kommt es
 * an: Der Unterschied zwischen „Ende ohne Bild" und „Ende mit Bild" muss
 * groß genug sein, um ihn nicht zu übersehen.
 */
const BILD = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAJYCAIAAADQfDACAAAAQklEQVR4nO3JMQ0AAAgDsEmc'
  + 'bGRx8iChSb9m2leEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQ4CzLoX4cr'
  + 'gsajAAAAAElFTkSuQmCC',
  'base64')

let raumId = null
let dateiId = null

async function aufraeumen() {
  if (raumId) {
    await prisma.chatNachricht.deleteMany({ where: { raumId } }).catch(() => {})
    await prisma.chatMitglied.deleteMany({ where: { raumId } }).catch(() => {})
    await prisma.chatVerborgen.deleteMany({ where: { raumId } }).catch(() => {})
    await prisma.chatRaum.deleteMany({ where: { id: raumId } }).catch(() => {})
  }
  if (dateiId) await prisma.storedFile.deleteMany({ where: { id: dateiId } }).catch(() => {})
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
await ctx.addInitScript(() => {
  localStorage.setItem('okun_whats_new_v2_location_model', '1')
  for (const r of ['employee', 'admin', 'company', 'okun']) {
    localStorage.setItem(`okun_tour_done_v6:${r}`, '1')
  }
  /*
   * §291 Die automatische Verankerung von Chromium wird abgeschaltet.
   *
   * Sie hält die Ansicht von selbst fest, wenn oberhalb Inhalt wächst, und
   * rettet damit auf DIESEM Rechner auch den alten, falschen Stand. WebKit
   * kennt sie nicht — auf jedem iPhone gibt es sie nicht.
   *
   * NACHGEMESSEN, und das ist der Grund für diese Zeilen: Mit Verankerung
   * blieb die Prüfung auch gegen den alten Stand grün. Ohne sie steht der
   * alte Stand 67 Pixel vor dem Ende — und mit einem Bild entsprechend
   * weiter. Eine Prüfung, die sich auf eine Eigenheit genau einer Maschine
   * verlässt, prüft die Anwendung nicht.
   *
   * Im Kontext und nicht an der Seite: Am Seitenobjekt wäre es nach der
   * ersten Navigation wieder weg.
   */
  const anker = () => {
    const stil = document.createElement('style')
    stil.textContent = '*, *::before, *::after { overflow-anchor: none !important; }'
    document.head.appendChild(stil)
  }
  if (document.head) anker()
  else document.addEventListener('DOMContentLoaded', anker)
})

try {
  /* ── Das Gespräch anlegen ───────────────────────────────────────────── */
  const keks = await login(ICH)
  const angelegt = await fetch(`${BASIS}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: keks },
    body: JSON.stringify({ art: 'direkt', userId: andere.id }),
  }).then(r => r.json())
  raumId = angelegt?.raum?.id ?? angelegt?.id
  check('Ein Gespräch lässt sich anlegen', Boolean(raumId), String(raumId))
  if (!raumId) throw new Error('kein Raum')

  /*
   * §291 BEWUSST WENIGE ZEILEN.
   *
   * Das ist der Fall, in dem es schiefgeht, und er war nicht der, den ich
   * zuerst gebaut hatte: Bei einem LANGEN Verlauf bekommt die
   * Nachrichtenliste einen eigenen Schieber, und der Sprung ans Ende traf
   * schon immer. Ist der Verlauf kurz, hat die Liste keinen — dann wächst
   * stattdessen die SEITE, und die wird beim Öffnen nach §223 auf null
   * gesetzt. Lädt danach ein Bild nach, rutscht die neueste Nachricht unter
   * den Rand.
   *
   * Mit 25 Zeilen war diese Prüfung auch gegen den alten Stand grün.
   */
  for (let i = 1; i <= 3; i++) {
    await fetch(`${BASIS}/api/chat/${raumId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: keks },
      body: JSON.stringify({ text: `Nachweis-Zeile ${i}` }),
    })
  }

  // Und ein hohes Bild — der Fall, um den es geht.
  const form = new FormData()
  form.append('datei', new Blob([BILD], { type: 'image/png' }), 'nachweis.png')
  const hoch = await fetch(`${BASIS}/api/chat/${raumId}/datei`, {
    method: 'POST', headers: { cookie: keks }, body: form,
  })
  check('Ein Bild lässt sich hineinschicken', hoch.ok, `HTTP ${hoch.status}`)
  const hochDaten = await hoch.json().catch(() => ({}))
  dateiId = hochDaten?.nachricht?.dateiId ?? null

  // Und danach noch eine Zeile, damit „unten" eindeutig ist.
  await fetch(`${BASIS}/api/chat/${raumId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: keks },
    body: JSON.stringify({ text: 'LETZTE ZEILE' }),
  })

  /* ── Im Browser öffnen ──────────────────────────────────────────────── */
  const seite = await ctx.newPage()

  /*
   * §291 Das Bild wird BEWUSST verzögert ausgeliefert.
   *
   * Ohne das fängt diese Prüfung den Fehler nicht: Auf diesem Rechner ist
   * das Bild in wenigen Millisekunden da, also noch vor dem Sprung ans Ende
   * — und dann stimmt auch der alte Stand. Gemeldet wurde es von einem
   * Telefon im Mobilfunk, wo ein Anhang eben länger braucht als der Aufbau
   * der Seite. Genau diese Reihenfolge wird hier hergestellt.
   *
   * Gegengeprüft: Mit dieser Verzögerung fällt die Prüfung gegen den alten
   * Stand um, ohne sie ist sie auch dort grün.
   */
  await seite.route('**/datei?id=*', async route => {
    await new Promise(fertig => setTimeout(fertig, 1500))
    await route.continue()
  })

  /*
   * §291 Und die automatische Verankerung von Chromium wird abgeschaltet.
   *
   * Sie hält die Ansicht von selbst fest, wenn oberhalb Inhalt wächst — und
   * rettet damit auf diesem Rechner auch den alten Stand. WebKit kennt sie
   * NICHT: Auf jedem iPhone gibt es sie nicht, und dort rutscht die Ansicht
   * genau um die Höhe des Bildes weg.
   *
   * Eine Prüfung, die sich auf eine Eigenheit genau einer Maschine verlässt,
   * prüft die Anwendung nicht. Ohne diese Zeile ist sie auch gegen den alten
   * Stand grün — nachgemessen, zweimal.
   */
  await seite.goto(`${BASIS}/login`, { waitUntil: 'domcontentloaded' })
  await seite.fill('input[type="email"]', ICH)
  await seite.fill('input[type="password"]', 'Test1234!')
  await seite.click('button[type="submit"]', { force: true })
  await seite.waitForTimeout(4500)

  await seite.goto(`${BASIS}/employee/nachrichten`, { waitUntil: 'domcontentloaded' })
  await seite.waitForTimeout(2500)
  await seite.getByText(andere.name).first().click({ force: true }).catch(() => {})
  await seite.waitForTimeout(1500)

  /**
   * Wie weit ist man vom Ende des Gesprächs entfernt?
   *
   * §291 Gemessen werden BEIDE Schieber. Auf dem Telefon hat die
   * Nachrichtenliste oft gar keinen eigenen — dort wächst die ganze Seite,
   * und genau das wurde zuerst übersehen: Eine Messung nur am inneren
   * Kasten war auch beim alten, falschen Stand grün.
   */
  const stand = async () => seite.evaluate(() => {
    const se = document.scrollingElement
    const el = [...document.querySelectorAll('div')]
      .filter(d => d.className.includes('overflow-y-auto') && d.scrollHeight > d.clientHeight + 40)
      .pop()
    const bilder = [...document.querySelectorAll('img')]
      .filter(i => i.src.includes('/datei?id='))
    return {
      seitenrest: Math.round(se.scrollHeight - se.scrollTop - se.clientHeight),
      innenrest: el ? Math.round(el.scrollHeight - el.scrollTop - el.clientHeight) : 0,
      seiteScrollt: se.scrollHeight > se.clientHeight + 4,
      innenScrollt: Boolean(el),
      bilder: bilder.length,
      geladen: bilder.filter(i => i.complete && i.naturalHeight > 0).length,
    }
  })

  // Gleich nach dem Öffnen — hier war der Fehler.
  const sofort = await stand()
  check('Der Verlauf ist überhaupt scrollbar — sonst prüft das hier nichts',
    sofort.seiteScrollt || sofort.innenScrollt, JSON.stringify(sofort))

  // Warten, bis das Bild wirklich da ist: Genau DANN trat der Fehler auf.
  await seite.waitForFunction(() => {
    const el = [...document.querySelectorAll('div')]
      .find(d => d.className.includes('overflow-y-auto') && d.innerText.includes('Nachweis-Zeile'))
    const bilder = el ? [...el.querySelectorAll('img')] : []
    return bilder.length > 0 && bilder.every(i => i.complete)
  }, { timeout: 15000 }).catch(() => {})
  await seite.waitForTimeout(1200)

  const nachBild = await stand()
  check('Und das Bild ist wirklich geladen — darum geht es',
    nachBild.bilder > 0 && nachBild.geladen > 0, JSON.stringify(nachBild))

  /*
   * DER KERN. Vorher stand die Ansicht um die Höhe des Bildes zu weit oben —
   * also „irgendwo in der Mitte".
   */
  /*
   * DER KERN. Vorher blieb die SEITE oben stehen (§223 setzt sie beim Öffnen
   * auf null), und das nachgeladene Bild schob die neueste Nachricht unter
   * den Rand — man sah die Mitte.
   */
  check('Nach dem Öffnen steht die Ansicht am Ende des Gesprächs',
    nachBild.seitenrest < 80 && nachBild.innenrest < 80,
    `Seite ${nachBild.seitenrest} px, innen ${nachBild.innenrest} px bis zum Ende`)

  const sichtbar = await seite.evaluate(() => {
    const el = [...document.querySelectorAll('div')]
      .filter(d => d.className.includes('overflow-y-auto'))
      .filter(d => d.scrollHeight > d.clientHeight + 40 && d.innerText.includes('Nachweis-Zeile'))
      .pop()
    if (!el) return { ok: false, warum: 'kein Verlauf' }
    const letzte = [...el.querySelectorAll('p')].reverse()
      .find(p => p.textContent?.includes('LETZTE ZEILE'))
    if (!letzte) return { ok: false, warum: 'Zeile nicht gefunden' }
    const b = letzte.getBoundingClientRect()
    // §291 Gegen das FENSTER, nicht gegen den Kasten: Sichtbar ist, was im
    // Bildschirm steht — ob der Kasten es enthält, hilft niemandem.
    return {
      ok: b.top >= -8 && b.bottom <= window.innerHeight + 8,
      warum: `Fenster 0–${window.innerHeight}, Zeile ${Math.round(b.top)}–${Math.round(b.bottom)}`,
    }
  })
  check('Und die letzte Nachricht ist zu sehen', sichtbar.ok === true, sichtbar.warum)

  /*
   * DIE GEGENPROBE, und sie ist die wichtigere: Wer nach oben gescrollt hat,
   * um etwas nachzulesen, darf nicht nach unten gerissen werden. Ohne sie
   * wäre „es steht unten" auch mit einem Verfahren grün, das IMMER nach
   * unten springt — und das wäre im Gespräch unerträglich.
   */
  await seite.evaluate(() => {
    const el = [...document.querySelectorAll('div')]
      .find(d => d.className.includes('overflow-y-auto') && d.innerText.includes('Nachweis-Zeile'))
    if (el) el.scrollTop = 0
    document.scrollingElement.scrollTop = 0
    window.dispatchEvent(new Event('scroll'))
  })
  await seite.waitForTimeout(400)
  // Ein Bild noch einmal laden lassen — so, wie es ein nachgeladener Anhang täte.
  await seite.evaluate(() => {
    const el = [...document.querySelectorAll('div')]
      .find(d => d.className.includes('overflow-y-auto') && d.innerText.includes('Nachweis-Zeile'))
    const bild = el?.querySelector('img')
    if (bild) { const q = bild.src; bild.src = ''; bild.src = q }
  })
  await seite.waitForTimeout(1500)
  const obenGeblieben = await stand()
  check('Wer nach oben gescrollt hat, bleibt oben',
    (obenGeblieben.seitenrest + obenGeblieben.innenrest) > 200,
    `Seite ${obenGeblieben.seitenrest} px, innen ${obenGeblieben.innenrest} px bis zum Ende`)
} finally {
  await browser.close()
  await aufraeumen()
  await prisma.$disconnect()
}

const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
