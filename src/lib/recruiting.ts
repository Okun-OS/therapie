/**
 * §148 Recruiting: Stellen, Karriereseite, Bewerber.
 *
 * WAS HIER STEHT UND WAS NICHT
 * Hier steht das Rechnen und Entscheiden: wie aus einem Titel eine Adresse
 * wird, was eine Anzeige braucht, bevor sie online darf, wann Bewerberdaten
 * zu löschen sind, welcher Stand auf welchen folgen kann. Kein Datenbank-
 * zugriff, keine Oberfläche — damit sich jede dieser Regeln einzeln prüfen
 * lässt, ohne ein System zu starten.
 *
 * DIE ENTSCHEIDENDE REGEL DIESES MODULS: BEWERBERDATEN GEHEN WIEDER WEG
 * Eine Bewerbung ist der Normalfall einer Datenverarbeitung ohne Vertrag.
 * Sobald das Verfahren beendet ist, fehlt der Zweck — und damit die
 * Rechtsgrundlage. Bleiben darf sie nur noch, solange eine Klage nach dem AGG
 * möglich ist: zwei Monate ab Zugang der Ablehnung (§15 Abs.4 AGG), plus die
 * Zeit, in der eine Klage zugestellt werden kann. Sechs Monate sind der Wert,
 * auf den sich die Aufsichtsbehörden eingependelt haben; länger nur mit
 * ausdrücklicher Einwilligung in den Bewerberpool.
 *
 * Deshalb rechnet dieses Modul die Frist mit — und `loeschreif()` ist die
 * Stelle, an der ein Aufräumlauf später ansetzt.
 */

// ── Stellen ────────────────────────────────────────────────────────────────

export const UMFAENGE = {
  vollzeit: 'Vollzeit',
  teilzeit: 'Teilzeit',
  minijob: 'Minijob',
  aushilfe: 'Aushilfe',
  ausbildung: 'Ausbildung',
  praktikum: 'Praktikum',
} as const

export type Umfang = keyof typeof UMFAENGE

/** Wie Google for Jobs die Beschäftigungsart nennt (schema.org employmentType). */
export const UMFANG_SCHEMA: Record<Umfang, string> = {
  vollzeit: 'FULL_TIME',
  teilzeit: 'PART_TIME',
  minijob: 'PART_TIME',
  aushilfe: 'PART_TIME',
  ausbildung: 'INTERN',
  praktikum: 'INTERN',
}

export const STELLEN_STAENDE = ['entwurf', 'veroeffentlicht', 'geschlossen'] as const
export type StellenStand = (typeof STELLEN_STAENDE)[number]

export const VERGUETUNG_ZEIT = {
  stunde: 'pro Stunde',
  monat: 'pro Monat',
  jahr: 'pro Jahr',
} as const

/** Wie schema.org dieselbe Einheit nennt. */
export const VERGUETUNG_SCHEMA: Record<string, string> = {
  stunde: 'HOUR',
  monat: 'MONTH',
  jahr: 'YEAR',
}

/**
 * Aus einem Titel eine Adresse machen.
 *
 * Umlaute werden ausgeschrieben und nicht weggeworfen: „Pflegefachkraft für
 * Frühdienst" soll `pflegefachkraft-fuer-fruehdienst` heißen und nicht
 * `pflegefachkraft-fr-frhdienst`. Eine Adresse liest auch ein Mensch — sie
 * steht in der Anzeige, die er weiterschickt.
 */
export function slugMachen(text: string): string {
  const ersetzt = text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '')
  return ersetzt || 'stelle'
}

/**
 * Eine Adresse eindeutig machen.
 *
 * Zwei Kitas eines Trägers suchen beide eine Erzieherin — derselbe Titel,
 * zwei Anzeigen. Ohne diesen Schritt überschriebe die zweite die erste oder
 * die Datenbank lehnte sie ab, und der Anwender bekäme einen Fehler für etwas,
 * das vollkommen normal ist.
 */
export function freierSlug(wunsch: string, vergeben: string[]): string {
  const basis = slugMachen(wunsch)
  if (!vergeben.includes(basis)) return basis
  for (let n = 2; n < 100; n++) {
    const kandidat = `${basis}-${n}`
    if (!vergeben.includes(kandidat)) return kandidat
  }
  return `${basis}-${Date.now().toString(36)}`
}

export interface StelleRoh {
  titel?: string | null
  ort?: string | null
  beschreibung?: string | null
  umfang?: string | null
  aufgaben?: string[]
  profil?: string[]
}

/**
 * Was fehlt, bevor eine Anzeige online darf.
 *
 * Bewusst eine Liste und kein `boolean`: Wer auf „Veröffentlichen" drückt und
 * nur „geht nicht" zu lesen bekommt, probiert herum. Hier steht, was fehlt.
 *
 * Die Schwelle ist niedrig gehalten — Titel, Ort und ein paar Sätze. Eine
 * Anzeige ohne Beschreibung ist keine Anzeige, alles Weitere ist Geschmack.
 */
export function fehltZumVeroeffentlichen(s: StelleRoh): string[] {
  const fehlt: string[] = []
  if (!s.titel?.trim()) fehlt.push('Ein Titel — danach sucht der Bewerber.')
  if (!s.ort?.trim()) {
    fehlt.push('Der Ort. Ohne ihn taucht die Anzeige in keiner Umkreissuche auf.')
  }
  const text = (s.beschreibung ?? '').trim()
  const stichpunkte = (s.aufgaben?.length ?? 0) + (s.profil?.length ?? 0)
  if (text.length < 80 && stichpunkte < 3) {
    fehlt.push(
      'Eine Beschreibung. Ein paar Sätze zur Stelle oder wenigstens drei '
      + 'Stichpunkte zu Aufgaben und Profil.',
    )
  }
  if (s.umfang && !(s.umfang in UMFAENGE)) fehlt.push('Ein gültiger Umfang.')
  return fehlt
}

/**
 * Was die Karriereseite selbst braucht, bevor sie online geht.
 *
 * Das Impressum steht hier und nicht als freundlicher Hinweis daneben: Eine
 * geschäftsmäßige Seite ohne Anbieterkennzeichnung verstößt gegen §5 DDG. Wer
 * eine Karriereseite einschaltet, veröffentlicht — und soll das nicht
 * versehentlich ohne Impressum tun.
 */
export function fehltZurKarriereseite(e: {
  karriereSlug?: string | null
  karriereImpressum?: string | null
}): string[] {
  const fehlt: string[] = []
  if (!e.karriereSlug?.trim()) {
    fehlt.push('Eine Adresse für die Seite — daraus wird der Link, den ihr teilt.')
  }
  if (!e.karriereImpressum?.trim()) {
    fehlt.push(
      'Ein Impressum. Eine öffentliche Unternehmensseite braucht nach §5 DDG '
      + 'eine Anbieterkennzeichnung: Name, Anschrift, Vertretungsberechtigter, '
      + 'Kontakt.',
    )
  }
  return fehlt
}

// ── Bewerbungen ────────────────────────────────────────────────────────────

export const BEWERBUNGSSTAENDE = {
  neu: 'Neu',
  gesichtet: 'Gesichtet',
  gespraech: 'Im Gespräch',
  zusage: 'Zusage',
  absage: 'Absage',
  eingestellt: 'Eingestellt',
} as const

export type Bewerbungsstand = keyof typeof BEWERBUNGSSTAENDE

/** Die Reihenfolge in der Pipeline. Absage steht daneben, nicht dahinter. */
export const PIPELINE: Bewerbungsstand[] = [
  'neu', 'gesichtet', 'gespraech', 'zusage', 'eingestellt',
]

/**
 * Welche Stände von hier aus erreichbar sind.
 *
 * Eine Absage ist von überall möglich, auch noch nach einer Zusage — Bewerber
 * springen ab, und dann muss der Stand das abbilden können. Von „eingestellt"
 * führt kein Weg zurück: Da hängt ein Mitarbeiterdatensatz dran.
 */
export function naechsteStaende(von: string): Bewerbungsstand[] {
  if (von === 'eingestellt') return []
  const alle = Object.keys(BEWERBUNGSSTAENDE) as Bewerbungsstand[]
  return alle.filter(s => s !== von && s !== 'eingestellt')
}

export function standErlaubt(von: string, nach: string): boolean {
  return naechsteStaende(von).includes(nach as Bewerbungsstand)
}

/** Ab diesem Stand ist das Verfahren beendet und die Frist läuft. */
export const BEENDET: string[] = ['absage', 'eingestellt']

/**
 * §128 Wie lange Bewerberdaten bleiben dürfen.
 *
 * Sechs Monate ab Ende des Verfahrens. Hergeleitet aus §15 Abs.4 AGG: zwei
 * Monate Geltendmachung, danach drei Monate Klagefrist (§61b ArbGG), dazu die
 * Zeit bis zur Zustellung. Sechs Monate sind die Zahl, die in den
 * Orientierungshilfen der Aufsichtsbehörden steht.
 */
export const AUFBEWAHRUNG_MONATE = 6

export function loeschenAb(statusAm: Date, monate = AUFBEWAHRUNG_MONATE): Date {
  const d = new Date(statusAm.getTime())
  const zielMonat = d.getUTCMonth() + monate
  const tag = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(zielMonat)
  // Der 31.08. plus sechs Monate ist der 28.02., nicht der 03.03.
  const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(tag, letzter))
  return d
}

/**
 * Ist diese Bewerbung löschreif?
 *
 * Eine Einstellung nie: Aus dem Bewerber ist ein Mitarbeiter geworden, und
 * seine Unterlagen folgen ab da der Personalakte. Ein Pool-Einverständnis
 * schiebt die Frist, solange es gilt.
 */
export function loeschreif(
  b: {
    status: string
    loeschenAb?: Date | null
    poolBis?: Date | null
    employeeId?: string | null
  },
  heute = new Date(),
): boolean {
  if (b.status === 'eingestellt' || b.employeeId) return false
  if (b.poolBis && b.poolBis.getTime() > heute.getTime()) return false
  if (!b.loeschenAb) return false
  return b.loeschenAb.getTime() <= heute.getTime()
}

/**
 * Eine eingehende Bewerbung prüfen.
 *
 * Läuft ungeschützt im Netz — hier kommt an, was ein Fremder abschickt. Die
 * Prüfung ist deshalb streng bei der Länge (eine Datenbank soll niemand über
 * ein Formular volllaufen lassen) und freundlich beim Rest: Wer sich bewirbt,
 * soll nicht an einer Telefonnummernvalidierung scheitern.
 */
export interface BewerbungEingang {
  name?: string | null
  email?: string | null
  telefon?: string | null
  nachricht?: string | null
  /** Honigtopf: ein Feld, das kein Mensch sieht und nur ein Automat ausfüllt */
  webseite?: string | null
}

export interface EingangsPruefung {
  ok: boolean
  fehler?: string
  /** Wortlos verwerfen — es war ein Automat. Kein Fehler für den Absender. */
  stillVerwerfen?: boolean
  werte?: { name: string; email: string; telefon: string | null; nachricht: string | null }
}

export const MAX_NACHRICHT = 5000

export function pruefeBewerbung(e: BewerbungEingang): EingangsPruefung {
  // Der Honigtopf zuerst: Ein ausgefülltes unsichtbares Feld heißt Automat.
  // Ihm wird „danke" geantwortet, damit er nicht merkt, dass er auffiel.
  if (e.webseite && String(e.webseite).trim()) {
    return { ok: false, stillVerwerfen: true }
  }

  const name = String(e.name ?? '').trim()
  const email = String(e.email ?? '').trim().toLowerCase()
  const telefon = String(e.telefon ?? '').trim() || null
  const nachricht = String(e.nachricht ?? '').trim() || null

  if (name.length < 2 || name.length > 120) {
    return { ok: false, fehler: 'Bitte trag deinen Namen ein.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
    return { ok: false, fehler: 'Diese E-Mail-Adresse sieht nicht vollständig aus.' }
  }
  if (telefon && telefon.length > 40) {
    return { ok: false, fehler: 'Die Telefonnummer ist zu lang.' }
  }
  if (nachricht && nachricht.length > MAX_NACHRICHT) {
    return {
      ok: false,
      fehler: `Die Nachricht ist zu lang (${nachricht.length} Zeichen, erlaubt `
        + `sind ${MAX_NACHRICHT}).`,
    }
  }

  return { ok: true, werte: { name, email, telefon, nachricht } }
}

// ── Für die Suchmaschinen ──────────────────────────────────────────────────

export interface StelleAnzeige {
  titel: string
  slug: string
  ort?: string | null
  plz?: string | null
  umfang: string
  beschreibung: string
  aufgaben: string[]
  profil: string[]
  wirBieten: string[]
  stundenProWoche?: number | null
  befristung: string
  befristetBis?: string | null
  beginn?: string | null
  verguetungVon?: number | null
  verguetungBis?: number | null
  verguetungZeit: string
  veroeffentlichtAm?: Date | string | null
}

/** Die Anzeige als zusammenhängender Text — für E-Mail, Feed und Vorschau. */
export function anzeigeText(s: StelleAnzeige): string {
  const teile = [s.beschreibung.trim()]
  if (s.aufgaben.length) teile.push('Deine Aufgaben:\n' + s.aufgaben.map(a => `• ${a}`).join('\n'))
  if (s.profil.length) teile.push('Das bringst du mit:\n' + s.profil.map(a => `• ${a}`).join('\n'))
  if (s.wirBieten.length) teile.push('Das bieten wir:\n' + s.wirBieten.map(a => `• ${a}`).join('\n'))
  return teile.filter(Boolean).join('\n\n')
}

/**
 * Die Anzeige als schema.org JobPosting.
 *
 * WOFÜR DAS GUT IST
 * Google for Jobs liest genau dieses Format. Eine Stellenanzeige mit korrektem
 * JobPosting erscheint in der Job-Suche — kostenlos und ohne Vertrag mit einer
 * Börse. Für einen kleinen Träger ist das der wirksamste Kanal überhaupt.
 *
 * WARUM SO PEINLICH GENAU
 * Google prüft streng: Fehlt `datePosted` oder `hiringOrganization`, wird die
 * Anzeige stillschweigend ignoriert. Man merkt nichts — es passiert nur nichts.
 */
export function jobPostingLd(
  s: StelleAnzeige,
  betrieb: { name: string; webseite?: string | null },
  adresse: { strasse?: string | null; plz?: string | null; ort?: string | null },
): Record<string, unknown> {
  const veroeffentlicht = s.veroeffentlichtAm
    ? new Date(s.veroeffentlichtAm).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: s.titel,
    description: anzeigeText(s),
    datePosted: veroeffentlicht,
    employmentType: UMFANG_SCHEMA[(s.umfang as Umfang)] ?? 'OTHER',
    hiringOrganization: {
      '@type': 'Organization',
      name: betrieb.name,
      ...(betrieb.webseite ? { sameAs: betrieb.webseite } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'DE',
        ...(adresse.strasse ? { streetAddress: adresse.strasse } : {}),
        ...(s.plz || adresse.plz ? { postalCode: s.plz ?? adresse.plz } : {}),
        ...(s.ort || adresse.ort ? { addressLocality: s.ort ?? adresse.ort } : {}),
      },
    },
  }

  if (s.befristung === 'befristet' && s.befristetBis) {
    ld.validThrough = new Date(s.befristetBis).toISOString()
  }
  if (s.verguetungVon) {
    ld.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'EUR',
      value: {
        '@type': 'QuantitativeValue',
        ...(s.verguetungBis && s.verguetungBis !== s.verguetungVon
          ? { minValue: s.verguetungVon, maxValue: s.verguetungBis }
          : { value: s.verguetungVon }),
        unitText: VERGUETUNG_SCHEMA[s.verguetungZeit] ?? 'MONTH',
      },
    }
  }
  if (s.stundenProWoche) {
    ld.workHours = `${s.stundenProWoche} Stunden pro Woche`
  }
  return ld
}

/** Die Vergütung als Satz, wie er in der Anzeige steht. */
export function verguetungText(s: {
  verguetungVon?: number | null
  verguetungBis?: number | null
  verguetungZeit: string
}): string | null {
  if (!s.verguetungVon) return null
  const einheit = VERGUETUNG_ZEIT[s.verguetungZeit as keyof typeof VERGUETUNG_ZEIT]
    ?? 'pro Monat'
  const zahl = (n: number) => n.toLocaleString('de-DE')
  if (s.verguetungBis && s.verguetungBis > s.verguetungVon) {
    return `${zahl(s.verguetungVon)} – ${zahl(s.verguetungBis)} € ${einheit}`
  }
  return `ab ${zahl(s.verguetungVon)} € ${einheit}`
}
