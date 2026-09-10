# OKUN Workforce — Featureliste

Arbeitsliste. Jeder Punkt durchläuft: **besprechen → verstehen → implementieren
→ testen → abhaken.**

Angelegt 18.08.2026 auf Basis einer Bestandsaufnahme im Code.

## Bedeutung der Kennzeichnung

| | |
|---|---|
| `[ ]` **steht** | Code ist da und hat Substanz — **aber nicht nachgewiesen.** Braucht den Test-Schritt, bevor abgehakt wird. |
| `[ ]` **teilweise** | Ein Teil fehlt, im Punkt benannt. |
| `[ ]` **fehlt** | Nicht vorhanden. Kein Datenmodell, keine Route. |
| `[x]` | Besprochen, verstanden, umgesetzt **und getestet**. |

Der Unterschied zwischen „steht" und abgehakt ist der wichtigste in diesem
Dokument. Am 17.08. sah die Dienstplanung fertig aus und meldete 100 % — sie
hielt drei aktive Regeln nicht ein. Nichts wird abgehakt, weil es plausibel
aussieht.

---

## A · Mitarbeiter und Stammdaten

- [x] **A1 Mitarbeiter anlegen und verwalten** — nachgewiesen. Löschen ist der
      Plattformverwaltung vorbehalten; die Standortleitung deaktiviert stattdessen.
- [x] **A2 Mitarbeiterprofil** — nachgewiesen über die eigenen Daten, Unterlagen
      und Kollegensicht.
- [x] **A3 Einladung und Registrierung** — nachgewiesen: Einladung entsteht beim
      Anlegen und ist über den Link abrufbar.
- [x] **A4 Rollen und Rechte** — nachgewiesen an über dreißig Abschottungen.
- [x] **A5 Dateiablage** — fertig und getestet. Inhalt liegt in der Datenbank
      (Railways Dateispeicher ist nach jedem Neustart leer); ein S3-Speicher kann
      später dazukommen, ohne dass sich am Rest etwas ändert. 10 MB je Datei,
      nur PDF und Bilder. 19 Modultests, 18 Ende-zu-Ende-Checks am laufenden
      System, 5 im Browser.
- [x] **A6 Personalakte** — fertig und getestet. Arbeitsvertrag, Zeugnisse,
      Bescheinigungen, Krankmeldungen. Vertrag und Lohnabrechnung sieht der
      Mitarbeiter automatisch, alles Übrige nur nach ausdrücklicher Freigabe.
      Der Mitarbeiter kann Krankmeldungen selbst einreichen, sich aber keinen
      Vertrag in die Akte legen. Löschen ist weich (Aufbewahrungsfristen).

## B · Arbeitszeit

- [x] **B1 Zeiterfassung, Unternehmenssicht** — nachgewiesen. Leitung sieht die
      Buchungen ihres Standorts, eine fremde Leitung keine.
- [x] **B2 Zeiterfassung, Mitarbeitersicht** — nachgewiesen: ein- und ausstempeln,
      Pause starten und beenden, laufende Erfassung abrufen.
- [x] **B3 Zeiterfassungsprotokolle** — nachgewiesen. Der Mitarbeiter bekommt sein
      eigenes Monatsprotokoll (kam vorher gar nicht heran), das eines Kollegen nicht.
- [x] **B4 Freigabe und Monatsabschluss** — nachgewiesen: anlegen, abrufen, Freigaben.
- [x] **B5 Überstunden** — nachgewiesen: beantragen, teilweise genehmigen. Keine
      Selbstgenehmigung, keine Genehmigung durch eine fremde Leitung.
- [x] **B6 Stundenkonto** — nachgewiesen. Eigenes abrufbar, fremdes gesperrt.

## C · Abwesenheit

- [x] **C1 Urlaubsanträge** — nachgewiesen: beantragen, abrufen, genehmigen.
      Kein Antrag auf fremden Namen, keine Selbstgenehmigung, keine Bescheidung
      durch eine fremde Leitung.
- [x] **C2 Urlaubsjahresplanung** — nachgewiesen: Wunschsammlung starten,
      eigene Urlaubswünsche hinterlegen; nicht für Kollegen, nicht am fremden Standort.
- [x] **C3 Urlaubsregeln** — nachgewiesen. Nur die eigene Leitung setzt sie;
      unvollständige Angaben werden verständlich abgelehnt statt mit HTTP 500.
- [x] **C4 Abwesenheiten** — nachgewiesen: erfassen und korrigieren, nicht auf
      fremden Namen, nicht durch eine fremde Leitung. Der Krankenschein selbst
      liegt in der Personalakte (A6); die Verknüpfung von Schein und Fehlzeit
      steht noch aus und ist als eigener Punkt vermerkt.
- [x] **C5 Schließzeiten** — nachgewiesen: anlegen, löschen, Ende-vor-Beginn
      wird abgewiesen; eine fremde Leitung kann weder lesen noch anlegen noch löschen.

## D · Lohn

- [x] **D1 Lohnberechnung** — nachgewiesen, und inzwischen nicht mehr selbst
      gerechnet. Erst kamen beim Nachrechnen fünf Fehler heraus (doppelter
      Grundfreibetrag, Steuerklasse III ohne Splittingverfahren, volle
      Sozialabgaben statt Vorsorgepauschale, Kinderfreibetrag in der Lohnsteuer
      statt nur bei Soli und Kirchensteuer, Steuerformel von 2024 neben
      Freibeträgen von 2025). Nach der Korrektur stimmte Steuerklasse I auf den
      Cent — Klasse III lag immer noch 9 € daneben. Deshalb rechnet die
      Lohnsteuer jetzt der **amtliche Programmablaufplan des BMF**, dieselbe
      Vorschrift, die jede Lohnsoftware in Deutschland umsetzt (`lohnsteuer-pap.ts`).
      Wir liefern die Eingaben und übernehmen das Ergebnis. Die Jahreswerte
      stehen als Daten in `lohnjahre.ts` mit Quelle und Prüfvermerk — 2025 und
      2026 sind eingetragen; für ein Jahr ohne geprüfte Werte wird die
      Abrechnung **verweigert statt geschätzt**.
- [x] **D2 Zuschlagsregeln** — nachgewiesen, mit dem größten Fund des Blocks:
      Nacht-, Sonntags- und Feiertagszuschläge wurden voll versteuert, obwohl sie
      nach §3b EStG steuerfrei sind. Das kostete den Mitarbeiter bares Geld. Jetzt
      werden steuerfreier und beitragsfreier Anteil getrennt gerechnet (25 % / 50 %
      / 125 % des Grundlohns, Steuerfreiheit bis 50 €/h Grundlohn, Beitragsfreiheit
      nur bis 25 €/h) und auf Abrechnung, Beleg und DATEV-Datei getrennt
      ausgewiesen. Samstagszuschläge bleiben steuerpflichtig — dafür gibt es keine
      Vorschrift.
- [x] **D3 Lohnabrechnung als Dokument** — fertig und getestet. `src/lib/lohnbeleg.ts`
      erzeugt die Entgeltabrechnung als PDF mit allen Angaben nach §108 GewO und
      Entgeltbescheinigungsverordnung; sie landet in der Personalakte.
- [x] **D4 Zustellung an den Mitarbeiter** — fertig und getestet. Der Beleg liegt
      für den Mitarbeiter sichtbar in seinen Unterlagen, er wird benachrichtigt,
      und eine fremde Leitung kommt nicht heran.
- [x] **D5 DATEV-Export** — fertig und getestet. CSV mit einer Zeile je Lohnart,
      zugeordnet über die Personalnummer, Berater- und Mandantennummer im Kopf.
      Keine behauptete Zertifizierung — eine strukturierte Übergabedatei.
- [x] **D6 Auszahlung per SEPA-Datei** — fertig und getestet. pain.001.001.03 mit
      geprüfter IBAN-Prüfsumme und stimmender Kontrollsumme. Bewusst als Datei zum
      Upload bei der Bank, nicht als eigene Zahlungsauslösung (erlaubnispflichtig,
      ZAG).

  **Kein einziger externer Zugang nötig.** Gerechnet wird bei uns, DATEV und SEPA
  sind Dateien zum Weitergeben, Feiertage rechnen wir selbst. Das Einzige, was
  von außen kommt, ist einmal im Jahr der Programmablaufplan des BMF — ein
  Download, kein Zugang.
- [ ] **D7 Meldewesen (SV-Meldungen, Lohnsteueranmeldung)** — **bewusst nicht
      selbst.** Braucht zertifizierte Übermittlung (ITSG, ELSTER). Läuft über
      Steuerberater oder DATEV — dafür D5.

## E · Kommunikation

- [x] **E1 Push-Infrastruktur** — nachgewiesen. Ein Gerät lässt sich nur für die
      eigene Person anmelden; fremde Push-Nachrichten sind nicht mitlesbar.
- [x] **E2 Benachrichtigungen** — nachgewiesen: eigenes Postfach lesen und
      markieren, Rundruf am eigenen Standort. Fremde Postfächer, fremde
      Nachrichten und Rundrufe an fremde Standorte sind gesperrt.
- [x] **E3 Einspringen und Kandidatensuche** — nachgewiesen: Anfrage anlegen,
      5 Kandidaten werden automatisch ermittelt. Keine Zusage im Namen anderer,
      keine Eskalation durch eine fremde Leitung.
- [x] **E4 Einspringen: Benachrichtigung der Infragekommenden** — fertig und
      getestet. Ausfall am Dienst melden, Empfänger wählen, Postfach/Push/E-Mail;
      danach Dienstanfrage oder direktes Besetzen. 16 Ende-zu-Ende-Checks.
- [ ] **E5 Mitarbeiter-Chat** — **fehlt.** Es gibt nur Support-Tickets.

## F · Dienstplanung

Sonderfall: wird pro Kunde von Hand programmiert, nicht vom Kunden eingerichtet.
Siehe `PRODUKT-NOTIZEN.md`.

- [x] **F1 Rechenkern** — nachgewiesen. Rechendienst erreichbar und auf passendem
      Stand (Version 98); der Versionsabgleich greift.
- [x] **F2 Plan erzeugen und speichern** — nachgewiesen: Lauf angenommen, Ergebnis
      abgeschlossen, 54 Zuweisungen, alle mit den definierten Dienstzeiten.
      Woche speichern und abrufen; alles gegen fremde Standorte gesperrt.
- [x] **F3 Dienstwünsche** — nachgewiesen: eintragen und abrufen; kein Wunsch auf
      fremden Namen, keine Einsicht in fremde Wünsche.
- [x] **F4 Schichttausch** — nachgewiesen: Anfrage stellen, bestätigen, und die
      Dienste sind danach WIRKLICH getauscht. Nur die angefragte Person darf
      antworten; ein beantworteter Tausch lässt sich nicht erneut beantworten.
- [ ] **F5 Kundenmodul-Mechanik** — Entwurf liegt unter
      `solver-service/rulepacks/`, nicht eingebunden, nicht aktiv
- [ ] **F6 Freischaltung je Kunde** — **fehlt.** Dienstplanung soll gesperrt sein,
      bis das Kundenmodul abgenommen ist.

## G · Grundlagen und Betrieb

- [ ] **G1 DSGVO: Auskunft und Datenexport** — **fehlt.**
- [ ] **G2 DSGVO: Löschkonzept** — teilweise. Beim Löschen des eigenen Kontos wird
      anonymisiert; ein durchgängiges Konzept mit Fristen fehlt.
- [ ] **G3 Automatische Prüfung vor dem Ausrollen** — **fehlt.**
      `.github/workflows` ist leer. Ohne das trägt kein Qualitätsversprechen.
- [x] **G4 Mandantentrennung** — nachgewiesen in allen geprüften Bereichen.
- [x] **G5 Prüfprotokolle** — nachgewiesen (Schreiben in die Datenbank).

---

## Zählung

| Zustand | Anzahl |
|---|---|
| abgehakt (getestet) | 54 |
| teilweise | 1 |
| fehlt | 5 |
| bewusst nicht selbst | 1 |

## Vorschlag für die Reihenfolge

1. **A · Mitarbeiter und Stammdaten** — alles hängt daran, und A5 (Dateiablage)
   ist zugleich das Fundament für Personalakte, Krankenscheine und Lohnbelege.
2. **D · Lohn** — größter sichtbarer Nutzen; D3/D4 fallen nach A5 leicht.
3. **E · Kommunikation** — E4 ist ein kleiner Handgriff mit großer Wirkung.
4. **C · Abwesenheit** — C4 schließt nach A5 auf.
5. **B · Arbeitszeit** — steht weitgehend, braucht vor allem den Nachweis.
6. **G · Grundlagen** — G3 vorziehen, sobald der erste Kunde produktiv ist.
7. **F · Dienstplanung** — nach der Standardstrecke.

Innerhalb jedes Punktes gehört zum Schritt „verstehen" ausdrücklich, das
Vorhandene **auszuprobieren** statt es anzunehmen.

---

# Aktueller Auftrag (18.08.2026)

Alles aus den Ansagen des Inhabers. Wird hier abgehakt, sobald es **läuft und
getestet ist** — nicht wenn es vorbereitet ist.

## Dateiablage und Akte
- [x] **1 Dateiablage** — siehe A5
- [x] **2 Personalakte** — siehe A6

## Vertretung / Dienstausfall
- [x] **3 Dienst im Plan anklicken** → verschieben, löschen, **fällt aus**
- [x] **4 Ausfall-Dialog** mit Grund und Empfängerwahl: alle, ausgewählte oder niemand
- [x] **5 Mitarbeiter werden wirklich benachrichtigt** — Postfach, Push und E-Mail;
      im Test 11 von 11 Kollegen, die ausgefallene Person ausgenommen
- [x] **6 Dienstanfrage und Besetzen** — der Dienst kommt als Vertretung zurück
      in den Plan, mit unveränderten Zeiten; doppelte Vergabe wird verhindert
- [x] **7 KI-Chat entfernt** — Komponente, Entwurfsmodul und KI-Route gelöscht

## Mitarbeiter-Ablauf
- [x] **8 Lohn-Stammdaten am Mitarbeiter** — eigene, streng geschützte Tabelle:
      Steuerklasse, Kinderfreibeträge, Konfession, Bundesland, Versicherungsart,
      Krankenkasse mit Zusatzbeitrag, SV-Nummer, Steuer-ID, Lohnart mit Stunden-
      oder Monatslohn, IBAN/BIC, Anschrift, Ein- und Austritt, Probezeit,
      Befristung, Schwerbehinderung. Sie speisen die Abrechnung wirklich:
      „Abrechnung vorbereiten" übernimmt sie und benennt, wo etwas fehlt.
- [x] **9 Anlegen auf Unternehmensebene** — neue Seite mit Liste, Suche,
      Standortfilter, Warnung bei Mitarbeitern ohne Standort, Anlegen samt
      Einladung und anschließender Standortzuordnung per Klick
- [x] **10 Am Standort nur noch dienstplanbezogene Angaben** — Gruppe, Bereich,
      feste freie Tage, Qualifikationen. Lohn und Bank bleiben Sache des
      Unternehmens; eine fremde Standortleitung kommt an beides nicht heran

## Unternehmensebene aufräumen
- [x] **11 Dienstplanung aus der Unternehmens-Navigation entfernt** — erreichbar
      über den jeweiligen Standort
- [x] **12 Planungsmodell entfernt** (`/company/model` gelöscht, liefert 404)
- [x] **13 Scores und KI-Analyse entfernt** — alle fünf Seiten gelöscht, im Test
      alle mit 404 nachgewiesen; auf Standortebene bleiben sie erhalten
- [x] **14 Standort öffnen und dort alles sehen** — neues Standort-Cockpit mit
      Kennzahlen, offenen Punkten, Basiswerten, Struktur nach Etagen, Mitarbeiter-
      liste und Wegen zu Dienstplan, Urlaub, Vertretungen, Regeln, Auswertungen
- [x] **15 Unternehmensonboarding entfernt** — es erfasste Unternehmens- und
      Standortdaten per Sprachmodell. Dieselbe Aufgabe erledigen jetzt die
      Unternehmenseinstellungen und der Einrichtungs-Assistent am Standort.
      Die Zwangsweiterleitung beim ersten Login ist ebenfalls weg, ebenso der
      Tour-Schritt und alle Verweise darauf.

---

# Aufräumen der Menüs (18.08.2026)

- [x] **Standortebene: Dienstplanung von 7 auf 4** — Dienstplan, Kalender,
      Urlaub & Wünsche, Vertretungen. Urlaubsanträge, Jahresplanung und
      Dienstwünsche liegen jetzt auf einer Seite mit Umschaltung.
- [x] **Standortebene: Auswertungen von 6 auf 3** — Workforce Insights,
      Fairness, Personalrisiko und Controlling sind eine Seite mit vier
      Ansichten; daneben nur noch Workforce Score und Berichte.
- [x] **Irreführende KI-Marken entfernt** — Dienstplan, Urlaub und Vertretungen
      trugen goldene „KI"-Abzeichen. Die Planung rechnet mit einem Solver, und
      aus der Vertretung wurde die KI bewusst entfernt.
- [x] **Doppeltes Icon behoben** — „KI & Analyse" und „OKUN Assistent" waren
      beide derselbe goldene Stern. Auswertungen bekommen ein Diagramm-Symbol,
      der Assistent ein Frage-Symbol.
- [x] **Aufgabenkatalog in die Einstellungen** — er ist Konfiguration, keine
      tägliche Planung.
- [x] **Sieben Routen entfernt**, alle Verweise, Benachrichtigungs-Ziele,
      Hilfetexte und Tour-Schritte mitgezogen.

---

# Befunde aus der Nachweis-Phase

Gefunden, weil geprüft statt geglaubt wurde — und jeweils sofort behoben.

## Block A (18.08.)
- **Kollegendaten offen**: Jeder Mitarbeiter konnte Stundenkonto,
  Urlaubsanspruch, verbrauchte Urlaubstage und Wochenstunden aller Kollegen
  abrufen. Behoben: Kollegen zeigen nur noch Name, Funktion, Standort, Gruppe
  und Qualifikationen; die eigenen Daten bleiben vollständig.

## Block F (10.09.)
- **Ein Planungslauf ließ sich an JEDEM Standort starten.** Eine fremde Leitung
  konnte beim Wettbewerber einen Dienstplan rechnen lassen und über die
  Sitzungs-ID an dessen Personaldaten kommen. Der gravierendste Fund in diesem
  Block.
- **Arbeitszeitregeln standen jedem Angemeldeten offen** — Höchststunden,
  Ruhezeit und Folgetage ließen sich ohne Rollenprüfung ändern.
- Zwölf Schnittstellen abgesichert: Planungsläufe, Planungssitzungen,
  Arbeitszeitregeln, Planungsrichtlinie, Einheiten, Wochenspeicherung,
  Nachoptimierung, Korrekturen und Dienstwünsche.

## Block E (10.09.)
- **Fremde Push-Nachrichten waren mitlesbar.** `push/subscribe` nahm eine
  beliebige `employeeId` entgegen — man konnte das EIGENE Gerät als Empfänger
  für die Meldungen einer Kollegin eintragen und ab dann alles mitlesen.
  Der gravierendste Einzelfund dieser Prüfphase.
- **Fremde Postfächer waren lesbar** und fremde Nachrichten ließen sich als
  gelesen markieren — also im Postfach der anderen Person verstecken.
- **Rundrufe gingen an jeden angegebenen Standort**, auch an den eines
  fremden Kunden.
- **Zusagen und Tauschanfragen im Namen anderer** waren möglich: sowohl das
  Zusagen auf eine Vertretung als auch das Stellen einer Tauschanfrage nahmen
  die handelnde Person aus dem Aufruf statt aus der Anmeldung.
- Elf Schnittstellen abgesichert.

## Block C (10.09.)
- **Acht Schnittstellen ohne Standortprüfung.** Eine fremde Leitung konnte die
  Urlaubsregeln, Jahresplanung und Schließzeiten eines anderen Kunden ändern
  und dessen Urlaubsanträge bescheiden. Alle geschlossen.
- **Zugriffsprüfung nur im Lesen, nicht im Schreiben.** Bei `absences` und
  `vacation-requests` stand sie im GET, fehlte aber im POST: Ein Mitarbeiter
  konnte eine Krankmeldung und einen Urlaubsantrag auf den Namen einer
  Kollegin einreichen.
- **Drei Routen stürzten mit HTTP 500 und LEEREM Antworttext ab**, sobald ein
  Feld fehlte oder unbekannt war — der Nutzer sah gar nichts. Urlaubsregeln
  und Urlaubswünsche antworten jetzt mit Klartext; beim Urlaubsantrag ermittelt
  der Server den Standortnamen selbst, statt ihn vom Aufrufer zu verlangen.

## Block B (10.09.)
- **17 von 18 Zeiterfassungs-Schnittstellen ohne Zugriffsprüfung.** Jeder
  Angemeldete konnte für jede beliebige Person stempeln, Pausen buchen,
  Überstunden beantragen, Zeitbuchungen ändern, Monatsabschlüsse korrigieren
  und freigeben — auch über Mandantengrenzen hinweg. Alle 18 abgesichert.
- **`assertEmployeeAccess` war zu weit gefasst.** Ein Mitarbeiter fiel in
  denselben Zweig wie eine Leitung und durfte damit auf alle Kolleginnen und
  Kollegen seines Standorts zugreifen. Für die Rolle „employee" gilt jetzt
  ausschließlich der eigene Datensatz. Eine Stelle, Wirkung überall.
- **`notify-admin` nahm einen frei erfundenen Absendernamen** und eine
  beliebige Standort-ID entgegen. Jetzt zählt nur, wer wirklich anfragt, und
  der Standort muss zum Aufrufer gehören.
- **Doppeltes Einstempeln** legte eine zweite laufende Erfassung an; die Zeit
  lief doppelt und der Monatsabschluss stimmte nicht mehr. Wird abgewiesen.
- **Der Mitarbeiter kam an sein eigenes Zeitprotokoll nicht heran** — die
  Rollenliste schloss ihn aus. Korrigiert.

## Block D (10.09.)

51 Prüfungen: 36 gegen Beleg, Zustellung, DATEV und SEPA, 15 gegen die
Lohnberechnung selbst — dazu 33 Rechentests gegen den Gesetzestext.

- **Fünf Fehler in der Lohnsteuer.** Der Grundfreibetrag wurde doppelt
  abgezogen: einmal von Hand, und noch einmal, weil er in der Formel des
  §32a EStG bereits steckt. Steuerklasse III rechnete mit einem verdoppelten
  Freibetrag statt nach dem Splittingverfahren. Statt der Vorsorgepauschale
  nach §39b Abs.2 wurden die vollen Sozialabgaben abgesetzt. Der
  Kinderfreibetrag minderte die Lohnsteuer, obwohl er nach §51a EStG nur für
  Soli und Kirchensteuer zählt. Und die Formel selbst war die von 2024, während
  die Freibeträge daneben von 2025 stammten. Alles korrigiert und gegen den
  Gesetzestext nachgerechnet.
- **Steuerfreie Zuschläge wurden versteuert.** Nacht-, Sonntags- und
  Feiertagszuschläge sind nach §3b EStG bis zu festen Sätzen steuerfrei — das
  Programm hat sie voll versteuert und verbeitragt. Im Testfall waren das
  25 EUR im Monat, die dem Mitarbeiter zustanden. Jetzt werden steuerfreier
  und beitragsfreier Anteil getrennt gerechnet und getrennt ausgewiesen.
- **„Vorbereiten" hat nie gerechnet.** Der Lauf übertrug nur die Stammdaten;
  Brutto und Netto blieben null. Damit war der Beleg leer, die DATEV-Datei ohne
  Lohnarten und die SEPA-Datei ohne Zahlung. Jetzt fließen Stunden aus der
  Zeiterfassung, Urlaub und Krankheit aus den Abwesenheiten und die Zuschläge
  aus dem Regelwerk des Kunden ein.
- **Ein zweiter Lauf hätte Freigegebenes überschrieben.** Entwürfe werden neu
  gerechnet, freigegebene Abrechnungen bleiben unangetastet.
- **Der Zusatzbeitrag der Krankenkasse wurde ignoriert.** Gerechnet wurde mit
  einem Durchschnittswert, obwohl der echte Satz am Mitarbeiter hinterlegt ist.

## Block D, zweiter Durchgang (10.09.) — Lohnsteuer vom Amt statt selbst gebaut

Nach der Korrektur der eigenen Steuerformel stimmte Steuerklasse I auf den Cent
(395,83 €), Steuerklasse III aber immer noch nicht: 111,17 € statt 102,00 €.
Eine Abweichung, die man einer Zahl nicht ansieht und die jeden Monat auf jeder
Abrechnung stünde. Deshalb der Wechsel auf die amtliche Vorlage.

- **Die Lohnsteuer rechnet jetzt der BMF-Programmablaufplan.** Kein API, keine
  laufende Verbindung — eine Umsetzung der amtlichen Vorschrift als Bibliothek
  (`lohnsteuerrechner`, MIT, eine Abhängigkeit). Vor der Aufnahme geprüft: keine
  Installationsskripte, keine Netzaufrufe, kein `eval`. Der Rechenweg trägt die
  Seitenverweise des Ablaufplans und die dort vorgeschriebenen Rundungsregeln.
- **Unabhängig nachgerechnet, nicht geglaubt.** Ein Referenzfall wurde von Hand
  aus den Konstanten des Ablaufplans hergeleitet (5.000 € · StKl I · 2026 →
  9.430 € Jahressteuer → 785,83 € im Monat) und stimmt auf den Cent. Zusätzlich
  ist der Tarif an seinen Bruchstellen nachgerechnet: Zone 2 endet exakt beim
  Startwert von Zone 3.
- **Die 2026er Werte sind damit belegt statt geraten** — Grundfreibetrag
  12.348 €, Beitragsbemessungsgrenzen 8.450 € und 5.812,50 € im Monat,
  Soli-Freigrenze 20.350 €. Vorher hätte ich die Tarifkoeffizienten raten müssen.
- **Zwei Dinge, die vorher als „braucht einen Steuerberater" markiert waren,
  gehen jetzt:** die abweichende Aufteilung der Pflegeversicherung in Sachsen
  und der Beitragsabschlag ab dem zweiten Kind unter 25.
- **Kinderlosenzuschlag und Kinderabschlag sind zwei verschiedene Dinge** und
  wurden vorher aus der Zahl der Kinderfreibeträge abgeleitet — das ist falsch.
  Der Zuschlag entfällt dauerhaft mit dem ersten Kind, die Abschläge gibt es nur
  für Kinder unter 25. Beide Angaben stehen jetzt eigens am Lohnprofil.
- **Jahre ohne geprüfte Rechengrößen werden abgewiesen**, mit einer Meldung, die
  sagt was fehlt und wo es einzutragen ist — statt still mit falschen Werten zu
  rechnen. Am laufenden System nachgewiesen.
- **Auf dem Beleg steht jetzt, wonach gerechnet wurde**, und die Grundlage wird
  an der Abrechnung gespeichert. Wer eine alte Abrechnung prüft, sieht den Stand
  ohne Rückfrage.

Nachweis: 19 Prüfungen gegen den Ablaufplan, 37 im Rechenkern, 39 am laufenden
System für Beleg, Export und SEPA, 15 für die Lohnberechnung.

## Offen und bewusst so
- Der Zugriff auf **ELStAM** (Steuerklassen elektronisch von der Finanzverwaltung)
  braucht einen zertifizierten Zugang. Bei uns trägt sie jemand ein — zulässig,
  aber der Kunde steht dafür gerade. Gehört in seinen Vertrag.
- **npm audit** meldet 12 Befunde, alle in `postcss` innerhalb von Next.js und
  alle schon vor diesem Block vorhanden. Die Behebung hieße Next 16 — eigener
  Vorgang, nicht nebenbei.

## Noch offen aus der Nachweis-Phase
- [ ] **Krankenschein mit Fehlzeit verknüpfen** — die Datei liegt in der
      Personalakte, die Abwesenheit im Kalender; beides ist noch nicht
      miteinander verbunden.
