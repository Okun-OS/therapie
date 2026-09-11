// §100 Dateiablage — Speicherung und Zugriffsregeln für Personalunterlagen.
//
// Wo die Dateien liegen
// ---------------------
// Standardmäßig in der Datenbank. Das klingt unorthodox, ist hier aber richtig:
// Personalakten sind klein (ein Vertrag als PDF wiegt ein paar hundert Kilobyte),
// und der Dateispeicher von Railway ist nach jedem Neustart des Dienstes leer —
// für Arbeitsverträge und Krankenscheine untauglich. Die Datenbank ist der
// einzige Ort, der ohne zusätzliche Einrichtung dauerhaft hält.
//
// Für größere Mengen kann ein S3-kompatibler Speicher dazukommen (Cloudflare R2,
// Hetzner Object Storage). Dafür ist unten der Treiber-Schalter vorgesehen; der
// übrige Code kennt den Unterschied nicht.

import { prisma } from './prisma'

/** Größte erlaubte Datei. Deutlich über einem gescannten Vertrag, deutlich
 *  unter dem, was eine Datenbankzeile unangenehm macht. */
export const MAX_DATEI_BYTES = 10 * 1024 * 1024 // 10 MB

/** Erlaubte Dateitypen. Bewusst eng: Personalunterlagen sind PDFs oder Fotos.
 *  Alles Ausführbare bleibt draußen. */
export const ERLAUBTE_TYPEN: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG-Bild',
  'image/png': 'PNG-Bild',
  'image/heic': 'HEIC-Bild',
  'image/webp': 'WebP-Bild',
}

export const KATEGORIEN = {
  vertrag: 'Arbeitsvertrag',
  zeugnis: 'Zeugnis',
  bescheinigung: 'Bescheinigung',
  krankenschein: 'Arbeitsunfähigkeitsbescheinigung',
  lohnabrechnung: 'Lohnabrechnung',
  sonstiges: 'Sonstiges',
} as const

export type Kategorie = keyof typeof KATEGORIEN

/** Kategorien, die der Mitarbeiter selbst hochladen darf. Er reicht seine
 *  Krankmeldung ein — er legt sich aber keinen Arbeitsvertrag in die Akte. */
export const MITARBEITER_DARF_HOCHLADEN: Kategorie[] = ['krankenschein', 'bescheinigung']

/** Kategorien, die der Mitarbeiter immer sehen darf, sobald sie ihm gehören.
 *  Seinen eigenen Vertrag und seine Abrechnung vorzuenthalten wäre absurd. */
export const IMMER_SICHTBAR: Kategorie[] = ['vertrag', 'lohnabrechnung']

export interface DateiEingang {
  customerId: string
  locationId?: string | null
  ownerType: 'employee' | 'location'
  ownerId: string
  kategorie: Kategorie
  dateiname: string
  mimeType: string
  daten: Buffer
  hochgeladenVon: string
  hochgeladenVonName?: string | null
  notiz?: string | null
  gueltigVon?: string | null
  gueltigBis?: string | null
  sichtbarFuerMitarbeiter?: boolean
}

export interface PruefErgebnis {
  ok: boolean
  fehler?: string
}

/** Datei vor dem Speichern prüfen — Größe, Typ, Name. */
export function pruefeDatei(dateiname: string, mimeType: string, groesse: number): PruefErgebnis {
  if (groesse <= 0) return { ok: false, fehler: 'Die Datei ist leer.' }
  if (groesse > MAX_DATEI_BYTES) {
    return {
      ok: false,
      fehler: `Die Datei ist ${(groesse / 1024 / 1024).toFixed(1)} MB groß. Erlaubt sind höchstens ${MAX_DATEI_BYTES / 1024 / 1024} MB.`,
    }
  }
  if (!ERLAUBTE_TYPEN[mimeType]) {
    return {
      ok: false,
      fehler: `Dateityp „${mimeType}“ ist nicht erlaubt. Möglich sind: ${Object.values(ERLAUBTE_TYPEN).join(', ')}.`,
    }
  }
  if (!dateiname.trim()) return { ok: false, fehler: 'Die Datei hat keinen Namen.' }
  return { ok: true }
}

/**
 * Dateinamen entschärfen. Ein hochgeladener Name landet später in einem
 * Download-Header und darf dort weder Pfade noch Zeilenumbrüche einschleusen.
 */
export function sichererDateiname(roh: string): string {
  const nurName = roh.split(/[/\\]/).pop() ?? 'datei'
  return nurName
    .replace(/[\r\n"]/g, '')
    // Nur harmlose Zeichen behalten. Umlaute bleiben erhalten, alles andere
    // wird ersetzt — der Name landet später in einem Download-Header.
    .replace(/[^A-Za-z0-9ÄÖÜäöüß._ -]/g, '_')
    .slice(0, 120)
    .trim() || 'datei'
}

/** Datei ablegen. Der Treiber entscheidet, wohin der Inhalt geht. */
export async function dateiSpeichern(eingang: DateiEingang) {
  const pruefung = pruefeDatei(eingang.dateiname, eingang.mimeType, eingang.daten.length)
  if (!pruefung.ok) throw new Error(pruefung.fehler)

  const sichtbar = eingang.sichtbarFuerMitarbeiter
    ?? IMMER_SICHTBAR.includes(eingang.kategorie)

  return prisma.storedFile.create({
    data: {
      customerId: eingang.customerId,
      locationId: eingang.locationId ?? null,
      ownerType: eingang.ownerType,
      ownerId: eingang.ownerId,
      kategorie: eingang.kategorie,
      dateiname: sichererDateiname(eingang.dateiname),
      mimeType: eingang.mimeType,
      groesse: eingang.daten.length,
      treiber: 'db',
      inhalt: eingang.daten,
      sichtbarFuerMitarbeiter: sichtbar,
      hochgeladenVon: eingang.hochgeladenVon,
      hochgeladenVonName: eingang.hochgeladenVonName ?? null,
      notiz: eingang.notiz ?? null,
      gueltigVon: eingang.gueltigVon ?? null,
      gueltigBis: eingang.gueltigBis ?? null,
    },
    select: DATEI_FELDER,
  })
}

/** Felder für Listen und Antworten — NIE der Inhalt, der wird gestreamt. */
export const DATEI_FELDER = {
  id: true, customerId: true, locationId: true,
  ownerType: true, ownerId: true, kategorie: true,
  dateiname: true, mimeType: true, groesse: true,
  sichtbarFuerMitarbeiter: true,
  hochgeladenVon: true, hochgeladenVonName: true,
  notiz: true, gueltigVon: true, gueltigBis: true,
  // §130 Zu welcher Fehlzeit der Nachweis gehoert — die Liste zeigt es an
  absenceId: true,
  createdAt: true,
} as const

/** Inhalt einer Datei holen. */
export async function dateiInhalt(id: string): Promise<{ inhalt: Buffer; mimeType: string; dateiname: string } | null> {
  const datei = await prisma.storedFile.findFirst({
    where: { id, deletedAt: null },
    select: { inhalt: true, mimeType: true, dateiname: true, treiber: true },
  })
  if (!datei) return null
  if (datei.treiber !== 'db' || !datei.inhalt) return null
  return {
    inhalt: Buffer.from(datei.inhalt),
    mimeType: datei.mimeType,
    dateiname: datei.dateiname,
  }
}

/**
 * Weiches Löschen. Personalunterlagen unterliegen Aufbewahrungsfristen —
 * ein Klick darf sie nicht endgültig vernichten.
 */
export async function dateiLoeschen(id: string) {
  return prisma.storedFile.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true },
  })
}

/**
 * Darf dieser Mitarbeiter die Datei in seiner App sehen?
 * Getrennt von der Rollenprüfung, damit die Regel an einer Stelle steht und
 * testbar ist: Eigenes plus freigegeben — oder selbst eingereicht.
 */
export function mitarbeiterDarfSehen(
  datei: { ownerType: string; ownerId: string; sichtbarFuerMitarbeiter: boolean; kategorie: string; hochgeladenVon: string },
  employeeId: string,
  userId?: string,
): boolean {
  const gehoertIhm = datei.ownerType === 'employee' && datei.ownerId === employeeId
  if (!gehoertIhm) return false
  if (datei.sichtbarFuerMitarbeiter) return true
  if (IMMER_SICHTBAR.includes(datei.kategorie as Kategorie)) return true
  // Was er selbst eingereicht hat, darf er auch wiedersehen
  return datei.hochgeladenVon === employeeId || (!!userId && datei.hochgeladenVon === userId)
}
