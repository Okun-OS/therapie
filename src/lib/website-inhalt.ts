/**
 * §179 Was auf der Website steht — an einer Stelle, zum Ändern ohne Code.
 *
 * DIE TEXTE SIND VOM EIGENTÜMER, NICHT VON MIR.
 * Sie kamen am 29.09.2026 als fertige Fassung. Wer sie ändert, ändert die
 * Positionierung des Produkts — das ist eine Entscheidung des Hauses, keine
 * des Programmierers. Bitte nur nach Absprache anfassen.
 *
 * WAS SICH GEGENÜBER DER ERSTEN FASSUNG GEÄNDERT HAT
 * Die war auf Dienstplanung zugeschnitten und damit zu klein: OKUN Workforce
 * ist ein durchgängiges System für Personalarbeit — vom Recruiting über
 * Personalakte und Planung bis zum Monatsabschluss.
 *
 * §274 UND WARUM „LOHNABRECHNUNG" HIER NICHT MEHR STEHT
 * Entscheidung des Eigentümers vom 01.11.2026. Eine Lohnsoftware, die
 * Sozialversicherungsmeldungen erzeugen soll, braucht die Systemprüfung der
 * ITSG. Die wird angegangen, aber später. Bis dahin darf das Wort hier nicht
 * stehen: Ein Betrieb, der wegen der Abrechnung kauft, kauft etwas, das er
 * nicht bekommt — und eine Zusage zurückzunehmen, die jemand beim Kauf
 * gelesen hat, ist ungleich teurer, als sie später hinzuzufügen.
 *
 * Geworben wird stattdessen mit dem, was wirklich läuft und was fast jeder
 * Betrieb ohnehin braucht: Zeiten und Zuschläge entstehen hier, das
 * Lohnprogramm bleibt, wo es ist. Was die Übergabe dorthin angeht, steht
 * hier nur, was heute schon geht — die Regel darunter („wer etwas ergänzt,
 * das es nicht gibt, macht aus einer Übersicht ein Versprechen") gilt für
 * diesen Abschnitt doppelt.
 *
 * §178 ZWEI REGELN, DIE AUS FEHLERN ENTSTANDEN SIND
 *
 *   KEINE KUNDENINTERNA. Hier standen einmal sechs Regeln aus dem
 *   Regelpaket eines echten Betriebs. Das wirkte überzeugend und war
 *   trotzdem falsch: Wie ein Kunde plant, gehört ihm, nicht uns.
 *
 *   KEINE EINENGUNG AUF EINE BRANCHE. Ebenfalls einmal dagewesen: „für
 *   Pflege, Kita und Eingliederungshilfe". Das Programm ist für jedes
 *   Unternehmen mit Personal — wer eine Branche nennt, schließt die
 *   anderen aus.
 *
 * DREI DINGE, DIE BEWUSST FEHLEN
 *   Preise (stehen nicht fest), Referenzen (kein Kunde hat zugestimmt) und
 *   „jetzt kostenlos testen" — ein Betrieb kann sich nicht selbst anlegen.
 *   Zwei Prüfungen in `pruefungen/k-website.mjs` wachen darüber.
 */

export interface Punkt {
  titel: string
  text: string
}

// ── Startseite ──────────────────────────────────────────────────────────────

export const KOPF = {
  vorspann: 'Ihr Team hat einen Arbeitsplatz. Ihre Personalabteilung jetzt auch.',
  zeilen: ['Ein Mitarbeiter.', 'Ein System.'],
  text:
    'OKUN Workforce verbindet Recruiting, Mitarbeiterverwaltung, '
    + 'Personalplanung, Arbeitszeiten, Abwesenheiten und Kommunikation auf '
    + 'einer Plattform. Weniger Programme. Weniger Handarbeit. Mehr '
    + 'Überblick.',
}

/** Die sechs Kacheln unter dem Aufmacher. */
export const STAERKEN: Punkt[] = [
  {
    titel: 'Planen, wie Ihr Unternehmen wirklich arbeitet',
    text:
      'Ob feste Arbeitszeiten, wechselnde Dienste oder komplexe '
      + 'Besetzungsregeln: OKUN Workforce bildet Ihre tatsächlichen Abläufe '
      + 'ab – statt Sie in starre Standards zu zwingen.',
  },
  {
    titel: 'Alles zum Mitarbeiter. An einem Ort.',
    text:
      'Stammdaten, Verträge, Nachweise, Fristen, Rollen und Dokumente '
      + 'zentral verwalten. Was fehlt oder abläuft, macht sich bemerkbar.',
  },
  {
    titel: 'Arbeitszeit, die nicht weitergetragen werden muss',
    text:
      'Zeiten erfassen, Stundenkonten führen und Zuschläge berechnen – ohne '
      + 'Daten zwischen verschiedenen Programmen hin und her zu übertragen.',
  },
  {
    titel: 'Urlaub, Krankheit und Abwesenheiten im Griff',
    text:
      'Anträge, Resturlaub, Krankmeldungen und weitere Abwesenheiten digital '
      + 'verwalten – und direkt dort berücksichtigen, wo sie relevant werden.',
  },
  {
    titel: 'Zuschläge, die niemand mehr ausrechnet',
    text:
      'Nacht, Samstag, Sonntag und Feiertag entstehen aus den gestempelten '
      + 'Zeiten – nach den Regeln Ihres Betriebs. Am Monatsende stehen sie '
      + 'fertig da, statt in einer Excel-Liste zusammengesucht zu werden.',
  },
  {
    titel: 'Vom Bewerber zum Mitarbeiter',
    text:
      'Stellen veröffentlichen, Bewerbungen begleiten und neue Mitarbeiter '
      + 'nach der Einstellung direkt in den laufenden Personalprozess '
      + 'übernehmen.',
  },
]

/**
 * Der Abschnitt „Der Unterschied".
 *
 * Er trägt zwei Argumente zugleich: die Lücken zwischen den Programmen —
 * und dass die Regeln des Betriebs abgebildet werden, statt den Betrieb an
 * die Software anzupassen.
 */
export const KERN = {
  vorspann: 'Der Unterschied',
  zeilen: ['Ihre Leute arbeiten zusammen.', 'Ihre Personalsoftware sollte das auch.'],
  absaetze: [
    'In vielen Unternehmen liegt Personalarbeit heute verteilt: Bewerbungen '
    + 'hier, Mitarbeiterdaten dort, Urlaub per Mail, Arbeitszeiten in einem '
    + 'anderen Programm – und am Monatsende wird für das Lohnbüro alles noch '
    + 'einmal von Hand zusammengesucht.',
    'Das Problem sind nicht die einzelnen Programme. Das Problem sind die '
    + 'Lücken dazwischen.',
    'OKUN Workforce verbindet diese Abläufe in einem System. Was einmal '
    + 'vorhanden ist, muss nicht an der nächsten Stelle wieder '
    + 'zusammengesucht, übertragen oder neu eingegeben werden.',
    'Und dort, wo Ihr Unternehmen eigene Regeln hat, beginnt OKUN Workforce '
    + 'nicht mit einem Standardformular. Wir schauen uns an, wie Sie '
    + 'tatsächlich arbeiten, und bilden diese Regeln im System ab. Besonders '
    + 'bei der Personalplanung entsteht so ein Regelwerk, das zu Ihrem '
    + 'Betrieb passt – statt Ihren Betrieb an die Software anzupassen.',
  ],
}

/**
 * §184 Die drei Bildschirmfotos — und was sie zusammen sagen.
 *
 * WARUM AUSGERECHNET DIESE DREI
 * Weil sie zusammen einen Vorgang zeigen statt drei Programme: derselbe
 * Mensch, derselbe Monat, von der Planung über die Stempeluhr bis zu dem,
 * was am Monatsende an Zuschlägen dasteht. Wer plant und erfasst, muss die
 * Stunden nicht übertragen — sie sind schon da.
 *
 * §274 Das dritte Bild war die Lohnabrechnung. Es ist jetzt die
 * Zuschlagsübersicht: Das ist der letzte Schritt, den wir wirklich gehen,
 * und der erste, den ein Lohnbüro von uns bekommt.
 *
 * Die Bilder entstehen mit `npm run schaufenster` aus dem laufenden Programm
 * und zeigen einen erfundenen Beispielbetrieb. Kein echter Kunde, kein echter
 * Mensch — und keine Branche, die andere ausschließt.
 */
export const SCHAUFENSTER = {
  vorspann: 'So sieht das aus',
  zeilen: ['Ein Mensch, ein Monat,', 'drei Bildschirme.'],
  text:
    'Keine nachgebauten Bilder: Das sind Bildschirmfotos aus dem Programm, '
    + 'aufgenommen in einem Beispielbetrieb. Was hier als Dienst geplant ist, '
    + 'wird morgens gestempelt — und steht am Monatsende fertig gerechnet in '
    + 'den Zuschlägen, ohne dass jemand eine Stunde überträgt.',
  schritte: [
    {
      bild: '/schaufenster/dienstplan.png',
      breite: 2880,
      hoehe: 1800,
      titel: 'Der Dienstplan',
      text:
        'Wechselschicht über zwei Bereiche. Das System rechnet den Plan nach '
        + 'den Regeln Ihres Betriebs — und sagt daneben, wo die Verteilung kippt.',
    },
    {
      bild: '/schaufenster/stempeluhr.png',
      breite: 1290,
      hoehe: 2640,
      titel: 'Die Stempeluhr',
      text:
        'Auf dem Telefon der Mitarbeiterin: Was heute ansteht, ein Knopf zum '
        + 'Einstempeln, Krankmeldung und Urlaub daneben. Mehr braucht es morgens nicht.',
    },
    {
      bild: '/schaufenster/zuschlaege.png',
      breite: 2880,
      hoehe: 1800,
      titel: 'Die Zuschläge',
      text:
        'Je Person und Monat, gerechnet aus genau den Zeiten, die gestempelt '
        + 'wurden — nach den Zuschlagsregeln Ihres Betriebs. Was nicht '
        + 'angefallen ist, steht auch nicht da.',
    },
  ],
}

/** Die Liste neben dem Abschnitt „Der Unterschied". */
export const KERN_PUNKTE: string[] = [
  'Ein System vom Recruiting bis zum Monatsabschluss',
  'Daten einmal erfassen und anschließend weiterverwenden',
  'Eigene Abläufe statt erzwungener Standardprozesse',
  'Personalplanung nach den Regeln Ihres Unternehmens',
  'Zuschläge entstehen aus den erfassten Zeiten — ohne Abtippen',
  'Verwaltung und Mitarbeiter arbeiten im selben System',
]

/** Wie eine Zusammenarbeit anfängt. */
export const ABLAUF: Punkt[] = [
  {
    titel: 'Sie zeigen uns Ihren Alltag',
    text:
      'Wie arbeiten Sie heute? Wo entstehen doppelte Arbeit, Excel-Listen, '
      + 'Rückfragen oder manuelle Übergaben?',
  },
  {
    titel: 'Wir bilden Ihr Unternehmen ab',
    text:
      'Mitarbeiter, Standorte, Rollen, Arbeitszeiten, Regeln und Abläufe '
      + 'werden so eingerichtet, dass OKUN Workforce zu Ihrem Betrieb passt.',
  },
  {
    titel: 'Alles greift ineinander',
    text:
      'Personalplanung, Abwesenheiten, Zeiten, Mitarbeiterdaten und '
      + 'Zuschläge arbeiten anschließend mit denselben Informationen.',
  },
  {
    titel: 'Der Alltag wird einfacher',
    text:
      'Ihre Mitarbeiter nutzen OKUN Workforce genauso wie Ihre Verwaltung – '
      + 'jeweils mit den Funktionen und Informationen, die sie für ihre '
      + 'Arbeit brauchen.',
  },
]

export const SCHLUSS = {
  titel: 'Wie viele Programme braucht es heute, um einen Mitarbeiter zu verwalten?',
  betont: 'Mit OKUN Workforce reicht eines.',
  text:
    'Recruiting, Personalplanung, Arbeitszeit, Zuschläge und '
    + 'Mitarbeiterverwaltung – miteinander verbunden in einem System.',
  knopf: 'OKUN Workforce kennenlernen',
}

// ── Funktionsseite ──────────────────────────────────────────────────────────

export const FUNKTIONEN_KOPF = {
  vorspann: 'Vom ersten Kontakt bis zum Monatsabschluss.',
  zeilen: ['Alles, was Personal ausmacht.', 'Alles miteinander verbunden.'],
  text:
    'Recruiting, Personalakte, Planung, Zeiterfassung, Abwesenheiten, '
    + 'Kommunikation, Auswertungen und Zuschläge greifen in OKUN Workforce '
    + 'ineinander – statt als einzelne Lösungen nebeneinander zu stehen.',
}

export interface Bereich {
  titel: string
  einleitung: string
  punkte: string[]
}

/**
 * §177 Vollständig, und das ist wörtlich gemeint.
 *
 * Die Einleitungssätze sind vom Eigentümer. Die Funktionslisten darunter
 * sind aus der Navigation der Anwendung und dem Nachweisverzeichnis
 * (`pruefungen/README.md`) zusammengetragen: Wer eine Software für Lohn
 * sucht, hat eine Liste im Kopf, die er abhaken will — fehlt sein Punkt,
 * nimmt er an, es gibt ihn nicht, und ruft nicht an.
 *
 * Wer hier etwas ergänzt, das es nicht gibt, macht aus einer Übersicht ein
 * Versprechen.
 */
export const BEREICHE: Bereich[] = [
  {
    titel: 'Dienstplanung',
    einleitung:
      'Planen Sie Arbeitszeiten und Dienste nach den tatsächlichen Regeln '
      + 'Ihres Unternehmens – mit Verfügbarkeiten, Qualifikationen, '
      + 'Vertretungen und fairer Verteilung direkt in der Berechnung.',
    punkte: [
      'Wochen-, Zwei-Wochen- und Monatsplanung mit einem Rechenkern, der alle Möglichkeiten prüft',
      'Ihr eigenes Regelwerk als geprüfter Code — Arbeitszeitmodelle, feste freie Tage, Mindestbesetzung je Bereich',
      'Standorte, Bereiche und Teams als Planungsstruktur',
      'Dienstwünsche der Beschäftigten, mit nachvollziehbarer Abwägung',
      'Fairness über Wochen hinweg: Früh-, Spät- und Wochenenddienste werden gleichmäßig verteilt',
      'Vertretung bei Ausfall: wer kann, wer darf, wer bleibt zurück',
      'Schichttausch zwischen Beschäftigten, mit Freigabe durch die Leitung',
      'Vorschläge, wenn es nicht aufgeht — nachgerechnet, dann zum Genehmigen oder Ablehnen',
      'Planvarianten zum Vergleich: ausgewogen, mitarbeiterfreundlich, maximal fair',
      'Aufgabenkatalog: To-dos und Checklisten je Dienst',
      'Veröffentlichen mit Benachrichtigung an alle Betroffenen',
      'Dienstplan als Druckansicht und als Export',
    ],
  },
  {
    titel: 'Zeiterfassung',
    einleitung:
      'Arbeitszeiten am Gerät oder Smartphone erfassen, Über- und '
      + 'Minusstunden verfolgen und Zuschläge automatisch aus den '
      + 'tatsächlichen Zeiten ableiten.',
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
      'Urlaub, Krankheit, Betriebsferien und weitere Abwesenheiten zentral '
      + 'verwalten – und unmittelbar in der Personalplanung berücksichtigen.',
    punkte: [
      'Urlaubsanträge mit Jahresplanung und Resturlaub',
      'Krankmeldung mit Krankenschein, Fristenprüfung nach §5 EntgFG',
      'Lücken bei fehlender Folgebescheinigung werden benannt',
      'Betriebsferien und Pflichturlaub für den ganzen Betrieb',
      'Mutterschutz und Beschäftigungsverbote',
      'Abwesenheiten wirken sofort auf den Dienstplan',
    ],
  },
  {
    titel: 'Übergabe an die Lohnabrechnung',
    einleitung:
      'Ihr Lohnprogramm bleibt, wo es ist. OKUN Workforce liefert die Zahlen, '
      + 'die es am Monatsende braucht – gerechnet aus den tatsächlich '
      + 'gestempelten Zeiten statt aus einer Liste, die jemand abtippt.',
    punkte: [
      'Monatsabschluss durch die Leitung — erst danach geht etwas ans Lohnbüro',
      'Zuschläge für Nacht, Samstag, Sonntag und Feiertag nach §3b EStG',
      'Eigene Zuschlagsregeln je Unternehmen, Standort oder Person',
      'Zuschlagsübersicht je Person und Monat, über alle Standorte',
      'Übergabedatei fürs Lohnbüro: Personalnummer, Stunden, Mehrarbeit, Zuschläge und Fehltage',
      'Steuerfreie und steuerpflichtige Zuschläge getrennt — so, wie das Lohnprogramm sie bucht',
      'Was fehlen würde, steht vorher da: etwa eine Personalnummer, die nicht gepflegt ist',
      'Stundennachweis je Mitarbeiter als Druckansicht für die Personalakte',
      'Ihre fertige Entgeltabrechnung in die App zustellen — jeder sieht seine eigene auf dem Telefon',
    ],
  },
  {
    titel: 'Personalakte und Nachweise',
    einleitung:
      'Mitarbeiterdaten, Pflichtnachweise, Vertragsfristen und Belehrungen '
      + 'zentral verwalten – inklusive Erinnerung, wenn etwas abläuft oder '
      + 'fehlt.',
    punkte: [
      'Stammdaten, Rollen und Zugänge je Person',
      'Einladung per E-Mail mit eigenem Zugangslink',
      'Pflichtnachweise mit Ablaufdatum: Schulungen, Unterweisungen, Führerscheine, Zertifikate',
      'Nachweise anfordern, einreichen, nachfragen, abnehmen',
      'Belehrungen und Unterweisungen verteilen und bestätigen lassen, mit Beleg',
      'Eingliederungsmanagement (BEM) ab der gesetzlichen Schwelle — und abgeschirmt vor allen, die es nichts angeht',
      'Vertragsfristen mit Erinnerung',
    ],
  },
  {
    titel: 'Kommunikation',
    einleitung:
      'Chat, Ankündigungen und Einspringanfragen direkt dort organisieren, '
      + 'wo auch Mitarbeiter, Teams und Standorte verwaltet werden.',
    punkte: [
      'Chat zwischen Beschäftigten, einzeln und in Gruppen',
      'Gespräche zu zweit sind für niemanden sonst einsehbar — auch nicht für die Leitung',
      'Tritt die Leitung einer Gruppe bei, steht das sichtbar im Verlauf',
      'Benachrichtigungen auf das Telefon, auch bei geschlossener App',
      'Einspringen-Anfragen mit Eskalation: erst das Team, dann der Bereich, dann alle',
      'Ankündigungen an ganze Standorte',
    ],
  },
  {
    titel: 'Auswertungen',
    einleitung:
      'Verteilung, Belastung und Entwicklungen im Team sichtbar machen und '
      + 'frühzeitig erkennen, wo personelle Engpässe entstehen können.',
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
      'Stellen veröffentlichen, Bewerbungen begleiten und neue Mitarbeiter '
      + 'nach der Einstellung direkt in OKUN Workforce übernehmen.',
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
      'Standorte, Bereiche und Verantwortlichkeiten getrennt verwalten und '
      + 'gleichzeitig den Überblick über das gesamte Unternehmen behalten.',
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
      'Auskunft, Löschung, Aufbewahrung und Zugriffsschutz als fester '
      + 'Bestandteil des Systems statt als nachträgliche Zusatzaufgabe.',
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
      'Im Browser, auf iPhone und Android sowie als Programm für Windows, '
      + 'macOS und Linux – mit Funktionen, die auch offline weiterarbeiten.',
    punkte: [
      'Mitarbeiter-App für iPhone und Android',
      'Gesichts- oder Fingerabdruck-Sperre vor Lohn- und Personaldaten',
      'Kamera für Nachweise und Bescheinigungen, ohne Umweg über die Dateiauswahl',
      'Programm für Windows, macOS und Linux — mit eigenem Symbol im Startmenü',
      'Drucken ohne Browserrand: Stundennachweis und Dienstplan für die Personalakte',
      'Funktioniert im Funkloch und reicht nach, sobald wieder Netz da ist',
    ],
  },
]

/** Was unter der Funktionsliste steht — die Einordnung. */
export const FUNKTIONEN_SCHLUSS = {
  titel: 'Warum das alles geprüft ist',
  text:
    'Ein Programm, an dem Arbeitszeiten und Zuschläge hängen, darf sich '
    + 'nicht irren. Bei jeder '
    + 'Auslieferung laufen über 1400 Prüfungen gegen das laufende System — '
    + 'echte Anmeldung, echte Datenbank, mehrere Mandanten. Dazu kommen über '
    + '900 Rechenprüfungen und die Abnahme des Rechenkerns an wirklich '
    + 'gelösten Plänen. Schlägt eine fehl, wird nicht ausgeliefert.',
}

// ── Kontakt ─────────────────────────────────────────────────────────────────

export const KONTAKT = {
  vorspann: 'Schauen wir uns an, was Sie heute noch von Hand machen.',
  zeilen: ['Ihre Abläufe zuerst.', 'Unsere Software danach.'],
  text:
    'Zeigen Sie uns, wie Sie heute Mitarbeiter verwalten, planen, Zeiten '
    + 'erfassen und an Ihr Lohnbüro übergeben. Wir zeigen Ihnen, wie OKUN '
    + 'Workforce daraus einen durchgängigen Ablauf macht – passend zu Ihrem '
    + 'Unternehmen.',
  knopf: 'Gespräch vereinbaren',
}

// ── Überall ─────────────────────────────────────────────────────────────────

export const FUSS = {
  claim: 'Ihre gesamte Personalarbeit. Ein System.',
  text:
    'Recruiting, Mitarbeiterverwaltung, Personalplanung, Arbeitszeit, '
    + 'Abwesenheiten und Zuschläge – miteinander verbunden.',
  /*
   * §193 Der Rechteinhaber — „OKUN Systems UG", nicht „OKUN Workforce".
   *
   * Ein Urheberrechtsvermerk nennt den RECHTEINHABER. „OKUN Workforce" ist
   * der Produktname und keine Rechtsperson — ein Produkt kann keine Rechte
   * halten. Auf der Anmeldeseite stand genau das fest eingetippt, und es ist
   * dem Eigentümer selbst aufgefallen.
   *
   * Die Rechtsform gehört dazu, sonst steht da ein Handelsname ohne Träger.
   * Das „(haftungsbeschränkt)" bleibt weg: Im Impressum ist es Pflicht, in
   * einer Fußzeile nur lang.
   *
   * Zwei Felder, weil die beiden Fußzeilen verschieden viel Platz haben: Die
   * Website trägt den ganzen Satz, die Anmeldeseite nur den Namen.
   */
  inhaber: 'OKUN Systems UG',
  rechte: 'OKUN Systems UG. Alle Rechte vorbehalten.',
}

/** Der Text, den Google unter dem Link anzeigt. */
export const BESCHREIBUNG =
  'OKUN Workforce verbindet Recruiting, Mitarbeiterverwaltung, '
  + 'Personalplanung, Zeiterfassung und Zuschläge in einer zentralen '
  + 'Plattform.'
