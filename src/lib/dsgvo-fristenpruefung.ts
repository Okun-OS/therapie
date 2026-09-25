import { DATENARTEN } from './dsgvo-katalog'

/**
 * §154 Die Prüfung der Löschfristen — Stück für Stück gegen die Vorschrift.
 *
 * WARUM DAS EIN EIGENES MODUL IST
 * Im Katalog (§128) steht, WAS gilt. Hier steht, WARUM — und vor allem, wie
 * belastbar es ist. Die beiden Dinge gehören getrennt: Der Katalog wird bei
 * jedem neuen Feature angefasst, diese Prüfung bei jeder Gesetzesänderung.
 *
 * DIE DREI STUFEN
 * Eine Frist ist selten einfach „richtig". Es gibt drei Sorten:
 *
 *   sicher      Die Vorschrift nennt die Zahl ausdrücklich. §41 Abs. 1 Satz 9
 *               EStG sagt „sechs Kalenderjahre" — da ist nichts auszulegen.
 *
 *   auslegung   Die Frist folgt aus einer Wertung, die vertretbar, aber nicht
 *               zwingend ist. Drei Jahre für Protokolle etwa folgen der
 *               Regelverjährung, nicht einer Aufbewahrungsvorschrift.
 *
 *   klaeren     Hier gehört die Antwort eines Steuerberaters oder
 *               Datenschutzbeauftragten her, bevor ein echter Kunde damit
 *               arbeitet. Diese Punkte stehen ausdrücklich als Frage da,
 *               nicht als Feststellung.
 *
 * WARUM „ZU LANG" AUCH EIN FEHLER IST
 * Der Reflex ist, im Zweifel länger aufzubewahren — dem Finanzamt kann man
 * dann nichts vorwerfen. Art. 5 Abs. 1 lit. e DSGVO sieht das anders: Daten
 * dürfen nur so lange gespeichert werden, wie es der Zweck erfordert. Eine zu
 * lange Frist ist deshalb genauso ein Verstoß wie eine zu kurze — nur einer,
 * den niemand bemerkt.
 */

export type Sicherheit = 'sicher' | 'auslegung' | 'klaeren'

export const SICHERHEIT_TEXT: Record<Sicherheit, string> = {
  sicher: 'Die Vorschrift nennt die Zahl ausdrücklich',
  auslegung: 'Aus einer Wertung hergeleitet — vertretbar, nicht zwingend',
  klaeren: 'Muss vor dem ersten echten Kunden fachlich geklärt werden',
}

export interface Fristpruefung {
  /** Die Kennung der Datenart aus dem Katalog */
  id: string
  /** Wie die Frist zustande kommt — in Sätzen */
  herleitung: string
  sicherheit: Sicherheit
  /** Nur bei `klaeren`: die Frage, so wie man sie stellen würde */
  frage?: string
  /** Wenn die Prüfung einen Mangel gefunden hat */
  befund?: string
}

export const PRUEFUNGEN: Fristpruefung[] = [
  {
    id: 'lohnkonto',
    sicherheit: 'klaeren',
    herleitung:
      '§41 Abs. 1 Satz 9 EStG: Das Lohnkonto ist bis zum Ablauf des sechsten '
      + 'Kalenderjahres aufzubewahren, das auf die zuletzt eingetragene '
      + 'Lohnzahlung folgt. Die sechs Jahre stehen dort wörtlich, und die '
      + 'Rechnung ab Jahresende bildet das Programm richtig ab.',
    frage:
      '§28f Abs. 1 SGB IV knüpft NICHT an sechs Jahre an, sondern an die '
      + 'letzte Betriebsprüfung: Entgeltunterlagen sind bis zum Ablauf des '
      + 'auf die letzte Prüfung nach §28p folgenden Kalenderjahres '
      + 'aufzubewahren. Prüfungen finden etwa alle vier Jahre statt, also '
      + 'liegt man mit sechs Jahren meist richtig — aber eben nur meist. '
      + 'Frage an den Steuerberater: Genügen die sechs Jahre, oder muss die '
      + 'Frist an das Datum der letzten Betriebsprüfung gekoppelt werden?',
  },
  {
    id: 'lohnstammdaten',
    sicherheit: 'sicher',
    herleitung:
      'Steuerklasse, Steuer-ID, Krankenkasse und Stundensatz sind Teil des '
      + 'Lohnkontos (§4 LStDV) und teilen dessen Frist aus §41 Abs. 1 EStG. '
      + 'Bankverbindung und Anschrift stehen NICHT in §4 LStDV; sie werden '
      + 'deshalb sofort entfernt — ihr Zweck (Überweisung, Postversand) '
      + 'entfällt mit dem Austritt.',
  },
  {
    id: 'zeiterfassung',
    sicherheit: 'klaeren',
    herleitung:
      '§16 Abs. 2 ArbZG und §17 Abs. 1 MiLoG verlangen beide „mindestens zwei '
      + 'Jahre". Das Wort „mindestens" ist hier der Haken: Es ist eine '
      + 'Untergrenze, keine Obergrenze.',
    befund:
      'Die zwei Jahre könnten ZU KURZ sein. Die Arbeitszeitaufzeichnungen sind '
      + 'die Grundlage der Lohnabrechnung, und die wird sechs Jahre '
      + 'aufbewahrt. Nach §147 Abs. 1 Nr. 5 AO sind „sonstige Unterlagen, '
      + 'soweit sie für die Besteuerung von Bedeutung sind" sechs Jahre '
      + 'aufzubewahren — darunter fallen Stundenzettel, aus denen sich das '
      + 'abgerechnete Entgelt ergibt. Kommt die Betriebsprüfung im vierten '
      + 'Jahr, liegt die Abrechnung vor, aber ihr Nachweis ist gelöscht.',
    frage:
      'An den Steuerberater: Sind die Arbeitszeitaufzeichnungen hier '
      + 'Unterlagen im Sinne des §147 Abs. 1 Nr. 5 AO und deshalb sechs Jahre '
      + 'aufzubewahren? Wenn ja, ist die Frist im Katalog von zwei auf sechs '
      + 'Jahre zu heben.',
  },
  {
    id: 'abwesenheiten',
    sicherheit: 'auslegung',
    herleitung:
      'Fehlzeiten wirken auf das abgerechnete Entgelt — bezahlter Urlaub, '
      + 'Entgeltfortzahlung, unbezahlte Unterbrechung (Großbuchstabe U nach '
      + '§41 Abs. 1 Satz 6 EStG). Als Bestandteil der Lohnabrechnung teilen '
      + 'sie deren sechs Jahre.',
    befund:
      'Krankheitszeiten sind Gesundheitsdaten nach Art. 9 DSGVO. Gespeichert '
      + 'wird bewusst nur der Zeitraum, nie eine Diagnose — damit ist die '
      + 'Verarbeitung auf das beschränkt, was §41 EStG verlangt. Die '
      + 'Bescheinigung selbst liegt getrennt in der Personalakte und folgt '
      + 'deren Regeln.',
  },
  {
    id: 'unterlagen',
    sicherheit: 'klaeren',
    herleitung:
      'Die Personalakte wird derzeit als EIN Block mit der längsten denkbaren '
      + 'Frist behandelt: zehn Jahre nach §147 Abs. 3 AO und §257 Abs. 4 HGB '
      + 'für Buchungsbelege.',
    befund:
      'Zwei Mängel. ERSTENS ist die Akte kein einheitlicher Block: Eine '
      + 'Lohnabrechnung ist ein Buchungsbeleg, ein Arbeitszeugnis nicht und '
      + 'ein Arbeitsvertrag auch nicht. Für alles über einen Kamm die längste '
      + 'Frist zu nehmen, ist gegenüber dem Finanzamt sicher und verstößt '
      + 'gegen Art. 5 Abs. 1 lit. e DSGVO — Daten dürfen nur so lange bleiben, '
      + 'wie der Zweck es verlangt. ZWEITENS: Die Frist für Buchungsbelege '
      + 'wurde durch das Vierte Bürokratieentlastungsgesetz von zehn auf ACHT '
      + 'Jahre verkürzt (§147 Abs. 3 AO, §257 Abs. 4 HGB, in Kraft seit dem '
      + '1. Januar 2025). Zehn Jahre sind damit zwei Jahre zu lang.',
    frage:
      'An den Steuerberater und den Datenschutzbeauftragten: Bestätigt sich '
      + 'die Verkürzung auf acht Jahre für Buchungsbelege? Und welche Fristen '
      + 'gelten je Unterlagenart — Arbeitsvertrag, Zeugnis, Bescheinigung, '
      + 'Arbeitsunfähigkeitsbescheinigung, Lohnabrechnung? Die Kategorien sind '
      + 'im Programm bereits vorhanden, die Unterscheidung lässt sich sofort '
      + 'umsetzen, sobald die Zahlen feststehen.',
  },
  {
    id: 'dienstplan',
    sicherheit: 'auslegung',
    herleitung:
      'Für Dienstpläne gibt es keine Aufbewahrungsvorschrift. Der Betrieb hat '
      + 'aber ein nachvollziehbares Interesse an seiner Plangeschichte — etwa '
      + 'um Besetzungen früherer Jahre zu belegen. Die Anonymisierung löst '
      + 'beides: Der Plan bleibt, der Personenbezug geht. Die Zufallskennung '
      + 'wird nirgends gespeichert, die Verbindung ist damit zerstört und '
      + 'nicht wiederherstellbar — das unterscheidet Anonymisierung von '
      + 'Pseudonymisierung und nimmt die Daten aus dem Anwendungsbereich der '
      + 'DSGVO heraus (Erwägungsgrund 26).',
  },
  {
    id: 'punkte',
    sicherheit: 'sicher',
    herleitung:
      'Freiwillige Daten ohne Aufbewahrungspflicht. Mit dem Ausscheiden '
      + 'entfällt der Zweck vollständig, also Löschung nach Art. 17 Abs. 1 '
      + 'lit. a DSGVO.',
  },
  {
    id: 'nachrichten',
    sicherheit: 'sicher',
    herleitung:
      'Benachrichtigungen und Geräteanmeldungen dienen allein der Zustellung. '
      + 'Ohne Beschäftigungsverhältnis gibt es nichts zuzustellen — der Zweck '
      + 'entfällt, und damit greift Art. 17 Abs. 1 lit. a DSGVO. Keine '
      + 'Vorschrift verlangt die Aufbewahrung.',
  },
  {
    id: 'chat',
    sicherheit: 'auslegung',
    herleitung:
      'Dienstliche Nachrichten zwischen Beschäftigten sind keine Handelsbriefe '
      + 'im Sinne des §257 Abs. 1 Nr. 2 HGB — sie betreffen die '
      + 'Arbeitsorganisation, nicht ein Handelsgeschäft. Damit keine '
      + 'Aufbewahrungspflicht.',
    befund:
      'Dass ein Gespräch zu zweit GANZ verschwindet, ist bewusst so: Was dort '
      + 'stünde, wäre nur noch ein einseitiger Verlauf über die ausgeschiedene '
      + 'Person. In Gruppen bleiben die Beiträge der anderen — deren Daten '
      + 'gehören ihnen.',
  },
  {
    id: 'wuensche',
    sicherheit: 'sicher',
    herleitung:
      'Dienstwünsche und Vorlieben beruhen auf Einwilligung (Art. 6 Abs. 1 '
      + 'lit. a). Mit dem Austritt entfällt der Zweck; eine Aufbewahrung wäre '
      + 'durch nichts gedeckt.',
  },
  {
    id: 'vertretung',
    sicherheit: 'sicher',
    herleitung:
      'Wer für eine Vertretung angefragt wurde und ob er zugesagt hat, ist '
      + 'Organisation des Tagesgeschäfts. Keine Vorschrift verlangt die '
      + 'Aufbewahrung, also greift Art. 17 Abs. 1 lit. a DSGVO mit dem '
      + 'Wegfall des Zwecks. Der Dienstplan selbst bleibt davon unberührt.',
  },
  {
    id: 'zugang',
    sicherheit: 'sicher',
    herleitung:
      'Das Benutzerkonto dient der Anmeldung. Ohne Beschäftigungsverhältnis '
      + 'gibt es nichts anzumelden; der Zweck entfällt, und Art. 17 Abs. 1 '
      + 'lit. a DSGVO verlangt die Löschung. Die Lohnunterlagen hängen nicht '
      + 'am Konto, sondern am Mitarbeiterdatensatz — die Löschung des Kontos '
      + 'nimmt ihnen also nichts.',
  },
  {
    id: 'nachweise',
    sicherheit: 'klaeren',
    herleitung:
      'Die Frist selbst ist nur eine Erinnerung („bis wann gilt die '
      + 'Belehrung"). Der Nachweis liegt als Dokument in der Personalakte und '
      + 'folgt deren Regeln. Für den Eintrag hier gibt es keine eigene '
      + 'Aufbewahrungsvorschrift, also greift Art. 17 Abs. 1 lit. a DSGVO — '
      + 'insofern ist die sofortige Löschung richtig.',
    befund:
      'Für die BESTÄTIGUNG einer Belehrung gilt das NICHT. Sie ist der '
      + 'Nachweis des Arbeitgebers, dass unterwiesen wurde — genau das, wofür '
      + 'das Modul gebaut wurde. Wird sie mit dem Austritt gelöscht, steht der '
      + 'Betrieb ohne Beleg da, wenn ein ehemaliger Beschäftigter später '
      + 'behauptet, nie unterwiesen worden zu sein. Art. 17 Abs. 3 lit. e '
      + 'DSGVO nimmt die Löschung ausdrücklich zurück, soweit sie zur '
      + 'Geltendmachung oder Verteidigung von Rechtsansprüchen erforderlich '
      + 'ist. Die Bestätigungen sind deshalb in eine eigene Datenart mit drei '
      + 'Jahren Sperre überführt worden (§195 BGB, Regelverjährung).',
    frage:
      'An den Datenschutzbeauftragten: Genügen drei Jahre? Bei Personenschäden '
      + 'aus einer unterbliebenen Unterweisung reicht §199 Abs. 2 BGB bis zu '
      + 'dreißig Jahre — für den Arbeitsschutz könnte eine längere Frist '
      + 'angemessen sein.',
  },
  {
    id: 'belehrungsnachweis',
    sicherheit: 'auslegung',
    herleitung:
      'Drei Jahre nach §195 BGB (Regelverjährung), gestützt auf Art. 17 '
      + 'Abs. 3 lit. e DSGVO: Die Löschung entfällt, soweit die Daten zur '
      + 'Verteidigung von Rechtsansprüchen erforderlich sind. Gespeichert '
      + 'bleibt nur, WAS wann bestätigt wurde — keine Inhalte über die Person.',
  },
  {
    id: 'bem',
    sicherheit: 'auslegung',
    herleitung:
      'Gesundheitsbezogene Angaben nach Art. 9 DSGVO werden nicht länger '
      + 'aufbewahrt als nötig. Mit dem Ausscheiden endet der Zweck des '
      + 'Verfahrens — es soll die Beschäftigung erhalten, und die gibt es '
      + 'nicht mehr. Gespeichert wird ohnehin nur das Verfahren, nie eine '
      + 'Diagnose.',
    befund:
      'Eine Ausnahme bleibt zu bedenken: Stützt der Betrieb eine '
      + 'krankheitsbedingte Kündigung darauf, dass ein Eingliederungsmanagement '
      + 'angeboten wurde, braucht er diesen Beleg im Kündigungsschutzprozess. '
      + 'Art. 17 Abs. 3 lit. e DSGVO deckt das. Das Programm löscht derzeit '
      + 'beim Ausscheiden — bei laufendem Verfahren ist das zu früh.',
  },
  {
    id: 'bewerbungen',
    sicherheit: 'auslegung',
    herleitung:
      'Sechs Monate ab Ende des Verfahrens. Hergeleitet aus §15 Abs. 4 AGG '
      + '(zwei Monate zur Geltendmachung) und §61b Abs. 1 ArbGG (drei Monate '
      + 'Klagefrist danach), zuzüglich der Zeit bis zur Zustellung. Sechs '
      + 'Monate sind der Wert, der in den Orientierungshilfen der '
      + 'Aufsichtsbehörden steht.',
  },
  {
    id: 'protokolle',
    sicherheit: 'auslegung',
    herleitung:
      'Für Zugriffsprotokolle gibt es keine feste Frist. Art. 5 Abs. 2 DSGVO '
      + 'verlangt, die Einhaltung nachweisen zu können; drei Jahre folgen der '
      + 'Regelverjährung des §195 BGB und damit dem Zeitraum, in dem Ansprüche '
      + 'noch erhoben werden können.',
    befund:
      'Der Löschantrag steht bewusst mit in dieser Datenart und nicht bei den '
      + 'Kontodaten: Er ist der Nachweis, dass jemand von seinem Recht '
      + 'Gebrauch gemacht hat. Würde er mitgelöscht, bliebe von einer '
      + 'abgelehnten Löschung keine Spur — weder für die Person noch für die '
      + 'Aufsicht.',
  },
]

export function pruefungZu(id: string): Fristpruefung | undefined {
  return PRUEFUNGEN.find(p => p.id === id)
}

/** Die Punkte, die vor dem ersten echten Kunden beantwortet sein müssen. */
export function offeneFragen(): Fristpruefung[] {
  return PRUEFUNGEN.filter(p => p.sicherheit === 'klaeren')
}

/** Alles, wo die Prüfung einen Mangel gefunden hat. */
export function befunde(): Fristpruefung[] {
  return PRUEFUNGEN.filter(p => !!p.befund)
}

/** Datenarten, für die noch keine Prüfung vorliegt. */
export function ungeprueft(): string[] {
  return DATENARTEN
    .filter(d => !PRUEFUNGEN.some(p => p.id === d.id))
    .map(d => d.id)
}
