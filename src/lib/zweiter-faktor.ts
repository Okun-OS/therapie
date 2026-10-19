import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { setSessionCookie, type SessionRole } from './session'
import type { NextResponse } from 'next/server'

/**
 * §196 Was SMS- und E-Mail-Code gemeinsam haben.
 *
 * WARUM DAS HIER STEHT UND NICHT ZWEIMAL DANEBEN
 * Als es nur den SMS-Weg gab, stand die ganze Logik in einer Route. Mit dem
 * zweiten Weg wäre sie zweimal dagewesen — und zwei Kopien einer Prüfung, die
 * entscheidet, wer hereinkommt, laufen garantiert auseinander. Dann hat der
 * eine Weg eine Sperre nach fünf Versuchen und der andere nicht, und niemand
 * merkt es, weil beide „funktionieren".
 */

/** Gültigkeitsdauer eines Codes. Lang genug für eine E-Mail, kurz genug, dass
 *  ein abgefangener Code wertlos wird. */
export const GUELTIG_MINUTEN = 10

/** Danach ist Schluss — sonst probiert jemand eine Million Zahlen durch. */
export const MAX_VERSUCHE = 5

/** Mindestabstand zwischen zwei Anforderungen. */
export const SPERRE_MINUTEN = 1

export type Kanal = 'sms' | 'email'

/** Sechs Ziffern. */
export function codeErzeugen(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Einen frischen Code hinterlegen und im Klartext zurückgeben.
 *
 * Gespeichert wird nur der Hash — ein Code, den man in der Datenbank lesen
 * kann, ist kein zweiter Faktor, sondern ein zweites Passwort im Klartext.
 */
export async function codeHinterlegen(userId: string, kanal: Kanal): Promise<string> {
  await prisma.smsTotpCode.deleteMany({ where: { userId } })
  const code = codeErzeugen()
  await prisma.smsTotpCode.create({
    data: {
      userId,
      kanal,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + GUELTIG_MINUTEN * 60 * 1000),
    },
  })
  return code
}

/** Wurde gerade eben schon einer angefordert? */
export async function zuFrueh(userId: string): Promise<boolean> {
  const letzter = await prisma.smsTotpCode.findFirst({
    where: { userId, createdAt: { gte: new Date(Date.now() - SPERRE_MINUTEN * 60 * 1000) } },
  })
  return Boolean(letzter)
}

export type Pruefergebnis =
  | { ok: true }
  | { ok: false; status: number; fehler: string }

/**
 * Einen eingegebenen Code prüfen und verbrauchen.
 *
 * Verbraucht heißt: Auch ein richtiger Code gilt genau einmal. Sonst könnte
 * ihn jemand, der die E-Mail mitgelesen hat, ein zweites Mal benutzen.
 */
export async function codePruefen(userId: string, eingabe: string): Promise<Pruefergebnis> {
  const satz = await prisma.smsTotpCode.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!satz) {
    return { ok: false, status: 400, fehler: 'Code abgelaufen. Bitte neu anfordern.' }
  }

  if (satz.attempts >= MAX_VERSUCHE) {
    await prisma.smsTotpCode.delete({ where: { id: satz.id } })
    return {
      ok: false,
      status: 429,
      fehler: 'Zu viele Versuche. Bitte einen neuen Code anfordern.',
    }
  }

  if (!await bcrypt.compare(String(eingabe).trim(), satz.codeHash)) {
    await prisma.smsTotpCode.update({
      where: { id: satz.id }, data: { attempts: { increment: 1 } },
    })
    return { ok: false, status: 400, fehler: 'Falscher Code.' }
  }

  await prisma.smsTotpCode.update({ where: { id: satz.id }, data: { usedAt: new Date() } })
  return { ok: true }
}

/**
 * §196 Die Sitzung setzen — mit ALLEN Angaben.
 *
 * WAS HIER VORHER FEHLTE
 * Die SMS-Anmeldung setzte `bereichIds` nicht, die normale Anmeldung schon.
 * Wer auf bestimmte Bereiche eingeschränkt ist, bekam über den zweiten Faktor
 * also eine Sitzung OHNE diese Einschränkung — der sicherere Weg führte zu
 * mehr Rechten. Genau deshalb steht das Setzen jetzt an einer Stelle.
 */
export async function sitzungSetzen(res: NextResponse, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false

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
  return true
}
