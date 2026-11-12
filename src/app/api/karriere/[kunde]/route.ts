import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { karriereSeite } from '@/lib/karriere'
import { sendEmail } from '@/lib/email'
import { getAppOrigin } from '@/lib/app-url'
import { pruefeBewerbung, jobPostingLd, UMFAENGE } from '@/lib/recruiting'
import { dateiSpeichern, pruefeDatei, sichererDateiname } from '@/lib/file-storage'

export const dynamic = 'force-dynamic'

/**
 * §148 Die einzige Tür dieses Programms, hinter der niemand angemeldet ist.
 *
 * WAS DAS BEDEUTET
 * Alles, was hier ankommt, kommt von einem Fremden. Deshalb:
 *  — es wird NICHTS ausgeliefert, was nicht ausdrücklich veröffentlicht wurde
 *    (das entscheidet `karriereSeite()`, nicht diese Datei),
 *  — eine unbekannte Adresse und eine ausgeschaltete Seite sehen gleich aus,
 *    sonst ließe sich durchprobieren, welche Betriebe es gibt,
 *  — es wird gezählt, wie oft von einer Stelle aus abgeschickt wird.
 *
 * WARUM EINE ZÄHLUNG IM ARBEITSSPEICHER UND KEIN CAPTCHA
 * Ein Captcha vor dem Bewerbungsformular kostet echte Bewerber. Die Zählung
 * hier hält Massenversand auf und ist einem Menschen gegenüber unsichtbar.
 * Sie überlebt keinen Neustart — das ist in Ordnung: Sie soll eine Flut
 * bremsen, nicht eine Beweiskette führen.
 */

const FENSTER_MS = 60 * 60 * 1000
const MAX_JE_STUNDE = 10
const zaehler = new Map<string, { anzahl: number; bis: number }>()

function zuVielVon(kennung: string): boolean {
  const jetzt = Date.now()
  const stand = zaehler.get(kennung)
  if (!stand || stand.bis < jetzt) {
    zaehler.set(kennung, { anzahl: 1, bis: jetzt + FENSTER_MS })
    // Abgelaufene Einträge nebenbei wegräumen, damit die Karte nicht wächst.
    if (zaehler.size > 5000) {
      for (const k of Array.from(zaehler.keys())) {
        if ((zaehler.get(k)?.bis ?? 0) < jetzt) zaehler.delete(k)
      }
    }
    return false
  }
  stand.anzahl++
  return stand.anzahl > MAX_JE_STUNDE
}

function absender(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unbekannt'
}

/** Die veröffentlichten Stellen eines Betriebs — für jeden lesbar. */
export async function GET(
  req: NextRequest, { params }: { params: { kunde: string } },
) {
  const seite = await karriereSeite(params.kunde)
  if (!seite) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  return NextResponse.json({
    betrieb: seite.betrieb,
    ueberschrift: seite.ueberschrift,
    text: seite.text,
    impressum: seite.impressum,
    datenschutz: seite.datenschutz,
    umfaenge: UMFAENGE,
    stellen: seite.stellen.map(s => ({
      ...s,
      jobPosting: jobPostingLd(s, { name: seite.betrieb }, seite.adresse),
    })),
  })
}

/**
 * Eine Bewerbung entgegennehmen.
 *
 * Nimmt `multipart/form-data` (mit Lebenslauf) und `application/json` (ohne)
 * entgegen — das Formular schickt das eine, ein Prüflauf das andere, und für
 * den Eingang macht es keinen Unterschied.
 */
export async function POST(
  req: NextRequest, { params }: { params: { kunde: string } },
) {
  const seite = await karriereSeite(params.kunde)
  if (!seite) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  if (zuVielVon(absender(req))) {
    return NextResponse.json(
      {
        error: 'Von dieser Verbindung sind gerade sehr viele Bewerbungen '
          + 'eingegangen. Bitte versuch es später noch einmal oder schreib uns '
          + 'eine E-Mail.',
      },
      { status: 429 },
    )
  }

  let felder: Record<string, string> = {}
  let anhang: { name: string; typ: string; daten: Buffer } | null = null

  const typ = req.headers.get('content-type') ?? ''
  if (typ.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ error: 'Der Upload kam nicht an.' }, { status: 400 })
    }
    form.forEach((v, k) => { if (typeof v === 'string') felder[k] = v })
    const datei = form.get('datei')
    if (datei instanceof File && datei.size > 0) {
      const puffer = Buffer.from(await datei.arrayBuffer())
      const geprueft = pruefeDatei(datei.name, datei.type, puffer.length)
      if (!geprueft.ok) {
        return NextResponse.json({ error: geprueft.fehler }, { status: 400 })
      }
      anhang = { name: datei.name, typ: datei.type, daten: puffer }
    }
  } else {
    felder = (await req.json().catch(() => ({}))) as Record<string, string>
  }

  const geprueft = pruefeBewerbung(felder)
  if (geprueft.stillVerwerfen) {
    // Dem Automaten wird „danke" gesagt. Merkt er, dass er auffiel, probiert
    // er es mit einem anderen Feld noch einmal.
    return NextResponse.json({ ok: true })
  }
  if (!geprueft.ok || !geprueft.werte) {
    return NextResponse.json({ error: geprueft.fehler }, { status: 400 })
  }

  const stelle = felder.stelle
    ? seite.stellen.find(s => s.slug === felder.stelle) ?? null
    : null
  if (felder.stelle && !stelle) {
    return NextResponse.json(
      { error: 'Diese Stelle ist nicht mehr ausgeschrieben.' }, { status: 404 },
    )
  }

  const kunde = await prisma.orgSettings.findUnique({
    where: { karriereSlug: params.kunde.trim().toLowerCase() },
    select: { customerId: true, notificationEmail: true, karriereEmail: true },
  })
  if (!kunde) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const voll = stelle
    ? await prisma.stelle.findFirst({
      where: { customerId: kunde.customerId, slug: stelle.slug },
      select: { id: true, titel: true, locationId: true },
    })
    : null

  const bewerbung = await prisma.bewerbung.create({
    data: {
      customerId: kunde.customerId,
      stelleId: voll?.id ?? null,
      stelleTitel: voll?.titel ?? null,
      locationId: voll?.locationId ?? null,
      ...geprueft.werte,
      quelle: 'karriereseite',
    },
  })

  await prisma.bewerbungEreignis.create({
    data: {
      bewerbungId: bewerbung.id, art: 'eingegangen',
      text: voll
        ? `Über die Karriereseite eingegangen — „${voll.titel}“`
        : 'Initiativbewerbung über die Karriereseite',
    },
  }).catch(() => undefined)

  if (anhang) {
    await dateiSpeichern({
      customerId: kunde.customerId,
      locationId: voll?.locationId ?? null,
      ownerType: 'bewerbung' as never,
      ownerId: bewerbung.id,
      kategorie: 'bewerbung',
      dateiname: sichererDateiname(anhang.name),
      mimeType: anhang.typ,
      daten: anhang.daten,
      hochgeladenVon: 'bewerber',
      hochgeladenVonName: geprueft.werte.name,
      sichtbarFuerMitarbeiter: false,
    }).catch(() => undefined)
  }

  // Dem Betrieb Bescheid geben. Eine Bewerbung, die drei Tage ungesehen im
  // Programm liegt, hat sich woanders längst beworben.
  const ziel = kunde.karriereEmail?.trim() || kunde.notificationEmail
  if (ziel) {
    await sendEmail(
      ziel,
      `Neue Bewerbung: ${geprueft.werte.name}`
        + (voll ? ` — ${voll.titel}` : ' (Initiativbewerbung)'),
      [
        `${geprueft.werte.name} hat sich beworben.`,
        voll ? `Stelle: ${voll.titel}` : 'Initiativbewerbung',
        `E-Mail: ${geprueft.werte.email}`,
        geprueft.werte.telefon ? `Telefon: ${geprueft.werte.telefon}` : '',
        anhang ? 'Unterlagen: 1 Datei' : 'Unterlagen: keine',
        '',
        geprueft.werte.nachricht ?? '',
      ].filter(Boolean).join('\n'),
      {
        ctaUrl: `${getAppOrigin(req)}/admin/recruiting`,
        ctaLabel: 'Bewerbung ansehen',
      },
    ).catch(() => undefined)
  }

  // Und dem Bewerber. Eine Eingangsbestätigung ist das Mindeste — sonst weiß
  // er nicht, ob das Formular funktioniert hat.
  await sendEmail(
    geprueft.werte.email,
    `Deine Bewerbung bei ${seite.betrieb}`,
    [
      `Hallo ${geprueft.werte.name},`,
      '',
      voll
        ? `deine Bewerbung auf die Stelle „${voll.titel}“ ist bei uns angekommen.`
        : 'deine Initiativbewerbung ist bei uns angekommen.',
      'Wir sehen sie uns an und melden uns.',
      '',
      seite.betrieb,
    ].join('\n'),
  ).catch(() => undefined)

  return NextResponse.json({ ok: true, id: bewerbung.id })
}
