/**
 * §184 Die drei Bildschirmfotos für die Website — aus dem laufenden Programm.
 *
 * WARUM AUS DEM ECHTEN PROGRAMM UND NICHT AUS EINEM ZEICHENPROGRAMM
 * Ein nachgebautes Bild zeigt, was man sich wünscht. Ein Bildschirmfoto zeigt,
 * was da ist. Wer eine Software kauft, hat schon genug Hochglanzbilder
 * gesehen, die mit dem Programm nichts zu tun hatten — und merkt es spätestens
 * in der ersten Woche.
 *
 * Deshalb: Dieses Skript meldet sich am laufenden Programm an, klickt sich zu
 * den drei Bildschirmen und fotografiert sie. Ändert sich die Oberfläche,
 * ändern sich die Bilder beim nächsten Lauf mit. Es gibt keine zweite Fassung,
 * die altern könnte.
 *
 *     npm run seed:schaufenster      einmal, legt den Beispielbetrieb an
 *     npm run dev                    muss laufen
 *     npm run schaufenster           erzeugt public/schaufenster/*.png
 *
 * WELCHE DREI UND WARUM GERADE DIE
 * Dienstplan, Stempeluhr, Lohnabrechnung — und zwar für denselben Menschen im
 * selben Monat. Das ist der Punkt, den kein Wettbewerber auf einem Bild zeigen
 * kann: Es ist nicht dreimal dasselbe Programm, sondern dreimal derselbe
 * Vorgang. Der Dienst wird geplant, die Zeit wird gestempelt, der Lohn kommt
 * aus genau dieser Zeit — ohne dass jemand etwas überträgt.
 *
 * WAS DAS SKRIPT WEGKLICKT UND WARUM DAS IN ORDNUNG IST
 * Die Einführungstour, das Was-ist-neu-Fenster und die Seitenhinweise. Sie
 * gehören zum Produkt, aber nicht auf ein Bild, das in zwei Sekunden
 * verstanden werden soll. Weggeklickt wird über dieselben Schalter, die auch
 * ein Mensch benutzt — nichts wird versteckt, was ein Kunde nicht auch
 * schließen könnte.
 */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HIER = dirname(fileURLToPath(import.meta.url))
const ZIEL = join(HIER, '..', 'public', 'schaufenster')
const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const PASSWORT = 'Test1234!'
const LEITUNG = 'leitung@beispielbetrieb.de'
const KRAFT = 'deniz.yilmaz@beispielbetrieb.de'

/*
 * Alles, was sich beim ersten Besuch von selbst öffnet. Es wird vor dem ersten
 * Bild als „schon gesehen" hinterlegt — dieselben Schlüssel, die auch ein
 * Klick auf „Verstanden" setzt.
 */
const SCHON_GESEHEN = {
  okun_whats_new_v2_location_model: '1',
  okun_lm_migration_done: '1',
  'okun_tour_done_v6:admin': '1',
  'okun_tour_done_v6:employee': '1',
  'okun_tour_done_v6:company': '1',
  okun_dock_hidden: '1',
}

mkdirSync(ZIEL, { recursive: true })

/*
 * §184 Der Lohnlauf, bevor fotografiert wird.
 *
 * Er steht NICHT im Seed, und das ist Absicht: Eine von Hand eingetragene
 * Nettozahl wäre eine Zahl auf einem Werbebild, die niemand nachgerechnet hat.
 * Hier läuft er über dieselben Schnittstellen, die auch eine Leitung benutzt —
 * Monatsabschluss freigeben, Abrechnungen vorbereiten. Was danach im Bild
 * steht, hat das Programm gerechnet.
 */
async function anmeldung(email) {
  const r = await fetch(`${BASIS}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORT }),
  })
  if (!r.ok) throw new Error(`Anmeldung ${email} fehlgeschlagen: HTTP ${r.status}`)
  return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
}

async function ruf(cookie, pfad, methode = 'GET', daten) {
  const r = await fetch(`${BASIS}${pfad}`, {
    method: methode,
    headers: { cookie, 'Content-Type': 'application/json' },
    body: daten === undefined ? undefined : JSON.stringify(daten),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

/*
 * §274 Hieß einmal `lohnlaufVorbereiten` und rief am Ende
 * `/api/payroll/vorbereiten` auf — für das Bild der Lohnabrechnung. Das Bild
 * gibt es nicht mehr, der Aufruf also auch nicht: Er erzeugte eine komplette
 * Abrechnung, nur damit ein Werbefoto entsteht.
 *
 * Was bleibt, wird für die Zuschlagsübersicht wirklich gebraucht: der
 * Monatsabschluss. Er gehört der Leitung — bei Stundenlohn ist die erfasste
 * Zeit die Grundlage des Entgelts, und ohne ihre Freigabe geht zu Recht
 * nichts ans Lohnbüro.
 */
async function monatsabschlussFreigeben() {
  const cookie = await anmeldung(LEITUNG)
  const heute = new Date()
  const jahr = heute.getMonth() === 0 ? heute.getFullYear() - 1 : heute.getFullYear()
  const monat = heute.getMonth() === 0 ? 12 : heute.getMonth()

  const personen = (await ruf(cookie, '/api/employees')).body.employees ?? []
  const amStandort = personen.filter(x => x.locationId === 'schaufenster-standort')
  let frei = 0
  for (const p of amStandort) {
    const angelegt = await ruf(cookie, '/api/monthly-closings/get-or-create', 'POST', {
      employeeId: p.id, year: jahr, month: monat,
      employeeInfo: { employeeName: p.name },
    })
    const id = angelegt.body.closing?.id
    if (!id) continue
    if (angelegt.body.closing?.status === 'freigegeben') { frei++; continue }
    const r = await ruf(cookie, '/api/time-tracking/release-closing', 'POST', {
      closingId: id, releasedBy: 'Lena Hartmann',
    })
    if (r.status < 300) frei++
  }

  console.log(`  Monatsabschluss ${String(monat).padStart(2, '0')}.${jahr}: `
    + `${frei} von ${amStandort.length} freigegeben`)
  if (frei === 0) {
    throw new Error(
      'Kein Monatsabschluss freigegeben. Erst `npm run seed:schaufenster` ausführen.',
    )
  }
}

await monatsabschlussFreigeben()

async function anmelden(ctx, email) {
  const seite = await ctx.newPage()
  await seite.goto(`${BASIS}/login`)
  await seite.fill('input[type=email]', email)
  await seite.fill('input[type=password]', PASSWORT)
  await seite.click('button[type=submit]')
  await seite.waitForURL(/\/(admin|employee|company)/, { timeout: 30_000 })
  return seite
}

/** Alles schließen, was sich über den Bildschirm legt. */
async function aufraeumen(seite) {
  for (const text of ['Verstanden', 'Tour beenden', 'Schließen', 'Später']) {
    const knopf = seite.getByRole('button', { name: text, exact: false }).first()
    if (await knopf.isVisible().catch(() => false)) {
      await knopf.click().catch(() => {})
      await seite.waitForTimeout(400)
    }
  }
  /*
   * Was sich nicht über einen Knopf schließen lässt, wird für das Bild
   * ausgeblendet: die schwebende Bedienleiste am unteren Rand und die
   * Hilfeblase unten rechts. Beide liegen ÜBER dem Inhalt — auf einem Bild
   * verdecken sie genau die Zeile, auf die es ankommt.
   *
   * Gesucht wird über die Beschriftung, nicht über eine Klasse: Klassen
   * ändern sich bei jedem Umbau der Oberfläche, und ein Bild mit einer
   * Bedienleiste quer durch den Dienstplan fiele erst auf der Website auf.
   */
  await seite.evaluate(() => {
    /*
     * Alles, was fest am UNTEREN Rand klebt: die schwebende Bedienleiste und
     * die Hilfeblase. Beide liegen über dem Inhalt und verdecken auf einem
     * Bild genau die Zeile, auf die es ankommt.
     *
     * Erkannt werden sie an ihrer Lage, nicht an einer Klasse oder einer
     * Beschriftung. Beides ändert sich bei jedem Umbau der Oberfläche — und
     * ein Bild mit einer Bedienleiste quer durch den Dienstplan fiele erst
     * auf der Website auf. Die Kopfzeile bleibt: Sie steht oben und gehört
     * aufs Bild.
     */
    for (const el of document.querySelectorAll('body *')) {
      if (getComputedStyle(el).position !== 'fixed') continue
      const kasten = el.getBoundingClientRect()
      if (kasten.height === 0) continue
      if (kasten.bottom > window.innerHeight - 140) {
        el.style.display = 'none'
      }
    }
  }).catch(() => {})
  await seite.waitForTimeout(500)
}

const browser = await chromium.launch()
const kontext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'de-DE',
})
await kontext.addInitScript((werte) => {
  try {
    for (const [k, v] of Object.entries(werte)) localStorage.setItem(k, v)
  } catch { /* ohne Speicher wird nur mehr weggeklickt */ }
}, SCHON_GESEHEN)

const bilder = []

// ── 1. Der Dienstplan ───────────────────────────────────────────────────────
{
  const seite = await anmelden(kontext, LEITUNG)
  await seite.goto(`${BASIS}/admin/schedule`, { waitUntil: 'networkidle' })
  await seite.waitForTimeout(2_500)
  await aufraeumen(seite)

  /*
   * Zur Wochentabelle scrollen. Darüber steht die Maske zum Rechnen — die
   * gehört ins Produkt, aber nicht auf ein Bild, das in zwei Sekunden
   * verstanden werden soll.
   *
   * Gescrollt wird so weit, dass die Kopfzeile der Tabelle oben steht; dann
   * wird einfach der Bildschirm fotografiert. Ein Ausschnitt nach festen
   * Pixelwerten ginge beim nächsten Umbau der Seite daneben, ohne dass es
   * jemand merkt.
   */
  const kopfzeile = seite.getByText('BEREICH NORD').first()
  await kopfzeile.evaluate(el => {
    const kasten = el.getBoundingClientRect()
    window.scrollBy({ top: kasten.top - 90, behavior: 'instant' })
  }).catch(() => {})
  await seite.waitForTimeout(800)
  await seite.screenshot({ path: join(ZIEL, 'dienstplan.png') })
  bilder.push('dienstplan.png')
  await seite.close()
}

// ── 2. Die Zuschläge ────────────────────────────────────────────────────────
//
// §274 Hier stand die Lohnabrechnung. Sie wird nicht mehr beworben, solange
// die ITSG-Systemprüfung fehlt. Die Zuschlagsübersicht ist der ehrliche
// Nachfolger: derselbe Monat, dieselben gestempelten Zeiten — und das ist
// das Erste, was ein Lohnbüro von uns bekommt.
{
  const seite = await anmelden(kontext, LEITUNG)
  await seite.goto(`${BASIS}/admin/surcharges`, { waitUntil: 'networkidle' })
  await seite.waitForTimeout(3_000)

  /*
   * Einen Monat zurück. Die Seite öffnet im laufenden Monat, und der ist am
   * Ersten noch fast leer — Zuschläge entstehen aus gestempelten Zeiten.
   * Das alte Bild zeigte aus genau diesem Grund einmal einen leeren Monat:
   * richtig, und als Werbebild das Gegenteil dessen, was gemeint war.
   */
  const zurueck = seite.locator('button:has(svg.lucide-chevron-left)').first()
  await zurueck.click({ timeout: 5_000 }).catch(() => {})
  await seite.waitForTimeout(3_000)

  /*
   * Nachsehen, ob wirklich Zeilen dastehen. Ein Klick, der ins Leere ging,
   * fiele sonst erst auf der fertigen Website auf.
   */
  const zeilen = await seite.locator('table tbody tr').count().catch(() => 0)
  if (zeilen === 0) {
    throw new Error(
      'Die Zuschlagsübersicht ist leer. Wurde `npm run seed:schaufenster` ausgeführt, '
      + 'und gibt es gestempelte Zeiten im Vormonat?',
    )
  }
  await aufraeumen(seite)
  await seite.screenshot({ path: join(ZIEL, 'zuschlaege.png') })
  bilder.push('zuschlaege.png')
  await seite.close()
}

// ── 3. Die Stempeluhr ───────────────────────────────────────────────────────
//
// Auf einem Telefon, weil sie dort benutzt wird. Ein Bild der Stempeluhr auf
// einem 1440 Pixel breiten Bildschirm wäre richtig und würde trotzdem lügen.
{
  const telefon = await browser.newContext({
    viewport: { width: 430, height: 880 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
  })
  await telefon.addInitScript((werte) => {
    try {
      for (const [k, v] of Object.entries(werte)) localStorage.setItem(k, v)
    } catch { /* siehe oben */ }
  }, SCHON_GESEHEN)

  const seite = await anmelden(telefon, KRAFT)
  await seite.waitForTimeout(2_500)
  await aufraeumen(seite)
  await seite.screenshot({ path: join(ZIEL, 'stempeluhr.png') })
  bilder.push('stempeluhr.png')
  await telefon.close()
}

await browser.close()

for (const name of bilder) {
  const { size } = statSync(join(ZIEL, name))
  console.log(`✓ public/schaufenster/${name}  ${(size / 1024).toFixed(0)} kB`)
}
console.log(`\n${readdirSync(ZIEL).length} Dateien in public/schaufenster`)
