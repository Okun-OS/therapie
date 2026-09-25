import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { setSessionCookie, createPendingToken, type SessionRole } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import {
  kennungAus, pruefeSperre, zaehleFehlversuch, versucheLoeschen,
  alteVersucheWegraeumen,
} from '@/lib/anmeldeschutz-db'

export const dynamic = 'force-dynamic'

/**
 * §152 Die Anmeldung — mit Bremse und Spur.
 *
 * WAS HIER VORHER FEHLTE
 * Beides. Die Anmeldung nahm beliebig viele Passwortversuche entgegen, und ein
 * Fehlversuch hinterließ keine Spur — obwohl der Protokolltyp `login_failed`
 * seit Langem existierte und nie geschrieben wurde. In einem Programm mit
 * Lohndaten und Gesundheitsdaten nach Art. 9 DSGVO ist das die erste Lücke,
 * die man zumacht (Art. 32 Abs. 1 DSGVO).
 *
 * DIE REIHENFOLGE IST WICHTIG
 * Erst die Sperre prüfen, dann das Passwort. Andersherum liefe bei jedem
 * Versuch ein bcrypt-Vergleich mit Kostenfaktor 12 — und genau den will ein
 * Angreifer auslösen, weil er teuer ist. Die Bremse wäre dann selbst der
 * Hebel für eine Überlastung.
 *
 * WARUM AUCH BEI UNBEKANNTER E-MAIL GERECHNET WIRD
 * Ohne den Leerlauf-Vergleich unten antwortet das Programm auf eine unbekannte
 * Adresse in einer Millisekunde und auf eine bekannte in zweihundert. Damit
 * ließe sich ohne ein einziges richtiges Passwort auslesen, wer hier ein Konto
 * hat — bei einer Einrichtung mit namentlich bekannten Mitarbeitern ist das
 * schon die halbe Auskunft.
 */

/**
 * Ein gültiger bcrypt-Wert, gegen den bei unbekannter E-Mail gerechnet wird.
 *
 * Einmal beim Start erzeugt, nicht fest einprogrammiert: Ein im Quelltext
 * stehender Vergleichswert wäre öffentlich bekannt, und dann ließe sich an
 * der Antwort wieder ablesen, welcher Fall vorlag.
 */
let leerlaufWert: string | null = null
async function leerlaufVergleich(passwort: string): Promise<void> {
  if (!leerlaufWert) {
    leerlaufWert = await hashPassword(`leerlauf-${Math.random()}-${Date.now()}`)
  }
  await verifyPassword(passwort, leerlaufWert).catch(() => false)
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) {
    return NextResponse.json(
      { error: 'E-Mail und Passwort sind erforderlich' }, { status: 400 })
  }

  const kennung = kennungAus(String(email), req.headers)

  const sperre = await pruefeSperre(kennung)
  if (sperre.gesperrt) {
    return NextResponse.json(
      { error: sperre.meldung, gesperrtBis: sperre.bis?.toISOString() },
      {
        status: 429,
        // Damit ein anständiger Client weiß, wann er wiederkommen darf,
        // statt im Sekundentakt anzuklopfen.
        headers: sperre.bis
          ? {
            'Retry-After': String(Math.max(1, Math.ceil(
              (sperre.bis.getTime() - Date.now()) / 1000))),
          }
          : {},
      },
    )
  }

  const user = await prisma.user.findUnique({ where: { email: kennung.konto } })

  if (!user) {
    // Rechnen, damit die Antwortzeit nicht verrät, dass es die Adresse nicht
    // gibt — siehe oben.
    await leerlaufVergleich(String(password))
  }

  if (!user || !(await verifyPassword(String(password), user.passwordHash))) {
    await zaehleFehlversuch(kennung)
    // Nebenbei aufräumen: Die Tabelle wächst nur, wenn jemand sich vertippt.
    alteVersucheWegraeumen().catch(() => undefined)

    // §152 Die Spur. Ein Angriff wird immer erst im Nachhinein sichtbar —
    // und nur, wenn es etwas nachzusehen gibt. Das Passwort steht hier
    // selbstverständlich nicht, auch kein falsches.
    logAudit({
      userId: user?.id ?? 'unbekannt',
      userEmail: kennung.konto,
      userRole: user?.role ?? 'unbekannt',
      action: 'login_failed',
      entityType: 'User',
      entityId: user?.id,
      customerId: user?.customerId ?? undefined,
      details: { grund: user ? 'passwort' : 'konto-unbekannt' },
    }).catch(() => undefined)

    // Dieselbe Meldung in beiden Fällen: Ob die Adresse existiert, geht
    // niemanden etwas an, der das Passwort nicht kennt.
    return NextResponse.json(
      { error: 'E-Mail oder Passwort ungültig' }, { status: 401 })
  }

  // Ab hier ist die Anmeldung gelungen. Der Zähler dieses Kontos wird geleert
  // — der der Adresse nicht, sonst entsperrte sich ein Angreifer mit dem
  // ersten Treffer selbst.
  await versucheLoeschen(kennung)

  if (user.totpEnabled) {
    const pendingToken = createPendingToken(user.id)
    return NextResponse.json({ requiresTOTP: true, pendingToken })
  }

  if (user.smsOtpEnabled && user.phoneVerified) {
    return NextResponse.json({ requiresSMS: true, userId: user.id })
  }

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? undefined,
      locationId: user.locationId ?? undefined,
      customerId: user.customerId ?? undefined,
    },
  })
  setSessionCookie(res, {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as SessionRole,
    employeeId: user.employeeId ?? undefined,
    locationId: user.locationId ?? undefined,
    customerId: user.customerId ?? undefined,
    customerName: user.customerName ?? undefined,
    bereichIds: user.bereichIds.length > 0 ? user.bereichIds : undefined,
  })
  return res
}
