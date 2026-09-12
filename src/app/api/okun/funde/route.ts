import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { topf, TOPF_TEXT, brauchtFreigabe, istHeikel } from '@/lib/funde'

export const dynamic = 'force-dynamic'

/**
 * §135 Der Zugang für den regelmäßigen Lauf.
 *
 * Einmal in der Stunde wacht eine Sitzung auf, liest hier die offenen Funde,
 * arbeitet sie nach den Regeln aus `FEHLERKREISLAUF.md` ab und schreibt das
 * Ergebnis zurück. Dafür braucht sie einen eigenen Weg ins laufende System —
 * eine Anmeldung mit Benutzernamen und Passwort wäre dafür das falsche
 * Werkzeug: Sie würde ein echtes Konto und dessen volle Rechte mitbringen.
 *
 * Deshalb ein eigener Schlüssel, der GENAU ZWEI DINGE kann: offene Funde lesen
 * und ihren Bearbeitungsstand zurückschreiben. Keine Mitarbeiter, keine Löhne,
 * keine Dienstpläne. Wer den Schlüssel erbeutet, bekommt Mängelmeldungen zu
 * sehen — ärgerlich, aber kein Schaden an Menschen.
 *
 * OHNE HINTERLEGTEN SCHLÜSSEL IST DER WEG ZU. Nicht offen, nicht „erstmal
 * erlaubt": Ein Zugang, der ohne Einrichtung funktioniert, ist irgendwann ein
 * Zugang, den niemand eingerichtet hat.
 */

/** Vergleicht in gleichbleibender Zeit — sonst verrät die Dauer den Schlüssel. */
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

/** Die Zustände, in denen ein Fund noch Arbeit bedeutet. */
const OFFEN = ['open', 'wartet_freigabe', 'freigegeben', 'rueckfrage', 'in_progress']

/**
 * GET /api/okun/funde
 *
 * Liefert die offenen Funde, jeden schon einsortiert: Was kann ohne Rückfrage
 * erledigt werden, was braucht eine Bestätigung, was wartet auf eine Freigabe,
 * wo fehlt eine Angabe. Die Einsortierung passiert hier und nicht im Lauf —
 * so gilt für den Lauf dieselbe Regel wie für die Oberfläche.
 */
export async function GET(req: NextRequest) {
  const abgelehnt = pruefeSchluessel(req)
  if (abgelehnt) return abgelehnt

  const funde = await prisma.bugReport.findMany({
    where: { status: { in: OFFEN } },
    orderBy: [{ heikel: 'desc' }, { createdAt: 'asc' }],
    take: 100,
  })

  const aufbereitet = funde.map(f => {
    const t = topf(f)
    return {
      id: f.id,
      kennung: f.ticketId,
      topf: t,
      topfText: TOPF_TEXT[t],
      status: f.status,
      art: f.art,
      bereich: f.bereich,
      ebene: f.ebene,
      heikel: istHeikel(f.bereich, f.heikel),
      freigabe: f.freigabe,
      meldeQualitaet: f.meldeQualitaet,
      titel: f.title,
      schritte: f.schritte,
      passiert: f.description,
      erwartet: f.erwartet,
      haeufigkeit: f.haeufigkeit,
      seite: f.page,
      version: f.version,
      letzteKlicks: f.lastActions,
      konsolenfehler: f.consoleErrors,
      rueckfrage: f.rueckfrage,
      antwort: f.antwort,
      vorschlag: f.vorschlag,
      gemeldetVon: f.userName,
      gemeldetAm: f.createdAt.toISOString(),
    }
  })

  // Die Zusammenfassung steht mit in der Antwort, damit der Lauf nicht selbst
  // zählen muss — und damit beide Seiten dieselbe Zahl nennen.
  const zusammenfassung = {
    gesamt: aufbereitet.length,
    selbst: aufbereitet.filter(f => f.topf === 'selbst').length,
    vorschlag: aufbereitet.filter(f => f.topf === 'vorschlag').length,
    freigabe: aufbereitet.filter(f => f.topf === 'freigabe').length,
    rueckfrage: aufbereitet.filter(f => f.topf === 'rueckfrage').length,
  }

  return NextResponse.json({ funde: aufbereitet, zusammenfassung })
}

/**
 * PATCH /api/okun/funde
 *
 * Das Ergebnis zurückschreiben. Mehr als diese vier Felder darf der Lauf nicht
 * ändern — insbesondere nicht die Freigabe. Die bleibt eine Entscheidung von
 * Menschen, und ein Programm, das sich seine eigene Freigabe erteilen kann,
 * hätte keine.
 */
export async function PATCH(req: NextRequest) {
  const abgelehnt = pruefeSchluessel(req)
  if (abgelehnt) return abgelehnt

  const body = await req.json().catch(() => ({})) as {
    id?: string
    vorschlag?: string
    rueckfrage?: string
    erledigtNotiz?: string
    inArbeit?: boolean
  }
  if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const fund = await prisma.bugReport.findUnique({ where: { id: body.id } })
  if (!fund) return NextResponse.json({ error: 'Fund nicht gefunden' }, { status: 404 })

  // §135 Ein Vorschlag zu etwas, das noch nicht freigegeben ist, darf nicht
  // heimlich zur Umsetzung werden. Der Lauf darf ihn aufschreiben — mehr nicht.
  if (body.erledigtNotiz && brauchtFreigabe(fund.art) && fund.freigabe !== 'freigegeben') {
    return NextResponse.json(
      {
        error: 'Dieser Vorschlag ist nicht freigegeben. Er kann nicht als erledigt '
          + 'gemeldet werden, solange niemand ihn freigegeben hat.',
      },
      { status: 409 },
    )
  }

  const aktualisiert = await prisma.bugReport.update({
    where: { id: body.id },
    data: {
      ...(body.vorschlag !== undefined ? { vorschlag: body.vorschlag } : {}),
      ...(body.rueckfrage !== undefined
        ? { rueckfrage: body.rueckfrage, status: 'rueckfrage' } : {}),
      ...(body.erledigtNotiz !== undefined
        ? { erledigtNotiz: body.erledigtNotiz, erledigtAm: new Date(), status: 'resolved' }
        : {}),
      ...(body.inArbeit && !body.erledigtNotiz && !body.rueckfrage
        ? { status: 'in_progress' } : {}),
    },
  })

  return NextResponse.json({ fund: { id: aktualisiert.id, status: aktualisiert.status } })
}
