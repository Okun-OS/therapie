import { prisma } from './prisma'
import { sendEmail } from './email'

/**
 * §143 Der Draht zwischen OKUN und dem einzelnen Menschen im Betrieb.
 *
 * WARUM DAS KEIN GEWÖHNLICHER DIREKTCHAT IST
 * Direktchats sind unantastbar (§129) — ein Gespräch zwischen zwei Personen
 * ist für niemanden sonst einsehbar, auch nicht für OKUN. Genau deshalb sitzt
 * OKUN nicht als Teilnehmer in einem Kundenraum. Der Kanal hier ist eine
 * eigene Art (`okun`): ein Raum mit genau einem menschlichen Mitglied, in den
 * OKUN hineinschreibt und aus dem heraus geschrieben wird.
 *
 * Damit bleibt die Grenze, wo sie war: OKUN liest keine Gespräche mit, sondern
 * hat eine eigene Tür.
 *
 * WARUM IM CHAT UND NICHT IM BENACHRICHTIGUNGS-POSTFACH
 * Weil eine Rückmeldung auf einen gemeldeten Fehler eine Antwort ist und keine
 * Systemmeldung. Sie gehört dorthin, wo man antworten kann — und sie soll
 * genau dort liegen, wo sie beim nächsten Öffnen wieder auffindbar ist. Das
 * Postfach für Benachrichtigungen ist nach zwei Tagen zugeschüttet.
 *
 * WAS HIER NICHT PASSIERT
 * Es wird nichts an OKUN weitergeleitet, was jemand einer Kollegin schreibt.
 * Nur was IN diesem Kanal steht, geht raus — und das steht als Absicht darüber.
 */

/** Der Absender, unter dem OKUN in diesem Kanal auftritt. */
export const OKUN_ABSENDER = 'okun'
export const OKUN_NAME = 'OKUN Workforce'

/** Die Art des Raums. Bewusst nicht `direkt` — siehe oben. */
export const OKUN_ART = 'okun'

/**
 * Wohin eine Nachricht aus dem Kanal geht.
 *
 * Ohne Anschrift wird nichts verschickt und nichts kaputtgemacht: Der Versand
 * schreibt eine Zeile ins Protokoll. Die Nachricht steht trotzdem im Kanal —
 * sie ist nicht verloren, sie wartet nur.
 */
export function okunAnschrift(): string | null {
  return process.env.OKUN_SUPPORT_EMAIL?.trim() || null
}

/** Der Schlüssel, der den Kanal eines Kontos eindeutig macht. */
export function kanalSchluessel(userId: string): string {
  return `okun|${userId}`
}

/**
 * Den Kanal eines Kontos holen — und anlegen, wenn es ihn noch nicht gibt.
 *
 * Gibt die Raumkennung zurück oder `null`, wenn dieses Konto keinen Kanal haben
 * kann: Plattformzugänge von OKUN (die schrieben sich selbst) und Konten ohne
 * Kunden.
 */
export async function okunKanal(userId: string): Promise<string | null> {
  const konto = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, customerId: true, locationId: true, employeeId: true, role: true },
  })
  if (!konto || konto.role === 'okun' || !konto.customerId) return null

  const schluessel = kanalSchluessel(userId)
  const vorhanden = await prisma.chatRaum.findUnique({ where: { schluessel } })
  if (vorhanden) return vorhanden.id

  // Zwei gleichzeitige Anfragen können beide hier landen. Der eindeutige
  // Schlüssel fängt das ab — der zweite findet den Raum des ersten.
  try {
    const raum = await prisma.chatRaum.create({
      data: {
        customerId: konto.customerId,
        locationId: konto.locationId,
        art: OKUN_ART,
        name: OKUN_NAME,
        beschreibung: 'Fragen, Rückmeldungen und Störungen — direkt an OKUN.',
        schluessel,
        erstelltVon: OKUN_ABSENDER,
        mitglieder: {
          create: [{ userId: konto.id, employeeId: konto.employeeId, rolle: 'mitglied' }],
        },
      },
    })
    return raum.id
  } catch {
    const nachtraeglich = await prisma.chatRaum.findUnique({ where: { schluessel } })
    return nachtraeglich?.id ?? null
  }
}

export interface OkunPost {
  /** Der Text im Kanal */
  text: string
  /** Zusätzlich als E-Mail — Betreff; ohne ihn bleibt es beim Kanal */
  betreff?: string
  /** Wohin der Knopf in der E-Mail führt */
  ziel?: string
  zielText?: string
}

/**
 * Eine Nachricht von OKUN an ein Konto.
 *
 * Der Kanal ist der verlässliche Weg, die E-Mail der laute. Beides zusammen,
 * weil der eine Fall, der hier zählt, sonst nicht funktioniert: Jemand meldet
 * sonntags um elf einen Fehler und macht das Programm zu. Eine Nachricht, die
 * er erst beim nächsten Anmelden sieht, kommt zu spät, um zu beeindrucken.
 */
export async function schreibeVonOkun(userId: string, post: OkunPost): Promise<boolean> {
  const raumId = await okunKanal(userId)
  if (!raumId) return false

  await prisma.chatNachricht.create({
    data: {
      raumId,
      userId: OKUN_ABSENDER,
      absenderName: OKUN_NAME,
      text: post.text,
      art: 'text',
    },
  })
  await prisma.chatRaum.update({
    where: { id: raumId },
    data: { letzteAktivitaet: new Date() },
  })

  if (post.betreff) {
    const konto = await prisma.user.findUnique({
      where: { id: userId }, select: { email: true },
    })
    if (konto?.email) {
      await sendEmail(konto.email, post.betreff, post.text, {
        ctaUrl: post.ziel, ctaLabel: post.zielText,
      }).catch(() => undefined)
    }
  }

  return true
}

/**
 * Was ein Mensch in diesen Kanal schreibt, geht bei OKUN als E-Mail ein.
 *
 * Bewusst E-Mail und kein zweites Postfach im Programm: Eine Störung meldet
 * man, damit jemand sie liest — und OKUN sitzt nicht den ganzen Tag in einer
 * Oberfläche, die es selbst gebaut hat. Ein Kanal, in den hineingeschrieben
 * wird, ohne dass es ankommt, ist schlimmer als gar keiner.
 */
export async function weiterleitenAnOkun(
  absender: { name: string; email?: string | null; rolle?: string | null },
  kunde: string | null,
  text: string,
): Promise<void> {
  const anschrift = okunAnschrift()
  const betreff = `Nachricht von ${absender.name}${kunde ? ` (${kunde})` : ''}`
  const inhalt = [
    text,
    '',
    '—',
    `${absender.name}${absender.rolle ? `, ${absender.rolle}` : ''}`,
    absender.email ?? '',
    kunde ?? '',
  ].filter(Boolean).join('\n')

  if (!anschrift) {
    console.log(`[okun-kanal:entwicklung] ${betreff}\n${inhalt}`)
    return
  }
  await sendEmail(anschrift, betreff, inhalt).catch(() => undefined)
}
