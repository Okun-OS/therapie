/**
 * §171 Der Demo-Mandant zum Kita-Regelpaket.
 *
 * WARUM ER SEIN MUSS
 * Das Regelpaket „Kita – zwei Etagen, acht Gruppen" wird im Rechendienst an
 * einem von Hand gebauten Prüfmodell abgenommen. Das ist richtig und findet
 * Rechenfehler — aber es sagt nichts darüber, ob die App dem Rechendienst
 * überhaupt das schickt, was er braucht. Genau dort lag der Fehler: Die
 * Rolle („Leitung", „Springerin") wurde nie übertragen, und jede
 * rollenbasierte Regel lief ins Leere. Aufgefallen ist das erst hier.
 *
 * WAS ER ANLEGT
 * Einen eigenen Mandanten mit dem Betrieb aus dem Kundenregelwerk: zwei
 * Etagen, acht Gruppen, achtzehn Kräfte, zwölf Dienstzeiten, Öffnung
 * 06:00–17:00, Montag bis Freitag. Er fasst die bestehenden Testdaten nicht
 * an — die Nachweise rechnen mit denen weiter.
 *
 *     npm run seed:kita
 *
 * Zugang: leitung@kita-regenbogen.de / Test1234!
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const PASSWORT = 'Test1234!'

const KUNDE = 'demo-kunde-kita2'
const STANDORT = 'demo-standort-kita2'
const UNTEN = 'demo-etage-unten'
const OBEN = 'demo-etage-oben'

/** Die acht Gruppen, wie sie im Regelwerk des Kunden stehen. */
const GRUPPEN = [
  { id: 'demo-g1', name: 'Gruppe 1', parentId: UNTEN },
  { id: 'demo-g2', name: 'Gruppe 2', parentId: UNTEN },
  { id: 'demo-g3', name: 'Gruppe 3', parentId: UNTEN },
  { id: 'demo-g4', name: 'Gruppe 4', parentId: UNTEN },
  { id: 'demo-g5', name: 'Gruppe 5', parentId: OBEN },
  { id: 'demo-g6', name: 'Gruppe 6', parentId: OBEN },
  { id: 'demo-g7', name: 'Gruppe 7', parentId: OBEN },
  { id: 'demo-g8', name: 'Gruppe 8', parentId: OBEN },
]

/**
 * Die Dienstzeiten. Geöffnet 06:00–17:00; acht Arbeitsstunden sind
 * achteinhalb Stunden Anwesenheit, fünf Stunden gehen ohne Pause.
 *
 * §164 Kein Dienst endet zwischen 15:30 und 17:00: Der Tag hört entweder mit
 * dem Spätdienst auf, mit dem Nachmittag um 15:30 oder 15:00 — oder früher,
 * weil jemand um sechs angefangen hat.
 *
 * `minStaff: 0` ist Absicht und keine Lücke: Wie viele wo stehen, entscheiden
 * die Gruppen- und Etagenregeln des Pakets, nicht eine Zahl je Dienstart. Eine
 * 1 hier hat den Plan schon einmal um 400.000 Strafpunkte verteuert.
 */
const DIENSTE = [
  { id: 'demo-f8',  name: 'Frühdienst 8',      type: 'early', startTime: '06:00', endTime: '14:30' },
  { id: 'demo-f7',  name: 'Frühdienst 7',      type: 'early', startTime: '06:00', endTime: '13:30' },
  { id: 'demo-f6',  name: 'Frühdienst 6',      type: 'early', startTime: '06:00', endTime: '12:30' },
  { id: 'demo-s8',  name: 'Spätdienst 8',      type: 'late',  startTime: '08:30', endTime: '17:00' },
  { id: 'demo-s7',  name: 'Spätdienst 7',      type: 'late',  startTime: '09:30', endTime: '17:00' },
  { id: 'demo-s6',  name: 'Spätdienst 6',      type: 'late',  startTime: '10:30', endTime: '17:00' },
  { id: 'demo-t8',  name: 'Tagdienst 8',       type: 'mid',   startTime: '07:00', endTime: '15:30' },
  { id: 'demo-t7n', name: 'Nachmittag 7',      type: 'mid',   startTime: '08:00', endTime: '15:30' },
  { id: 'demo-t7',  name: 'Tagdienst 7',       type: 'mid',   startTime: '07:30', endTime: '15:00' },
  { id: 'demo-t6',  name: 'Tagdienst 6',       type: 'mid',   startTime: '08:00', endTime: '14:30' },
  { id: 'demo-t5',  name: 'Kernzeit 5 (9 Uhr)', type: 'mid',  startTime: '09:00', endTime: '14:00' },
  { id: 'demo-t5f', name: 'Kernzeit 5 (8 Uhr)', type: 'mid',  startTime: '08:00', endTime: '13:00' },
]

/**
 * Die Belegschaft. Zwei heißen Katrin — genau wie im Regelwerk des Kunden.
 *
 * §181 WAS HIER NEU IST: TAGESMUSTER UND FESTE FREIE TAGE
 * Beides stand bis zum 02.10.2026 als Namenstabelle im Regelpaket. Es gehört
 * aber nicht dorthin, sondern in die Personalakte — und zwar neben die
 * Stundenzahl, mit der es übereinstimmen muss. Standen beide getrennt,
 * konnten sie einander widersprechen, und dann fand der Rechendienst für den
 * GANZEN Standort keinen Plan mehr.
 *
 * Die Summe aus Muster und Stundenzahl wird beim Speichern geprüft
 * (`src/lib/tagesmuster.ts`). Dieser Seed schreibt direkt in die Datenbank und
 * geht an der Prüfung vorbei — deshalb rechnet er sie unten selbst nach und
 * bricht ab, wenn etwas nicht aufgeht. Ein Demo-Mandant, der sich nicht
 * planen lässt, wäre schlimmer als keiner.
 *
 * Die Leitung steht mit 0 Planstunden im Dienstplan: Leitungszeit ist keine
 * Gruppenzeit. Ihre 40 Vertragsstunden gehören ins Lohnprofil.
 */
interface Kraft {
  name: string
  stunden: number
  gruppe: string | null
  funktion: string
  /** Wie sich die Wochenstunden auf die Tage verteilen. */
  muster?: { stunden: number; tage: number }[]
  /** Feste freie Wochentage. */
  frei?: string[]
  /** Dauerhafte Schichtvorliebe — früher zwei `moeglichst_nicht` im Regelpaket. */
  mag?: 'frueh' | 'spaet' | 'nacht'
}

const BELEGSCHAFT: Kraft[] = [
  // Untere Etage
  { name: 'Marin Berg',     stunden: 40, gruppe: 'demo-g1', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 5 }] },
  { name: 'Shelley Frei',   stunden: 40, gruppe: 'demo-g1', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 5 }] },
  { name: 'Stephanie Lang', stunden: 35, gruppe: 'demo-g2', funktion: 'Erzieher', muster: [{ stunden: 7, tage: 5 }] },
  { name: 'Christina Weiß', stunden: 35, gruppe: 'demo-g2', funktion: 'Erzieher', muster: [{ stunden: 7, tage: 5 }] },
  { name: 'Juliane Roth',   stunden: 35, gruppe: 'demo-g3', funktion: 'Erzieher', muster: [{ stunden: 7, tage: 5 }], mag: 'frueh' },
  { name: 'Kristine Mai',   stunden: 40, gruppe: 'demo-g3', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 5 }] },
  { name: 'Tim Sommer',     stunden: 40, gruppe: 'demo-g4', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 5 }] },
  { name: 'Sophia Klein',   stunden: 35, gruppe: 'demo-g4', funktion: 'Erzieher', muster: [{ stunden: 7, tage: 5 }] },
  // Obere Etage
  { name: 'Heike Stein',    stunden: 30, gruppe: 'demo-g5', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 3 }, { stunden: 6, tage: 1 }], frei: ['Fr'] },
  { name: 'Corinna Vogel',  stunden: 40, gruppe: 'demo-g5', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 5 }] },
  { name: 'Susan Hart',     stunden: 40, gruppe: 'demo-g6', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 5 }] },
  // Das Regelwerk des Kunden nennt sie „Katrin K" — so steht sie auch hier.
  // Die zweite Katrin (Gruppe 8) wird über ihre Stammgruppe unterschieden,
  // nicht über den Nachnamen: Wer heiratet, heißt anders. Seit §181 braucht
  // das Regelpaket diese Unterscheidung gar nicht mehr — beide stehen mit
  // ihrem eigenen Muster in ihrer eigenen Akte.
  { name: 'Katrin K Nolte', stunden: 32, gruppe: 'demo-g7', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 4 }], frei: ['Di'] },
  { name: 'Daniel Fuchs',   stunden: 35, gruppe: 'demo-g7', funktion: 'Erzieher', muster: [{ stunden: 7, tage: 5 }] },
  { name: 'Annika Peters',  stunden: 24, gruppe: 'demo-g7', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 3 }], frei: ['Do', 'Fr'] },
  { name: 'Felix Arndt',    stunden: 40, gruppe: 'demo-g8', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 5 }], mag: 'spaet' },
  { name: 'Katrin Ulrich',  stunden: 32, gruppe: 'demo-g8', funktion: 'Erzieher', muster: [{ stunden: 8, tage: 4 }], frei: ['Mi'] },
  // Springerin und Leitung werden über ihre FUNKTION gefunden, nicht über
  // ihren Namen — deshalb steht sie hier und nicht mehr im Regelpaket.
  { name: 'Nicole Sprung',  stunden: 25, gruppe: null, funktion: 'Springer', muster: [{ stunden: 5, tage: 5 }] },
  { name: 'Franke Leitner', stunden: 0,  gruppe: null, funktion: 'Leitung' },
]

/**
 * §181 Die Gegenrechnung, die der Seed sich selbst stellt.
 *
 * Die Maske lässt ein Muster, dessen Summe nicht zur Stundenzahl passt, gar
 * nicht erst durch. Der Seed schreibt direkt in die Datenbank und käme damit
 * durch — und hinterließe einen Demo-Mandanten, für den sich kein Dienstplan
 * rechnen lässt. Lieber hier abbrechen.
 */
function musterPruefen(): void {
  for (const k of BELEGSCHAFT) {
    if (!k.muster) continue
    const summe = k.muster.reduce((s, m) => s + m.stunden * m.tage, 0)
    if (Math.abs(summe - k.stunden) > 0.001) {
      throw new Error(
        `${k.name}: Das Tagesmuster ergibt ${summe} Stunden, im Vertrag stehen `
        + `${k.stunden}. Beides muss übereinstimmen.`,
      )
    }
    const tage = k.muster.reduce((s, m) => s + m.tage, 0)
    const moeglich = 5 - (k.frei?.length ?? 0)
    if (tage > moeglich) {
      throw new Error(
        `${k.name}: Das Muster belegt ${tage} Arbeitstage, zur Verfügung stehen `
        + `${moeglich} (Montag bis Freitag, abzüglich fester freier Tage).`,
      )
    }
  }
}

function mail(name: string): string {
  return name.toLowerCase().replace(/ /g, '.')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    + '@kita-regenbogen.de'
}

async function main() {
  musterPruefen()
  const hash = await bcrypt.hash(PASSWORT, 10)

  const kunde = await prisma.customer.upsert({
    where: { id: KUNDE },
    create: {
      id: KUNDE, name: 'Kita Regenbogen gGmbH',
      contactName: 'Geschäftsführung', contactEmail: 'kontakt@kita-regenbogen.de',
      status: 'active', plan: 'professional', seatsLicensed: 30,
      createdAt: '2026-09-01',
    },
    update: { name: 'Kita Regenbogen gGmbH' },
  })

  const zugaenge = [
    { email: 'gf@kita-regenbogen.de',      name: 'Geschäftsführung Regenbogen', role: 'company' },
    { email: 'leitung@kita-regenbogen.de', name: 'Franke Leitner',              role: 'admin' },
  ]
  const nutzer: Record<string, string> = {}
  for (const z of zugaenge) {
    const u = await prisma.user.upsert({
      where: { email: z.email },
      create: { ...z, customerId: kunde.id, passwordHash: hash },
      update: { role: z.role, customerId: kunde.id, passwordHash: hash },
    })
    nutzer[z.email] = u.id
  }

  // §127 Die Dienstplanung ist je Kunde von Hand gebaut und bleibt gesperrt,
  // bis OKUN sie freischaltet. Hier ist sie freigeschaltet, weil genau das
  // vorgeführt werden soll.
  const standort = await prisma.location.upsert({
    where: { id: STANDORT },
    create: {
      id: STANDORT, customerId: kunde.id, name: 'Kita Regenbogen',
      address: 'Am Wiesengrund 12', city: 'Köln', state: 'Nordrhein-Westfalen', zip: '51063',
      adminId: nutzer['leitung@kita-regenbogen.de'],
      rulePackId: 'kita_zwei_etagen',
      dienstplanungFrei: true,
      dienstplanungFreiSeit: '2026-09-27',
      dienstplanungFreiVon: 'OKUN Plattform',
    },
    update: {
      rulePackId: 'kita_zwei_etagen', dienstplanungFrei: true,
      adminId: nutzer['leitung@kita-regenbogen.de'],
    },
  })

  await prisma.user.updateMany({
    where: { email: { in: zugaenge.map(z => z.email) } },
    data: { locationId: standort.id },
  })

  for (const d of DIENSTE) {
    const daten = { ...d, locationId: standort.id, minStaff: 0, color: '#0B6E72', bgColor: '#DBF4F4' }
    await prisma.shift.upsert({ where: { id: d.id }, create: daten, update: daten })
  }

  // §163 Die Etagen mit Mindestbesetzung 0: Dass jede Etage geöffnet und
  // geschlossen wird, regelt das Paket mit „genau einer" — nicht der
  // allgemeine Mechanismus mit „mindestens so viele".
  const einheiten = [
    { id: UNTEN, name: 'untere Etage', type: 'etage', parentId: null, minStaff: 0, sortOrder: 0 },
    { id: OBEN,  name: 'obere Etage',  type: 'etage', parentId: null, minStaff: 0, sortOrder: 1 },
    ...GRUPPEN.map((g, i) => ({
      id: g.id, name: g.name, type: 'gruppe', parentId: g.parentId, minStaff: 1, sortOrder: 2 + i,
    })),
  ]
  for (const u of einheiten) {
    await prisma.planningUnit.upsert({
      where: { id: u.id },
      create: { ...u, locationId: standort.id },
      update: { name: u.name, minStaff: u.minStaff, parentId: u.parentId, sortOrder: u.sortOrder },
    })
  }

  const gruppenName = new Map(GRUPPEN.map(g => [g.id, g.name]))
  for (const kraft of BELEGSCHAFT) {
    const email = mail(kraft.name)
    const istLeitung = kraft.funktion === 'Leitung'
    const gemeinsam = {
      customerId: kunde.id, locationId: standort.id, name: kraft.name, email,
      role: istLeitung ? 'admin' : 'employee',
      position: kraft.funktion, roleType: kraft.funktion,
      weeklyHours: istLeitung ? 40 : kraft.stunden,
      workDaysPerWeek: 5,
      // §181 Die festen freien Wochentage. Sie standen als Tabelle im
      // Regelpaket; hier gehören sie hin, und von hier erreichen sie den
      // Rechendienst längst als „an diesem Tag nicht verfügbar".
      fixedOffDays: kraft.frei ?? [],
      // Die Springerin und die Leitung gehören keiner Gruppe an. Die
      // Springerin darf überall helfen — deshalb multiGroupCapable.
      gruppe: kraft.gruppe ? gruppenName.get(kraft.gruppe) : null,
      multiGroupCapable: !kraft.gruppe,
      active: true,
    }
    const person = await prisma.employee.upsert({
      where: { email },
      create: { ...gemeinsam, joinedAt: '2025-01-01', vacationDaysTotal: 30 },
      update: gemeinsam,
    })

    // §181 Das Tagesmuster und die Schichtvorliebe ins Planungsprofil. Beides
    // stand vorher im Regelpaket — beides ist eine Angabe über diesen
    // Menschen, nicht über diesen Betrieb.
    if (kraft.muster || kraft.mag) {
      const werte = {
        ...(kraft.muster ? { tagesmuster: kraft.muster } : {}),
        ...(kraft.mag ? { shiftPreference: kraft.mag } : {}),
      }
      await prisma.employeePlanningProfile.upsert({
        where: { employeeId: person.id },
        create: { employeeId: person.id, ...werte },
        update: werte,
      })
    }
  }

  // §171 Die Leitung hat 40 Vertragsstunden und 0 Planstunden: Leitungszeit
  // ist keine Gruppenzeit. Ohne diese Unterscheidung stellt der Rechendienst
  // sie jeden Tag in eine Gruppe, um ihre 40 Stunden unterzubringen — der
  // Plan sieht besetzt aus und ist es nicht.
  const leitung = await prisma.employee.findUnique({ where: { email: mail('Franke Leitner') } })
  if (leitung) {
    await prisma.employeePlanningProfile.upsert({
      where: { employeeId: leitung.id },
      create: { employeeId: leitung.id, planungsStundenSoll: 0 },
      update: { planungsStundenSoll: 0 },
    })
  }

  // Die Leitung bekommt ihren Zugang an ihren Mitarbeiterdatensatz gehängt —
  // ohne das kann sie verwalten, aber niemandem schreiben.
  if (leitung) {
    await prisma.user.update({
      where: { email: 'leitung@kita-regenbogen.de' },
      data: { employeeId: leitung.id },
    })
  }

  /*
   * §181 Jede Kraft bekommt einen eigenen Zugang.
   *
   * WARUM DAS VORHER GEFEHLT HAT — UND WARUM ES EIN FEHLER WAR
   * Bis hierher hatte in dieser Kita nur die Leitung ein Konto. Die sechzehn
   * Namen aus dem Regelpaket standen zwar als echte Mitarbeiterdatensätze in
   * der Datenbank, mit Stunden, Gruppe und Stammdaten — aber niemand von
   * ihnen konnte sich anmelden. Damit war die eine Frage, auf die es am Ende
   * ankommt, nie geprüft: Kommt der Plan, den das Regelpaket rechnet, auch
   * wirklich bei der Person an, für die er gerechnet wurde?
   *
   * Ein Regelpaket, das auf dem Bildschirm der Leitung einen schönen Plan
   * erzeugt, ist nichts wert, wenn Stephanie ihn nicht sieht. Genau diese
   * Kette prüft `pruefungen/f7-durchstich.mjs` — und dafür braucht jede Kraft
   * ein Konto, so wie im echten Betrieb.
   */
  const alleKraefte = await prisma.employee.findMany({
    where: { locationId: standort.id },
    select: { id: true, name: true, email: true },
  })
  for (const kraft of alleKraefte) {
    // Die Leitung hat ihren Zugang schon — ein zweiter auf denselben
    // Mitarbeiterdatensatz wäre eine Person mit zwei Konten.
    if (leitung && kraft.id === leitung.id) continue
    await prisma.user.upsert({
      where: { email: kraft.email },
      create: {
        email: kraft.email, name: kraft.name, role: 'employee', passwordHash: hash,
        customerId: kunde.id, locationId: standort.id, employeeId: kraft.id,
      },
      update: {
        role: 'employee', employeeId: kraft.id,
        locationId: standort.id, passwordHash: hash,
      },
    })
  }

  await prisma.locationPlanningRules.upsert({
    where: { locationId: standort.id },
    create: {
      locationId: standort.id, maxWeeklyHours: 40, restHours: 11, maxConsecutiveDays: 5,
      breakThresholdMinutes: 360, breakDeductionMinutes: 30,
    },
    update: { maxWeeklyHours: 40, restHours: 11, maxConsecutiveDays: 5 },
  })

  console.log('Demo-Kita bereit:')
  console.log(`  Standort  ${standort.name} (${standort.id}), Regelpaket ${standort.rulePackId}`)
  console.log(`  Struktur  2 Etagen, ${GRUPPEN.length} Gruppen, ${DIENSTE.length} Dienstzeiten`)
  console.log(`  Personal  ${BELEGSCHAFT.length} Kräfte, davon 1 Leitung und 1 Springerin`)
  console.log(`  Zugang    leitung@kita-regenbogen.de / ${PASSWORT}`)
  console.log(`  §181 Jede Kraft hat ein eigenes Konto, z. B. ${mail('Stephanie Lang')} / ${PASSWORT}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
