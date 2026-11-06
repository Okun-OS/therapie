/**
 * §185 Den neuen Kunden einrichten: Wohngruppe mit fünf Bewohnern.
 *
 * WAS DIESES SKRIPT TUT
 * Es legt an, was ein Betrieb braucht, bevor der erste Dienstplan gerechnet
 * werden kann — und zwar in der Reihenfolge, in der es aufeinander aufbaut:
 *
 *   1. Kunde und Standort
 *   2. Die fünfzehn Dienstzeiten aus dem Regelwerk, dazu Büro und Sitzung
 *   3. Den Bereich (eine Wohngruppe ist ein Ort, keine Gruppenlandschaft)
 *   4. Das Regelpaket zuordnen und die Dienstplanung freischalten
 *   5. Die Belegschaft — über dieselbe Schnittstelle wie die Maske (§183)
 *
 *     npm run kunde:wohngruppe
 *
 * WARUM DIE BELEGSCHAFT ÜBER DIE SCHNITTSTELLE GEHT UND NICHT ÜBER PRISMA
 * Weil dort die Prüfung sitzt, die einen Betrieb davor bewahrt, ohne
 * Dienstplan dazustehen: Tagesmuster und Stundenzahl müssen zusammenpassen,
 * eine Gruppe muss es geben, ein fester freier Tag muss in die Betriebswoche
 * passen (§181/§183). Ein Skript, das direkt in die Datenbank schreibt, geht
 * an all dem vorbei — und der Fehler fällt erst beim ersten Plan auf.
 *
 * WAS HIER NICHT STEHT
 * Die Fixtermine der Leitung (WWS-Sitzung, Gesamtsitzung, Teamsitzung). Das
 * Regelwerk des Kunden nennt sie selbst als ERSTEN Schritt der Planung, noch
 * vor dem Rechnen. Sie gehören als Termin in den Plan, nicht in ein
 * Einrichtungsskript — und sie ändern sich monatlich.
 *
 * ZU DEN PERSONENDATEN
 * Die Belegschaftsliste unten stammt aus dem Regelwerk des Kunden und enthält
 * echte Namen. Sie steht hier, damit das Einrichten nachvollziehbar und
 * wiederholbar ist. Sie gehört NICHT in Demo-Daten, nicht in Prüfungen und
 * schon gar nicht auf die Website — dafür gibt es den Beispielbetrieb (§184).
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const BASIS = process.env.PRUEF_BASIS ?? 'http://localhost:3000'
const PASSWORT = process.env.KUNDE_PASSWORT ?? 'Test1234!'
const KUNDE = 'wohngruppe-kunde'
const STANDORT = 'wohngruppe-standort'
const PAKET = 'wohngruppe_fuenf'

/**
 * Die Dienstzeiten aus Abschnitt 3 des Regelwerks — unverändert übernommen.
 *
 * Die Nummern des Kunden stehen im Namen, damit die Leitung ihren eigenen
 * Plan wiedererkennt: Wer „4Bf" sagt, soll „4Bf" sehen.
 *
 * `type` ist die Dienstart für den Rechendienst: early, mid, late. Sie steuert
 * die Fairness-Verteilung und die Zuschläge — nicht die Besetzungsregeln, die
 * rechnen mit Uhrzeiten.
 */
const DIENSTE = [
  { id: 'wg-1',   name: '1 Früh',              type: 'early', startTime: '06:30', endTime: '14:00' },
  { id: 'wg-2',   name: '2 Früh lang',         type: 'early', startTime: '06:30', endTime: '16:30' },
  { id: 'wg-3',   name: '3 Tag',               type: 'mid',   startTime: '07:45', endTime: '19:15' },
  { id: 'wg-3f',  name: '3f Tag früh',         type: 'mid',   startTime: '07:15', endTime: '18:45' },
  { id: 'wg-4a',  name: '4A Tag kurz',         type: 'mid',   startTime: '07:45', endTime: '14:30' },
  { id: 'wg-4af', name: '4Af Tag kurz früh',   type: 'mid',   startTime: '07:15', endTime: '13:45' },
  { id: 'wg-4b',  name: '4B Tag kurz',         type: 'mid',   startTime: '07:45', endTime: '16:30' },
  { id: 'wg-4bf', name: '4Bf Tag kurz früh',   type: 'mid',   startTime: '07:15', endTime: '16:30' },
  { id: 'wg-5',   name: '5 Tag ab Mittag',     type: 'mid',   startTime: '11:30', endTime: '19:15' },
  { id: 'wg-6',   name: '6 Mitteldienst',      type: 'mid',   startTime: '09:00', endTime: '18:15' },
  { id: 'wg-7',   name: '7 Spät',              type: 'late',  startTime: '13:45', endTime: '21:45' },
  { id: 'wg-7b',  name: '7b Spät kurz',        type: 'late',  startTime: '16:30', endTime: '21:45' },
  { id: 'wg-8',   name: '8 Spät lang',         type: 'late',  startTime: '11:30', endTime: '21:45' },
  { id: 'wg-10',  name: '10 TS + Nachtessen',  type: 'mid',   startTime: '13:45', endTime: '19:15' },
  { id: 'wg-11',  name: '11 Kurz-Dienst',      type: 'mid',   startTime: '07:45', endTime: '08:45' },

  /*
   * Abschnitt 9 des Regelwerks heißt „Verschiedenes — individuell". Für die
   * Planung braucht es daraus konkrete Zeiten, sonst lässt sich Bürozeit nicht
   * als Arbeitszeit anrechnen. Die Zeiten stehen in Abschnitt 13:
   * ganzer Bürotag ab ca. 08:00 bis 15:00–16:00, halber Bürotag donnerstags
   * 13:45–16:30, weil die Bewohner dann außer Haus sind.
   *
   * Der Name beginnt mit „Büro" — daran erkennt das Regelpaket, dass dieser
   * Dienst Arbeitszeit ist, aber KEINE Betreuung.
   */
  { id: 'wg-buero',      name: 'Büro ganzer Tag',  type: 'mid', startTime: '08:00', endTime: '16:00' },
  { id: 'wg-buero-halb', name: 'Büro halber Tag',  type: 'mid', startTime: '13:45', endTime: '16:30' },
  { id: 'wg-buero-lang', name: 'Büro Leitungsdienst', type: 'mid', startTime: '08:00', endTime: '18:00' },
]

/** Eine Wohngruppe ist ein Ort — ein Bereich, keine Gruppenlandschaft. */
const BEREICH = { id: 'wg-gruppe', name: 'Wohngruppe', minStaff: 1 }

/**
 * Die Belegschaft im Format der Belegschaftsmaske (§183):
 *
 *     Name; Stunden; Tage/Woche; Gruppe; Funktion; Muster; Frei; Vorliebe
 *
 * KEIN TAGESMUSTER — und das ist hier richtig.
 * In einer Wohngruppe mit fünfzehn Dienstlängen von einer bis elfeinhalb
 * Stunden gibt es keine festen Tagesportionen. Ein erfundenes Muster würde die
 * Planung einengen, ohne dass es jemand so vereinbart hätte.
 *
 * TAGE/WOCHE ist aus dem Pensum geschätzt (Pensum geteilt durch einen
 * durchschnittlichen Dienst von acht Stunden) und von der Leitung zu
 * bestätigen. Es ist die einzige Zahl hier, die nicht im Regelwerk steht.
 *
 * FESTE FREIE TAGE bilden die Verfügbarkeiten aus Abschnitt 2 ab.
 */
const BELEGSCHAFT = `
# Name; Stunden; Tage/Woche; Gruppe; Funktion; Muster; Frei; Vorliebe
Arwed Spanehl; 37.8; 5; Wohngruppe; Gruppenleitung
Kurt Steffen; 33.6; 4; Wohngruppe; Stellvertretende Gruppenleitung
Jochen Gärtner; 33.6; 4; Wohngruppe; Betreuungsassistent
Stephanie Kohler; 33.6; 4; Wohngruppe; FaBe
Andrea Stitrich; 29.4; 4; Wohngruppe; FaBe
Lorena Bucher; 33.6; 4; Wohngruppe; Betreuungsassistent
Andrea Stirnimann; 10.5; 2; Wohngruppe; Betreuungsassistent; ; Di Mi Fr Sa So
Manuela Wolf; 33.6; 4; Wohngruppe; FaBe
Sarah Stendelmann; 8.4; 1; Wohngruppe; FaBe; ; Di Mi Do Fr
Fabienne Bucher; 4.2; 1; Wohngruppe; FaBe
`.trim()

async function anmeldung(email, passwort) {
  const r = await fetch(`${BASIS}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwort }),
  })
  if (!r.ok) throw new Error(`Anmeldung ${email} fehlgeschlagen: HTTP ${r.status}`)
  return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
}

async function main() {
  const hash = await bcrypt.hash(PASSWORT, 10)

  const kunde = await prisma.customer.upsert({
    where: { id: KUNDE },
    create: {
      id: KUNDE, name: 'Wohngruppe (Pilotkunde)',
      contactName: 'Gruppenleitung', contactEmail: 'leitung@wohngruppe.example',
      status: 'active', plan: 'professional', seatsLicensed: 15,
      createdAt: new Date().toISOString().slice(0, 10),
    },
    update: { name: 'Wohngruppe (Pilotkunde)' },
  })

  const leitungsZugang = await prisma.user.upsert({
    where: { email: 'leitung@wohngruppe.example' },
    create: {
      email: 'leitung@wohngruppe.example', name: 'Gruppenleitung', role: 'admin',
      customerId: kunde.id, passwordHash: hash,
    },
    update: { role: 'admin', customerId: kunde.id, passwordHash: hash },
  })

  const standort = await prisma.location.upsert({
    where: { id: STANDORT },
    create: {
      id: STANDORT, customerId: kunde.id, name: 'Wohngruppe',
      address: '—', city: '—', state: 'Nordrhein-Westfalen',
      bundesland: 'Nordrhein-Westfalen',
      adminId: leitungsZugang.id,
      // §127 Die Dienstplanung ist freigeschaltet, weil das Regelpaket steht.
      rulePackId: PAKET,
      dienstplanungFrei: true,
    },
    update: { rulePackId: PAKET, dienstplanungFrei: true, adminId: leitungsZugang.id },
  })

  await prisma.user.update({
    where: { id: leitungsZugang.id },
    data: { locationId: standort.id },
  })

  /*
   * Die Farben: eine je Dienstart, damit ein Plan auf einen Blick lesbar ist.
   * Wer fünfzehn Dienste in fünfzehn Farben zeigt, zeigt ein Mosaik —
   * entscheidend ist, ob jemand früh, mittags oder spät da ist.
   */
  const FARBEN = {
    early: { color: '#0B6E72', bgColor: '#DBF4F4' },
    mid:   { color: '#8A5A08', bgColor: '#FCEFD6' },
    late:  { color: '#4B3B96', bgColor: '#E9E4FB' },
  }
  for (const d of DIENSTE) {
    const daten = {
      ...d, ...FARBEN[d.type], locationId: standort.id,
      // Wie viele wo stehen, entscheiden die Besetzungsregeln über die
      // Uhrzeit — nicht eine Zahl je Dienstart.
      minStaff: 0,
    }
    await prisma.shift.upsert({ where: { id: d.id }, create: daten, update: daten })
  }

  await prisma.planningUnit.upsert({
    where: { id: BEREICH.id },
    create: {
      id: BEREICH.id, name: BEREICH.name, type: 'gruppe', parentId: null,
      minStaff: BEREICH.minStaff, sortOrder: 0, locationId: standort.id,
    },
    update: { name: BEREICH.name, minStaff: BEREICH.minStaff },
  })

  /*
   * Die Betriebstage: alle sieben. Eine Wohngruppe hat am Wochenende nicht zu
   * — sie ist das Zuhause der Bewohner. Ohne diese Angabe nähme die
   * Belegschaftsprüfung Montag bis Freitag an und lehnte die feste
   * Wochenendverfügbarkeit zu Recht ab.
   */
  await prisma.locationRuleModelRecord.upsert({
    where: { locationId: standort.id },
    create: {
      locationId: standort.id, customerId: kunde.id,
      ruleModel: {
        betriebsTyp: '7_tage',
        schichtmodell: { arbeitstage: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] },
      },
    },
    update: {
      ruleModel: {
        betriebsTyp: '7_tage',
        schichtmodell: { arbeitstage: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] },
      },
    },
  })

  await prisma.locationPlanningRules.upsert({
    where: { locationId: standort.id },
    create: {
      locationId: standort.id, maxWeeklyHours: 42, restHours: 11, maxConsecutiveDays: 6,
      breakThresholdMinutes: 360, breakDeductionMinutes: 30,
    },
    update: { maxWeeklyHours: 42, restHours: 11, maxConsecutiveDays: 6 },
  })

  console.log('Wohngruppe eingerichtet:')
  console.log(`  Kunde      ${kunde.name}`)
  console.log(`  Standort   ${standort.name} (${standort.id}), Regelpaket ${PAKET}`)
  console.log(`  Dienste    ${DIENSTE.length}, davon 3 Bürodienste`)
  console.log(`  Zugang     leitung@wohngruppe.example`)

  // ── Die Belegschaft über die geprüfte Schnittstelle ──────────────────────
  let okunZugang
  try {
    okunZugang = await anmeldung('okun@okun.de', PASSWORT)
  } catch {
    console.log('\n  Die Belegschaft wurde NICHT angelegt: Das Programm läuft nicht,')
    console.log('  oder der OKUN-Zugang hat ein anderes Kennwort. Dann die Liste')
    console.log('  unten in die Belegschaftsmaske einfügen (OKUN → Dienstplanung).')
    console.log(`\n${BELEGSCHAFT}\n`)
    return
  }

  const antwort = await fetch(`${BASIS}/api/okun/belegschaft`, {
    method: 'POST',
    headers: { cookie: okunZugang, 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId: standort.id, text: BELEGSCHAFT, anlegen: true }),
  })
  const d = await antwort.json().catch(() => ({}))
  if (!antwort.ok) {
    console.error('\n✗ Die Belegschaft wurde nicht angelegt:')
    for (const f of d.fehler ?? []) console.error(`   Zeile ${f.zeile}: ${f.text}`)
    if (d.error) console.error(`   ${d.error}`)
    process.exitCode = 1
    return
  }
  console.log(`  Belegschaft ${d.angelegt} neu, ${d.geaendert} aktualisiert`)
  console.log('              E-Mail-Adressen trägt der Betrieb selbst ein —')
  console.log('              erst dann gehen die Einladungen raus.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
