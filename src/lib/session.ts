import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'

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
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
