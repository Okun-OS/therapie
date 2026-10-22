import { NextRequest, NextResponse } from 'next/server'
import { getOrgSettings, updateOrgSettings } from '@/lib/okun-platform-entities'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { ibanGekuerzt } from '@/lib/lohn-export'

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

  /*
   * §217 Eine geänderte Bankverbindung hinterlässt eine Spur.
   *
   * Bis hierher nicht: Die IBAN des Arbeitgebers ließ sich ändern, ohne dass
   * irgendwo stand, wer das wann getan hat. Dabei ist sie das Konto, von dem
   * alle Gehälter abgehen — und der häufigste Betrug in diesem Bereich ist
   * nicht der gehackte Bankzugang, sondern die stillschweigend getauschte
   * Kontonummer. Im Protokoll steht die IBAN nur gekürzt: genug, um die
   * Änderung zu erkennen, zu wenig, um davon zu überweisen.
   */
  const bankFelder = ['iban', 'bic', 'kontoinhaber'] as const
  const bankGeaendert = bankFelder.filter(f => f in updates)
  const vorher = bankGeaendert.length > 0
    ? await prisma.orgSettings.findUnique({
      where: { customerId }, select: { iban: true, bic: true, kontoinhaber: true },
    })
    : null

  const settings = await updateOrgSettings(customerId, updates as never)

  if (bankGeaendert.length > 0) {
    const wirklich = bankGeaendert.filter(
      f => String(vorher?.[f] ?? '') !== String(updates[f] ?? ''),
    )
    if (wirklich.length > 0) {
      await logAudit({
        userId: session.userId, userEmail: session.email, userRole: session.role,
        action: 'update', entityType: 'Bankverbindung', entityId: customerId,
        customerId,
        details: {
          wen: 'Unternehmen',
          felder: wirklich,
          ...(wirklich.includes('iban') ? {
            ibanVorher: ibanGekuerzt(vorher?.iban),
            ibanNachher: ibanGekuerzt(String(updates.iban ?? '')),
          } : {}),
        },
      })
    }
  }

  return NextResponse.json({ settings })
}
