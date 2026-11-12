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
 * §145 Der zweite feste Raum: der Hilfe-Assistent.
 *
 * Zwei Türen, die bewusst getrennt sind. Hinter der einen sitzt ein Programm,
 * das sofort antwortet und das Programm erklärt. Hinter der anderen sitzen
 * Menschen, die vielleicht erst morgen antworten, dafür aber entscheiden
 * können. Beides in einen Raum zu legen wäre bequem und falsch: Man wüsste nie,
 * ob gerade eine Maschine oder ein Mensch geantwortet hat — und würde dem
 * einen Dinge erzählen, die für den anderen gedacht waren.
 */
export const ASSISTENT_ART = 'assistent'
export const ASSISTENT_ABSENDER = 'assistent'
export const ASSISTENT_NAME = 'OKUN Assistent'

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

/** Der Schlüssel, der einen festen Raum eines Kontos eindeutig macht. */
export function kanalSchluessel(userId: string, art = OKUN_ART): string {
  return `${art}|${userId}`
}

/** Die beiden festen Räume, die jedes Konto hat. */
export const FESTE_RAEUME = [OKUN_ART, ASSISTENT_ART]

/**
 * Den Kanal eines Kontos holen — und anlegen, wenn es ihn noch nicht gibt.
 *
 * Gibt die Raumkennung zurück oder `null`, wenn dieses Konto keinen Kanal haben
 * kann: Plattformzugänge von OKUN (die schrieben sich selbst) und Konten ohne
 * Kunden.
 */
export async function okunKanal(userId: string, art = OKUN_ART): Promise<string | null> {
  const konto = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, customerId: true, locationId: true, employeeId: true, role: true },
  })
  if (!konto || konto.role === 'okun' || !konto.customerId) return null

  const schluessel = kanalSchluessel(userId, art)
  const vorhanden = await prisma.chatRaum.findUnique({ where: { schluessel } })
  if (vorhanden) return vorhanden.id

  // Zwei gleichzeitige Anfragen können beide hier landen. Der eindeutige
  // Schlüssel fängt das ab — der zweite findet den Raum des ersten.
  try {
    const raum = await prisma.chatRaum.create({
      data: {
        customerId: konto.customerId,
        locationId: konto.locationId,
        art,
        name: art === ASSISTENT_ART ? ASSISTENT_NAME : OKUN_NAME,
        beschreibung: art === ASSISTENT_ART
          ? 'Fragen zum Programm — der Assistent antwortet sofort.'
          : 'Fragen, Rückmeldungen und Störungen — direkt an OKUN.',
        schluessel,
        erstelltVon: art === ASSISTENT_ART ? ASSISTENT_ABSENDER : OKUN_ABSENDER,
        mitglieder: {
          create: [{ userId: konto.id, employeeId: konto.employeeId, rolle: 'mitglied' }],
        },
      },
    })

    // §145 Ein leeres Gespräch sagt nicht, wofür es da ist. Der erste Satz
    // steht deshalb schon drin — und er sagt auch, was der Assistent NICHT
    // kann, damit niemand ihn nach seinem Resturlaub fragt und enttäuscht wird.
    await prisma.chatNachricht.create({
      data: {
        raumId: raum.id,
        userId: art === ASSISTENT_ART ? ASSISTENT_ABSENDER : OKUN_ABSENDER,
        absenderName: art === ASSISTENT_ART ? ASSISTENT_NAME : OKUN_NAME,
        art: 'text',
        text: art === ASSISTENT_ART
          ? 'Hallo! Ich erkläre dir, wie OKUN Workforce funktioniert — wo du '
            + 'etwas findest, was eine Funktion macht, wie ein Ablauf gedacht '
            + 'ist. Frag einfach.\n\nWas ich nicht kann: in deine Daten sehen '
            + 'oder etwas ändern. Für alles, wo ein Mensch entscheiden muss, ist '
            + 'das Gespräch „OKUN Workforce" daneben da.'
          : 'Hier erreichst du OKUN direkt — bei Störungen, Fragen zur '
            + 'Abrechnung oder wenn etwas fehlt. Wir lesen mit und antworten. '
            + 'Rückmeldungen zu gemeldeten Fehlern landen ebenfalls hier.',
      },
    }).catch(() => undefined)

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

/**
 * §145 Die Antwort des Assistenten in den Raum schreiben.
 *
 * WARUM NICHT AUF DIE ANTWORT GEWARTET WIRD
 * Der Aufrufer schickt eine Nachricht ab und bekommt sie sofort zurück — so
 * steht sie im Verlauf, wie man es von jedem Messenger kennt. Die Antwort
 * kommt Sekunden später über denselben Weg wie die einer Kollegin: Die Liste
 * fragt ohnehin alle zehn Sekunden nach. Würde der Absenden-Knopf acht
 * Sekunden lang drehen, hielte man das Programm für hängen.
 *
 * WARUM BEI EINEM FEHLER TROTZDEM ETWAS DASTEHT
 * Ein Gespräch, in dem auf eine Frage gar nichts folgt, ist schlimmer als eins
 * mit einer ehrlichen Absage — man wartet, lädt neu, fragt noch einmal. Bleibt
 * die Antwort aus, schreibt der Assistent das selbst hin.
 */
export async function assistentAntwortet(raumId: string): Promise<void> {
  const { frageAssistenten, assistentEingerichtet } = await import('./assistent')

  const schreib = (text: string) => prisma.chatNachricht.create({
    data: {
      raumId, userId: ASSISTENT_ABSENDER, absenderName: ASSISTENT_NAME,
      text, art: 'text',
    },
  }).then(() => prisma.chatRaum.update({
    where: { id: raumId }, data: { letzteAktivitaet: new Date() },
  })).then(() => undefined)

  if (!assistentEingerichtet()) {
    await schreib(
      'Der Assistent ist auf dieser Anlage nicht eingerichtet. Deine Frage ist '
      + 'nicht verloren — schreib sie im Gespräch „OKUN Workforce" daneben, '
      + 'dort liest ein Mensch mit.',
    ).catch(() => undefined)
    return
  }

  // Nur die letzten Beiträge als Zusammenhang. Ein Gespräch, das seit Wochen
  // läuft, würde sonst mit jeder Frage teurer und langsamer — und was vor drei
  // Wochen gefragt wurde, hilft bei der heutigen Frage selten.
  const letzte = await prisma.chatNachricht.findMany({
    where: { raumId, art: 'text' },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { userId: true, text: true },
  })
  const verlauf = letzte.reverse().map(n => ({
    role: n.userId === ASSISTENT_ABSENDER ? ('assistant' as const) : ('user' as const),
    content: n.text,
  }))
  if (verlauf.length === 0 || verlauf[verlauf.length - 1].role !== 'user') return

  const antwort = await frageAssistenten(verlauf)
  await schreib(
    antwort
    ?? 'Da komme ich gerade nicht weiter — bitte versuch es gleich noch einmal. '
      + 'Wenn es dabei bleibt, schreib es im Gespräch „OKUN Workforce" daneben, '
      + 'dort liest ein Mensch mit.',
  ).catch(() => undefined)
}
