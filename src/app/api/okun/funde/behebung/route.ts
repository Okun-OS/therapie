import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  beurteileBehebung, pruefstandReicht, type Klasse, type Pruefstand,
} from '@/lib/behebung'
import { meldetext, brauchtZwischenmeldung } from '@/lib/fundmeldung'
import { schreibeVonOkun } from '@/lib/okun-kanal'

/**
 * §142 Stufe 3 — der Weg, auf dem der Lauf eine Behebung anmeldet.
 *
 * Der Ablauf hat bewusst ZWEI Schritte, und die Reihenfolge ist der ganze
 * Punkt:
 *
 *   1. POST — der Lauf sagt, was er geändert hat und was es geprüft hat.
 *      Der Server entscheidet, ob das direkt rausgehen darf, gesammelt wird
 *      oder abgelehnt ist, und nennt den Zweig, auf den gepusht werden soll.
 *   2. PATCH — der Lauf meldet, dass er gepusht hat, mit dem Commit.
 *
 * Er fragt also VOR dem Pushen um Erlaubnis und bekommt den Zielzweig genannt.
 * Andersherum — erst pushen, dann melden — wäre die Erlaubnis eine Formsache:
 * Auf der laufenden Anlage stünde die Änderung dann längst.
 *
 * Die Entscheidung selbst fällt in src/lib/behebung.ts, anhand der geänderten
 * DATEIEN. Was der Lauf über seine Änderung denkt, ist eine Angabe unter
 * mehreren — nicht das Urteil.
 */

function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}

function pruefeSchluessel(req: NextRequest): NextResponse | null {
  const hinterlegt = process.env.FUNDE_TOKEN
  if (!hinterlegt || hinterlegt.length < 24) {
    return NextResponse.json(
      {
        error: 'Für den Fundelauf ist kein Schlüssel hinterlegt.',
        hinweis: 'FUNDE_TOKEN in den Umgebungsvariablen setzen (mindestens 24 Zeichen).',
      },
      { status: 503 },
    )
  }
  const kopf = req.headers.get('authorization') ?? ''
  const mitgeschickt = kopf.startsWith('Bearer ') ? kopf.slice(7).trim() : ''
  if (!mitgeschickt || !gleich(mitgeschickt, hinterlegt)) {
    return NextResponse.json({ error: 'Kein gültiger Schlüssel' }, { status: 401 })
  }
  return null
}

/** Der Zweig, auf dem gearbeitet wird. */
const ARBEITSZWEIG = 'claude/scheduling-saas-app-vntbc'

const KLASSEN: Klasse[] = ['anzeige', 'logik']

export async function POST(req: NextRequest) {
  const abgelehnt = pruefeSchluessel(req)
  if (abgelehnt) return abgelehnt

  const body = await req.json().catch(() => ({})) as {
    fundId?: string
    klasse?: string
    dateien?: unknown
    zeilen?: number
    begruendung?: string
    pruefstand?: Pruefstand
  }

  if (!body.fundId) return NextResponse.json({ error: 'fundId fehlt' }, { status: 400 })
  if (!KLASSEN.includes(body.klasse as Klasse)) {
    return NextResponse.json(
      { error: 'klasse muss "anzeige" oder "logik" sein' }, { status: 400 })
  }
  const dateien = Array.isArray(body.dateien)
    ? body.dateien.filter((d): d is string => typeof d === 'string' && d.length > 0)
    : []
  if (dateien.length === 0) {
    return NextResponse.json({ error: 'dateien fehlt' }, { status: 400 })
  }

  const fund = await prisma.bugReport.findUnique({ where: { id: body.fundId } })
  if (!fund) return NextResponse.json({ error: 'Fund nicht gefunden' }, { status: 404 })

  // Schon eine Behebung unterwegs? Zweimal dasselbe zu bauen, erzeugt nur
  // zwei Zweige, die sich gegenseitig im Weg stehen.
  const laufend = await prisma.behebung.findFirst({
    where: { fundId: fund.id, status: { in: ['wartet', 'freigegeben', 'ausgerollt'] } },
  })
  if (laufend) {
    return NextResponse.json(
      {
        error: 'Für diesen Fund gibt es schon eine Behebung.',
        behebungId: laufend.id, status: laufend.status,
      },
      { status: 409 },
    )
  }

  // Zuerst der Prüfstand. Eine Änderung, die nicht geprüft ist, wird gar nicht
  // erst eingestuft — auch nicht als „sammeln". Was gesammelt wird, landet
  // später genauso auf der Anlage, nur mit einem Menschen dazwischen, und der
  // sieht einer roten Prüfung nicht an, dass sie rot ist.
  const stand = pruefstandReicht(body.pruefstand ?? {})
  if (!stand.ok) {
    await prisma.behebung.create({
      data: {
        fundId: fund.id, kennung: fund.ticketId, titel: fund.title,
        klasse: body.klasse as string, ausgang: 'abgelehnt',
        grund: `Nicht übernommen: ${stand.grund}`,
        dateien, zeilen: Number(body.zeilen ?? 0),
        begruendung: body.begruendung ?? null,
        pruefstand: (body.pruefstand ?? {}) as object,
        status: 'verworfen',
      },
    })
    return NextResponse.json({ ausgang: 'abgelehnt', grund: stand.grund }, { status: 409 })
  }

  const urteil = beurteileBehebung({
    fund: {
      art: fund.art, bereich: fund.bereich, heikel: fund.heikel,
      meldeQualitaet: fund.meldeQualitaet, freigabe: fund.freigabe,
    },
    klasse: body.klasse as Klasse,
    dateien,
    zeilen: Number(body.zeilen ?? 0),
  })

  const zweig = urteil.ausgang === 'direkt'
    ? ARBEITSZWEIG
    // Ein eigener Zweig je Behebung: So lässt sich einzeln freigeben und
    // einzeln verwerfen. Ein gemeinsamer Sammelzweig wäre alles oder nichts.
    : `claude/behebung-${fund.ticketId.toLowerCase()}`

  const behebung = await prisma.behebung.create({
    data: {
      fundId: fund.id, kennung: fund.ticketId, titel: fund.title,
      klasse: body.klasse as string,
      ausgang: urteil.ausgang,
      grund: urteil.grund,
      dateien, zeilen: Number(body.zeilen ?? 0),
      begruendung: body.begruendung ?? null,
      pruefstand: (body.pruefstand ?? {}) as object,
      zweig: urteil.ausgang === 'abgelehnt' ? null : zweig,
      status: urteil.ausgang === 'abgelehnt' ? 'verworfen' : 'wartet',
    },
  })

  // §143 Die Zwischenmeldung — aber nur, wenn es wirklich länger dauert.
  //
  // Was gesammelt wird, wartet auf einen Menschen; das können Stunden sein.
  // Wer gemeldet hat, soll in der Zeit nicht im Unklaren sitzen. Bei einer
  // Kleinigkeit, die in derselben Viertelstunde rausgeht, wären zwei
  // Nachrichten hintereinander dagegen nur Lärm — und wer drei Nachrichten für
  // einen Tippfehler bekommt, stellt sie ab.
  if (urteil.ausgang === 'sammeln' && fund.userId
      && brauchtZwischenmeldung(fund.createdAt)) {
    const meldung = meldetext('dran', { kennung: fund.ticketId, titel: fund.title })
    schreibeVonOkun(fund.userId, { text: meldung.text, betreff: meldung.betreff })
      .catch(() => undefined)
  }

  return NextResponse.json({
    behebungId: behebung.id,
    ausgang: urteil.ausgang,
    grund: urteil.grund,
    zweig: urteil.ausgang === 'abgelehnt' ? null : zweig,
  }, { status: urteil.ausgang === 'abgelehnt' ? 409 : 200 })
}

/**
 * Der Lauf meldet, dass er gepusht hat.
 *
 * Erst hier wird aus einer erlaubten Behebung eine ausgerollte. Der Eintrag
 * sagt danach, was wirklich draußen ist — nicht, was erlaubt gewesen wäre.
 */
export async function PATCH(req: NextRequest) {
  const abgelehnt = pruefeSchluessel(req)
  if (abgelehnt) return abgelehnt

  const body = await req.json().catch(() => ({})) as {
    id?: string
    commit?: string
    /** Der Lauf hat eine freigegebene Behebung zusammengeführt */
    zusammengefuehrt?: boolean
  }
  if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const behebung = await prisma.behebung.findUnique({ where: { id: body.id } })
  if (!behebung) {
    return NextResponse.json({ error: 'Behebung nicht gefunden' }, { status: 404 })
  }
  if (behebung.status === 'verworfen') {
    return NextResponse.json(
      { error: 'Diese Behebung ist verworfen und wird nicht mehr angefasst.' },
      { status: 409 },
    )
  }

  // Zusammenführen darf der Lauf nur, was ein Mensch freigegeben hat.
  if (body.zusammengefuehrt && behebung.status !== 'freigegeben') {
    return NextResponse.json(
      {
        error: 'Diese Behebung ist nicht freigegeben. Sie kann nicht als '
          + 'zusammengeführt gemeldet werden.',
      },
      { status: 409 },
    )
  }

  const neuerStatus = body.zusammengefuehrt
    ? 'ausgerollt'
    : behebung.ausgang === 'direkt' ? 'ausgerollt' : 'wartet'

  const aktualisiert = await prisma.behebung.update({
    where: { id: body.id },
    data: {
      ...(body.commit ? { commit: body.commit } : {}),
      status: neuerStatus,
    },
  })

  // Was draußen ist, ist erledigt. Ein Fund, der behoben und ausgerollt ist,
  // aber weiter als offen gilt, taucht im nächsten Lauf wieder auf — und wird
  // ein zweites Mal behoben.
  if (neuerStatus === 'ausgerollt') {
    await prisma.bugReport.update({
      where: { id: behebung.fundId },
      data: {
        status: 'resolved',
        erledigtAm: new Date(),
        erledigtNotiz: [
          behebung.ausgang === 'direkt'
            ? 'Automatisch behoben und ausgerollt.'
            : 'Nach deiner Freigabe umgesetzt.',
          behebung.grund,
          aktualisiert.commit ? `Commit ${aktualisiert.commit.slice(0, 7)}.` : '',
        ].filter(Boolean).join(' '),
      },
    }).catch(() => undefined)
  }

  // §143 Und jetzt der Moment, um den es geht: „Ist behoben."
  //
  // Jemand meldet sonntags um elf, dass ein Knopf nicht funktioniert, und eine
  // Stunde später steht das hier. Das ist der Unterschied zwischen einem
  // Werkzeug, dem man etwas erzählt, und einem, dem man nichts mehr erzählt.
  if (neuerStatus === 'ausgerollt') {
    const fund = await prisma.bugReport.findUnique({
      where: { id: behebung.fundId },
      select: { userId: true, ticketId: true, title: true },
    })
    if (fund?.userId) {
      const meldung = meldetext('behoben', {
        kennung: fund.ticketId, titel: fund.title,
      })
      await schreibeVonOkun(fund.userId, {
        text: meldung.text, betreff: meldung.betreff,
      }).catch(() => undefined)
    }
  }

  return NextResponse.json({
    behebung: { id: aktualisiert.id, status: aktualisiert.status },
  })
}

/**
 * Was der Lauf wissen muss: Was hat ein Mensch inzwischen freigegeben?
 *
 * Der nächste Lauf führt diese Zweige zusammen. Ohne diese Liste bliebe eine
 * Freigabe folgenlos — der Mensch hätte zugestimmt, und nichts wäre passiert.
 */
export async function GET(req: NextRequest) {
  const abgelehnt = pruefeSchluessel(req)
  if (abgelehnt) return abgelehnt

  const freigegeben = await prisma.behebung.findMany({
    where: { status: 'freigegeben' },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    freigegeben: freigegeben.map(b => ({
      id: b.id, kennung: b.kennung, titel: b.titel, zweig: b.zweig,
      dateien: b.dateien, grund: b.grund,
    })),
    anzahl: freigegeben.length,
  })
}
