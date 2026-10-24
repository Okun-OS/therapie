import type { NextRequest } from 'next/server'

/** req.nextUrl.origin spiegelt auf Railway/hinter Reverse-Proxies oft die interne
 * Bind-Adresse (localhost) statt der öffentlichen Domain wider. APP_URL ist daher
 * die verlässliche Quelle für absolute Links in E-Mails; req.nextUrl.origin bleibt
 * nur als Fallback für die lokale Entwicklung ohne gesetzte Variable. */
export function getAppOrigin(req: NextRequest): string {
  return process.env.APP_URL?.replace(/\/+$/, '') || req.nextUrl.origin
}
