import { createHash } from 'node:crypto'
import { prisma } from './prisma'
import {
  sperrlage, fensterBeginn, absenderadresse, adresskuerzel,
  type Sperrlage,
} from './anmeldeschutz'

/**
 * §152 Die Bremse an der Datenbank — getrennt von den Regeln.
 *
 * Die Regeln stehen in `anmeldeschutz.ts` und sind ohne Datenbank prüfbar.
 * Hier steht nur das Zählen, Nachschlagen und Wegräumen.
 */

/**
 * Das Geheimnis, mit dem die Absenderadresse gesalzen wird.
 *
 * Bewusst dasselbe wie für die Sitzungen: Wer es hat, hat ohnehin alles. Ein
 * zweites Geheimnis wäre eine zweite Sache, die beim Einrichten vergessen
 * werden kann — und ein vergessenes Salz ist schlimmer als ein geteiltes.
 */
function salz(): string {
  return process.env.SESSION_SECRET ?? 'entwicklung-ohne-geheimnis'
}

const kuerzel = (adresse: string) =>
  adresskuerzel(adresse, salz(), t => createHash('sha256').update(t).digest('hex'))

export interface Anmeldekennung {
  /** Kleingeschriebene E-Mail */
  konto: string
  /** Gesalzenes Kürzel der Absenderadresse */
  adresse: string
}

export function kennungAus(email: string, kopf: { get(n: string): string | null }): Anmeldekennung {
  return {
    konto: String(email ?? '').trim().toLowerCase(),
    adresse: kuerzel(absenderadresse(kopf)),
  }
}

/**
 * Ist diese Anmeldung gerade gesperrt?
 *
 * Wird VOR der Passwortprüfung aufgerufen. Sonst liefe bei jedem Versuch ein
 * bcrypt-Vergleich — und genau den will ein Angreifer auslösen, weil er teuer
 * ist. Die Bremse wäre dann selbst der Hebel für eine Überlastung.
 */
export async function pruefeSperre(k: Anmeldekennung): Promise<Sperrlage> {
  const seit = fensterBeginn()

  const [konto, adresse, aeltester] = await Promise.all([
    prisma.anmeldeversuch.count({
      where: { art: 'konto', kennung: k.konto, createdAt: { gte: seit } },
    }),
    prisma.anmeldeversuch.count({
      where: { art: 'adresse', kennung: k.adresse, createdAt: { gte: seit } },
    }),
    prisma.anmeldeversuch.findFirst({
      where: {
        createdAt: { gte: seit },
        OR: [
          { art: 'konto', kennung: k.konto },
          { art: 'adresse', kennung: k.adresse },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  return sperrlage({ konto, adresse, aeltester: aeltester?.createdAt ?? null })
}

/** Einen Fehlversuch zählen — je Konto und je Adresse eine Zeile. */
export async function zaehleFehlversuch(k: Anmeldekennung): Promise<void> {
  await prisma.anmeldeversuch.createMany({
    data: [
      { art: 'konto', kennung: k.konto },
      { art: 'adresse', kennung: k.adresse },
    ],
  }).catch(() => undefined)
}

/**
 * Nach einer gelungenen Anmeldung wird der Zähler dieses Kontos geleert.
 *
 * Nicht der der Adresse: Wer aus einem Botnetz Konten durchprobiert und dabei
 * eines trifft, hätte sich sonst mit dem Treffer selbst entsperrt.
 */
export async function versucheLoeschen(k: Anmeldekennung): Promise<void> {
  await prisma.anmeldeversuch.deleteMany({
    where: { art: 'konto', kennung: k.konto },
  }).catch(() => undefined)
}

/**
 * Alte Zeilen wegräumen.
 *
 * Nebenbei bei jedem Fehlversuch, nicht als eigener Lauf: Die Tabelle wächst
 * nur, wenn jemand sich vertippt, und dann ist ohnehin gerade jemand da, der
 * die Arbeit mitmachen kann. Ein stündlicher Lauf für ein paar Zeilen wäre
 * mehr Betriebsaufwand, als er einspart.
 */
export async function alteVersucheWegraeumen(): Promise<void> {
  await prisma.anmeldeversuch.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
  }).catch(() => undefined)
}
