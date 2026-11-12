import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, setSessionCookie, sitzungsangabenAus } from '@/lib/session'
import {
  OEFFNUNG_KEKS, KEKS_OPTIONEN, KARENZ_SEKUNDEN,
  siegelGueltig, hatZweitenFaktor, oeffnungAktiv,
} from '@/lib/oeffnungssiegel'

export const dynamic = 'force-dynamic'

/**
 * §289 Die Bestätigung beim Öffnen der App.
 *
 *   GET     Wird gefragt, und ist gerade bestätigt? Über welchen Weg?
 *   PUT     { an } — die Einstellung umschalten
 *   DELETE  Das Siegel wegwerfen (die Oberfläche, wenn die App zurückkommt)
 *
 * Diese Wege bleiben offen, auch wenn die Tür zu ist — sonst gäbe es keinen
 * Weg hindurch. Die Liste steht in `oeffnungssiegel.ts`.
 */

async function kontoLesen(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true,
      employeeId: true, locationId: true, customerId: true, customerName: true,
      bereichIds: true,
      totpEnabled: true, smsOtpEnabled: true, emailOtpEnabled: true,
      phone: true, faktorBeimOeffnen: true,
    },
  })
}

/** Die Telefonnummer nur angedeutet — wie in `2fa/status`. */
function nummerAndeuten(phone: string | null): string | null {
  return phone ? phone.replace(/(\+\d{1,3})\d+(\d{2})$/, '$1***$2') : null
}

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const user = await kontoLesen(session.userId)
  if (!user) return NextResponse.json({ error: 'Konto nicht gefunden' }, { status: 404 })

  const lage = {
    sms: user.smsOtpEnabled, email: user.emailOtpEnabled, totp: user.totpEnabled,
  }
  const aktiv = oeffnungAktiv(user.faktorBeimOeffnen, lage)

  const res = NextResponse.json({
    /** Lässt sich die Einstellung überhaupt einschalten? */
    moeglich: hatZweitenFaktor(lage),
    /** Steht sie in der Datenbank? */
    eingeschaltet: user.faktorBeimOeffnen,
    /** Gilt sie wirklich (Einstellung UND ein Faktor dafür)? */
    aktiv,
    /** Ist gerade bestätigt? */
    frei: !aktiv || siegelGueltig(req.cookies.get(OEFFNUNG_KEKS)?.value, session.userId),
    wege: {
      sms: user.smsOtpEnabled ? nummerAndeuten(user.phone) : null,
      email: user.emailOtpEnabled ? user.email : null,
      totp: user.totpEnabled,
    },
    karenzSekunden: KARENZ_SEKUNDEN,
  })

  /*
   * §288/§289 Der stille Fall, der sonst zur Falle wird: Die Einstellung
   * steht an, aber der zweite Faktor ist weggefallen (Telefon verloren, die
   * Verwaltung hat SMS-2FA abgeschaltet). Dann gibt es keinen Schlüssel mehr
   * zu dieser Tür.
   *
   * Hier wird nicht nur nachgegeben, sondern aufgeräumt: Der Haken fällt
   * auch in der Datenbank, und die Sitzungsmarke wird neu ausgestellt — sonst
   * trüge sie `faktorBeimOeffnen` weiter und `requireRole` würde jede
   * Schnittstelle sperren, während diese hier erklärt, es sei alles offen.
   */
  if (user.faktorBeimOeffnen && !hatZweitenFaktor(lage)) {
    await prisma.user.update({
      where: { id: user.id }, data: { faktorBeimOeffnen: false },
    })
    setSessionCookie(res, sitzungsangabenAus({ ...user, faktorBeimOeffnen: false }))
    res.cookies.set(OEFFNUNG_KEKS, '', { ...KEKS_OPTIONEN, maxAge: 0 })
  }

  return res
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { an } = await req.json().catch(() => ({})) as { an?: boolean }
  if (typeof an !== 'boolean') {
    return NextResponse.json({ error: '`an` fehlt.' }, { status: 400 })
  }

  const user = await kontoLesen(session.userId)
  if (!user) return NextResponse.json({ error: 'Konto nicht gefunden' }, { status: 404 })

  const lage = {
    sms: user.smsOtpEnabled, email: user.emailOtpEnabled, totp: user.totpEnabled,
  }

  /*
   * §288 Keine Tür ohne Schlüssel. Wer keinen zweiten Faktor eingerichtet
   * hat, kann diese Sperre nicht einschalten — er käme hinter ihr nicht mehr
   * hervor. Genau diese Vorsichtsmaßnahme hatte die alte Gerätesperre auch,
   * und genau sie hat gefehlt, als der Sensor SPÄTER ausfiel. Deshalb gibt
   * es dazu die Prüfung im GET, die auch nachträglich nachgibt.
   */
  if (an && !hatZweitenFaktor(lage)) {
    return NextResponse.json({
      error: 'Dafür brauchst du zuerst einen zweiten Faktor — SMS-Code, '
        + 'E-Mail-Code oder eine Authenticator-App.',
      code: 'KEIN_FAKTOR',
    }, { status: 400 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { faktorBeimOeffnen: an } })

  const res = NextResponse.json({ eingeschaltet: an, aktiv: an })
  // Die Marke muss den neuen Stand tragen, sonst greift `requireRole` erst
  // nach der nächsten Anmeldung — oder, beim Ausschalten, noch danach.
  setSessionCookie(res, sitzungsangabenAus({ ...user, faktorBeimOeffnen: an }))
  if (an) {
    /*
     * Wer gerade einschaltet, steht vor dem Gerät und hat sich eben
     * angemeldet. Ihn sofort nach einem Code zu fragen, wäre eine Frage ohne
     * Erkenntnis — das Siegel gilt also ab jetzt. Gefragt wird beim nächsten
     * Öffnen, und darum geht es.
     */
    const { siegelErzeugen } = await import('@/lib/oeffnungssiegel')
    res.cookies.set(OEFFNUNG_KEKS, siegelErzeugen(user.id), KEKS_OPTIONEN)
  } else {
    res.cookies.set(OEFFNUNG_KEKS, '', { ...KEKS_OPTIONEN, maxAge: 0 })
  }
  return res
}

/**
 * Das Siegel wegwerfen.
 *
 * Gerufen von der Oberfläche, wenn die App aus dem Hintergrund zurückkommt
 * und länger als die Karenzzeit weg war. Der Server kann das nicht sehen —
 * nur das Gerät weiß, wann es weggelegt wurde.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const res = NextResponse.json({ frei: false })
  res.cookies.set(OEFFNUNG_KEKS, '', { ...KEKS_OPTIONEN, maxAge: 0 })
  return res
}
