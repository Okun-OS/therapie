import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  kennungAus, pruefeSperre, zaehleFehlversuch, versucheLoeschen,
  alteVersucheWegraeumen,
} from '@/lib/anmeldeschutz-db'
import {
  SIEGEL_KEKS, GUELTIG_MINUTEN, KEKS_OPTIONEN,
  siegelErzeugen, siegelPruefen, siegelNoetig,
} from '@/lib/lohnsiegel'

export const dynamic = 'force-dynamic'

/**
 * §201 Die Freigabe für die eigene Lohnabrechnung.
 *
 *   GET     Muss ich fragen, und ist gerade freigegeben?
 *   POST    { passwort } → freigeben
 *   DELETE  wieder sperren
 *
 * WARUM DIE BREMSE DIESELBE IST WIE BEI DER ANMELDUNG
 * Hier wird dasselbe Passwort geprüft wie dort. Hätte diese Stelle eine
 * eigene, großzügigere Zählung, wäre sie der bequemere Weg, Passwörter
 * durchzuprobieren — und die ganze Mühe von §152 an der Anmeldung umsonst.
 * Eine Tür zusätzlich einzubauen und sie schlechter zu sichern als die erste
 * macht das Haus unsicherer, nicht sicherer.
 */

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const noetig = siegelNoetig(session.role)
  const stand = siegelPruefen(req.cookies.get(SIEGEL_KEKS)?.value, session.userId)

  return NextResponse.json({
    noetig,
    // Wer gar nicht gefragt wird, ist immer frei — sonst müsste die Oberfläche
    // beide Fälle einzeln auseinanderhalten.
    frei: !noetig || stand.gueltig,
    restSekunden: stand.gueltig ? Math.floor(stand.restMs / 1000) : 0,
    minuten: GUELTIG_MINUTEN,
  })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { passwort } = await req.json().catch(() => ({})) as { passwort?: string }
  if (!passwort) {
    return NextResponse.json({ error: 'Bitte dein Passwort eingeben.' }, { status: 400 })
  }

  const kennung = kennungAus(session.email, req.headers)

  // Erst die Sperre, dann bcrypt — dieselbe Reihenfolge wie bei der Anmeldung
  // und aus demselben Grund: Der teure Vergleich darf nicht der Hebel sein,
  // mit dem sich der Dienst überlasten lässt.
  const sperre = await pruefeSperre(kennung)
  if (sperre.gesperrt) {
    return NextResponse.json(
      { error: sperre.meldung, gesperrtBis: sperre.bis?.toISOString() },
      {
        status: 429,
        headers: sperre.bis
          ? {
            'Retry-After': String(Math.max(1, Math.ceil(
              (sperre.bis.getTime() - Date.now()) / 1000))),
          }
          : {},
      },
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true },
  })

  // Kein Leerlauf-Vergleich wie bei der Anmeldung: Wer hier ankommt, ist
  // angemeldet. Dass es sein Konto gibt, ist damit ohnehin bekannt — es wäre
  // nichts zu verbergen.
  if (!user || !(await verifyPassword(String(passwort), user.passwordHash))) {
    await zaehleFehlversuch(kennung)
    alteVersucheWegraeumen().catch(() => undefined)
    await logAudit({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: 'login_failed',
      entityType: 'lohnsiegel',
      customerId: session.customerId,
      details: { wo: 'Lohnabrechnung freigeben' },
    })
    return NextResponse.json({ error: 'Das Passwort stimmt nicht.' }, { status: 401 })
  }

  await versucheLoeschen(kennung)

  const res = NextResponse.json({
    frei: true,
    restSekunden: GUELTIG_MINUTEN * 60,
    minuten: GUELTIG_MINUTEN,
  })
  res.cookies.set(SIEGEL_KEKS, siegelErzeugen(session.userId), {
    ...KEKS_OPTIONEN,
    maxAge: GUELTIG_MINUTEN * 60,
  })
  return res
}

/**
 * Wieder sperren.
 *
 * Gibt es, weil jemand ein geteiltes Gerät bewusst zumachen können muss,
 * ohne sich ganz abzumelden — sonst ist der einzige Weg „abmelden", und das
 * macht niemand, der gleich wieder in den Dienstplan will.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const res = NextResponse.json({ frei: !siegelNoetig(session.role), restSekunden: 0 })
  res.cookies.set(SIEGEL_KEKS, '', { ...KEKS_OPTIONEN, maxAge: 0 })
  return res
}
