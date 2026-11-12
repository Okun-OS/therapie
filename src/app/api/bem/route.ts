import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import {
  auTageImFenster, lage, zaehlungAb, ANTWORTEN, FENSTER_TAGE,
  type Antwort,
} from '@/lib/bem'

export const dynamic = 'force-dynamic'

/**
 * §147 Betriebliches Eingliederungsmanagement.
 *
 * WER DARF HIER ÜBERHAUPT HEREIN
 * Die Unternehmensebene immer. Die Standortleitung nur, wenn der Betrieb es
 * ausdrücklich eingeschaltet hat (`bemSichtbarLeitung`) — standardmäßig steht
 * es aus. Es sind Gesundheitsdaten nach Art. 9 DSGVO, und der Kreis der
 * Mitwissenden gehört so klein wie möglich gehalten.
 *
 * Ein Mitarbeiter sieht hier gar nichts. Nicht einmal sich selbst: Sein BEM
 * erfährt er durch das Angebot, nicht durch eine Liste im Programm — und eine
 * Liste, die er abrufen kann, wäre eine Liste, die auch andere abrufen wollen.
 *
 * WAS DAS PROGRAMM NICHT TUT
 * Es bietet nichts von selbst an. Es rechnet die Schwelle aus und sagt, dass
 * ein Angebot fällig ist. Ein BEM-Angebot ist ein Gespräch zwischen Menschen;
 * eine automatische E-Mail dazu wäre der falsche Ton für den Anlass.
 */

async function darfBem(
  session: { role: string },
  customerId: string,
): Promise<boolean> {
  if (session.role === 'company' || session.role === 'okun') return true
  if (session.role !== 'admin') return false
  const einstellungen = await prisma.orgSettings.findUnique({
    where: { customerId }, select: { bemSichtbarLeitung: true },
  })
  return einstellungen?.bemSichtbarLeitung === true
}

/**
 * §147 Bewusst eine FUNKTION und keine Konstante.
 *
 * Eine `NextResponse` trägt einen Datenstrom, und der lässt sich genau einmal
 * lesen. Als Modulkonstante angelegt, lieferte dieselbe Antwort ab der zweiten
 * Anfrage einen 403 mit LEEREM Körper — der Status stimmte, die Begründung war
 * weg. Aufgefallen erst beim zweiten Aufruf im selben Prüflauf.
 */
const verschlossen = () => NextResponse.json(
  {
    error: 'Für diesen Bereich fehlt die Berechtigung. BEM enthält '
      + 'Gesundheitsdaten; die Unternehmensebene kann ihn für die '
      + 'Standortleitung freischalten.',
  },
  { status: 403 },
)

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ eintraege: [] })
  if (!await darfBem(session, customerId)) return verschlossen()

  const scope = await allowedLocationScope(session)
  const leute = await prisma.employee.findMany({
    where: {
      customerId, active: true, datenGesperrtAm: null,
      ...(scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }),
    },
    select: { id: true, name: true, locationId: true },
  })
  if (leute.length === 0) return NextResponse.json({ eintraege: [] })

  const ids = leute.map(l => l.id)
  const seit = new Date(Date.now() - FENSTER_TAGE * 86_400_000)

  const [fehlzeiten, vorgaenge] = await Promise.all([
    prisma.absence.findMany({
      where: {
        employeeId: { in: ids },
        // Grob vorfiltern; genau gerechnet wird danach im Motor.
        endDate: { gte: seit.toISOString().slice(0, 10) },
      },
      select: { employeeId: true, type: true, startDate: true, endDate: true },
    }),
    prisma.bemVorgang.findMany({
      where: { employeeId: { in: ids } },
      orderBy: { ausgeloestAm: 'desc' },
    }),
  ])

  const jeMensch = new Map<string, typeof fehlzeiten>()
  for (const f of fehlzeiten) {
    const liste = jeMensch.get(f.employeeId) ?? []
    liste.push(f)
    jeMensch.set(f.employeeId, liste)
  }
  // Nur der jüngste Vorgang je Person zählt — ältere sind Geschichte.
  const aktuell = new Map<string, (typeof vorgaenge)[number]>()
  for (const v of vorgaenge) if (!aktuell.has(v.employeeId)) aktuell.set(v.employeeId, v)

  const eintraege = leute.map(person => {
    const vorgang = aktuell.get(person.id) ?? null
    // Nach einem Abschluss wird ab dem Abschluss neu gezählt — sonst löste
    // derselbe Zeitraum ein zweites Mal aus.
    const ab = zaehlungAb(vorgang)
    const fenster = Math.max(
      1, Math.ceil((Date.now() - ab.getTime()) / 86_400_000))
    const tage = auTageImFenster(jeMensch.get(person.id) ?? [], new Date(), fenster)
    const l = lage(tage, vorgang)
    return {
      employeeId: person.id,
      personName: person.name,
      locationId: person.locationId,
      vorgangId: vorgang?.id ?? null,
      tage,
      stand: l.stand,
      standText: l.text,
      naechsterSchritt: l.naechsterSchritt,
      bisSchwelle: l.bisSchwelle,
      ausgeloestAm: vorgang?.ausgeloestAm ?? null,
      angebotenAm: vorgang?.angebotenAm ?? null,
      angebotenVon: vorgang?.angebotenVon ?? null,
      antwort: vorgang?.antwort ?? null,
      antwortAm: vorgang?.antwortAm ?? null,
      ergebnis: vorgang?.ergebnis ?? null,
      abgeschlossenAm: vorgang?.abgeschlossenAm ?? null,
    }
  })
  // Wer unauffällig ist, gehört nicht auf eine Liste über Krankheitstage.
  .filter(e => e.stand !== 'unauffaellig')
  .sort((a, b) => b.tage - a.tage)

  return NextResponse.json({
    eintraege,
    zusammenfassung: {
      faellig: eintraege.filter(e => e.stand === 'faellig').length,
      offen: eintraege.filter(e => ['angeboten', 'laeuft'].includes(e.stand)).length,
    },
  })
}

/**
 * Ein Angebot festhalten.
 *
 * Erzeugt den Vorgang, wenn es ihn noch nicht gibt. Das Angebot selbst hat ein
 * Mensch gemacht — hier wird nur vermerkt, dass es geschehen ist. Genau dieser
 * Vermerk ist später der Nachweis.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }
  if (!await darfBem(session, customerId)) return verschlossen()

  const { employeeId, tage } = await req.json().catch(() => ({}))
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId fehlt' }, { status: 400 })
  }
  const verweigert = await assertEmployeeAccess(session, employeeId)
  if (verweigert) return verweigert

  const laufend = await prisma.bemVorgang.findFirst({
    where: { employeeId, abgeschlossenAm: null },
  })
  if (laufend) {
    return NextResponse.json(
      { error: 'Für diese Person läuft bereits ein Vorgang.', vorgangId: laufend.id },
      { status: 409 },
    )
  }

  const vorgang = await prisma.bemVorgang.create({
    data: {
      employeeId, customerId,
      tageBeiAusloesung: Number(tage ?? 0),
      angebotenAm: new Date(),
      angebotenVon: session.name ?? session.email,
    },
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'create', entityType: 'BemVorgang', entityId: vorgang.id,
    customerId, details: { employeeId },
  })

  return NextResponse.json({ vorgang })
}

/**
 * Die Antwort festhalten oder das Verfahren abschließen.
 *
 * Eine Ablehnung braucht keine Begründung — die Teilnahme ist freiwillig.
 * Ein Abschluss braucht ein Ergebnis: Ohne wäre das Verfahren nicht
 * durchgeführt, sondern nur abgehakt.
 */
export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }
  if (!await darfBem(session, customerId)) return verschlossen()

  const { id, antwort, ergebnis, abschliessen, notiz } =
    await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorgang = await prisma.bemVorgang.findUnique({ where: { id } })
  if (!vorgang) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const verweigert = await assertEmployeeAccess(session, vorgang.employeeId)
  if (verweigert) return verweigert

  if (vorgang.abgeschlossenAm) {
    return NextResponse.json(
      {
        error: 'Dieser Vorgang ist abgeschlossen. Ein abgeschlossenes Verfahren '
          + 'wird nicht nachträglich umgeschrieben — bei erneutem Überschreiten '
          + 'der Schwelle entsteht ein neuer.',
      },
      { status: 409 },
    )
  }

  if (antwort !== undefined && !ANTWORTEN.includes(antwort as Antwort)) {
    return NextResponse.json({ error: 'Unbekannte Antwort' }, { status: 400 })
  }

  if (abschliessen && !String(ergebnis ?? vorgang.ergebnis ?? '').trim()) {
    return NextResponse.json(
      {
        error: 'Ein Abschluss braucht ein Ergebnis. Ohne wäre das Verfahren '
          + 'nicht durchgeführt, sondern nur abgehakt.',
      },
      { status: 400 },
    )
  }

  const aktualisiert = await prisma.bemVorgang.update({
    where: { id },
    data: {
      ...(antwort !== undefined
        ? { antwort, antwortAm: antwort === 'offen' ? null : new Date() } : {}),
      ...(ergebnis !== undefined ? { ergebnis } : {}),
      ...(notiz !== undefined ? { notiz } : {}),
      ...(abschliessen
        ? {
          abgeschlossenAm: new Date(),
          abgeschlossenVon: session.name ?? session.email,
        }
        : {}),
    },
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'BemVorgang', entityId: id,
    customerId, details: { antwort, abgeschlossen: !!abschliessen },
  })

  return NextResponse.json({ vorgang: aktualisiert })
}
