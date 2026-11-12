import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import { oeffnungSperre, OEFFNUNG_KEKS } from './oeffnungssiegel'

const SESSION_COOKIE = 'okun_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export type SessionRole = 'employee' | 'admin' | 'company' | 'okun'

export interface SessionPayload {
  userId: string
  email: string
  name?: string
  role: SessionRole
  employeeId?: string
  locationId?: string
  customerId?: string
  customerName?: string
  bereichIds?: string[]
  /**
   * §289 Verlangt dieses Konto beim Öffnen der App den zweiten Faktor?
   *
   * Steht in der Marke und nicht in der Datenbank, weil `requireRole` an
   * JEDER Schnittstelle läuft und dort keine Abfrage stehen darf. Gesetzt
   * wird der Wert beim Anmelden und beim Umschalten der Einstellung — und
   * nur dann, wenn das Konto wirklich einen zweiten Faktor hat.
   */
  faktorBeimOeffnen?: boolean
  iat: number
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET ist nicht gesetzt')
    }
    return 'dev-insecure-session-secret-do-not-use-in-production'
  }
  return secret
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function createSessionToken(payload: Omit<SessionPayload, 'iat'>): string {
  const full: SessionPayload = { ...payload, iat: Date.now() }
  const data = Buffer.from(JSON.stringify(full)).toString('base64url')
  const signature = sign(data)
  return `${data}.${signature}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [data, signature] = parts
  const expectedSignature = sign(data)

  const sigBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expectedSignature)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload
    const ageSeconds = (Date.now() - payload.iat) / 1000
    if (ageSeconds > SESSION_MAX_AGE_SECONDS) return null
    return payload
  } catch {
    return null
  }
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  return verifySessionToken(token)
}

export function setSessionCookie(res: NextResponse, payload: Omit<SessionPayload, 'iat'>): void {
  const token = createSessionToken(payload)
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

/**
 * §289 Die Angaben einer Sitzung — aus einem Benutzerdatensatz, an EINER
 * Stelle.
 *
 * WARUM DAS JETZT HIER STEHT
 * Dieselben zehn Zeilen standen dreimal im Programm: in der Anmeldung, beim
 * zweiten Faktor über SMS/E-Mail und beim zweiten Faktor über die App. §196
 * hat an genau dieser Doppelung schon einen Fehler gefunden — eine der
 * Abschriften setzte `bereichIds` nicht, und wer auf Bereiche eingeschränkt
 * war, bekam über den SICHEREREN Anmeldeweg MEHR Rechte.
 *
 * Mit `faktorBeimOeffnen` wäre es dasselbe noch einmal geworden: Eine
 * Abschrift, die den Wert nicht setzt, lässt die Sperre still aus. Deshalb
 * zuerst zusammengeführt, dann erweitert.
 *
 * `faktorBeimOeffnen` wird NUR gesetzt, wenn das Konto wirklich einen
 * zweiten Faktor hat. Das ist die Schranke aus §288 — eine Tür ohne
 * Schlüssel baut man nicht, auch dann nicht, wenn in der Datenbank noch ein
 * Haken von früher steht.
 */
export interface SitzungsBenutzer {
  id: string
  email: string
  name: string
  role: string
  employeeId?: string | null
  locationId?: string | null
  customerId?: string | null
  customerName?: string | null
  bereichIds?: string[]
  totpEnabled?: boolean
  smsOtpEnabled?: boolean
  emailOtpEnabled?: boolean
  faktorBeimOeffnen?: boolean
}

export function sitzungsangabenAus(user: SitzungsBenutzer): Omit<SessionPayload, 'iat'> {
  const hatFaktor = Boolean(user.totpEnabled || user.smsOtpEnabled || user.emailOtpEnabled)
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as SessionRole,
    employeeId: user.employeeId ?? undefined,
    locationId: user.locationId ?? undefined,
    customerId: user.customerId ?? undefined,
    customerName: user.customerName ?? undefined,
    bereichIds: user.bereichIds && user.bereichIds.length > 0 ? user.bereichIds : undefined,
    faktorBeimOeffnen: Boolean(user.faktorBeimOeffnen) && hatFaktor ? true : undefined,
  }
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

/**
 * Per-route guard. Call at the top of a route handler:
 *   const session = requireRole(req, ['admin', 'okun'])
 *   if (session instanceof NextResponse) return session
 */
export function requireRole(
  req: NextRequest,
  roles?: SessionRole[]
): SessionPayload | NextResponse {
  const session = getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  /*
   * §289 Die Bestätigung beim Öffnen der App.
   *
   * Sie steht HIER und nicht in den einzelnen Routen, und das ist der
   * Unterschied zwischen Schutz und Schaufenster: Wer das Telefon in der
   * Hand hält, hat auch den Sitzungskeks. Eine Sperre, die nur die
   * Oberfläche verdeckt, ließe jede Adresse offen.
   *
   * Welche Wege trotzdem offen bleiben müssen — allen voran das Abmelden —
   * steht in `oeffnungssiegel.ts`. Ohne diesen Ausweg wäre es wieder die
   * Falle aus §288.
   */
  const sperre = oeffnungSperre({
    verlangt: session.faktorBeimOeffnen,
    marke: req.cookies.get(OEFFNUNG_KEKS)?.value,
    userId: session.userId,
    pfad: req.nextUrl.pathname,
  })
  if (sperre) {
    return NextResponse.json(
      { error: sperre.error, code: sperre.code }, { status: sperre.status })
  }

  return session
}

/**
 * Session cookies are signed once at login and never re-validated against the
 * database, so a field added to SessionPayload after a user's last login (or
 * backfilled on their User row after their cookie was issued) is missing from
 * their existing cookie until they log out and back in. Routes that need an
 * authoritative customerId should call this instead of reading
 * session.customerId directly, so already-logged-in users aren't locked out
 * by a stale cookie.
 */
export async function resolveCustomerId(session: SessionPayload): Promise<string | undefined> {
  if (session.customerId) return session.customerId
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { customerId: true } })
  return user?.customerId ?? undefined
}

/**
 * Same staleness problem as resolveCustomerId, for locationId. Routes that
 * restrict a Standortleitung ('admin' role) to their own location should
 * call this instead of reading session.locationId directly.
 */
export async function resolveLocationId(session: SessionPayload): Promise<string | undefined> {
  if (session.locationId) return session.locationId
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { locationId: true } })
  return user?.locationId ?? undefined
}

/**
 * Bereichsleiter: company-role users whose access is scoped to specific Bereiche.
 * Returns the bereichIds from the cookie (fast path) or re-reads from DB
 * (stale-cookie fallback). An empty array means unrestricted company access.
 */
export async function resolveBereichIds(session: SessionPayload): Promise<string[]> {
  if (session.bereichIds && session.bereichIds.length > 0) return session.bereichIds
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { bereichIds: true } })
  return user?.bereichIds ?? []
}

/**
 * Creates a short-lived signed token encoding a userId, used as a TOTP
 * "pending" token between login step 1 (password) and step 2 (TOTP code).
 * Expires after 5 minutes.
 */
export function createPendingToken(userId: string): string {
  const nonce = randomBytes(8).toString('hex')
  const exp = Date.now() + 5 * 60 * 1000
  const data = Buffer.from(JSON.stringify({ userId, exp, nonce })).toString('base64url')
  const signature = createHmac('sha256', getSecret()).update(data).digest('base64url')
  return `${data}.${signature}`
}

/**
 * Verifies a pending TOTP token. Returns the userId if valid, null otherwise.
 */
export function verifyPendingToken(token: string): { userId: string } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [data, signature] = parts
  const expectedSignature = createHmac('sha256', getSecret()).update(data).digest('base64url')
  const sigBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expectedSignature)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as { userId: string; exp: number }
    if (Date.now() > payload.exp) return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}
