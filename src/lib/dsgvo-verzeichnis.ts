import { DATENARTEN, BEHANDLUNG_TEXT, type Datenart } from './dsgvo-katalog'
import { MASSNAHMEN, offenePunkte } from './dsgvo-tom'

/**
 * §152 Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO).
 *
 * ZWEI VERZEICHNISSE, NICHT EINS
 * Art. 30 kennt zwei Rollen, und wir sind beide:
 *
 *   Abs. 1 — DER VERANTWORTLICHE. Das ist der KUNDE. Er entscheidet, warum
 *   die Daten seiner Mitarbeiter verarbeitet werden. Sein Verzeichnis muss er
 *   führen, nicht wir — aber wir wissen als Einzige genau, was in welcher
 *   Tabelle liegt und wie lange. Deshalb erzeugen wir es ihm. Das ist kein
 *   Gefallen, sondern der Grund, warum ein Betrieb ein solches Programm
 *   überhaupt kauft: Er bekommt eine Pflicht erledigt, statt eine neue zu
 *   bekommen.
 *
 *   Abs. 2 — DER AUFTRAGSVERARBEITER. Das sind WIR. Unser Verzeichnis ist
 *   kürzer und sagt andere Dinge: für wen wir verarbeiten, welche Arten von
 *   Verarbeitung wir übernehmen, wen wir als Unterauftragnehmer einsetzen und
 *   ob Daten in Drittländer gehen.
 *
 * WARUM DAS AUS DEM DATENKATALOG WÄCHST
 * Weil ein von Hand gepflegtes Verzeichnis nach dem dritten neuen Feature
 * unvollständig ist — und ein unvollständiges Verzeichnis ist bei einer
 * Prüfung schlechter als ein fehlendes, weil es Sorgfalt behauptet, die nicht
 * stattgefunden hat. Der Katalog (§128) wird schon durch einen Test gegen das
 * Datenbankschema gehalten. Was dort fehlt, fällt auf; was dort steht, steht
 * damit auch hier.
 */

// ── Wer wir sind ───────────────────────────────────────────────────────────

/**
 * Die Angaben über OKUN selbst.
 *
 * Aus der Umgebung und nicht einprogrammiert: Anschrift und
 * Vertretungsberechtigter ändern sich, und ein Firmensitz im Quelltext wird
 * beim Umzug garantiert vergessen. Fehlt etwas, sagt das Verzeichnis das
 * ausdrücklich — statt eine Lücke als Leerzeile zu tarnen.
 */
export interface Anbieter {
  name: string
  anschrift: string | null
  vertreten: string | null
  kontakt: string | null
  datenschutzbeauftragter: string | null
}

export function anbieter(): Anbieter {
  const wert = (n: string) => process.env[n]?.trim() || null
  return {
    name: wert('OKUN_FIRMA') ?? 'OKUN Workforce',
    anschrift: wert('OKUN_ANSCHRIFT'),
    vertreten: wert('OKUN_VERTRETEN'),
    kontakt: wert('OKUN_KONTAKT') ?? wert('OKUN_SUPPORT_EMAIL'),
    datenschutzbeauftragter: wert('OKUN_DSB'),
  }
}

/** Was dem Anbieterblock noch fehlt, damit das Verzeichnis vollständig ist. */
export function fehltAmAnbieter(a = anbieter()): string[] {
  const fehlt: string[] = []
  if (!a.anschrift) fehlt.push('Anschrift des Anbieters (OKUN_ANSCHRIFT)')
  if (!a.vertreten) fehlt.push('Vertretungsberechtigte Person (OKUN_VERTRETEN)')
  if (!a.kontakt) fehlt.push('Kontaktadresse für Betroffene (OKUN_KONTAKT)')
  // Der Datenschutzbeauftragte ist nicht für jeden Betrieb Pflicht (§38 BDSG:
  // ab zwanzig Personen mit ständiger automatisierter Verarbeitung). Deshalb
  // ein Hinweis und keine Fehlmeldung.
  return fehlt
}

// ── Unterauftragsverarbeiter ───────────────────────────────────────────────

export type Vertragsstand = 'geschlossen' | 'offen' | 'nicht_noetig'

export interface Unterauftrag {
  name: string
  zweck: string
  /** Wo die Daten liegen bzw. verarbeitet werden */
  ort: string
  /** Welche Daten ihn überhaupt erreichen */
  daten: string
  vertrag: Vertragsstand
  /** Wo der Vertrag zu finden ist */
  quelle?: string
  /** Nur wenn Daten die EU verlassen: worauf sich die Übermittlung stützt */
  drittland?: string
}

/**
 * Die Dienstleister, die Kundendaten sehen können.
 *
 * WER HIER NICHT STEHT
 * Dienste, die keine Personendaten erreichen. Das ist kein Weglassen, sondern
 * die richtige Abgrenzung — Art. 28 gilt für die Verarbeitung von
 * Personendaten, nicht für jedes eingekaufte Werkzeug.
 *
 * WARUM DER VERTRAGSSTAND DRINSTEHT
 * Damit die Lücke sichtbar ist, solange sie besteht. Ein Verzeichnis, in dem
 * alle Dienstleister ohne Stand aufgezählt sind, liest sich wie „alles
 * geregelt" — und genau das war es zum Zeitpunkt dieser Zeile nicht.
 */
export const UNTERAUFTRAEGE: Unterauftrag[] = [
  {
    name: 'Railway Corp.',
    zweck: 'Betrieb des Programms und der Datenbank (Hosting)',
    ort: 'Rechenzentrum in der EU',
    daten:
      'Alle im Programm gespeicherten Daten — Stammdaten, Arbeitszeiten, '
      + 'Abwesenheiten, Lohndaten, Personalunterlagen.',
    vertrag: 'offen',
    quelle: 'https://railway.com/legal/dpa',
  },
  {
    name: 'Resend, Inc.',
    zweck: 'Versand von E-Mails (Einladungen, Benachrichtigungen, Lohnbelege)',
    ort: 'USA',
    daten: 'Name, E-Mail-Adresse und der Inhalt der jeweiligen Nachricht.',
    vertrag: 'offen',
    drittland:
      'Übermittlung in die USA. Zu stützen auf das EU-US Data Privacy '
      + 'Framework, soweit der Anbieter zertifiziert ist, sonst auf '
      + 'Standardvertragsklauseln samt Folgenabschätzung.',
  },
  {
    name: 'Twilio Inc.',
    zweck: 'SMS für den zweiten Anmeldefaktor',
    ort: 'USA',
    daten: 'Mobilfunknummer und der einmalige Zahlencode.',
    vertrag: 'offen',
    quelle: 'https://www.twilio.com/legal/data-protection-addendum',
    drittland: 'Wie bei Resend. Wird nur genutzt, wenn der SMS-Faktor eingeschaltet ist.',
  },
  {
    name: 'Anthropic PBC',
    zweck:
      'Sprachmodell für den Hilfe-Assistenten und die Unterstützung bei der '
      + 'Einrichtung',
    ort: 'USA',
    daten:
      'Der Text der jeweiligen Frage. Der Assistent hat KEINEN Zugriff auf '
      + 'Betriebsdaten — er erklärt das Programm und liest keine Datenbank.',
    vertrag: 'offen',
    drittland:
      'Übermittlung in die USA, zu stützen wie oben. Eine Nutzung der Inhalte '
      + 'zum Training ist vertraglich auszuschließen.',
  },
  {
    name: 'Google Ireland Ltd. (Firebase Cloud Messaging)',
    zweck: 'Benachrichtigungen an die App aus dem Store',
    ort: 'EU, mit Weiterleitung an Apple (APNs) für iPhones',
    daten:
      'Die Gerätekennung und der Text der Benachrichtigung. Personenbezogene '
      + 'Inhalte gehören deshalb nicht in den Text einer Benachrichtigung.',
    vertrag: 'offen',
  },
]

export function offeneVertraege(): Unterauftrag[] {
  return UNTERAUFTRAEGE.filter(u => u.vertrag === 'offen')
}

// ── Art. 30 Abs. 2 — OKUN als Auftragsverarbeiter ──────────────────────────

export interface VerzeichnisAbs2 {
  stand: string
  auftragsverarbeiter: Anbieter
  /** Für wen verarbeitet wird */
  auftraggeber: string
  /** Art. 30 Abs. 2 lit. b — die Kategorien der Verarbeitungen */
  kategorien: { bezeichnung: string; beschreibung: string }[]
  /** Art. 30 Abs. 2 lit. c */
  drittlaender: { empfaenger: string; land: string; grundlage: string }[]
  unterauftraege: Unterauftrag[]
  /** Art. 30 Abs. 2 lit. d — allgemeine Beschreibung der TOM */
  massnahmen: { bezeichnung: string; beschreibung: string; stand: string }[]
  offen: string[]
}

export function verzeichnisAlsAuftragsverarbeiter(
  heute = new Date(),
): VerzeichnisAbs2 {
  return {
    stand: heute.toISOString().slice(0, 10),
    auftragsverarbeiter: anbieter(),
    auftraggeber:
      'Die Kunden von OKUN Workforce — Träger und Einrichtungen der Pflege, '
      + 'Kindertagesbetreuung und Eingliederungshilfe. Sie sind jeweils '
      + 'Verantwortliche im Sinne des Art. 4 Nr. 7 DSGVO.',
    kategorien: [
      {
        bezeichnung: 'Personalverwaltung',
        beschreibung:
          'Stammdaten, Qualifikationen, Pflichtnachweise und Fristen, '
          + 'Personalunterlagen, Bewerbungen.',
      },
      {
        bezeichnung: 'Arbeitszeit und Abwesenheit',
        beschreibung:
          'Dienstplanung, Zeiterfassung, Urlaub, Krankmeldungen und '
          + 'Arbeitsunfähigkeitsbescheinigungen.',
      },
      {
        bezeichnung: 'Entgeltabrechnung',
        beschreibung:
          'Berechnung des Entgelts, Erstellung der Belege, Bereitstellung der '
          + 'Datei für den Steuerberater und der Überweisungsdatei für die '
          + 'Bank. Die Meldungen an Sozialversicherung und Finanzamt gibt der '
          + 'Steuerberater ab, nicht dieses Programm.',
      },
      {
        bezeichnung: 'Kommunikation',
        beschreibung:
          'Benachrichtigungen, Nachrichten zwischen Beschäftigten, '
          + 'Anforderungen von Nachweisen und Belehrungen.',
      },
      {
        bezeichnung: 'Gesundheitsbezogene Verfahren',
        beschreibung:
          'Betriebliches Eingliederungsmanagement nach §167 Abs. 2 SGB IX. '
          + 'Besondere Kategorie nach Art. 9 DSGVO; eigener, engerer '
          + 'Zugriffskreis.',
      },
    ],
    drittlaender: UNTERAUFTRAEGE
      .filter(u => !!u.drittland)
      .map(u => ({
        empfaenger: u.name,
        land: u.ort,
        grundlage: u.drittland!,
      })),
    unterauftraege: UNTERAUFTRAEGE,
    massnahmen: MASSNAHMEN.map(m => ({
      bezeichnung: m.bezeichnung,
      beschreibung: m.beschreibung,
      stand: m.stand,
    })),
    offen: [
      ...fehltAmAnbieter(),
      ...offeneVertraege().map(u =>
        `Vertrag zur Auftragsverarbeitung mit ${u.name} noch nicht geschlossen`),
      ...offenePunkte().map(m => `${m.bezeichnung}: ${m.luecke ?? 'offen'}`),
    ],
  }
}

// ── Art. 30 Abs. 1 — für den Kunden als Verantwortlichen ───────────────────

export interface Taetigkeit {
  id: string
  bezeichnung: string
  /** Art. 30 Abs. 1 lit. b */
  zweck: string
  /** Die Rechtsgrundlage, auf die sich der Zweck stützt */
  rechtsgrundlage: string
  /** Art. 30 Abs. 1 lit. c — Kategorien betroffener Personen */
  betroffene: string
  /** Art. 30 Abs. 1 lit. c — Kategorien der Daten */
  daten: string
  /** Art. 30 Abs. 1 lit. d */
  empfaenger: string[]
  /** Art. 30 Abs. 1 lit. f */
  loeschung: string
}

/**
 * Der Zweck und die Rechtsgrundlage je Datenart.
 *
 * Der Datenkatalog sagt, WAS wo liegt und wie lange. Art. 30 verlangt
 * zusätzlich, WOZU und WORAUF GESTÜTZT. Das steht hier — bewusst getrennt,
 * damit der Katalog weiter das tut, wofür er gebaut ist, und nicht zum
 * Sammelbecken wird.
 */
const ZWECKE: Record<string, { zweck: string; rechtsgrundlage: string; empfaenger: string[] }> = {
  lohnkonto: {
    zweck: 'Berechnung und Auszahlung des Arbeitsentgelts.',
    rechtsgrundlage:
      'Art. 6 Abs. 1 lit. b DSGVO (Arbeitsvertrag), Art. 6 Abs. 1 lit. c '
      + 'i.V.m. §41 EStG und §28f SGB IV, §26 BDSG',
    empfaenger: ['Steuerberater', 'Finanzamt', 'Krankenkassen', 'Hausbank'],
  },
  lohnstammdaten: {
    zweck: 'Zutreffende Besteuerung und Verbeitragung des Entgelts.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. c DSGVO i.V.m. §41 EStG, §26 BDSG',
    empfaenger: ['Steuerberater', 'Finanzamt', 'Krankenkassen'],
  },
  zeiterfassung: {
    zweck:
      'Nachweis der Arbeitszeit, Einhaltung des Arbeitszeitgesetzes und '
      + 'Grundlage der Entgeltabrechnung.',
    rechtsgrundlage:
      'Art. 6 Abs. 1 lit. c DSGVO i.V.m. §16 Abs. 2 ArbZG und §17 MiLoG, §26 BDSG',
    empfaenger: ['Steuerberater', 'Aufsichtsbehörden bei Prüfung'],
  },
  abwesenheiten: {
    zweck:
      'Gewährung von Urlaub, Entgeltfortzahlung im Krankheitsfall und '
      + 'Dienstplanung.',
    rechtsgrundlage:
      'Art. 6 Abs. 1 lit. b und c DSGVO i.V.m. BUrlG und EntgFG, §26 BDSG; '
      + 'für Krankheitsdaten zusätzlich Art. 9 Abs. 2 lit. b DSGVO',
    empfaenger: ['Steuerberater', 'Krankenkasse bei Entgeltfortzahlung'],
  },
  unterlagen: {
    zweck: 'Führung der Personalakte.',
    rechtsgrundlage:
      'Art. 6 Abs. 1 lit. b DSGVO, §26 BDSG; Aufbewahrung nach §147 AO und '
      + '§257 HGB',
    empfaenger: ['Steuerberater', 'Prüfbehörden im Prüfungsfall'],
  },
  dienstplan: {
    zweck: 'Einsatzplanung und Sicherstellung der Besetzung.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO, §26 BDSG',
    empfaenger: ['Beschäftigte des Standorts (eigener Plan und Besetzung)'],
  },
  punkte: {
    zweck: 'Freiwilliges Anerkennungsprogramm.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)',
    empfaenger: [],
  },
  nachrichten: {
    zweck: 'Benachrichtigung über Dienstpläne, Anfragen und Fristen.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO, §26 BDSG',
    empfaenger: ['Versanddienstleister für E-Mail und Push'],
  },
  chat: {
    zweck: 'Dienstliche Verständigung zwischen Beschäftigten.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO, §26 BDSG',
    empfaenger: ['Die jeweiligen Gesprächsteilnehmer'],
  },
  wuensche: {
    zweck: 'Berücksichtigung persönlicher Wünsche bei der Dienstplanung.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)',
    empfaenger: [],
  },
  vertretung: {
    zweck: 'Besetzung kurzfristiger Ausfälle.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO, §26 BDSG',
    empfaenger: ['Angefragte Beschäftigte'],
  },
  zugang: {
    zweck: 'Anmeldung am Programm und Zuordnung der Berechtigungen.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO, Art. 32 DSGVO',
    empfaenger: [],
  },
  nachweise: {
    zweck:
      'Nachweis der für die Tätigkeit vorgeschriebenen Qualifikationen, '
      + 'Belehrungen und Untersuchungen.',
    rechtsgrundlage:
      'Art. 6 Abs. 1 lit. c DSGVO i.V.m. §43 IfSG, §12 ArbSchG, §72a SGB VIII '
      + 'und ArbMedVV, §26 BDSG',
    empfaenger: ['Aufsichtsbehörden im Prüfungsfall', 'Unfallversicherungsträger'],
  },
  belehrungsnachweis: {
    zweck:
      'Nachweis, dass die vorgeschriebenen Unterweisungen und Belehrungen '
      + 'durchgeführt wurden.',
    rechtsgrundlage:
      'Art. 6 Abs. 1 lit. c DSGVO i.V.m. §12 ArbSchG, §43 IfSG und DGUV '
      + 'Vorschrift 1; Aufbewahrung gestützt auf Art. 17 Abs. 3 lit. e DSGVO '
      + 'i.V.m. §195 BGB',
    empfaenger: ['Aufsichtsbehörden und Unfallversicherungsträger im Prüfungsfall'],
  },
  bem: {
    zweck:
      'Durchführung des betrieblichen Eingliederungsmanagements und Erhalt '
      + 'der Beschäftigungsfähigkeit.',
    rechtsgrundlage:
      'Art. 9 Abs. 2 lit. b DSGVO i.V.m. §167 Abs. 2 SGB IX, §26 Abs. 3 BDSG',
    empfaenger: [
      'Mit Einwilligung der betroffenen Person: Interessenvertretung, '
      + 'Betriebsarzt, Integrationsamt, Rehabilitationsträger',
    ],
  },
  bewerbungen: {
    zweck: 'Entscheidung über eine Bewerbung.',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO, §26 Abs. 1 BDSG',
    empfaenger: [],
  },
  protokolle: {
    zweck:
      'Nachweis des ordnungsgemäßen Umgangs mit Daten und Erkennung '
      + 'unbefugter Zugriffe.',
    rechtsgrundlage: 'Art. 5 Abs. 2, Art. 32 Abs. 1 DSGVO',
    empfaenger: ['Aufsichtsbehörde auf Verlangen'],
  },
}

function alsTaetigkeit(d: Datenart): Taetigkeit {
  const z = ZWECKE[d.id]
  return {
    id: d.id,
    bezeichnung: d.bezeichnung,
    zweck: z?.zweck ?? '—',
    rechtsgrundlage: z?.rechtsgrundlage ?? '—',
    betroffene:
      d.id === 'bewerbungen' ? 'Bewerberinnen und Bewerber' : 'Beschäftigte',
    daten: d.beschreibung,
    empfaenger: z?.empfaenger ?? [],
    loeschung: d.fristJahre > 0
      ? `${BEHANDLUNG_TEXT[d.behandlung]} — ${d.fristJahre} Jahre `
        + `(${d.grundlage ?? 'ohne Angabe'})`
      : BEHANDLUNG_TEXT[d.behandlung],
  }
}

export interface VerzeichnisAbs1 {
  stand: string
  verantwortlicher: {
    name: string
    anschrift: string | null
    kontakt: string | null
  }
  auftragsverarbeiter: string
  taetigkeiten: Taetigkeit[]
  /** Hinweis auf die TOM des Auftragsverarbeiters */
  massnahmen: string
  /** Was der Kunde selbst noch ergänzen muss */
  ergaenzen: string[]
}

/**
 * Das Verzeichnis des Kunden — erzeugt, nicht abgetippt.
 *
 * Es ist bewusst ein ENTWURF und sagt das auch: Der Betrieb verarbeitet
 * Personendaten auch außerhalb dieses Programms — Bewerbungen auf Papier, eine
 * Videoanlage am Eingang, die Telefonliste im Flur. Was hier steht, ist der
 * Teil, den wir kennen. Ein erzeugtes Verzeichnis, das sich für vollständig
 * ausgibt, wäre schlimmer als keines.
 */
export function verzeichnisFuerKunden(
  betrieb: { name: string; anschrift?: string | null; kontakt?: string | null },
  heute = new Date(),
): VerzeichnisAbs1 {
  return {
    stand: heute.toISOString().slice(0, 10),
    verantwortlicher: {
      name: betrieb.name,
      anschrift: betrieb.anschrift ?? null,
      kontakt: betrieb.kontakt ?? null,
    },
    auftragsverarbeiter: anbieter().name,
    taetigkeiten: DATENARTEN.map(alsTaetigkeit),
    massnahmen:
      'Die technischen und organisatorischen Maßnahmen des '
      + 'Auftragsverarbeiters sind als Anlage beigefügt (Art. 32 DSGVO).',
    ergaenzen: [
      ...(betrieb.anschrift ? [] : ['Anschrift des Verantwortlichen']),
      ...(betrieb.kontakt ? [] : ['Kontaktadresse für Betroffene']),
      'Datenschutzbeauftragter, soweit nach §38 BDSG erforderlich (in der '
      + 'Regel ab zwanzig Personen mit ständiger automatisierter Verarbeitung)',
      'Verarbeitungen außerhalb dieses Programms — etwa Bewerbungen auf '
      + 'Papier, Videoüberwachung, Besucherlisten, Telefonverzeichnisse',
      'Weitere Empfänger, die nur der Betrieb kennt — Berufsgenossenschaft, '
      + 'Betriebsarzt, Zeitarbeitsfirmen',
    ],
  }
}

/** Die Zeilen ohne Zweck — dort ist das Verzeichnis noch unvollständig. */
export function taetigkeitenOhneZweck(): string[] {
  return DATENARTEN.filter(d => !ZWECKE[d.id]).map(d => d.id)
}
