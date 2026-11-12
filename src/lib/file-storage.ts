import { randomBytes } from 'crypto'
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

/**
 * §221 Was im Chat erlaubt ist — und warum das eine eigene Liste ist.
 *
 * `ERLAUBTE_TYPEN` oben gilt für die Personalakte. Dort gehören Verträge,
 * Zeugnisse und Bescheinigungen hin, und genau deshalb steht da kein Ton und
 * kein Tabellenblatt: Eine Akte, in die alles darf, ist keine Akte.
 *
 * Im Chat ist es umgekehrt. Dort wird ein Foto vom Dienstplan an der Wand
 * geschickt, eine Sprachnachricht, wenn die Hände voll sind, und eine PDF vom
 * Träger. Diese Liste zu verengen hieße, Menschen zurück auf WhatsApp zu
 * schicken — und dort liegen die Daten dann wirklich falsch.
 *
 * Was NICHT drinsteht, ist ebenso bewusst: nichts Ausführbares, keine
 * Archive. Eine Datei, die beim Öffnen etwas tut, gehört nicht in ein
 * Postfach, das jeder im Betrieb erreicht.
 */
export const CHAT_TYPEN: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG-Bild',
  'image/png': 'PNG-Bild',
  'image/heic': 'HEIC-Bild',
  'image/webp': 'WebP-Bild',
  'image/gif': 'GIF-Bild',
  'audio/mpeg': 'MP3-Aufnahme',
  'audio/mp4': 'M4A-Aufnahme',
  'audio/aac': 'AAC-Aufnahme',
  'audio/ogg': 'OGG-Aufnahme',
  'audio/webm': 'Sprachnachricht',
  'audio/wav': 'WAV-Aufnahme',
  'video/mp4': 'MP4-Video',
  'video/quicktime': 'MOV-Video',
  'text/plain': 'Textdatei',
  'application/msword': 'Word-Dokument',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word-Dokument',
  'application/vnd.ms-excel': 'Excel-Tabelle',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel-Tabelle',
}

/** §221 Für Tondateien und Videos reichen zehn Megabyte nicht. */
export const MAX_CHAT_BYTES = 25 * 1024 * 1024

export function pruefeChatDatei(
  dateiname: string, mimeType: string, groesse: number,
): PruefErgebnis {
  if (groesse <= 0) return { ok: false, fehler: 'Die Datei ist leer.' }
  if (groesse > MAX_CHAT_BYTES) {
    return {
      ok: false,
      fehler: `Die Datei ist ${(groesse / 1024 / 1024).toFixed(1)} MB groß. `
        + `Im Chat sind höchstens ${MAX_CHAT_BYTES / 1024 / 1024} MB möglich.`,
    }
  }
  if (!CHAT_TYPEN[mimeType]) {
    return {
      ok: false,
      fehler: `Dateien dieser Art lassen sich hier nicht verschicken (${mimeType}). `
        + 'Möglich sind Bilder, Tonaufnahmen, Videos, PDF und Office-Dateien.',
    }
  }
  if (!dateiname.trim()) return { ok: false, fehler: 'Die Datei hat keinen Namen.' }
  return { ok: true }
}

export const KATEGORIEN = {
  vertrag: 'Arbeitsvertrag',
  zeugnis: 'Zeugnis',
  bescheinigung: 'Bescheinigung',
  krankenschein: 'Arbeitsunfähigkeitsbescheinigung',
  lohnabrechnung: 'Lohnabrechnung',
  // §148 Was ein Bewerber mitgeschickt hat. Bleibt nach der Übernahme in der
  // Akte — deshalb eine eigene Kategorie und nicht „Sonstiges": Man soll
  // später sehen, dass diese Unterlagen aus der Bewerbung stammen.
  bewerbung: 'Bewerbungsunterlagen',
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

/**
 * §260 Ein Platz im Objektspeicher — der Name, unter dem die Datei dort liegt.
 *
 * WARUM NICHT DER DATEINAME
 * Weil zwei Menschen denselben Dateinamen hochladen („IMG_0427.jpg") und sich
 * sonst gegenseitig überschrieben. Und weil der Name in der Adresse stünde:
 * `…/krankenschein-mueller.pdf` verrät etwas, bevor jemand die Datei öffnet.
 *
 * Der Schlüssel ist stattdessen zufällig. Die Endung bleibt dran, damit sich
 * eine Datei im Speicher noch einordnen lässt, wenn die Datenbank einmal
 * danebenliegt — mehr nicht.
 *
 * Der Ordner vorn trennt die Verwendungszwecke: Wer später aufräumen oder eine
 * Löschfrist durchsetzen will, braucht das.
 */
export function objektSchluessel(bereich: string, dateiname: string): string {
  const endung = (dateiname.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? '').toLowerCase()
  const zufall = randomBytes(16).toString('hex')
  const heute = new Date().toISOString().slice(0, 10)
  return `${bereich}/${heute}/${zufall}${endung ? `.${endung}` : ''}`
}

/**
 * §260 Einen Datensatz für eine Datei anlegen, die bereits IM SPEICHER liegt.
 *
 * Das Gegenstück zu `dateiSpeichern`: Dort geht der Inhalt durch die Anwendung
 * in die Datenbank, hier hat ihn das Telefon schon direkt abgelegt und es wird
 * nur noch vermerkt, wo er liegt.
 *
 * WARUM DIE GRÖSSE ÜBERGEBEN WIRD UND NICHT GEMESSEN
 * Weil die Anwendung die Datei nie sieht — das ist der ganze Zweck. Die Zahl
 * kommt vom Browser und ist damit eine Behauptung; sie dient der Anzeige, nicht
 * einer Prüfung. Die wirkliche Grenze zieht die ausgestellte Adresse: Sie gilt
 * fünf Minuten, nur für diesen einen Schlüssel und nur für diesen einen Typ.
 */
/**
 * §261 Hängt an diesem Platz schon ein Eintrag?
 *
 * Die Unterschrift über einen Platz gilt eine halbe Stunde. Wer sie in dieser
 * Zeit zweimal einlöst, bekäme zwei Einträge auf EINE Datei — und sobald
 * jemand den einen löscht, zeigt der andere ins Leere. Das muss nicht
 * passieren: Ein Platz wird einmal ausgegeben und einmal eingelöst.
 */
export async function objektSchonVermerkt(objektSchluessel: string): Promise<boolean> {
  const da = await prisma.storedFile.findFirst({
    where: { objektSchluessel }, select: { id: true },
  })
  return Boolean(da)
}

/**
 * §261 Dasselbe, nachdem die Datenbank es abgelehnt hat.
 *
 * Zwischen `objektSchonVermerkt` und dem Anlegen liegt ein Spalt: Zwei
 * Anfragen im selben Augenblick kämen beide durch das Nachsehen. Den Spalt
 * schließt der eindeutige Index — und der meldet sich als P2002.
 *
 * Für den Menschen ist das derselbe Fall wie oben, also soll auch dieselbe
 * Antwort kommen und nicht eine 500 mit Kennung.
 */
export function istSchonVermerkt(fehler: unknown): boolean {
  const code = (fehler as { code?: unknown } | null)?.code
  if (code !== 'P2002') return false
  const ziel = (fehler as { meta?: { target?: unknown } }).meta?.target
  const felder = Array.isArray(ziel) ? ziel.map(String) : [String(ziel ?? '')]
  return felder.some(f => f.includes('objektSchluessel'))
}

export async function objektSpeichern(eingang: Omit<DateiEingang, 'daten'> & {
  objektSchluessel: string
  groesse: number
  pruefen?: (name: string, typ: string, groesse: number) => PruefErgebnis
}) {
  const pruefer = eingang.pruefen ?? pruefeDatei
  const pruefung = pruefer(eingang.dateiname, eingang.mimeType, eingang.groesse)
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
      groesse: eingang.groesse,
      // §260 Der Unterschied zu `dateiSpeichern`: kein Inhalt in der
      // Datenbank, dafür der Verweis in den Objektspeicher.
      treiber: 'r2',
      inhalt: null,
      objektSchluessel: eingang.objektSchluessel,
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

/** Datei ablegen. Der Treiber entscheidet, wohin der Inhalt geht. */
export async function dateiSpeichern(eingang: DateiEingang & {
  /**
   * §221 Eine andere Prüfung als die der Personalakte.
   *
   * Der Chat lässt Ton, Video und Office-Dateien zu, die Akte nicht. Statt
   * die eine Liste aufzuweichen — und damit beides zu erlauben, wo nur eines
   * gemeint war — wird die Prüfung hier übergeben.
   */
  pruefen?: (name: string, typ: string, groesse: number) => PruefErgebnis
}) {
  const pruefer = eingang.pruefen ?? pruefeDatei
  const pruefung = pruefer(eingang.dateiname, eingang.mimeType, eingang.daten.length)
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

/**
 * Wo eine Datei liegt — ohne sie zu holen.
 *
 * §261 Für die Stellen, die umleiten können statt durchzureichen. Das ist der
 * ganze Zweck des Objektspeichers: Die Datei läuft nicht durch die Anwendung,
 * Railway zählt keinen ausgehenden Verkehr dafür, und kein Arbeitsspeicher
 * wird für 20 MB Video vorgehalten.
 */
export async function dateiOrt(id: string): Promise<
  | { art: 'db'; mimeType: string; dateiname: string }
  | { art: 'r2'; objektSchluessel: string; mimeType: string; dateiname: string }
  | null
> {
  const datei = await prisma.storedFile.findFirst({
    where: { id, deletedAt: null },
    select: { mimeType: true, dateiname: true, treiber: true, objektSchluessel: true },
  })
  if (!datei) return null
  if (datei.treiber === 'r2' && datei.objektSchluessel) {
    return {
      art: 'r2',
      objektSchluessel: datei.objektSchluessel,
      mimeType: datei.mimeType,
      dateiname: datei.dateiname,
    }
  }
  return { art: 'db', mimeType: datei.mimeType, dateiname: datei.dateiname }
}

/**
 * Inhalt einer Datei holen.
 *
 * §261 Liegt sie im Objektspeicher, wird sie von dort geholt.
 *
 * WARUM DIESE STELLE DEN UMWEG MITMACHT, OBWOHL ER TEUER IST
 * Weil es Aufrufer gibt, die den Inhalt WIRKLICH brauchen und nicht umleiten
 * können: eine Belehrung, die in ein Schriftstück eingesetzt wird, eine
 * Bewerbungsunterlage in einem Archiv. Ohne diesen Zweig hätten die nach dem
 * Umzug einer Datei still „Inhalt nicht verfügbar" gemeldet — und das fällt
 * erst Wochen später auf, wenn jemand eine alte Unterlage sucht. Genau solche
 * stillen Lücken sind in diesem Vorhaben mehrfach teuer geworden.
 *
 * Wer umleiten kann, nimmt `dateiOrt`.
 */
export async function dateiInhalt(id: string): Promise<{ inhalt: Buffer; mimeType: string; dateiname: string } | null> {
  const datei = await prisma.storedFile.findFirst({
    where: { id, deletedAt: null },
    select: {
      inhalt: true, mimeType: true, dateiname: true, treiber: true,
      objektSchluessel: true,
    },
  })
  if (!datei) return null

  if (datei.treiber === 'r2' && datei.objektSchluessel) {
    const { objektHolen } = await import('./r2')
    const inhalt = await objektHolen(datei.objektSchluessel)
    if (!inhalt) return null
    return { inhalt, mimeType: datei.mimeType, dateiname: datei.dateiname }
  }

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
