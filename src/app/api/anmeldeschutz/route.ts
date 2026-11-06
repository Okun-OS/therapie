import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { kennungAus, pruefeSperre } from '@/lib/anmeldeschutz-db'

export const dynamic = 'force-dynamic'

/**
 * §152 Eine Sperre wieder aufheben.
 *
 * WARUM ES DAS GEBEN MUSS
 * Die Sperre läuft nach einer Viertelstunde von selbst ab — das genügt für den
 * Alltag. Es genügt nicht für den Anruf: „Ich komme nicht rein, ich habe in
 * zehn Minuten Dienstübergabe." Ohne diesen Weg bliebe der Leitung nur, die
 * Person zu vertrösten, und das Programm stünde als Schikane da.
 *
 * WER WEN AUFSPERREN DARF
 *   Unternehmensebene → die eigenen Leute. Sie kennt sie und kann am Telefon
 *   erkennen, mit wem sie spricht.
 *   OKUN → jedes Konto, und zusätzlich die Sperre einer ganzen VERBINDUNG.
 *   Der zweite Fall kommt vor, wenn eine ganze Einrichtung hinter einem
 *   Anschluss sitzt und sich gemeinsam ausgesperrt hat.
 *
 * WARUM NICHT DIE STANDORTLEITUNG
 * Weil eine aufgehobene Sperre die einzige Bremse gegen Durchprobieren
 * wegnimmt. Wer sie aufheben darf, muss auch dafür geradestehen — und je
 * kleiner dieser Kreis, desto weniger taugt er als Einfallstor.
 *
 * WARUM JEDE AUFHEBUNG PROTOKOLLIERT WIRD
 * Weil sonst genau der Angriff unsichtbar bliebe, gegen den die Bremse gebaut
 * ist: erst durchprobieren, dann die Spur der Sperre selbst beseitigen.
 */

/** Was der Fragende über den Stand einer Adresse wissen darf. */
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email fehlt' }, { status: 400 })

  if (session.role === 'company') {
    const verweigert = await nurEigene(session, email)
    if (verweigert) return verweigert
  }

  const lage = await pruefeSperre(kennungAus(email, req.headers))
  return NextResponse.json({
    gesperrt: lage.gesperrt,
    bis: lage.bis?.toISOString() ?? null,
    meldung: lage.meldung ?? null,
  })
}

/** Gehört dieses Konto zum Unternehmen des Fragenden? */
async function nurEigene(
  session: { userId: string; role: string },
  email: string,
): Promise<NextResponse | null> {
  const customerId = await resolveCustomerId(session as never)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }
  const konto = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
    select: { customerId: true },
  })
  // Auch bei einem Konto, das es nicht gibt, dieselbe Antwort: Sonst ließe
  // sich über diese Schnittstelle durchprobieren, welche Adressen existieren.
  if (!konto || konto.customerId !== customerId) {
    return NextResponse.json(
      { error: 'Dieses Konto gehört nicht zu deinem Unternehmen.' }, { status: 403 })
  }
  return null
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const email = req.nextUrl.searchParams.get('email')
  const auchVerbindung = req.nextUrl.searchParams.get('verbindung') === '1'

  if (!email && !auchVerbindung) {
    return NextResponse.json(
      { error: 'Welches Konto soll aufgesperrt werden?' }, { status: 400 })
  }

  if (auchVerbindung && session.role !== 'okun') {
    return NextResponse.json(
      {
        error: 'Die Sperre einer ganzen Verbindung hebt nur OKUN auf — sie '
          + 'betrifft alle, die hinter demselben Anschluss sitzen.',
      },
      { status: 403 },
    )
  }

  if (email && session.role === 'company') {
    const verweigert = await nurEigene(session, email)
    if (verweigert) return verweigert
  }

  const kennung = kennungAus(email ?? '', req.headers)
  let konto = 0
  let verbindung = 0

  if (email) {
    const r = await prisma.anmeldeversuch.deleteMany({
      where: { art: 'konto', kennung: kennung.konto },
    })
    konto = r.count
  }
  if (auchVerbindung) {
    const r = await prisma.anmeldeversuch.deleteMany({
      where: { art: 'adresse', kennung: kennung.adresse },
    })
    verbindung = r.count
  }

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Anmeldesperre',
    entityId: email ?? 'verbindung',
    customerId: await resolveCustomerId(session),
    details: { konto, verbindung },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, konto, verbindung })
}
