import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { upsertHumanContext } from '@/lib/human-context-service'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

/**
 * §232 Die freiwilligen persönlichen Angaben — Zugriff und Schreibrecht.
 *
 * ZWEI BEFUNDE, BEIM AUFRÄUMEN DER DOPPELFELDER GEFUNDEN
 *
 * 1. DAS LESEN WAR OFFEN — UND OHNE KENNUNG GAB ES ALLES
 *    `requireRole(req)` ohne Rollenliste lässt jede angemeldete Person herein.
 *    Danach wurde `employeeId` ungeprüft benutzt; **fehlte sie ganz, kam die
 *    Tabelle vollständig zurück** — über alle Standorte und alle Kunden
 *    hinweg. Nachgemessen am 24.10.2026: HTTP 200 für die Angaben einer
 *    Kollegin, und HTTP 200 für eine Leitung eines FREMDEN Kunden.
 *
 *    Was dort steht, ist nicht harmlos. „Lebenssituation" meint
 *    alleinerziehend, Pflege von Angehörigen, gesundheitliche Einschränkungen,
 *    regelmäßige Arzttermine — danach fragt der Chat ausdrücklich. Das sind
 *    Gesundheits- und Familiendaten nach Art. 9 DSGVO, freiwillig gegeben, und
 *    sie lagen für jeden angemeldeten Menschen offen.
 *
 * 2. DIE EIGENE MASKE KONNTE NICHT SPEICHERN
 *    `PATCH` verlangte `['admin', 'company', 'okun']`. Im Mitarbeiterportal
 *    steht aber genau diese Maske — Stärken, Lebenssituation, Absprachen, mit
 *    Speicherknopf. Wer dort etwas eintrug und speicherte, bekam 403. Über den
 *    KI-Chat ging es, über die Maske daneben nicht; dieselbe Angabe, zwei
 *    Wege, einer davon tot.
 *
 * `assertEmployeeAccess` entscheidet beides an einer Stelle: die eigene
 * Person, und für die Leitung die des eigenen Standorts.
 */

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    // §232 Kein Abruf ohne Kennung mehr. Vorher war das die Form, die ALLES
    // zurückgab — und niemand in der Oberfläche hat sie je gebraucht.
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const contexts = await prisma.employeeHumanContext.findMany({ where: { employeeId } })
  return NextResponse.json({ contexts })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { employeeId, strengths, lifeCircumstances, preferredActivities, agreements } = await req.json()
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  // §232 Die eigene Person darf hier schreiben — es sind ihre freiwilligen
  // Angaben. Die Leitung darf es für ihren Standort, weil sie die Absprachen
  // festhält. Alles andere wird abgewiesen.
  const zugriffVerweigert = await assertEmployeeAccess(session, employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const context = await upsertHumanContext(employeeId, { strengths, lifeCircumstances, preferredActivities, agreements })
  return NextResponse.json({ context })
}
