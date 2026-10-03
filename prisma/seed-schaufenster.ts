/**
 * §184 Der Schaufenster-Mandant — für die Bildschirmfotos auf der Website.
 *
 * WARUM NICHT EINER DER VORHANDENEN DEMO-BETRIEBE
 * Zwei Gründe, und beide wiegen schwer.
 *
 *   ERSTENS DIE MENSCHEN. Die Vornamen im Kita-Demo-Mandanten stammen aus dem
 *   schriftlichen Regelwerk eines echten Kunden — „Heike hat freitags frei"
 *   stand so in seinen Unterlagen. Die Nachnamen sind erfunden, die Vornamen
 *   nicht. Auf eine öffentliche Seite gehört das nicht, auch nicht in einem
 *   Bildschirmfoto, auch nicht klein.
 *
 *   ZWEITENS DIE BRANCHE. „Reha-Zentrum Köln-Süd" und „Kita Sonnenschein"
 *   engen das Bild ein. Wer ein Logistikunternehmen führt und auf der
 *   Startseite eine Kita sieht, liest weiter unten gar nicht mehr nach, ob
 *   das Programm auch für ihn gedacht ist. Genau diese Einengung sollte von
 *   der Website verschwinden — sie durch die Hintertür in einem Bild wieder
 *   hereinzuholen, wäre absurd.
 *
 * Also ein eigener Betrieb, der erkennbar keiner ist: „Beispielbetrieb GmbH",
 * zwei Bereiche, zehn Menschen mit Allerweltsnamen, vier Dienstzeiten, die es
 * in jedem Schichtbetrieb gibt. Nichts davon zeigt auf jemanden.
 *
 * WAS DRIN IST UND WARUM
 * Genug für die drei Bilder, die der Eigentümer sehen will — und zwar für
 * alle drei dieselben Menschen, damit der Zusammenhang sichtbar wird:
 *
 *   Dienstplan     eine veröffentlichte Woche über zwei Bereiche
 *   Stempeluhr     echte Zeitbuchungen derselben Person über den Monat
 *   Lohnabrechnung derselbe Monat, gerechnet aus genau diesen Zeiten
 *
 * Das ist die eine Sache, die kein Wettbewerber auf einem Bild zeigen kann:
 * Es ist nicht dreimal dasselbe Programm, sondern dreimal derselbe Vorgang.
 *
 *     npm run seed:schaufenster
 *
 * Der Lohnlauf selbst wird NICHT hier gerechnet. Er entsteht über dieselbe
 * Schnittstelle wie beim Kunden (`/api/payroll/vorbereiten`), aufgerufen von
 * `scripts/schaufenster.mjs`. Ein hier von Hand eingetragenes Nettoentgelt
 * wäre eine Zahl auf einem Werbebild, die niemand nachgerechnet hat.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PASSWORT = 'Test1234!'
const KUNDE = 'schaufenster-kunde'
const STANDORT = 'schaufenster-standort'

/** Vier Dienstzeiten, die es in jedem Schichtbetrieb gibt. */
const DIENSTE = [
  { id: 'sf-frueh', name: 'Frühdienst', type: 'early', startTime: '06:00', endTime: '14:30', minStaff: 2, color: '#0B6E72', bgColor: '#DBF4F4' },
  { id: 'sf-tag',   name: 'Tagdienst',  type: 'mid',   startTime: '08:00', endTime: '16:30', minStaff: 2, color: '#8A5A08', bgColor: '#FCEFD6' },
  { id: 'sf-spaet', name: 'Spätdienst', type: 'late',  startTime: '13:00', endTime: '21:30', minStaff: 2, color: '#4B3B96', bgColor: '#E9E4FB' },
  { id: 'sf-nacht', name: 'Nachtdienst', type: 'night', startTime: '21:00', endTime: '06:30', minStaff: 1, color: '#1A1D1F', bgColor: '#E8ECEF' },
]

/** Zwei Bereiche — branchenneutral, wie überall sonst auf der Website. */
const BEREICHE = [
  { id: 'sf-nord', name: 'Bereich Nord', minStaff: 2 },
  { id: 'sf-sued', name: 'Bereich Süd', minStaff: 2 },
]

/**
 * Zehn Allerweltsnamen. Sie sind so gewählt, dass sie auf niemanden zeigen —
 * und so gemischt, dass ein Bildschirmfoto nicht nach einem einzigen
 * Geschlecht oder einer einzigen Herkunft aussieht.
 */
const BELEGSCHAFT: [string, number, string, string][] = [
  ['Lena Hartmann',   40, 'sf-nord', 'Teamleitung'],
  ['Deniz Yilmaz',    40, 'sf-nord', 'Fachkraft'],
  ['Robert Pohl',     40, 'sf-nord', 'Fachkraft'],
  ['Marta Kowalski',  30, 'sf-nord', 'Fachkraft'],
  ['Jonas Keller',    35, 'sf-nord', 'Mitarbeiter'],
  ['Amira Haddad',    40, 'sf-sued', 'Teamleitung'],
  ['Sven Lorenz',     40, 'sf-sued', 'Fachkraft'],
  ['Pia Bergmann',    35, 'sf-sued', 'Fachkraft'],
  ['Tobias Frank',    24, 'sf-sued', 'Mitarbeiter'],
  ['Elif Demir',      40, 'sf-sued', 'Fachkraft'],
]

/** Wessen Monat durchgespielt wird — dieselbe Person in allen drei Bildern. */
const HAUPTPERSON = 'Deniz Yilmaz'

function mail(name: string): string {
  return name.toLowerCase().replace(/ /g, '.')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    + '@beispielbetrieb.de'
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Montag der Woche, in der dieser Tag liegt. */
function montagVon(d: Date): Date {
  const tag = d.getDay()
  const m = new Date(d)
  m.setDate(d.getDate() - tag + (tag === 0 ? -6 : 1))
  m.setHours(12, 0, 0, 0)
  return m
}

async function main() {
  const hash = await bcrypt.hash(PASSWORT, 10)

  const kunde = await prisma.customer.upsert({
    where: { id: KUNDE },
    create: {
      id: KUNDE, name: 'Beispielbetrieb GmbH',
      contactName: 'Betriebsleitung', contactEmail: 'kontakt@beispielbetrieb.de',
      status: 'active', plan: 'professional', seatsLicensed: 25,
      createdAt: '2026-01-01',
    },
    update: { name: 'Beispielbetrieb GmbH' },
  })

  const leitungsZugang = await prisma.user.upsert({
    where: { email: 'leitung@beispielbetrieb.de' },
    create: {
      email: 'leitung@beispielbetrieb.de', name: 'Lena Hartmann', role: 'admin',
      customerId: kunde.id, passwordHash: hash,
    },
    update: { role: 'admin', customerId: kunde.id, passwordHash: hash },
  })

  const standort = await prisma.location.upsert({
    where: { id: STANDORT },
    create: {
      id: STANDORT, customerId: kunde.id, name: 'Beispielbetrieb · Standort Mitte',
      address: 'Musterstraße 1', city: 'Musterstadt', state: 'Nordrhein-Westfalen',
      zip: '00000', bundesland: 'Nordrhein-Westfalen',
      adminId: leitungsZugang.id,
      // §127 Die Dienstplanung ist hier frei: Der Schaufenster-Betrieb soll
      // einen Plan zeigen können. Ein Regelpaket braucht er nicht — die
      // allgemeinen Regeln genügen für ein Bild.
      dienstplanungFrei: true,
    },
    update: {
      name: 'Beispielbetrieb · Standort Mitte', dienstplanungFrei: true,
      adminId: leitungsZugang.id,
    },
  })

  await prisma.user.update({
    where: { id: leitungsZugang.id },
    data: { locationId: standort.id },
  })

  for (const d of DIENSTE) {
    const daten = { ...d, locationId: standort.id }
    await prisma.shift.upsert({ where: { id: d.id }, create: daten, update: daten })
  }

  for (let i = 0; i < BEREICHE.length; i++) {
    const b = BEREICHE[i]
    const daten = {
      id: b.id, name: b.name, type: 'gruppe', parentId: null,
      minStaff: b.minStaff, sortOrder: i, locationId: standort.id,
    }
    await prisma.planningUnit.upsert({ where: { id: b.id }, create: daten, update: daten })
  }

  const bereichName = new Map(BEREICHE.map(b => [b.id, b.name]))
  const personen: Record<string, string> = {}
  for (const [name, stunden, bereich, funktion] of BELEGSCHAFT) {
    const email = mail(name)
    const gemeinsam = {
      customerId: kunde.id, locationId: standort.id, name, email,
      role: 'employee',
      position: funktion, roleType: funktion,
      weeklyHours: stunden,
      workDaysPerWeek: stunden >= 35 ? 5 : 4,
      gruppe: bereichName.get(bereich) ?? null,
      joinedAt: '2025-01-01', vacationDaysTotal: 30, active: true,
    }
    const p = await prisma.employee.upsert({
      where: { email }, create: gemeinsam, update: gemeinsam,
    })
    personen[name] = p.id

    // Die Hauptperson bekommt einen eigenen Zugang — die Stempeluhr ist ihr
    // Bildschirm, nicht der der Leitung.
    if (name === HAUPTPERSON) {
      await prisma.user.upsert({
        where: { email },
        create: {
          email, name, role: 'employee', passwordHash: hash,
          customerId: kunde.id, locationId: standort.id, employeeId: p.id,
        },
        update: { role: 'employee', employeeId: p.id, locationId: standort.id, passwordHash: hash },
      })
    }
  }

  await prisma.locationPlanningRules.upsert({
    where: { locationId: standort.id },
    create: {
      locationId: standort.id, maxWeeklyHours: 40, restHours: 11, maxConsecutiveDays: 6,
      breakThresholdMinutes: 360, breakDeductionMinutes: 30,
    },
    update: { maxWeeklyHours: 40, restHours: 11, maxConsecutiveDays: 6 },
  })

  // ── Der Dienstplan ────────────────────────────────────────────────────────
  //
  // Drei Wochen: die vorige, die laufende und die nächste. Nicht aus
  // Gründlichkeit, sondern weil die Fairness-Bewertung über die Wochen
  // schaut. Lag nur eine Woche vor, meldete sie bei JEDEM Menschen „zu wenige
  // Frühschichten, zu wenige Spätschichten" — und sie hatte recht: In einer
  // einzigen handgelegten Woche hat niemand alle Dienstarten.
  //
  // Ein Bild, auf dem die Software neben jedem Namen ein rotes Dreieck setzt,
  // wäre kein Werbebild. Es wäre auch keine Lüge gewesen, die Warnung
  // auszublenden — es wäre schlimmer gewesen: ein Bild, das zeigt, was das
  // Programm nicht meldet.
  //
  // Deshalb eine echte Wechselschicht: Jede Kraft hat eine Woche Frühdienst,
  // eine Spätdienst, eine Tagdienst, eine Nachtdienst — versetzt, damit zu
  // jeder Zeit jemand da ist. Genau so planen Schichtbetriebe.
  const WECHSEL = ['sf-frueh', 'sf-spaet', 'sf-tag', 'sf-nacht']
  const montagDieserWoche = montagVon(new Date())

  /*
   * Genau vier Wochen — die Spanne, über die die Fairness-Bewertung urteilt.
   *
   * Drei Wochen waren zu wenig: Bei einer Rotation über vier Dienstarten fehlt
   * dann immer eine, und das meldete sie zu Recht. Fünf waren zu viel: Dann
   * steht mehr im Plan, als in vier Wochen erwartet wird, und sie meldete
   * „zu viele Frühschichten" — ebenfalls zu Recht.
   *
   * Bei genau vier Wochen durchläuft jede Kraft die volle Rotation, und es
   * bleiben die beiden Teamleitungen übrig, die nur Tagdienst haben. Deren
   * Hinweis bleibt stehen, und das ist richtig so: Das Programm soll melden,
   * was auffällt, und ein Bild ohne jede Meldung wäre ein Bild, auf dem das
   * Programm nichts tut.
   */
  const wochenStart = [-2, -1, 0, 1].map(v => {
    const d = new Date(montagDieserWoche)
    d.setDate(montagDieserWoche.getDate() + v * 7)
    return d
  })
  const HEUTE = iso(new Date())
  const ALLE_TAGE: string[] = []
  for (const start of wochenStart) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i)
      ALLE_TAGE.push(iso(d))
    }
  }

  /*
   * Alles weg, nicht nur der Bereich, der gleich neu geschrieben wird.
   *
   * Die erste Fassung löschte genau die Tage, die sie danach anlegte. Beim
   * Verkürzen von fünf auf vier Wochen blieb damit die fünfte stehen — und die
   * Fairness-Bewertung meldete völlig zu Recht „zu viele Spätschichten", weil
   * tatsächlich mehr im Plan stand als in vier Wochen erwartet. Eine halbe
   * Stunde Suche an der falschen Stelle, und die Ursache war der eigene Seed.
   */
  await prisma.scheduleEntry.deleteMany({ where: { locationId: standort.id } })

  const bereichVon = new Map(BELEGSCHAFT.map(([n, , b]) => [n, b]))
  let gelegt = 0
  for (let personIndex = 0; personIndex < BELEGSCHAFT.length; personIndex++) {
    const [name, , , funktion] = BELEGSCHAFT[personIndex]
    for (let wocheIndex = 0; wocheIndex < wochenStart.length; wocheIndex++) {
      const start = wochenStart[wocheIndex]
      // Die Teamleitungen sind im Tagdienst — sie führen, sie rotieren nicht.
      // Das ist keine Vereinfachung, sondern der Normalfall; und es ist der
      // Grund, warum die Fairness-Bewertung bei ihnen weiterhin anschlägt.
      // Auch das gehört aufs Bild: Das Programm meldet, was auffällt.
      const dienst = funktion === 'Teamleitung'
        ? 'sf-tag'
        : WECHSEL[(personIndex + wocheIndex) % WECHSEL.length]

      /*
       * Wie viele Tage — aus dem Vertrag, nicht pauschal fünf.
       *
       * Die erste Fassung plante jeden fünf Tage. Bei den Teilzeitkräften
       * stand danach „40,0/30h" in Rot, und bei den Nachtdienstwochen
       * „45,0/40h": Ein Nachtdienst dauert neun Stunden netto, fünf davon
       * sind fünfundvierzig. Beides stimmte — und ein Werbebild, auf dem die
       * halbe Belegschaft in Mehrarbeit steht, wirbt für das Gegenteil.
       *
       * Abgerundet, nicht gerundet: Lieber eine Stunde unter dem Vertrag als
       * eine darüber. Wer aufrundet, baut die roten Zahlen wieder ein.
       */
      const nettoStunden = dienst === 'sf-nacht' ? 9 : 8
      const stundenImVertrag = BELEGSCHAFT[personIndex][1]
      const tage = Math.max(1, Math.min(5, Math.floor(stundenImVertrag / nettoStunden)))

      /*
       * Montag bis Freitag. Die erste Fassung ließ die Rotation versetzt
       * beginnen, damit auch samstags jemand im Haus ist — und erzeugte damit
       * bei jedem Zweiten die Meldung „6× Wochenenddienst in 4 Wochen (Limit:
       * 2)". Auch die stimmte: Der Beispielbetrieb ist ein
       * Montag-bis-Freitag-Betrieb, und dann ist Wochenendarbeit die Ausnahme
       * und keine Planungsgröße.
       */
      for (let i = 0; i < tage; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        await prisma.scheduleEntry.create({
          data: {
            employeeId: personen[name], shiftId: dienst, date: iso(d),
            locationId: standort.id, status: 'published',
            gruppe: bereichVon.get(name) ?? null,
          },
        })
        gelegt++
      }
    }
  }


  /*
   * Und ein Dienst für HEUTE, falls heute ein Wochenendtag ist.
   *
   * Die Stempeluhr ist der Bildschirm, den die Kraft morgens sieht. Fällt der
   * Tag der Aufnahme auf einen Samstag, stand dort „Kein Dienst geplant" — das
   * stimmt, zeigt aber den Ausnahmefall. Ein Werbebild soll den Normalfall
   * zeigen: Dienst steht an, Knopf zum Einstempeln darunter.
   *
   * Ein einzelner Wochenenddienst in vier Wochen bleibt unter der Grenze, ab
   * der die Fairness-Bewertung etwas sagt — sonst wäre aus der Verschönerung
   * eine Meldung geworden.
   */
  const wochentagHeute = new Date().getDay()
  if (wochentagHeute === 0 || wochentagHeute === 6) {
    await prisma.scheduleEntry.create({
      data: {
        employeeId: personen[HAUPTPERSON], shiftId: 'sf-frueh', date: HEUTE,
        locationId: standort.id, status: 'published',
        gruppe: bereichVon.get(HAUPTPERSON) ?? null,
      },
    })
  }

  // ── Die gestempelten Zeiten ───────────────────────────────────────────────
  //
  // Der laufende Monat bis gestern, für die Hauptperson. Mal auf die Minute,
  // mal zwölf Minuten später — ein Monat, in dem jeder Tag auf 08:00 anfängt,
  // sieht aus wie erfunden, weil er es ist.
  const heute = new Date()
  const hauptId = personen[HAUPTPERSON]

  /*
   * §184 Zwei Monate: der VORMONAT vollständig und der laufende bis gestern.
   *
   * Der Vormonat ist der, der abgerechnet wird — eine Lohnabrechnung über
   * zwei Arbeitstage wäre kein Bild, sondern ein Beleg dafür, dass hier nur
   * so getan wird. Der laufende Monat gehört trotzdem dazu: Auf dem Bildschirm
   * der Stempeluhr steht das Stundenkonto des Monats, in dem man gerade ist.
   */
  const VORMONAT = heute.getMonth() === 0
    ? { jahr: heute.getFullYear() - 1, monat: 12 }
    : { jahr: heute.getFullYear(), monat: heute.getMonth() }
  const LAUFEND = { jahr: heute.getFullYear(), monat: heute.getMonth() + 1 }

  const ABWEICHUNG = [0, 3, -2, 7, 1, -4, 12, 0, 5, -1, 2, 9, -3, 4, 0, 6, -5, 1, 8, 2, 0, 3]
  const zeit = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  let n = 0
  for (const { jahr, monat, bisTag } of [
    { ...VORMONAT, bisTag: new Date(VORMONAT.jahr, VORMONAT.monat, 0).getDate() },
    { ...LAUFEND, bisTag: heute.getDate() - 1 },
  ]) {
    await prisma.timeLog.deleteMany({
      where: {
        employeeId: hauptId,
        date: { startsWith: `${jahr}-${String(monat).padStart(2, '0')}` },
      },
    })
    for (let tag = 1; tag <= bisTag; tag++) {
      const d = new Date(jahr, monat - 1, tag)
      if (d.getDay() === 0 || d.getDay() === 6) continue
      const ab = ABWEICHUNG[n % ABWEICHUNG.length]
      n++
      // Um sechs, plus/minus ein paar Minuten. Ein Monat, in dem jeder Tag
      // auf die Minute gleich anfängt, sieht aus wie erfunden, weil er es ist.
      const beginn = 6 * 60 + ab
      const ende = 14 * 60 + 30 + (ab > 0 ? 4 : 0)
      await prisma.timeLog.create({
        data: {
          employeeId: hauptId, locationId: standort.id, date: iso(d),
          clockIn: zeit(beginn), clockOut: zeit(ende),
          totalMinutes: ende - beginn - 30, breakMinutes: 30,
          quelle: 'app',
        },
      })
    }
  }

  // ── Die Lohndaten ─────────────────────────────────────────────────────────
  //
  // Alles, was eine Abrechnung braucht — aber nicht die Abrechnung selbst.
  // Die rechnet das Programm, über dieselbe Schnittstelle wie beim Kunden
  // (`scripts/schaufenster.mjs`). Eine hier von Hand eingetragene Nettozahl
  // wäre eine Zahl auf einem Werbebild, die niemand nachgerechnet hat.
  //
  // Alle zehn bekommen Stammdaten, nicht nur die Hauptperson: Das Bild der
  // Lohnabrechnung soll einen ganzen Lauf zeigen, keine einzelne Zeile.
  //
  // Die Hauptperson wird nach STUNDEN bezahlt, alle anderen im Monatsgehalt.
  // Das ist nicht nur Abwechslung: Bei Stundenlohn ist die erfasste Zeit die
  // Grundlage des Entgelts — genau der Weg, den die drei Bilder zusammen
  // zeigen sollen. Für die übrigen neun wäre dafür je ein voller Monat
  // Zeitbuchungen nötig, und der steht im Bild gar nicht.
  const STEUERKLASSEN = [1, 3, 1, 4, 1, 3, 1, 5, 2, 4]
  const STUNDENLOEHNE = [26.5, 21.5, 20.0, 19.5, 18.0, 26.0, 21.0, 20.5, 17.5, 22.0]
  for (let i = 0; i < BELEGSCHAFT.length; i++) {
    const [name, stunden] = BELEGSCHAFT[i]
    const id = personen[name]
    const nachStunden = name === HAUPTPERSON
    const lohndaten = {
      personalnummer: String(1000 + i * 7),
      eintrittsdatum: '2025-01-01',
      strasse: 'Musterstraße 1', plz: '00000', ort: 'Musterstadt',
      steuerId: `1234567890${i}`,
      steuerklasse: STEUERKLASSEN[i], kinderfreibetraege: 0,
      konfession: 'keine', bundesland: 'Nordrhein-Westfalen',
      versicherungsart: 'GKV', krankenkasse: 'Beispielkasse', zusatzbeitrag: 1.7,
      ...(nachStunden
        ? { lohnart: 'stunde', stundenlohn: STUNDENLOEHNE[i], monatsgehalt: null }
        : {
          lohnart: 'monat',
          // Monatsgehalt aus Stundenlohn und Wochenstunden — 4,33 Wochen je
          // Monat, die übliche Umrechnung.
          monatsgehalt: Math.round(STUNDENLOEHNE[i] * stunden * 4.33 / 10) * 10,
          stundenlohn: null,
        }),
      iban: 'DE02120300000000202051', kontoinhaber: name,
      // §157 Ohne Stand der Steuermerkmale meldet die Vorbereitung zu Recht,
      // dass niemand weiß, wann zuletzt abgeglichen wurde.
      elstamStand: `${VORMONAT.jahr}-${String(VORMONAT.monat).padStart(2, '0')}-01`,
    }
    await prisma.employeePayrollProfile.upsert({
      where: { employeeId: id },
      create: { employeeId: id, customerId: kunde.id, ...lohndaten },
      update: lohndaten,
    })
  }

  console.log('Schaufenster bereit:')
  console.log(`  Kunde      ${kunde.name}`)
  console.log(`  Standort   ${standort.name} (${standort.id})`)
  console.log(`  Personal   ${BELEGSCHAFT.length} Menschen, ${DIENSTE.length} Dienstzeiten, ${BEREICHE.length} Bereiche`)
  console.log(`  Dienstplan ${ALLE_TAGE[0]} bis ${ALLE_TAGE.at(-1)}, ${gelegt} Dienste, veröffentlicht`)
  console.log(`  Zeiten     ${HAUPTPERSON}, ${String(VORMONAT.monat).padStart(2, '0')}.${VORMONAT.jahr} vollständig und ${String(LAUFEND.monat).padStart(2, '0')}.${LAUFEND.jahr} bis gestern`)
  console.log(`  Zugang     leitung@beispielbetrieb.de / ${PASSWORT}`)
  console.log(`             ${mail(HAUPTPERSON)} / ${PASSWORT}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
