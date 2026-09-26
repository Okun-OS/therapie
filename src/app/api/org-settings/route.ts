import { NextRequest, NextResponse } from 'next/server'
import { getOrgSettings, updateOrgSettings } from '@/lib/okun-platform-entities'
import { requireRole, resolveCustomerId } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ settings: null })
  }
  const settings = await getOrgSettings(customerId)
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Mandant für diesen Nutzer hinterlegt' }, { status: 400 })
  }
  const eingang = await req.json().catch(() => ({})) as Record<string, unknown>

  // §148 Nur was hier steht, geht in die Datenbank.
  //
  // Vorher wurde der ganze Körper der Anfrage an Prisma durchgereicht. Damit
  // konnte jeder, der diese Schnittstelle erreicht, jede Spalte der Tabelle
  // beschreiben — einschließlich der Bankverbindung des Unternehmens und,
  // seit dieser Etappe, des Impressums der öffentlichen Karriereseite. Eine
  // Liste erlaubter Felder ist die einzige Form dieser Prüfung, die beim
  // nächsten neuen Feld nicht stillschweigend veraltet: Was nicht
  // dazugeschrieben wird, wird nicht geschrieben.
  const ERLAUBT_ALLE = [
    'organizationName', 'defaultWeeklyHours', 'defaultVacationDaysPerYear',
    'autoApproveVacationUnderDays', 'notificationEmail', 'auNachweisAbTag',
  ]
  // §113/§114 Anschrift, Betriebsnummer und Bankverbindung des Arbeitgebers.
  // Sie stehen auf jeder Entgeltabrechnung und in jeder SEPA-Datei — eine
  // Standortleitung hat daran nichts zu ändern.
  const ERLAUBT_UNTERNEHMEN = [
    'strasse', 'plz', 'ort', 'betriebsnummer', 'steuernummer',
    'iban', 'bic', 'kontoinhaber', 'datevBeraternummer', 'datevMandantennummer',
    // §147 Wer Gesundheitsdaten sehen darf, entscheidet das Unternehmen.
    'bemSichtbarLeitung',
  ]

  const erlaubt = session.role === 'company'
    ? [...ERLAUBT_ALLE, ...ERLAUBT_UNTERNEHMEN]
    : ERLAUBT_ALLE

  const abgewiesen = Object.keys(eingang).filter(k => !erlaubt.includes(k))
  if (abgewiesen.length > 0 && session.role === 'admin') {
    const heikel = abgewiesen.filter(k => ERLAUBT_UNTERNEHMEN.includes(k))
    if (heikel.length > 0) {
      return NextResponse.json(
        {
          error: heikel.includes('bemSichtbarLeitung')
            ? 'Die Freigabe für das Eingliederungsmanagement kann nur die '
              + 'Unternehmensebene erteilen.'
            : 'Diese Angaben ändert die Unternehmensebene: '
              + `${heikel.join(', ')}.`,
        },
        { status: 403 },
      )
    }
  }

  const updates: Record<string, unknown> = {}
  for (const feld of erlaubt) {
    if (feld in eingang) updates[feld] = eingang[feld]
  }

  const settings = await updateOrgSettings(customerId, updates as never)
  return NextResponse.json({ settings })
}
