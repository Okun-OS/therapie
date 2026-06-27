import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'okun_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export type SessionRole = 'employee' | 'admin' | 'company' | 'okun'

export interface SessionPayload {
  userId: string
  email: string
  role: SessionRole
  employeeId?: string
  locationId?: string
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
