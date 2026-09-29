/**
 * §177 Was auf der Website steht — an einer Stelle, zum Ändern ohne Code.
 *
 * WARUM DER TEXT NICHT IN DEN SEITEN STEHT
 * Eine Verkaufsseite wird geändert, nachdem man sie jemandem gezeigt hat.
 * Wer dafür durch JSX klettern muss, ändert sie nicht mehr. Hier steht sie
 * als lesbare Liste; die Seiten daneben ordnen sie nur an.
 *
 * DREI DINGE, DIE HIER BEWUSST FEHLEN
 *   Preise — sie stehen nicht fest, und eine erfundene Zahl auf einer
 *   Verkaufsseite ist schlimmer als keine.
 *
 *   Referenzen — ein Kundenname gehört erst dorthin, wenn der Kunde
 *   zugestimmt hat.
 *
 *   „Jetzt kostenlos testen" — ein Betrieb kann sich hier nicht selbst
 *   anlegen, und das ist Absicht: Die Dienstplanung wird je Kunde von Hand
 *   gebaut (§126). Ein Knopf, der etwas verspricht, was das Programm nicht
 *   kann, ist eine Lüge im Schaufenster.
 */

export interface Punkt {
  titel: string
  text: string
}

// ── Startseite ──────────────────────────────────────────────────────────────

export const KOPF = {
  vorspann: 'Für Pflege, Kita und Eingliederungshilfe',
  zeilen: ['Der Dienstplan', 'kennt Ihre Regeln.'],
  /** Diese Zeile wird farbig hervorgehoben — sie ist der Kern. */
  betont: 'Ihre Regeln.',
  text:
    'Dienstplanung, Zeiterfassung und Lohnabrechnung in einem Programm. '
    + 'Mit den Regeln Ihrer Einrichtung — nicht mit denen von der Stange.',
}

/**
 * §126/§163 Das Verkaufsargument, das sonst niemand hat.
 *
 * Jede Software verteilt Schichten. Was hier anders ist: Die Regeln eines
 * Betriebs werden als Code geschrieben, geprüft und versioniert —
 * einschließlich derer, die nirgends aufgeschrieben stehen und die jede
 * Leitung trotzdem im Kopf hat.
 */
export const KERN = {
  vorspann: 'Der Unterschied',
  titel: 'Ihr Regelwerk wird gebaut, nicht angekreuzt.',
  absaetze: [
    'In jeder Einrichtung gelten Regeln, die in keinem Formular stehen. Wer '
    + 'donnerstags fest frei hat. Dass in Gruppe 1 immer zwei Leute stehen '
    + 'müssen. Dass eine Kraft ihre Gruppe nur verlässt, wenn eine andere '
    + 'eigene bleibt. Dass in der Eingewöhnung niemand abgezogen wird.',
    'Solche Regeln lassen sich nicht ankreuzen. Wir schreiben sie für Ihre '
    + 'Einrichtung auf, programmieren sie und prüfen sie an echten Plänen — '
    + 'bevor jemand damit arbeitet.',
  ],
}

/** Die Kacheln unter dem Aufmacher. */
export const STAERKEN: Punkt[] = [
  {
    titel: 'Echter Rechenkern',
    text:
      'Kein Zufallsgenerator: Ein Optimierer prüft alle Möglichkeiten und '
      + 'legt offen, warum er sich entschieden hat.',
  },
  {
    titel: 'Ihr Regelwerk',
    text:
      'Die Regeln Ihres Hauses werden programmiert und an echten Plänen '
      + 'abgenommen — nicht in Formularen angekreuzt.',
  },
  {
    titel: 'Lohn nach Recht',
    text:
      'Vom Minijob bis zur Pfändung: gerechnet nach EStG, SGB und ZPO, mit '
      + 'Paragraph an jeder Zahl.',
  },
  {
    titel: 'In der Hosentasche',
    text:
      'Mitarbeiter-App für iPhone und Android, Programm für den Rechner — '
      + 'und alles funktioniert auch ohne Netz.',
  },
  {
    titel: 'Datenschutz eingebaut',
    text:
      'Auskunft nach Art. 15 auf Knopfdruck, ein Löschkonzept über alle '
      + 'Tabellen, Server in Deutschland.',
  },
  {
    titel: 'Wir bleiben dran',
    text:
      'Ändern sich Ihre Regeln, ändern wir sie mit. Das ist kein '
      + 'Zusatzauftrag, sondern der Kern der Sache.',
  },
]

/** Wie eine Zusammenarbeit anfängt — ehrlich, inklusive der Wartezeit. */
export const ABLAUF: Punkt[] = [
  {
    titel: 'Zuhören',
    text:
      'Wir lassen uns zeigen, wie bei Ihnen geplant wird. Nicht wie es im '
      + 'Lehrbuch steht — wie es bei Ihnen läuft.',
  },
  {
    titel: 'Aufschreiben',
    text:
      'Ihre Regeln kommen als lesbares Dokument zurück. Erst wenn Sie sagen '
      + '„so ist es richtig", wird programmiert.',
  },
  {
    titel: 'Einrichten',
    text:
      'Stammdaten, Gruppen, Dienstzeiten, Zugänge. Den ersten Plan rechnen '
      + 'wir gemeinsam und sehen ihn zusammen durch.',
  },
  {
    titel: 'Dranbleiben',
    text:
      'Im Betrieb ändert sich etwas — eine neue Gruppe, eine neue '
      + 'Vereinbarung. Wir ziehen das Regelwerk nach.',
  },
]

export const SCHLUSS = {
  titel: 'Sehen Sie es an Ihrem eigenen Dienstplan.',
  text:
    'Im Gespräch rechnen wir eine echte Woche aus Ihrem Haus durch — mit '
    + 'Ihren Regeln, Ihren Leuten, Ihren Ausfällen. Danach wissen Sie, ob '
    + 'es passt.',
}

// ── Funktionsseite ──────────────────────────────────────────────────────────

export const FUNKTIONEN_KOPF = {
  vorspann: 'Der volle Umfang',
  titel: 'Das ganze Programm.',
  text:
    'Alles, was OKUN Workforce kann — ohne Auslassung. Jeder Punkt ist '
    + 'gebaut und wird bei jeder Auslieferung automatisch nachgeprüft.',
}

export interface Bereich {
  titel: string
  einleitung: string
  punkte: string[]
}

/**
 * §177 Vollständig, und das ist wörtlich gemeint.
 *
 * Die Liste ist aus der Navigation der Anwendung und dem Nachweisverzeichnis
 * (`pruefungen/README.md`) zusammengetragen. Wer hier etwas ergänzt, das es
 * nicht gibt, macht aus einer Übersicht ein Versprechen.
 */
export const BEREICHE: Bereich[] = [
  {
    titel: 'Dienstplanung',
    einleitung:
      'Ein Optimierer verteilt die Dienste. Was er entscheidet, legt er offen.',
    punkte: [
      'Wochen-, Zwei-Wochen- und Monatsplanung mit einem Rechenkern, der alle Möglichkeiten prüft',
      'Ihr eigenes Regelwerk als geprüfter Code — Tagesmuster, feste freie Tage, Mindestbesetzung je Gruppe',
      'Etagen, Gruppen und Bereiche als Planungsstruktur',
      'Dienstwünsche der Beschäftigten, mit nachvollziehbarer Abwägung',
      'Fairness über Wochen hinweg: Früh-, Spät- und Freitagsdienste werden gleichmäßig verteilt',
      'Vertretung bei Ausfall: wer kann, wer darf, wer bleibt zurück',
      'Schichttausch zwischen Beschäftigten, mit Freigabe durch die Leitung',
      'Maßnahmen-Vorschläge, wenn es nicht aufgeht — nachgerechnet, dann zum Genehmigen oder Ablehnen',
      'Planvarianten zum Vergleich: ausgewogen, mitarbeiterfreundlich, maximal fair',
      'Aufgabenkatalog: To-dos und Checklisten je Dienst',
      'Veröffentlichen mit Benachrichtigung an alle Betroffenen',
      'Dienstplan als Druckansicht und als Export',
    ],
  },
  {
    titel: 'Zeiterfassung',
    einleitung:
      'Vom Stempeln bis zum Stundenkonto — auch im Funkloch.',
    punkte: [
      'Stempeluhr am Gerät und im Telefon, mit Zeitstempel vom Gerät',
      'Warteschlange ohne Netz: nachgereicht, sobald wieder Empfang da ist',
      'Stundenkonten, Über- und Minusstunden je Person',
      'Soll-Ist-Vergleich je Woche, mit Benennung der Abweichung statt Kaschierung',
      'Pausenregeln je Standort: ab wann, wie lange, automatisch abgezogen',
      'Zuschläge für Nacht, Sonntag und Feiertag nach §3b EStG',
      'Eigene Zuschlagsregeln je Unternehmen, Standort oder Person',
      'Monatsabschluss durch die Leitung — ohne Freigabe kein Lohn',
      'Zeitkorrekturen mit Protokoll, wer wann was geändert hat',
    ],
  },
  {
    titel: 'Abwesenheiten',
    einleitung:
      'Urlaub, Krankheit, Schließzeiten — beantragt im Telefon, sofort im Plan.',
    punkte: [
      'Urlaubsanträge mit Jahresplanung und Resturlaub',
      'Krankmeldung mit Krankenschein, Fristenprüfung nach §5 EntgFG',
      'Lücken bei fehlender Folgebescheinigung werden benannt',
      'Schließzeiten und Pflichturlaub für den ganzen Betrieb',
      'Mutterschutz und Beschäftigungsverbote',
      'Abwesenheiten wirken sofort auf den Dienstplan',
    ],
  },
  {
    titel: 'Lohnabrechnung',
    einleitung:
      'Vom Brutto bis zum Beleg, nach deutschem Recht und mit Paragraph an jeder Zahl.',
    punkte: [
      'Lohnsteuer nach Steuerklasse, Kinderfreibeträgen und Kirchensteuer',
      'Sozialversicherung mit allen vier Zweigen und den Grenzen des Jahres',
      'Minijob, kurzfristige Beschäftigung und Übergangsbereich',
      'Teilmonate bei Ein- und Austritt',
      'Einmalzahlungen: Weihnachtsgeld, Prämie, Abfindung',
      'Rückwirkende Änderungen mit Aufrollung und Korrekturbetrag',
      'Lohnpfändung nach §§850 ff. ZPO, mit Rangfolge und Nachweis',
      'Betriebliche Altersvorsorge: 8 % steuerfrei im Jahr, 4 % beitragsfrei im Monat',
      'Kurzarbeitergeld auf der pauschalierten Nettodifferenz, mit Abrechnungsliste',
      'Mehrfachbeschäftigung mit geteilter Beitragsbemessungsgrenze',
      'Umlagen U1, U2 und Insolvenzgeld — die Sätze von 24 Krankenkassen sind hinterlegt',
      'Bescheinigungen: Arbeitsbescheinigung, Krankengeld, Mutterschaftszuschuss',
      'ELStAM-Stand je Person, Warnung bei Veralterung, Import der Änderungsliste',
      'Lohnbeleg als PDF, Zustellung in die App',
      'Jahresabschluss und die Werte für die Lohnsteuerbescheinigung',
      'DATEV-Export für den Steuerberater',
      'SEPA-Datei für die Überweisung',
    ],
  },
  {
    titel: 'Personalakte und Nachweise',
    einleitung:
      'Was ablaufen kann, meldet sich von selbst — statt im Ordner zu verstauben.',
    punkte: [
      'Stammdaten, Rollen und Zugänge je Person',
      'Einladung per E-Mail mit eigenem Zugangslink',
      'Pflichtnachweise mit Ablaufdatum: Führungszeugnis, Erste Hilfe, Hygiene',
      'Nachweise anfordern, einreichen, nachfragen, abnehmen',
      'Belehrungen verteilen und bestätigen lassen, mit Beleg',
      'Eingliederungsmanagement (BEM) ab der gesetzlichen Schwelle — und abgeschirmt vor allen, die es nichts angeht',
      'Vertragsfristen mit Erinnerung',
    ],
  },
  {
    titel: 'Kommunikation',
    einleitung:
      'Alles an einem Ort, statt in drei Messengern.',
    punkte: [
      'Chat zwischen Beschäftigten, einzeln und in Gruppen',
      'Gespräche zu zweit sind für niemanden sonst einsehbar — auch nicht für die Leitung',
      'Tritt die Leitung einer Gruppe bei, steht das sichtbar im Verlauf',
      'Benachrichtigungen auf das Telefon, auch bei geschlossener App',
      'Einspringen-Anfragen mit Eskalation: erst die Gruppe, dann die Etage, dann alle',
      'Ankündigungen an ganze Standorte',
    ],
  },
  {
    titel: 'Auswertungen',
    einleitung:
      'Zahlen, die eine Entscheidung tragen.',
    punkte: [
      'Team-Kennzahlen: Verteilung, Belastung, Trends',
      'Personalrisiko: wo es eng wird, bevor es eng wird',
      'Workforce Score: Punkte und Stufen für das Team',
      'Berichte und Datenexport',
      'Plan-Bewertung mit Score und Freigabeempfehlung',
    ],
  },
  {
    titel: 'Recruiting',
    einleitung:
      'Von der Stelle bis zur Einstellung, ohne Medienbruch.',
    punkte: [
      'Stellen ausschreiben',
      'Eigene Karriereseite, ohne Anmeldung erreichbar',
      'Bewerbungen entgegennehmen und begleiten',
      'Aus der Einstellung wird direkt ein Zugang',
    ],
  },
  {
    titel: 'Mehrere Standorte',
    einleitung:
      'Für Träger mit mehr als einem Haus.',
    punkte: [
      'Standorte und Bereiche mit eigener Leitung',
      'Bereichsleitung sieht nur ihre Bereiche',
      'Auswertungen über alle Standorte',
      'Saubere Trennung zwischen Mandanten — geprüft bei jeder Auslieferung',
    ],
  },
  {
    titel: 'Datenschutz',
    einleitung:
      'Nicht nachträglich draufgesetzt, sondern eingebaut.',
    punkte: [
      'Auskunft nach Art. 15 DSGVO auf Knopfdruck, als PDF und als Datei zum Mitnehmen',
      'Löschkonzept über alle Tabellen, mit Vorschau vor jeder Löschung',
      'Sperre statt Löschung, wo das Gesetz die Aufbewahrung verlangt',
      'Verzeichnis der Verarbeitungstätigkeiten (Art. 30)',
      'Technische und organisatorische Maßnahmen (Art. 32), jede mit Beleg im Code',
      'Anmeldeschutz mit Sperre nach Fehlversuchen',
      'Zwei-Faktor-Anmeldung über App oder SMS',
    ],
  },
  {
    titel: 'Auf jedem Gerät',
    einleitung:
      'Im Browser, auf dem Telefon, als Programm auf dem Rechner.',
    punkte: [
      'Mitarbeiter-App für iPhone und Android',
      'Gesichts- oder Fingerabdruck-Sperre vor Lohn- und Personaldaten',
      'Kamera für den Krankenschein, ohne Umweg über die Dateiauswahl',
      'Programm für Windows, macOS und Linux — mit eigenem Symbol im Startmenü',
      'Drucken ohne Browserrand: ein Lohnbeleg für die Personalakte',
      'Funktioniert im Funkloch und reicht nach, sobald wieder Netz da ist',
    ],
  },
]

/** Was unter der Funktionsliste steht — die Einordnung. */
export const FUNKTIONEN_SCHLUSS = {
  titel: 'Warum das alles geprüft ist',
  text:
    'Ein Programm, das Gehälter rechnet, darf sich nicht irren. Bei jeder '
    + 'Auslieferung laufen über 1400 Prüfungen gegen das laufende System — '
    + 'echte Anmeldung, echte Datenbank, mehrere Mandanten. Dazu kommen über '
    + '900 Rechenprüfungen und die Abnahme des Rechenkerns an wirklich '
    + 'gelösten Plänen. Schlägt eine fehl, wird nicht ausgeliefert.',
}

// ── Kontakt ─────────────────────────────────────────────────────────────────

export const KONTAKT = {
  vorspann: 'Reden wir',
  titel: 'Erzählen Sie uns von Ihrem Haus.',
  text:
    'Wie viele Standorte, wie viele Beschäftigte, und was beim Planen jedes '
    + 'Mal weh tut. Wir melden uns innerhalb eines Werktags.',
}
