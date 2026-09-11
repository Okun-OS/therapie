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
    modelle: ['Notification', 'PushSubscription'],
    behandlung: 'loeschen',
    fristJahre: 0,
    begruendung: 'Keine Aufbewahrungspflicht — wird sofort gelöscht.',
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
    id: 'protokolle',
    bezeichnung: 'Zugriffsprotokolle',
    beschreibung: 'Aufzeichnungen darüber, wer wann auf welche Daten zugegriffen hat.',
    modelle: ['AuditLog', 'SupportAccessLog', 'Loeschvorgang'],
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
