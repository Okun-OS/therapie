import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { lesen, platzhalterAdresse, istPlatzhalter } from '@/lib/belegschaft-import'
import { getLocationModel } from '@/lib/company-model-service'
import { BETRIEBSTYP_ARBEITSTAGE } from '@/lib/rule-model-service'

/** Die Wochentage, an denen dieser Standort geöffnet hat. */
async function betriebstage(locationId: string): Promise<string[]> {
  const modell = await getLocationModel(locationId)
  const eigene = modell?.schichtmodell?.arbeitstage ?? []
  if (eigene.length > 0) return eigene
  return BETRIEBSTYP_ARBEITSTAGE[modell?.betriebsTyp ?? 'mon_fri']
    ?? ['Mo', 'Di', 'Mi', 'Do', 'Fr']
}

/**
 * §183 /api/okun/belegschaft — die Belegschaft beim Einrichten anlegen.
 *
 * WARUM NUR OKUN
 * Dasselbe wie beim Regelpaket: Die Dienstplanung wird für jeden Betrieb von
 * Hand eingerichtet, und dazu gehört die Belegschaft mit ihren Tagesmustern.
 * Wer ein Regelwerk aufnimmt, hat die Liste ohnehin vor sich. Der Kunde kann
 * danach jederzeit ändern, ergänzen und einladen — aber nicht hundert
 * Menschen auf einmal einspielen; dafür gibt es keinen Grund und jede Menge
 * Wege, sich dabei zu vertun.
 *
 * GET  ?locationId=       → wer schon da ist, und wem die Adresse fehlt
 * POST { locationId, text, nurPruefen } → einlesen; ohne `nurPruefen` anlegen
 *
 * NICHTS ODER ALLES
 * Ist eine Zeile fehlerhaft, wird keine einzige angelegt. Eine halb
 * eingelesene Belegschaft ist schlimmer als keine — niemand sieht ihr an,
 * welche Hälfte fehlt, und der zweite Versuch legt die erste doppelt an.
 *
 * ZWEIMAL EINSPIELEN ÄNDERT, STATT ZU VERDOPPELN
 * Erkannt wird über Name + Standort. Wer schon da ist, wird aktualisiert;
 * seine echte E-Mail-Adresse bleibt dabei unangetastet. Sonst nähme ein
 * zweiter Durchlauf einer Kollegin, die längst angemeldet ist, den Zugang weg.
 */

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  const [personen, einheiten] = await Promise.all([
    prisma.employee.findMany({
      where: { locationId },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, email: true, weeklyHours: true, position: true,
        gruppe: true, active: true, fixedOffDays: true,
      },
    }),
    prisma.planningUnit.findMany({
      where: { locationId, type: 'gruppe' },
      orderBy: { sortOrder: 'asc' },
      select: { name: true },
    }),
  ])

  const profile = await prisma.employeePlanningProfile.findMany({
    where: { employeeId: { in: personen.map(p => p.id) } },
    select: { employeeId: true, tagesmuster: true, shiftPreference: true },
  })
  const profilZu = new Map(profile.map(p => [p.employeeId, p]))

  return NextResponse.json({
    gruppen: einheiten.map(e => e.name),
    betriebstage: await betriebstage(locationId),
    personen: personen.map(p => ({
      ...p,
      // §183 Wem die Adresse noch fehlt, der kann nicht eingeladen werden.
      // Das gehört sichtbar gemacht, nicht erschlossen.
      ohneAdresse: istPlatzhalter(p.email),
      tagesmuster: profilZu.get(p.id)?.tagesmuster ?? null,
      vorliebe: profilZu.get(p.id)?.shiftPreference ?? 'keine',
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const locationId = typeof body.locationId === 'string' ? body.locationId : ''
  const text = typeof body.text === 'string' ? body.text : ''
  if (!locationId || !text.trim()) {
    return NextResponse.json({ error: 'locationId und text sind erforderlich' }, { status: 400 })
  }

  const standort = await prisma.location.findUnique({
    where: { id: locationId },
    select: { id: true, name: true, customerId: true },
  })
  if (!standort) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  }

  const gruppen = await prisma.planningUnit.findMany({
    where: { locationId, type: 'gruppe' },
    orderBy: { sortOrder: 'asc' },
    select: { name: true },
  })

  const { zeilen, fehler } = lesen(
    text, gruppen.map(g => g.name), await betriebstage(locationId),
  )

  // Erst zeigen, dann anlegen. Die Maske fragt zuerst ohne `anlegen` — wer
  // achtzehn Menschen einspielt, soll vorher sehen, was ankommt.
  if (!body.anlegen || fehler.length > 0) {
    return NextResponse.json({
      gelesen: zeilen,
      fehler,
      angelegt: 0,
      hinweis: fehler.length > 0
        ? `${fehler.length} Zeile(n) stimmen nicht — es wurde nichts angelegt.`
        : `${zeilen.length} Zeile(n) gelesen. Noch nichts angelegt.`,
    }, { status: fehler.length > 0 ? 400 : 200 })
  }

  const vorhandene = await prisma.employee.findMany({
    where: { locationId },
    select: { id: true, name: true, email: true },
  })
  const nachName = new Map(vorhandene.map(p => [p.name.toLowerCase(), p]))

  let neu = 0, geaendert = 0
  for (const z of zeilen) {
    const schonDa = nachName.get(z.name.toLowerCase())
    const stammdaten = {
      customerId: standort.customerId,
      locationId,
      name: z.name,
      role: 'employee',
      position: z.funktion,
      roleType: z.funktion,
      weeklyHours: z.stunden,
      workDaysPerWeek: z.tageProWoche,
      fixedOffDays: z.freieTage,
      gruppe: z.gruppe,
      multiGroupCapable: !z.gruppe,
      active: true,
    }

    const person = schonDa
      ? await prisma.employee.update({ where: { id: schonDa.id }, data: stammdaten })
      : await prisma.employee.create({
        data: {
          ...stammdaten,
          // §183 Eine Adresse auf `.invalid` — dorthin kann nichts zugestellt
          // werden. Die echte trägt der Betrieb ein, und erst dann geht eine
          // Einladung raus.
          email: platzhalterAdresse(z.name, locationId),
          joinedAt: new Date().toISOString().slice(0, 10),
          vacationDaysTotal: 30,
        },
      })
    schonDa ? geaendert++ : neu++

    const profilWerte = {
      tagesmuster: z.muster
        ? (z.muster as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      ...(z.vorliebe ? { shiftPreference: z.vorliebe } : {}),
    }
    await prisma.employeePlanningProfile.upsert({
      where: { employeeId: person.id },
      create: { employeeId: person.id, ...profilWerte },
      update: profilWerte,
    })
  }

  return NextResponse.json({
    gelesen: zeilen,
    fehler: [],
    angelegt: neu,
    geaendert,
    hinweis: `${neu} neu angelegt, ${geaendert} aktualisiert. `
      + 'Die E-Mail-Adressen trägt der Betrieb selbst ein — erst dann kann er einladen.',
  })
}
