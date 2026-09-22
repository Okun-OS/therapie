/**
 * §128 Der Datenkatalog: wo Personendaten liegen, wie lange sie bleiben müssen
 * und was beim Löschen mit ihnen geschieht.
 *
 * Warum ein Katalog und nicht Code an dreißig Stellen
 * ----------------------------------------------------
 * Personendaten liegen bei uns in rund dreißig Tabellen. Eine Auskunft nach
 * Art.15 DSGVO ist nur vollständig, wenn wirklich alle gemeint sind — und eine
 * Löschung ist nur richtig, wenn jede Tabelle einzeln beurteilt wird. Steht das
 * verstreut im Code, fehlt nach der nächsten neuen Tabelle garantiert eine.
 *
 * Der schwierigste Teil: LÖSCHEN IST OFT VERBOTEN
 * ------------------------------------------------
 * „Recht auf Löschung" heißt nicht „alles weg". Lohnunterlagen müssen sechs
 * Jahre aufbewahrt werden, Buchungsbelege zehn, Arbeitszeitnachweise zwei. Wer
 * sie auf Zuruf löscht, verstößt gegen Steuer- und Sozialrecht — und kann bei
 * der nächsten Betriebsprüfung nichts vorlegen.
 *
 * Richtig ist stattdessen die EINSCHRÄNKUNG DER VERARBEITUNG (Art.18 DSGVO):
 * die Daten bleiben, werden aber gesperrt und nur noch für den Zweck verwendet,
 * für den das Gesetz sie verlangt. Genau das macht dieser Katalog sichtbar —
 * für jede Datenart steht, was passiert und warum.
 *
 * ACHTUNG BEI DEN FRISTEN
 * -----------------------
 * Die Fristen unten sind nach bestem Wissen eingetragen und mit der Vorschrift
 * belegt, aus der sie stammen. Sie sind NICHT von einem Steuerberater oder
 * Datenschutzbeauftragten geprüft. Vor dem ersten echten Kunden gehört genau
 * das gemacht — es ist eine Datei und eine Stunde Arbeit.
 */

export type Behandlung =
  /** Wird gelöscht — keine Aufbewahrungspflicht */
  | 'loeschen'
  /** Bleibt, aber ohne Personenbezug — für Auswertungen und Statistik */
  | 'anonymisieren'
  /** Bleibt unverändert und wird gesperrt (Art.18 DSGVO) — gesetzliche Pflicht */
  | 'sperren'

export interface Datenart {
  /** Kurzname, wie er in der Auskunft steht */
  id: string
  bezeichnung: string
  /** Was der Betroffene darunter versteht — kein Tabellenname */
  beschreibung: string
  /** Die Prisma-Modelle, in denen diese Daten liegen */
  modelle: string[]
  behandlung: Behandlung
  /** Aufbewahrungsfrist in Jahren nach Ende der Beschäftigung, 0 = keine */
  fristJahre: number
  /** Die Vorschrift, aus der die Frist folgt */
  grundlage?: string
  /** Warum diese Behandlung — steht so auch im Löschbericht */
  begruendung: string
}

export const DATENARTEN: Datenart[] = [
  // ── Was bleiben muss ─────────────────────────────────────────────────────
  {
    id: 'lohnkonto',
    bezeichnung: 'Lohnabrechnungen',
    beschreibung: 'Ihre monatlichen Abrechnungen, Einmalzahlungen und Korrekturen.',
    modelle: ['PayrollEntry', 'PayrollBonus', 'PayrollCorrection'],
    behandlung: 'sperren',
    fristJahre: 6,
    grundlage: '§41 Abs.1 EStG (Lohnkonto), §28f SGB IV (Beitragsunterlagen)',
    begruendung:
      'Das Lohnkonto muss bis zum Ablauf des sechsten Kalenderjahres nach der letzten '
      + 'Lohnzahlung aufbewahrt werden. Es wird gesperrt und nur noch für Prüfungen '
      + 'von Finanzamt und Rentenversicherung verwendet.',
  },
  {
    id: 'lohnstammdaten',
    bezeichnung: 'Steuer- und Sozialversicherungsdaten',
    beschreibung:
      'Steuerklasse, Steuer-ID, Krankenkasse, Sozialversicherungsnummer und der '
      + 'Stundensatz, mit dem Ihre Zuschläge gerechnet wurden.',
    modelle: ['EmployeePayrollProfile', 'SurchargeWageConfig'],
    behandlung: 'sperren',
    fristJahre: 6,
    grundlage: '§41 Abs.1 EStG',
    begruendung:
      'Diese Angaben gehören zum Lohnkonto und teilen dessen Frist. Bankverbindung und '
      + 'Anschrift werden jedoch sofort entfernt — sie werden nach dem Austritt nicht '
      + 'mehr gebraucht.',
  },
  {
    id: 'zeiterfassung',
    bezeichnung: 'Arbeitszeiten',
    beschreibung: 'Ihre Stempelzeiten, Pausen und Monatsabschlüsse.',
    modelle: ['TimeLog', 'TimeClockEntry', 'MonthlyClosing', 'TimesheetApproval', 'OvertimeRequest'],
    behandlung: 'sperren',
    fristJahre: 2,
    grundlage: '§16 Abs.2 ArbZG, §17 MiLoG',
    begruendung:
      'Aufzeichnungen über die Arbeitszeit sind zwei Jahre aufzubewahren. Danach werden '
      + 'sie gelöscht.',
  },
  {
    id: 'abwesenheiten',
    bezeichnung: 'Urlaub und Fehlzeiten',
    beschreibung: 'Urlaubsanträge, Krankmeldungen und sonstige Abwesenheiten.',
    modelle: ['Absence', 'VacationRequest'],
    behandlung: 'sperren',
    fristJahre: 6,
    grundlage: '§41 Abs.1 EStG',
    begruendung:
      'Fehlzeiten wirken auf die Lohnabrechnung und teilen deren Frist. '
      + 'Krankheitsdaten sind besonders geschützt und werden ausschließlich gesperrt '
      + 'aufbewahrt, nie ausgewertet.',
  },
  {
    id: 'unterlagen',
    bezeichnung: 'Personalakte',
    beschreibung: 'Arbeitsvertrag, Zeugnisse, Bescheinigungen, Lohnbelege, Krankmeldungen.',
    modelle: ['StoredFile'],
    behandlung: 'sperren',
    fristJahre: 10,
    grundlage: '§147 AO, §257 HGB (Buchungsbelege), Nachweispflichten',
    begruendung:
      'Lohnbelege sind Buchungsbelege und zehn Jahre aufzubewahren. Unterlagen ohne '
      + 'Aufbewahrungspflicht — etwa freiwillig eingereichte Nachweise — werden gelöscht.',
  },

  // ── Was ohne Personenbezug bleibt ────────────────────────────────────────
  {
    id: 'dienstplan',
    bezeichnung: 'Dienstplaneinträge',
    beschreibung: 'In welchen Schichten Sie eingeteilt waren.',
    modelle: ['ScheduleEntry', 'PlanChange'],
    behandlung: 'anonymisieren',
    fristJahre: 0,
    begruendung:
      'Der Betrieb braucht seine Plangeschichte weiter — etwa um Besetzungen früherer '
      + 'Jahre nachzuvollziehen. Ihr Name wird dabei entfernt, die Schicht bleibt.',
  },
  {
    id: 'punkte',
    bezeichnung: 'Punkte und Auszeichnungen',
    beschreibung: 'Punkte aus dem Workforce Score.',
    modelle: ['ScoreEvent'],
    behandlung: 'loeschen',
    fristJahre: 0,
    begruendung: 'Rein freiwillige Daten ohne Aufbewahrungspflicht.',
  },

  // ── Was sofort verschwindet ──────────────────────────────────────────────
  {
    id: 'nachrichten',
    bezeichnung: 'Nachrichten und Benachrichtigungen',
    beschreibung: 'Ihr Postfach und die Anmeldung Ihres Geräts für Push-Nachrichten.',
    // §139 `Geraet` ist die Kennung des Telefons, auf dem die App aus dem Store
    // läuft. Sie sagt, welches Gerät einer Person gehört — das ist ein
    // Personenbezug und gehört deshalb genauso in die Auskunft wie die
    // Anmeldung über den Browser.
    modelle: ['Notification', 'PushSubscription', 'Geraet'],
    behandlung: 'loeschen',
    fristJahre: 0,
    begruendung: 'Keine Aufbewahrungspflicht — wird sofort gelöscht.',
  },
  {
    id: 'chat',
    bezeichnung: 'Nachrichten an Kollegen',
    beschreibung:
      'Ihre Gespräche mit Kolleginnen und Kollegen und die Gruppen, in denen Sie waren.',
    modelle: ['ChatNachricht', 'ChatMitglied'],
    behandlung: 'loeschen',
    fristJahre: 0,
    begruendung:
      'Nachrichten unterliegen keiner Aufbewahrungspflicht. Ihre eigenen Nachrichten '
      + 'werden gelöscht; Gespräche, die nur zwischen Ihnen und einer anderen Person '
      + 'geführt wurden, verschwinden ganz — was dort stünde, wäre nur noch ein '
      + 'einseitiger Verlauf über Sie. In Gruppen bleiben die Beiträge der anderen.',
  },
  {
    id: 'wuensche',
    bezeichnung: 'Wünsche und Vorlieben',
    beschreibung:
      'Ihre Dienstwünsche, Urlaubswünsche, Schichtvorlieben und alles, was Sie '
      + 'freiwillig über sich hinterlegt haben.',
    modelle: [
      'EmployeeRequest', 'WishSubmission', 'VacationPlanPreference',
      'EmployeePlanningProfile', 'EmployeeHumanContext', 'EmployeeProfile',
    ],
    behandlung: 'loeschen',
    fristJahre: 0,
    begruendung:
      'Freiwillige Angaben ohne Aufbewahrungspflicht. Sie werden sofort und '
      + 'vollständig gelöscht.',
  },
  {
    id: 'vertretung',
    bezeichnung: 'Vertretungsanfragen',
    beschreibung: 'Anfragen zum Einspringen, an denen Sie beteiligt waren.',
    modelle: ['SubstitutionCandidate'],
    behandlung: 'loeschen',
    fristJahre: 0,
    begruendung:
      'Wer für eine Vertretung angefragt wurde und ob er zugesagt hat, muss nicht '
      + 'aufbewahrt werden. Der Dienstplan selbst bleibt davon unberührt.',
  },
  {
    id: 'zugang',
    bezeichnung: 'Zugangsdaten',
    beschreibung: 'Ihr Benutzerkonto, Einladungen und Kalenderabonnements.',
    modelle: ['User', 'InvitationToken', 'EmployeeCalendarSync', 'PasswordResetToken', 'SmsTotpCode'],
    behandlung: 'loeschen',
    fristJahre: 0,
    begruendung:
      'Das Konto wird gelöscht, die Anmeldung ist damit nicht mehr möglich. '
      + 'Die Lohnunterlagen bleiben davon unberührt.',
  },
  {
    id: 'nachweise',
    bezeichnung: 'Qualifikationen und Pflichtnachweise',
    beschreibung:
      'Ihre Schulungen, Belehrungen und Zeugnisse samt Gültigkeitsdauer — etwa '
      + 'Erste Hilfe, Infektionsschutzbelehrung oder das Führungszeugnis. Dazu '
      + 'die Aufforderungen, etwas einzureichen, und was dazu geschrieben wurde.',
    // §149 Die Reihenfolge zaehlt: Das Gespraech haengt an der Kennung der
    // Aufforderung und muss vor ihr weg.
    modelle: ['AnforderungBeitrag', 'Anforderung', 'Frist'],
    behandlung: 'loeschen',
    fristJahre: 0,
    begruendung:
      'Die Unterlagen selbst liegen in Ihrer Personalakte und folgen deren '
      + 'Aufbewahrung. Die Einträge hier sind nur die Erinnerung dazu, wann '
      + 'etwas aufgefrischt werden muss, und der Schriftwechsel darüber, was '
      + 'eingereicht werden sollte — beides wird gelöscht.',
  },
  {
    id: 'bem',
    bezeichnung: 'Betriebliches Eingliederungsmanagement',
    beschreibung:
      'Wurde Ihnen ein Eingliederungsmanagement angeboten, ob Sie zugestimmt '
      + 'haben und was dabei vereinbart wurde. Keine Diagnosen — nur das '
      + 'Verfahren selbst.',
    modelle: ['BemVorgang'],
    behandlung: 'loeschen',
    fristJahre: 0,
    grundlage: 'Art.9 DSGVO (Gesundheitsdaten), §167 Abs.2 SGB IX',
    begruendung:
      'Gesundheitsbezogene Angaben werden nicht länger aufbewahrt als nötig. '
      + 'Nach dem Ausscheiden werden sie gelöscht.',
  },
  {
    id: 'bewerbungen',
    bezeichnung: 'Bewerbungen',
    beschreibung:
      'Wie Sie zu uns gekommen sind: Ihre Unterlagen aus dem '
      + 'Einstellungsverfahren und was dabei festgehalten wurde — wann etwas '
      + 'eingegangen ist, wann eingeladen wurde, wie entschieden wurde.',
    // Die Reihenfolge zaehlt: Der Verlauf haengt an der Kennung der Bewerbung
    // und muss vor ihr weg, sonst findet ihn niemand mehr.
    modelle: ['BewerbungEreignis', 'Bewerbung'],
    behandlung: 'loeschen',
    fristJahre: 0,
    grundlage: '§15 Abs.4 AGG, §61b ArbGG, Art.6 Abs.1 lit.b DSGVO',
    begruendung:
      'Bewerbungsdaten werden nur für die Entscheidung über die Bewerbung '
      + 'verarbeitet. Ist das Verfahren beendet, werden sie nach sechs Monaten '
      + 'gelöscht — so lange, wie Ansprüche nach dem Allgemeinen '
      + 'Gleichbehandlungsgesetz geltend gemacht werden können. Wer in die '
      + 'Aufnahme in den Bewerberpool eingewilligt hat, bleibt so lange '
      + 'gespeichert, wie die Einwilligung gilt. Wurde jemand eingestellt, '
      + 'gehören die Unterlagen zur Personalakte und folgen deren Aufbewahrung.',
  },
  {
    id: 'protokolle',
    bezeichnung: 'Zugriffsprotokolle',
    beschreibung: 'Aufzeichnungen darüber, wer wann auf welche Daten zugegriffen hat.',
    // §139 Der Löschantrag gehört hierher und nicht zu den Kontodaten: Er ist
    // der Nachweis, dass jemand von seinem Recht Gebrauch gemacht hat und was
    // daraufhin geschah. Löschte man ihn mit, bliebe von einer abgelehnten
    // Löschung keine Spur — weder für die Person noch für die Aufsicht.
    modelle: ['AuditLog', 'SupportAccessLog', 'Loeschvorgang', 'Loeschantrag'],
    behandlung: 'sperren',
    fristJahre: 3,
    grundlage: 'Art.5 Abs.2 DSGVO (Rechenschaftspflicht)',
    begruendung:
      'Die Protokolle weisen nach, dass mit Ihren Daten korrekt umgegangen wurde — '
      + 'einschließlich des Nachweises, was bei einer Löschung entfernt wurde und was '
      + 'bleiben musste. Sie zu löschen würde genau diesen Nachweis zerstören.',
  },
]

/** Eine Datenart nachschlagen. */
export function datenart(id: string): Datenart | undefined {
  return DATENARTEN.find(d => d.id === id)
}

/** Alle Modelle, die irgendwo im Katalog vorkommen — für die Vollständigkeitsprüfung. */
export function erfassteModelle(): string[] {
  return Array.from(new Set(DATENARTEN.flatMap(d => d.modelle))).sort()
}

/**
 * Wann läuft die Aufbewahrung ab?
 *
 * Gerechnet ab dem Ende des Kalenderjahres, in dem die Beschäftigung endete —
 * so zählen die steuerlichen Fristen. Wer am 3. Februar ausscheidet, dessen
 * Sechsjahresfrist beginnt am 31. Dezember desselben Jahres.
 */
export function aufbewahrungBis(austritt: Date, fristJahre: number): string | null {
  if (fristJahre <= 0) return null
  const jahresende = new Date(Date.UTC(austritt.getUTCFullYear(), 11, 31))
  jahresende.setUTCFullYear(jahresende.getUTCFullYear() + fristJahre)
  return jahresende.toISOString().slice(0, 10)
}

export const BEHANDLUNG_TEXT: Record<Behandlung, string> = {
  loeschen: 'wird gelöscht',
  anonymisieren: 'wird anonymisiert',
  sperren: 'bleibt gesperrt aufbewahrt',
}
