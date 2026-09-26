# OKUN Workforce — Featureliste

> **Wo wir gerade stehen, steht in `STAND.md`.** Diese Liste hier hält fest,
> was fertig ist und wie es nachgewiesen wurde — sie ist das Gedächtnis, nicht
> die Tagesordnung.

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
- [x] **C4 Abwesenheiten** — nachgewiesen: erfassen, korrigieren und entfernen,
      nicht auf fremden Namen, nicht durch eine fremde Leitung.
- [x] **C6 Krankenschein und Fehlzeit** — fertig. Die Bescheinigung wird beim
      Einreichen der passenden Fehlzeit zugeordnet, Lücken werden benannt, die
      Frist nach §5 EntgFG ist einstellbar. Siehe Block C6 unten.
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
- [x] **E5 Mitarbeiter-Chat** — fertig. Jeder schreibt jedem am eigenen
      Standort, die Standortleitung eröffnet und verwaltet Gruppen. Siehe
      Block E5 unten.

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
- [x] **F5 Kundenmodul-Mechanik** — fertig. Entwurf lag unter
      `solver-service/rulepacks/`, nicht eingebunden, nicht aktiv
- [x] **F6 Freischaltung je Kunde** — fertig. Dienstplanung ist gesperrt,
      bis das Kundenmodul abgenommen ist.

## G · Grundlagen und Betrieb

- [x] **G1 DSGVO: Auskunft und Datenexport** — fertig. Jeder holt seine Auskunft
      selbst, als lesbares PDF und als Datei zum Mitnehmen. Siehe Block G1/G2 unten.
- [x] **G2 DSGVO: Löschkonzept** — fertig. Katalog über alle 35 Tabellen mit
      Personenbezug, Vorschau vor jeder Löschung, Sperre statt Löschung wo das
      Gesetz es verlangt, Löschbericht als Nachweis. Siehe Block G1/G2 unten.
- [x] **G3 Automatische Prüfung vor dem Ausrollen** — fertig. 670 Nachweise im
      Repo unter `pruefungen/`, ein Befehl (`npm run pruefen`), automatischer
      Lauf bei jedem Push. Siehe Block G3 unten.
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

## Block D8 (10.09.) — ELStAM

Die Lohnsteuer ist seit dem Wechsel auf den amtlichen Ablaufplan exakt. Exakt
gerechnet mit einem veralteten Merkmal ist aber trotzdem falsch: Steuerklasse,
Kinderfreibeträge und Freibeträge kommen vom Finanzamt und ändern sich laufend.
Bei 3.400 € brutto liegen zwischen Klasse I und Klasse III mit einem Kind
**286 € im Monat** — und für zu wenig einbehaltene Lohnsteuer haftet der
Arbeitgeber (§42d EStG).

- [x] **D8 ELStAM-Abgleich** — fertig und getestet. Zwei Teile:
      - **Der schützende:** Jedes Lohnprofil trägt einen ELStAM-Stand. Vor dem
        Abrechnungslauf wird gemeldet, wessen Stand fehlt oder älter ist als der
        Abrechnungsmonat. Gewarnt, nicht gesperrt — manchmal gibt es schlicht
        keine Änderung, aber es muss jemandem auffallen, bevor gerechnet wird.
      - **Der bequeme:** Die monatliche Änderungsliste wird eingelesen. Der
        Abgleich zeigt Mitarbeiter für Mitarbeiter, was sich ändern *würde*;
        übernommen wird erst nach Bestätigung. Festgehalten wird, von wann der
        Stand ist, aus welcher Liste er kommt und wer bestätigt hat.
- [x] **Freibetrag, Hinzurechnungsbetrag und Faktor** — gehören zu ELStAM, wurden
      bisher gar nicht geführt. Der amtliche Ablaufplan nimmt sie entgegen, jetzt
      werden sie auch gefüllt. Der Faktor gilt nur in Steuerklasse IV; an einer
      anderen Klasse wäre er ein Datenfehler und wird nicht angewandt.

Entscheidungen, die im Code stehen und begründet sind:

- **Zugeordnet wird über die Steuer-ID**, ersatzweise Personalnummer, notfalls
  Name. Eine Zuordnung über den Namen wird gekennzeichnet und ist **nicht**
  vorausgewählt — bei Namensgleichheit wird gar nicht zugeordnet, sondern gefragt.
- **Felder, die die Liste nicht nennt, bleiben unangetastet.** Eine fehlende
  Spalte darf keinen bestehenden Freibetrag löschen.
- **Die Datei ist nur ein Parser.** Käme später ein zertifizierter Abruf dazu,
  bliebe alles Übrige — Abgleich, Bestätigung, Nachweis — unverändert.
- **Eine fremde Leitung findet fremde Mitarbeiter in ihrer Datei gar nicht erst.**
  Kein Fehler, kein Hinweis: der Abgleich läuft nur gegen den eigenen Bestand.

Nachweis: 22 Modultests, 24 Prüfungen am laufenden System — darunter der
vollständige Weg von der Liste bis zur gesunkenen Lohnsteuer (388 € → 102 €).

## Block D9 (10.09.) — Rückwirkende Aufrollung

Der Fall, um den es geht: Eine Abrechnung ist freigegeben und ausgezahlt. Danach
ändert sich etwas an ihrer Grundlage — ein Krankenschein wird nachgereicht, eine
Zeitbuchung korrigiert, das Finanzamt meldet rückwirkend eine andere
Steuerklasse, eine Gehaltserhöhung gilt ab einem vergangenen Datum. Bisher
passierte dann nichts: ein freigegebener Monat wurde nicht mehr angefasst, und
die Abrechnung blieb dauerhaft falsch. **Das ist kein Randfall, sondern der
Normalfall in jedem Betrieb.**

- [x] **D9 Aufrollung** — fertig und getestet.
      - Freigegebene Monate werden mit den heutigen Daten nachgerechnet. Die
        freigegebene Abrechnung wird dabei **nie überschrieben** — sie bleibt,
        wie sie unterschrieben wurde. Der Unterschied entsteht als eigener,
        nachvollziehbarer Datensatz daneben.
      - Wie beim ELStAM-Import: erst zeigen was abweicht, dann bestätigen.
        Geprüft wird das ganze Jahr, weil niemand vorher weiß, welcher Monat
        betroffen ist.
      - Die Differenz wird im nächsten offenen Monat ausgezahlt. Ist der schon
        freigegeben, **wandert die Korrektur weiter statt liegenzubleiben.**
      - Eine versehentlich angelegte Korrektur lässt sich verwerfen. Eine
        bereits ausgezahlte nicht — dafür gibt es die Aufrollung des
        Ausgleichsmonats.
- [x] **Auszahlungsbetrag als eigenes Feld** — Netto plus Korrektur. SEPA, DATEV
      und der Beleg lesen dieses eine Feld, damit sie nicht auseinanderlaufen
      können. Auf dem Beleg steht die Korrektur als eigene Zeile mit Herkunft
      („Nachzahlung aus August 2026"), in der DATEV-Datei als eigene Lohnart.

Zwei Rechtsprinzipien, die hier bewusst getrennt behandelt werden:

- **Lohnsteuer folgt dem Zuflussprinzip.** Die Differenz wird in dem Monat
  versteuert, in dem sie ausgezahlt wird; §41c EStG erlaubt dem Arbeitgeber die
  Aufrollung innerhalb des Jahres.
- **Sozialversicherung folgt beim laufenden Entgelt dem Entstehungsprinzip.**
  Die Beiträge gehören in den Ursprungsmonat. Deshalb hält jeder
  Korrekturdatensatz **beide** Monate fest — das ist die Grundlage für den
  späteren Beitragsnachweis.

### Dabei gefunden und behoben: die Lohn-Schnittstelle war offen

Block D war bei der Nachweis-Phase übersprungen worden, deshalb war
`/api/payroll` nie geprüft. Es fanden sich drei Löcher:

- **Eine fremde Leitung konnte eine fremde Abrechnung freigeben und ändern.**
  PATCH hat allein über die Kennung gearbeitet, ohne zu prüfen, wem die
  Abrechnung gehört — über Mandantengrenzen hinweg. Am laufenden System
  nachgewiesen und behoben.
- **Der Browser bestimmte Brutto und Netto.** POST schrieb den ganzen
  Anfragekörper in die Datenbank. Jetzt liefert er nur die
  Bemessungsgrundlagen; gerechnet wird auf dem Server.
- **Eine Standortleitung sah die Abrechnungen aller Standorte.** GET war nur
  nach Kunde gefiltert, nicht nach Standort.

Dazu: ein freigegebener Monat lässt sich über POST nicht mehr überschreiben
(HTTP 409), und wer freigibt, wird festgehalten statt vom Absender bestimmt.

Nachweis: 15 Modultests, 40 Prüfungen am laufenden System — darunter der ganze
Weg von der rückwirkenden Steuerklassenänderung über die Korrektur bis zum
höheren Betrag in der SEPA-Datei.

## Block D10 (10.09.) — Einmalzahlungen

Weihnachtsgeld hat jeder Kunde, und bisher gab es dafür gar keinen Platz. Wer es
zahlen wollte, konnte es nur als erhöhtes Monatsgehalt eintragen — dann stimmte
weder die Steuer noch der Beitrag.

- [x] **Einmalzahlungen** — Weihnachtsgeld, Urlaubsgeld, Prämien, Abfindungen.
      Sie werden erfasst und beim nächsten Abrechnungslauf gerechnet; dieselbe
      Reihenfolge wie bei allem anderen.
- [x] **Besteuert nach §39b Abs.3 EStG** — die Steuer auf eine Einmalzahlung ist
      der Unterschied zwischen der Jahressteuer mit und ohne sie. Der amtliche
      Ablaufplan konnte das bereits, wir haben es nur nicht genutzt.
- [x] **Verbeitragt an der anteiligen Jahresgrenze**, nicht an der Monatsgrenze.
      Das ist der teuerste Fehler bei Einmalzahlungen: wer mit der Monatsgrenze
      rechnet, verbeitragt bei Gutverdienern zu wenig — und das fällt erst bei
      der Betriebsprüfung auf, Jahre später. Renten- und Krankenversicherung
      werden an getrennten Grenzen gerechnet.
- [x] **Die Märzklausel wird gemeldet, nicht geraten.** §23a Abs.4 SGB IV kann
      eine Zahlung aus dem ersten Quartal dem Vorjahr zuordnen. Das braucht die
      vollständigen Vorjahresdaten — solange die nicht sicher vorliegen, gibt es
      eine Warnung statt einer stillen Annahme.
- [x] **Abfindungen sind beitragsfrei**, aber steuerpflichtig — sie entschädigen
      den Verlust des Arbeitsplatzes und sind kein Arbeitsentgelt.
- [x] Getrennte Lohnarten im DATEV-Export, eigene Zeile auf dem Beleg, getrennt
      ausgewiesene Steuer.
- [x] Ein freigegebener Monat lässt sich nicht nachträglich um eine Zahlung
      ergänzen — dafür gibt es die Aufrollung.

Nachweis: 21 Modultests, 29 Prüfungen am laufenden System. Im Testfall bleiben
von 3.400 EUR Weihnachtsgeld **2.217,90 EUR netto** (463 EUR Steuer,
719,10 EUR Beiträge).

## Block D11 (10.09.) — Minijob, kurzfristig, Übergangsbereich

In Kita und Reha sind geringfügig Beschäftigte der Normalfall. Bisher hat das
Programm bei kleinen Beträgen nur gewarnt und ansonsten wie bei einem regulären
Arbeitsverhältnis gerechnet — **falsch in beide Richtungen**: dem Minijobber
wurden Beiträge abgezogen, die er nicht schuldet, und der Arbeitgeber zahlte
nicht die Pauschalen, die er schuldet.

- [x] **Minijob** — 15 % Rente und 13 % Kranken pauschal beim Arbeitgeber,
      3,6 % Eigenanteil beim Arbeitnehmer (befreibar), 2 % Pauschsteuer statt
      Besteuerung nach ELStAM. Nachgewiesen: von 500 € bleiben 482 €, den
      Arbeitgeber kostet es 650 €.
- [x] **Kurzfristige Beschäftigung** — beitragsfrei in allen Zweigen, aber
      steuerpflichtig. Mit Hinweis auf die Zeitgrenze.
- [x] **Übergangsbereich** nach §20 Abs.2a SGB IV — mit beiden Bemessungsgrößen:
      der Gesamtbeitrag bemisst sich anders als der Arbeitnehmeranteil. Deshalb
      trägt der Arbeitgeber an der Untergrenze alles allein. Bei 1.200 € zahlt
      der Arbeitnehmer 180,77 € statt 246,60 €.
- [x] **Er steht bewusst nicht zur Wahl.** Wer als „regulär" geführt wird und im
      Bereich verdient, wird so gerechnet — das ist Gesetz, keine Vereinbarung.

Zwei Entscheidungen, auf die es ankam:

- **Die Geringfügigkeitsgrenze steht nicht als Zahl im Code.** Sie folgt seit
  2022 dem Mindestlohn (§8 Abs.1a SGB IV) und wird daraus gerechnet. Die
  Herleitung bestätigt sich selbst: 12,82 € Mindestlohn ergeben genau die
  amtlichen 556 € für 2025. Damit kann sie nicht veralten, ohne dass es
  auffällt — geprüft werden muss nur noch der Mindestlohn. Für 2026 ist er im
  Prüfvermerk ausdrücklich als **ungeprüft** markiert.
- **Kein Sprung an der Schwelle.** Ein Euro mehr Brutto darf nie weniger Netto
  bedeuten. Eigens getestet, sowohl als Modultest als auch am laufenden System:
  603 € → 581,29 € netto, 604 € → 603,70 € netto.

Nachweis: 35 Modultests, 22 Prüfungen am laufenden System.

## Block D13 (10.09.) — Teilmonate

Wer mitten im Monat kommt oder geht, hat bisher das volle Monatsgehalt bekommen,
und die Beitragsbemessungsgrenzen galten für den ganzen Monat. Hat jeder Kunde,
und es stimmte davon nichts.

- [x] **SV-Tage statt Kalendertagen.** Die Sozialversicherung zählt anders: jeder
      volle Monat hat 30 Tage — auch der Februar, auch der Januar. Der 31. zählt
      nicht. Ein Teilmonat, der am Monatsende ausläuft, wird im Februar auf 30
      aufgefüllt.
- [x] **Die Probe, die alles zusammenhält:** zwei Teilmonate desselben Monats
      müssen zusammen genau 30 ergeben. Der 1.–14. Februar sind 14 SV-Tage, der
      15.–28. sind 16 — zusammen 30. Wer Kalendertage zählt, kommt auf 28 und
      verbeitragt zu wenig. Am laufenden System nachgewiesen: zwei halbe Monate
      ergeben zusammen wieder genau 3.400 € Brutto.
- [x] Anteiliges Gehalt, anteilige Bemessungsgrenzen. Stundenlöhner bleiben
      unberührt — sie werden ohnehin nach Stunden bezahlt.
- [x] Wer im Monat gar nicht beschäftigt war, bekommt keine Abrechnung.
- [x] Anteiliger Urlaubsanspruch nach §5 BUrlG mit der vorgeschriebenen
      Aufrundung, Urlaubsabgeltung nach §7 Abs.4 und §11 BUrlG.

**Dabei gefunden:** Die Beschäftigungsart wurde nach dem Monatsbetrag
klassifiziert. Wer mit 3.400 € Gehalt am 25. anfängt, kommt auf rund 566 € im
ersten Monat — und wäre damit fälschlich im Übergangsbereich gelandet, mit
falschen Beiträgen. Klassifiziert wird jetzt nach dem **regelmäßigen** Entgelt.
Eigens getestet.

Nachweis: 27 Modultests, 14 Prüfungen am laufenden System.

## Block G3 (10.09.) — Automatische Prüfung vor dem Ausrollen

Bis heute lagen über 280 Prüfungen **nur im Arbeitsverzeichnis einer Sitzung.**
Der wurde einmal komplett gelöscht — und damit war der einzige Beweis weg, dass
die Lohnabrechnung stimmt. Für ein Programm, das Gehälter rechnet und bei jedem
Push automatisch ausgerollt wird, war das untragbar.

- [x] **Alle Nachweise im Repo** unter `pruefungen/`, mit einem Läufer, der sie
      hintereinander ausführt und ein ehrliches Ergebnis liefert.
- [x] **Ein Befehl:** `npm run pruefen`. Mit Filter: `npm run pruefen -- d9`.
- [x] **Verständliche Voraussetzungsprüfung** — läuft das System nicht oder
      fehlen die Testdaten, sagt der Läufer das im Klartext, statt mit
      unverständlichen Fehlern abzubrechen.
- [x] **Automatischer Lauf bei jedem Push** (`.github/workflows/pruefen.yml`):
      Typen, Modultests, Bauen, dann die Nachweise gegen das gestartete System
      mit eigener Datenbank.

**Was der erste Lauf sofort gefunden hat:** Drei von zwölf Prüfungen sind
fehlgeschlagen — nicht weil das Programm falsch war, sondern weil sie sich
gegenseitig Zustand hinterließen. Einzeln bestanden alle, hintereinander nicht.
Eine Prüfung, die nur einzeln besteht, ist kein Sicherheitsnetz. Jede Lohn-
Prüfung stellt jetzt ihren Ausgangszustand selbst her (`zuruecksetzen`).

Stand: **303 Checks in 12 Prüfungen, alle grün** — dazu 320 Modultests.

## Block D14 (10.09.) — Beleg und DATEV vollständig

Beim Prüfen des eigenen Stands gefunden: Die Sonderformen wurden zwar richtig
gerechnet, aber nirgends erklärt.

- [x] **Der Beleg nennt SV-Tage und Beschäftigungsart.** Die SV-Tage sind nach
      der Entgeltbescheinigungsverordnung ohnehin anzugeben — und ohne sie kann
      niemand nachvollziehen, warum bei einem Teilmonat nur ein Teil kam.
- [x] **Er erklärt, warum nichts abgeht.** Bei einem Minijob stand vorher nur
      „Lohnsteuer 0,00 €". Jetzt steht dabei, dass der Arbeitgeber sie pauschal
      trägt (§40a Abs.2 EStG) und dass der Verdienst nicht in die
      Steuererklärung gehört. Dasselbe für kurzfristige Beschäftigung,
      Übergangsbereich und Teilmonat — und **nur dann**, wenn es zutrifft.
- [x] **Der DATEV-Export führt die Arbeitgeberanteile** als eigene Lohnarten
      (6100–6130) und die Pauschsteuer (6200). Beim Minijob fehlten dem
      Steuerberater vorher **sämtliche** Abgaben, obwohl die Pauschalen dort die
      einzigen sind.

Nachweis: 15 Prüfungen am laufenden System, die den Beleg wirklich aufmachen
(PDF entpacken und den sichtbaren Text lesen) statt nur zu prüfen, ob eine Datei
ankommt.

## Block D15 (10.09.) — Jahresabschluss

Ohne ihn kann kein Kunde das Jahr abschließen. Das Jahresende ist in
dreieinhalb Monaten.

**Die Entscheidung, die die Bauweise bestimmt hat:** Rechtlich zählt die
*elektronische* Lohnsteuerbescheinigung. Der Arbeitgeber übermittelt sie, der
Mitarbeiter bekommt einen **Ausdruck** davon — und der trägt die Kennung der
Übermittlung. Solange wir nicht selbst übermitteln (Fahrplan Teil 4), können wir
keinen gültigen Ausdruck erzeugen. Wer es trotzdem täte, gäbe dem Kunden ein
Papier in die Hand, das amtlich aussieht und keines ist.

Deshalb entstehen zwei Dinge statt einer Fälschung:

- [x] **Die vollständigen Jahreswerte für den Steuerberater** als CSV — er
      übermittelt und erzeugt daraus die Bescheinigung. Mit Personalnummer,
      Steuer-ID, Steuerklasse, allen Beträgen und den Hinweisen, die er braucht.
- [x] **Eine Jahresübersicht für den Mitarbeiter** als PDF in der Personalakte.
      Sie heißt so, wie sie ist, und sagt ausdrücklich: *„Diese Übersicht ist
      KEINE Lohnsteuerbescheinigung."* Dazu, woher die amtliche kommt.

Zwei Regeln, die falsch anzuwenden Geld kostet:

- **Pauschal versteuerter Arbeitslohn wird nicht bescheinigt** (§40a EStG). Wer
  als Minijobber mit der 2-Prozent-Pauschale abgerechnet wird, taucht mit diesem
  Verdienst in seiner Steuererklärung gar nicht auf. Wer ihn trotzdem
  bescheinigt, lässt ihn ein zweites Mal besteuern.
- **Steuerfreie Zuschläge nach §3b bleiben aus dem Bruttoarbeitslohn heraus** —
  sie werden nicht bescheinigt. Auf der Übersicht stehen sie trotzdem, getrennt,
  damit der Mitarbeiter sein Geld wiederfindet.

Dazu: unterjähriger Eintritt, und Lücken im Beschäftigungszeitraum werden als
möglicher Großbuchstabe U gemeldet statt stillschweigend übergangen.

Nachweis: 17 Modultests, 33 Prüfungen am laufenden System — darunter das
Öffnen des PDF und die Prüfung, dass der Satz „KEINE Lohnsteuerbescheinigung"
wirklich draufsteht.

---

# Die Übergangsversion ist vollständig

Stand 10.09.2026. Was ein Kunde damit kann:

| | |
|---|---|
| Rechnen | Lohnsteuer nach dem amtlichen Programmablaufplan, Sozialabgaben, §3b-Zuschläge, Einmalzahlungen, Minijob, Übergangsbereich, Teilmonate |
| Nachführen | ELStAM-Änderungsliste einlesen, Stand überwachen |
| Korrigieren | Rückwirkende Aufrollung mit Ausgleich im Folgemonat |
| Zustellen | Beleg nach §108 GewO in die Personalakte, mit Benachrichtigung |
| Weitergeben | DATEV-Datei je Lohnart an den Steuerberater |
| Auszahlen | SEPA-Datei für die Bank des Kunden |
| Abschließen | Jahreswerte für die Bescheinigung, Übersicht für den Mitarbeiter |

**Gemeldet wird über den Steuerberater.** Das ist bewusst so, bis die
Zertifizierung steht (Fahrplan Teil 4 und 5).

**Nachweis: 351 Checks in 14 Prüfungen am laufenden System, 339 Modultests.**

---

## Block F5/F6 (11.09.) — Regelpakete und Freischaltung

Das Geschäftsmodell aus `PRODUKT-NOTIZEN.md` war bisher eine Absichtserklärung:
„Wir programmieren die Dienstplanung je Kunde von Hand." Der Entwurf dafür lag
seit August im Rechendienst — **verdrahtet war nichts davon.** Kein Feld am
Standort, kein Aufruf im Solver, kein Kundenverzeichnis, keine Sperre.

### F5 — Regelpakete

- [x] **Die Mechanik läuft.** Ein Standort trägt eine Paket-ID, der Solver lädt
      das Paket und wendet es an — nach den Custom-Constraints des Kunden, damit
      es auf ihnen aufbauen kann.
- [x] **Bausteine statt Einzelstücke** (`rulepacks/bausteine.py`): die Muster,
      die in vielen Betrieben gleich aussehen — Leitung ohne Gruppe, höchstens
      N pro Woche, Dienst nur an bestimmten Tagen, immer eine Fachkraft, zwei
      Personen nie zusammen. Ein Kundenpaket bleibt damit zehn Zeilen lang.
- [x] **Ein echtes Paket als Muster** (`kunden/kita_sonnenschein.py`) — genau
      die Fälle, an denen die Planung im August gescheitert ist, mit einem Satz
      dazu, **warum** der Betrieb es so hält. Dieser Satz ist wichtiger als der
      Code darunter.
- [x] **Jede Regel meldet sich laut.** Eine Regel, die niemanden trifft, ist der
      teuerste Fehler überhaupt — sie sieht aus, als würde sie wirken. Die
      Sucher werfen einen Fehler statt still nichts zu tun.
- [x] **Der Verifier prüft das Paket mit.** Ein Paket, das nicht lief, ist eine
      kritische Verletzung — und eines, das durchlief und **nichts tat**, auch.
      Der zweite Fall ist der gefährlichere, weil er unauffällig ist.
- [x] **Eine Paket-ID kann keinen fremden Modulpfad laden** — eigens geprüft.
- [x] Der Rechendienst meldet seine Pakete in `/version`; die Verwaltung merkt,
      wenn ein zugeordnetes Paket nach einem Deploy verschwunden ist.

### F6 — Freischaltung

- [x] **Die Dienstplanung ist gesperrt, bis OKUN sie eingerichtet hat.** Ein
      Kunde, der ungebaute Dienstplanung ausprobiert, bekommt einen schlechten
      Plan und ein falsches Bild vom Produkt — genau das ist im August passiert.
- [x] Der Planungslauf antwortet mit HTTP 423 und einem Text, den OKUN je
      Standort hinterlegen kann („wird gerade eingerichtet, wir melden uns").
- [x] **Freischalten darf nur OKUN**, weder die Standortleitung noch das
      Unternehmen. Wer freigeschaltet hat und wann, wird festgehalten.
- [x] Eine eigene Seite unter `/okun/dienstplanung`.
- [x] **Bestehende Standorte werden nicht still gesperrt** — sie arbeiten heute
      damit, und ein stiller Entzug wäre schlimmer als die fehlende Sperre. Nur
      neue Standorte starten gesperrt.

Nachweis: 24 Python-Tests für die Bausteine — darunter die **Gegenprobe**, dass
es ohne die Regel mehr Spätdienste gäbe (sonst könnte eine wirkungslose Regel
einen grünen Test erzeugen). Dazu 4 Tests im Verifier und 21 Prüfungen am
laufenden System.

## Block G1/G2 (11.09.) — Auskunft und Löschkonzept

Vor dem ersten echten Kunden: Personendaten liegen bei uns in **35 Tabellen**.
Eine Auskunft ist nur vollständig, wenn wirklich alle gemeint sind — und eine
Löschung nur richtig, wenn jede Tabelle einzeln beurteilt wurde.

### Der Kern: Löschen ist oft verboten

„Recht auf Löschung" heißt nicht „alles weg". Lohnunterlagen müssen sechs Jahre
bleiben, Buchungsbelege zehn, Arbeitszeitnachweise zwei. Wer sie auf Zuruf
löscht, verstößt gegen Steuer- und Sozialrecht und kann bei der Betriebsprüfung
nichts vorlegen. Richtig ist die **Einschränkung der Verarbeitung** (Art.18
DSGVO): die Daten bleiben, werden gesperrt und nur noch für den Zweck verwendet,
für den das Gesetz sie verlangt.

- [x] **Ein Katalog statt Code an dreißig Stellen** (`src/lib/dsgvo-katalog.ts`):
      je Datenart steht dort, was passiert (löschen / anonymisieren / sperren),
      wie lange aufbewahrt wird, **aus welcher Vorschrift** die Frist folgt und
      warum — in der Sprache des Betroffenen, ohne Tabellennamen.
- [x] **Der Katalog kann nicht veralten.** Ein Test liest `schema.prisma` und
      schlägt fehl, sobald eine neue Tabelle mit Personenbezug dazukommt und
      nicht eingetragen wird. Er hat beim ersten Lauf sofort eine gefunden
      (`SurchargeWageConfig`).
- [x] **Keine Datenart kann beim Löschen stillschweigend übersprungen werden.**
      Ein zweiter Test hält fest, dass es zu jeder Tabelle im Katalog auch eine
      Abfrage gibt — der gefährlichste Fehler wäre der, bei dem der Knopf
      funktioniert und die Daten trotzdem liegen bleiben.

### G1 — Auskunft (Art.15) und Mitnehmen (Art.20)

- [x] **Jeder holt sie selbst**, unter „Mein Profil". Art.15 ist ein Recht der
      Person, keine Gefälligkeit des Arbeitgebers — es darf keinen Antrag
      brauchen.
- [x] **Zwei Formate mit Absicht:** ein PDF, das in Sätzen erklärt, welche Daten
      es gibt, wie viele Einträge und wie lange sie bleiben — und die
      vollständigen Einzeldaten als Datei, die man auch woanders hin mitnehmen
      kann. Eine reine JSON-Datei wäre formal richtig und praktisch wertlos.
- [x] **Fremde Daten sind gekürzt.** Eine Vertretungsanfrage nennt Kollegen, ein
      Dienstplan zeigt, wer sonst Schicht hatte. Auskunft heißt „Ihre Daten",
      nicht „alles, wo Ihr Name vorkommt".
- [x] Passwörter und Geräteschlüssel sind nie enthalten — eigens geprüft.
- [x] Die Auskunft nennt zu jeder Datenart die **Aufbewahrungsdauer** (Art.15
      Abs.1 lit.d) — die Frage, die Betroffene am häufigsten stellen.
- [x] Jeder Abruf wird protokolliert. Eine Auskunft versammelt an einer Stelle
      alles über einen Menschen; wer sie erzeugt, muss nachvollziehbar sein.

### G2 — Löschen, sperren, anonymisieren

- [x] **Vorschau vor jeder Löschung.** Sie zeigt Zeile für Zeile, was
      verschwindet, was anonymisiert wird und was bleiben **muss** — mit Datum
      und Vorschrift. Eine Löschung lässt sich nicht zurücknehmen; wer sie
      auslöst, muss vorher gesehen haben, was passiert.
- [x] **Zwei Bremsen.** Ohne Austrittsdatum läuft nichts (ohne Austritt beginnt
      keine Frist), und eine noch aktive Person wird nicht gelöscht. Dazu eine
      ausdrückliche Bestätigung — ein doppelter Klick darf das nicht auslösen.
- [x] **Anonymisieren heißt wirklich anonymisieren.** Der Dienstplan bleibt dem
      Betrieb erhalten, die Einträge bekommen aber eine Zufallskennung, die
      **nirgends gespeichert** wird. Damit ist die Verbindung zur Person
      zerstört — das unterscheidet Anonymisierung von Pseudonymisierung.
- [x] **Sperren nach Art.18** für Lohn, Zeiten, Fehlzeiten und Personalakte.
      Bankverbindung und Anschrift gehen trotzdem sofort — für die Aufbewahrung
      werden sie nicht gebraucht.
- [x] **Abgelaufene Fristen werden geräumt.** Aufbewahren ist eine Pflicht,
      keine Erlaubnis: läuft die Frist ab, wird gelöscht, am Ende auch der
      Personaldatensatz selbst. Als Jahreslauf über alle gesperrten Personen.
- [x] **Der Löschbericht bleibt.** Er enthält keine Personendaten, nur Zahlen
      und Begründungen — und ist der einzige Weg, eine **vollständige** Löschung
      hinterher noch nachweisen zu können (Art.5 Abs.2 DSGVO). Auch als PDF für
      den Betroffenen.
- [x] **Löschen darf nur das Unternehmen**, nicht die Standortleitung; der
      Jahreslauf nur OKUN.

Nachweis: 53 Prüfungen am laufenden System (`pruefungen/g1-dsgvo.mjs`) —
darunter der harte Teil: nach der Löschung wird **nachgesehen**, dass die
Fehlzeit noch da ist, der Zugang weg, die Schicht dem Betrieb erhalten und
niemandem mehr zugeordnet, die IBAN entfernt und die Personalnummer geblieben.
Dazu 22 Modultests.

### Was noch aussteht
Die Fristen sind mit der Vorschrift belegt, aus der sie stammen, aber **nicht
von einem Steuerberater oder Datenschutzbeauftragten gegengezeichnet.** Das
gehört vor den ersten echten Kunden — es ist eine Datei und eine Stunde Arbeit.

## Block E5 (11.09.) — Nachrichten zwischen Mitarbeitern

Bisher gab es nur Benachrichtigungen in eine Richtung und Support-Tickets an
OKUN. Wer einer Kollegin schreiben wollte, hat das Programm verlassen und
WhatsApp genommen — mit Dienstplänen, Krankmeldungen und Namen auf privaten
Telefonen. Genau das soll überflüssig werden.

### Was geht
- [x] **Jeder schreibt jedem an seinem Standort.** Nicht dem ganzen Unternehmen:
      In einem Betrieb mit acht Häusern hat der Kollege aus dem anderen Ort
      nichts mit einem zu tun, und eine Suchliste über alle wäre selbst schon
      eine Preisgabe. Leitung und Unternehmen erreichen jeden in ihrem Bereich —
      dieselbe Grenze wie überall sonst.
- [x] **Die Standortleitung eröffnet und verwaltet Gruppen:** Mitglieder setzen
      und entfernen, umbenennen, schließen und wieder öffnen.
- [x] **Geschlossen heißt nicht gelöscht.** Der Verlauf bleibt für die Mitglieder
      lesbar; wer eine Absprache von vor einem Jahr sucht, findet sie wieder.
- [x] Ungelesen-Zähler je Gespräch und ein Abzeichen im Kopf jeder Seite.
- [x] Push aufs Handy — aber **keine E-Mail und kein Eintrag ins Postfach.** Bei
      dreißig Nachrichten am Tag wären beides dreißig Störungen, und das
      Postfach fasst ohnehin nur die letzten dreißig Meldungen.

### Die drei Entscheidungen, auf die es ankommt

**Mitlesen ist nicht Verwalten.** Eine Standortleitung darf Gruppen einrichten
und Mitglieder setzen — lesen kann sie nur, was in Gruppen steht, in denen sie
selbst Mitglied ist. Der Beitritt ist möglich, hinterlässt aber einen für alle
sichtbaren Hinweis im Verlauf. Eine Vorgesetzte, die unbemerkt mitliest, wäre
keine Funktion, sondern ein Vertrauensbruch.

**Gespräche zu zweit sind unantastbar.** Für niemanden sonst einsehbar: nicht
für die Leitung, nicht für das Unternehmen, nicht für OKUN. Deshalb kann ein
Zugang ohne eigenen Mitarbeiterdatensatz — und das ist jeder OKUN-Zugang — den
Chat gar nicht erst benutzen.

**„Gibt es nicht" und „du bist kein Mitglied" sehen gleich aus.** Beides wird
mit 404 beantwortet. Sonst ließe sich durch Ausprobieren herausfinden, welche
Gespräche existieren — und schon die Existenz eines Gesprächs ist eine
Information über Menschen.

### Bewusst nicht gebaut
- **Keine Lesebestätigung für andere und keine Anzeige „schreibt gerade".**
  Beides erzeugt in einem Betrieb Druck: jemand sieht, dass gelesen und nicht
  geantwortet wurde. Der Lesestand ist ausschließlich für den eigenen
  Ungelesen-Zähler da.
- **Kein Live-Kanal**, sondern Nachsehen alle zehn Sekunden. Für einen
  Betriebschat schnell genug; eine dauerhafte Verbindung je Gerät wäre Aufwand,
  der sich hier nicht auszahlt.

### Beim Löschen
Der Katalogtest hat die drei neuen Tabellen sofort eingefordert. Nachrichten
unterliegen keiner Aufbewahrungspflicht und werden gelöscht — mit einem
Unterschied: **Ein Gespräch zu zweit verschwindet ganz**, denn was übrig bliebe,
wäre ein einseitiger Verlauf, der ausschließlich von der gelöschten Person
handelt. **In Gruppen bleiben die Beiträge der anderen**; sie gehören anderen
Menschen. Beides ist eigens nachgewiesen.

Nachweis: 64 Prüfungen am laufenden System (`pruefungen/e5-chat.mjs`), davon der
größere Teil zum Thema „wer kommt NICHT hinein". Dazu 6 Prüfungen in
`g1-dsgvo.mjs` für das Löschen.

### Nebenbei korrigiert
Die Standortleitung hatte in den Testdaten keinen Mitarbeiterdatensatz, obwohl
das Datenmodell genau das vorsieht (`reassignLocationAdmin` setzt
`Employee.role = 'admin'`). Sie konnte damit verwalten, aber niemandem
schreiben. Im Seed nachgetragen, zusammen mit drei weiteren Mitarbeiterzugängen
— ohne die lässt sich ein Chat gar nicht prüfen.

## Block C6 (11.09.) — Krankenschein und Fehlzeit verbunden

Beide lagen nebeneinander und wussten nichts voneinander: die
Arbeitsunfähigkeitsbescheinigung als Datei in der Personalakte, die Fehlzeit als
Eintrag im Kalender. An der Fehlzeit stand ein von Hand gesetztes „Nachweis
vorhanden: ja/nein" — und das stimmte irgendwann nicht mehr.

### Der teure Fall ist nicht die fehlende Bescheinigung
Sondern die **unvollständige**: drei Wochen krank, eine Bescheinigung über eine
Woche. Vorher sah das aus wie eine vollständig belegte Fehlzeit. Jetzt wird
ausgerechnet, welche Tage gedeckt sind, und die Lücke benannt: „Für 11.04. bis
20.04. fehlt noch eine Bescheinigung (10 Tage) — in der Regel die
Folgebescheinigung."

- [x] **Zuordnung beim Einreichen.** Der Mitarbeiter gibt den Zeitraum der
      Bescheinigung an; passt genau eine Fehlzeit, wird verbunden.
- [x] **Bei mehreren wird gefragt, nicht geraten.** Eine falsch zugeordnete
      Bescheinigung ist schlimmer als eine nicht zugeordnete, weil sie eine
      Lücke zudeckt, die dann niemand mehr sieht.
- [x] **Erst- und Folgebescheinigung** werden zusammengesetzt; eine Fehlzeit
      kann beliebig viele Nachweise haben.
- [x] **„Nachweis vorhanden" wird abgeleitet, nicht gepflegt.** Es ist das
      Ergebnis daraus, ob Dateien verknüpft sind, und wird bei jeder Änderung —
      auch beim Löschen einer Datei — neu bestimmt.
- [x] **Eine Datei ohne Gültigkeitszeitraum deckt nichts ab** und wird auch so
      angezeigt. Sie stillschweigend anzurechnen wäre der gefährlichere Weg.
- [x] Die Leitung sieht die Bescheinigungen direkt an der Fehlzeit und kann sie
      dort öffnen; der Mitarbeiter sieht selbst, ob seine Fehlzeit gedeckt ist.

### Ab wann eine Bescheinigung verlangt wird
§5 Abs.1 EntgFG: spätestens ab dem **vierten Kalendertag**. Gerechnet wird in
Kalendertagen, nicht in Arbeitstagen — wer Freitag krank wird und Montag noch
krank ist, ist am vierten Tag, auch wenn nur zwei davon Arbeitstage waren. Genau
hier wird sonst falsch gerechnet.

Satz 3 erlaubt dem Arbeitgeber, sie früher zu verlangen. Das steht im
Arbeitsvertrag und ist deshalb **einstellbar** (Unternehmenseinstellungen),
nicht einprogrammiert.

### Nebenbei geschlossen: Fehlzeiten löschen
Eine versehentlich erfasste Krankmeldung ließ sich bisher nur umdeuten, nicht
entfernen — wer sich im Mitarbeiter vertippt hatte, hinterließ eine Krankheit
bei einer Person, die nie krank war. Das fließt in Fehlzeitenquoten und in die
Lohnabrechnung ein. Jetzt entfernbar; die eingereichten Bescheinigungen bleiben
dabei in der Personalakte und verlieren nur ihre Zuordnung.

### Bewusst nicht
Die **elektronische AU (eAU)** bei der Krankenkasse abrufen. Das läuft über ein
zertifiziertes Verfahren, das wir nicht haben — dasselbe Thema wie beim
Meldewesen. Bis dahin reicht der Mitarbeiter seine Bescheinigung ein, so wie er
es heute auch tut.

Nachweis: 50 Prüfungen am laufenden System (`pruefungen/c2-krankenschein.mjs`)
und 25 Modultests für die Fristen- und Lückenrechnung.

## Block §131/§132 (11.09.) — Funde aus dem laufenden Betrieb

Der erste echte Rundgang durch das laufende System hat sieben Sachen zutage
gebracht, die kein Test gefunden hatte, weil alle Tests von den richtigen
Voraussetzungen ausgingen.

### Der Chat hing am falschen Datensatz
Die erste Fassung machte den **Mitarbeiterdatensatz** zum Teilnehmer. Im Betrieb
fiel das sofort um: Standortleitung und Geschäftsführung haben ein Konto, aber
nicht zwingend einen Mitarbeiterdatensatz. Beide bekamen „Dieser Zugang ist
keinem Mitarbeiter zugeordnet" zu sehen — ausgerechnet die zwei Rollen, die am
meisten zu kommunizieren haben.

Jetzt ist der Teilnehmer das **Benutzerkonto**. Damit erreicht die
Geschäftsführung alle Standortleitungen und alle Mitarbeiter ihrer Häuser,
eröffnet Gruppen über Standorte hinweg, und ein Mitarbeiter kann ihr auch
antworten. Die Mitarbeiterkennung wird weiter mitgeschrieben — nur über sie
findet eine Löschung nach Art.17 DSGVO die Nachrichten wieder.

### Zwei Menüpunkte führten ins Leere
„Lohnabrechnung" und „Zuschlags-Engine" zeigten in der Navigation des
Unternehmens auf `/admin/...`. Deren Layout lässt nur die Rolle „admin" zu — wer
als Unternehmen klickte, landete **wortlos wieder auf dem Dashboard**. Beide
Seiten gibt es jetzt unter `/company/...`; der Inhalt ist derselbe, die
Eingrenzung auf den eigenen Bereich macht ohnehin der Server.

### Die Sperre der Dienstplanung war unsichtbar
Es gab sie seit F6 — aber nur im Rechendienst. Im Dienstplan selbst sah der
Kunde eine leere Wochentabelle mit „Noch keine Schichten angelegt" und dachte,
er müsse selbst etwas einrichten. Genau das soll er nicht. Jetzt steht dort, dass
wir seine Dienstplanung gerade bauen, und dass er alles andere in der
Zwischenzeit ohne Einschränkung nutzen kann.

Dazu zwei ehrlichere Texte: Die Einrichtung verspricht nicht mehr „fünf Schritte
zur fertigen Dienstplanung", solange die Planung gesperrt ist — sie sammelt dann
Grunddaten. Und die OKUN-Verwaltung warnt jetzt bei Standorten, die
**freigeschaltet sind, aber kein Regelpaket haben**: die planen mit
Standardregeln, die ihren Betrieb nicht kennen.

### Ein Knopf, der nichts tat
„Löschung vorbereiten" war deaktiviert, wenn ein Hindernis bestand — aber ohne
sichtbaren Grund. Man drückt, nichts passiert, man weiß nicht warum. Der Grund
steht jetzt direkt darunter. Und die Sicherheitsabfrage (den Namen tippen)
verzeiht Groß-/Kleinschreibung: Sie soll vor Versehen schützen, nicht vor
Tippfehlern.

### Nebenbei gefunden: ein Datenschutzvorfall
`/api/invitations` war **nicht auf den Mandanten eingegrenzt**. Eine
Standortleitung sah die offenen Einladungen aller Kunden — mit Namen und
E-Mail-Adressen. Behoben und mit zwei Prüfungen belegt. Bei der Gelegenheit
liefert die Liste jetzt auch den Einladungslink: Wenn die E-Mail nicht ankommt,
muss die Leitung ihn weitergeben können.

Nachweis: 562 Prüfungen gesamt, davon 75 für die Nachrichten (jetzt
einschließlich Unternehmensebene) und 28 für die Mitarbeiterverwaltung.

## Block H1 (12.09.) — Funde erfassen statt Fehler melden

Aus dem Fehlermelder ist die **Fundstelle** geworden. Der Auslöser war eine
einfache Beobachtung: Getestet wird von mehreren Leuten, und was dabei auffällt,
ist nicht immer ein Fehler. Ein Verbesserungsvorschlag passt nicht in ein
Formular, das nach „Schweregrad des Fehlers" fragt.

### Die Einsicht, die alles bestimmt
Wie gut eine Behebung wird, hängt fast ausschließlich an der **Qualität der
Meldung** — nicht an dem, was danach damit geschieht. Deshalb steckt die Arbeit
im Formular und nicht in der Verarbeitung.

Das wichtigste Feld ist **„Was hättest du erwartet?"**. Ohne es lässt sich nicht
entscheiden, ob etwas kaputt ist oder nur anders, als der Melder dachte — und
genau daran hängt, ob aus einer Meldung ein Fehler oder ein Vorschlag wird.

- [x] **Zwei Wege zum Melden.** Der Käfer unten links für den schnellen Fund
      unterwegs, ein ausführliches Formular unter „Funde" für die Tester. Beide
      schreiben in dieselbe Tabelle, mit denselben Pflichtangaben.
- [x] **Vier Arten:** Fehler, Verbesserungsvorschlag, Frage, Wunsch — mit je
      eigenen Fragen. Bei einem Vorschlag gibt es nichts nachzustellen; da zählt
      der Zielzustand, nicht der Weg dorthin.
- [x] **Eine Ampel beim Absenden**, die sagt, was noch fehlt. Sie weist die
      Meldung aber **nicht ab**: Eine abgewiesene Meldung ist eine verlorene
      Meldung — wer zweimal abgewiesen wird, meldet beim dritten Mal nicht mehr.
- [x] **Die Bewertung entsteht auf dem Server.** Ein Browser, der seine eigene
      Meldung für vollständig erklärt, wäre eine Selbstbescheinigung.
- [x] **Verbesserungen und Wünsche warten auf Freigabe.** Ein Fehler wird
      behoben; ein Vorschlag ist eine Entscheidung darüber, wie das Produkt sein
      soll. Die trifft nicht der Melder und nicht das Programm. Eine Ablehnung
      bleibt mit Begründung stehen, damit derselbe Vorschlag nicht in drei
      Wochen erneut auf dem Tisch liegt.
- [x] **Rückfragen** an den Melder, der sie beantworten kann — und mit der
      Antwort geht der Fund zurück in die Bearbeitung.
- [x] **Was Geld oder Recht berührt** (Lohn, Zeiten, Datenschutz, Zugänge) wird
      am Bereich erkannt, bekommt hohe Dringlichkeit und ist von jeder
      automatischen Behebung ausgenommen.
- [x] **Eine Fundliste ist eine Mängelliste des Betriebs** — wer nicht OKUN ist,
      sieht ausschließlich die eigenen Meldungen.
- [x] Der Melde-Weg war bisher **ohne Anmeldung** erreichbar; jetzt nicht mehr.

Nachweis: 38 Prüfungen am laufenden System (`pruefungen/h-funde.mjs`), 26
Modultests für die Bewertung und die Freigabe-Regeln.

## Block §134 (12.09.) — Zwei Funde aus den eigenen Prüfungen

Am Morgen des 12.09. schlugen fünf Lohn-Prüfungen fehl, ohne dass sich am
Programm etwas geändert hatte. Der Grund: Sie rechneten mit einer Person aus den
Testdaten, deren Zeiterfassung mitlief — und aus der entstanden über Nacht
17,93 € Zuschläge. **Eine Prüfung, die am 11. besteht und am 12. nicht, prüft
den Kalender und nicht das Programm.** Behoben, indem diese Prüfungen jetzt mit
einer eigenen Person ohne Zeiterfassung rechnen.

Beim Aufräumen kamen zwei echte Fehler heraus, die niemandem aufgefallen wären:

### Der Jahreslohn ohne Vormonate
Für den voraussichtlichen Jahresarbeitslohn (§39b Abs.3 EStG) zählte nur, was
**in diesem System** bereits abgerechnet war. Bei einem Kunden, der im September
zu uns wechselt, ist das nichts: Aus 40.800 € wurden 13.600 €, und auf ein
Weihnachtsgeld von 3.400 € wurde **keine Lohnsteuer** einbehalten. Der
Mitarbeiter hätte im Folgejahr eine Nachzahlung bekommen, mit der er nicht
rechnet.

Jetzt werden die Monate vor dem Wechsel aus dem laufenden Lohn hochgerechnet —
ab dem Eintritt, nicht ab Januar. Genommen wird der größere der beiden Werte:
Zu viel einbehaltene Steuer holt sich der Mitarbeiter mit der Steuererklärung
zurück, zu wenig wird zur Nachzahlung. Von den beiden Fehlern ist nur einer
zumutbar.

### Doppelte Steuer-ID beim ELStAM-Abgleich
Sind zwei Profile versehentlich mit derselben Steuer-ID angelegt, gewann still
der zuletzt geladene — jemand bekam die Steuerklasse eines Kollegen. Bei
gleichen **Namen** wurde die Mehrdeutigkeit längst gemeldet; ausgerechnet bei
den Kennzeichen, denen man am meisten vertraut, nicht. Jetzt wird auch dort
abgebrochen, mit dem Hinweis, zuerst die Stammdaten zu bereinigen.

## Block H2 (12.09.) — Der stündliche Lauf

Stufe 2 aus `FEHLERKREISLAUF.md`: Ein Zeitplan weckt stündlich eine Sitzung, die
die offenen Funde liest, sie beurteilt und Vorschläge bzw. Rückfragen
zurückschreibt. **Code ändert der Lauf noch nicht** — das ist Stufe 3 und
kommt erst, wenn der Bericht ein paar Wochen gezeigt hat, dass die Einschätzung
stimmt.

### Ein eigener Schlüssel statt einer Anmeldung
Der Lauf braucht einen Weg ins laufende System. Eine Anmeldung mit Benutzername
und Passwort wäre dafür falsch: Sie brächte ein echtes Konto mit dessen vollen
Rechten mit. Stattdessen ein eigener Schlüssel, der **genau zwei Dinge** kann —
offene Funde lesen und ihren Bearbeitungsstand zurückschreiben. Wer ihn erbeutet,
sieht Mängelmeldungen. Ärgerlich, aber kein Schaden an Menschen.

- [x] **Ohne hinterlegten Schlüssel ist der Zugang zu** — nicht offen, nicht
      „erstmal erlaubt". Ein Zugang, der ohne Einrichtung funktioniert, ist
      irgendwann einer, den niemand eingerichtet hat.
- [x] Der Vergleich läuft in gleichbleibender Zeit; sonst verrät die Dauer der
      Antwort den Schlüssel Zeichen für Zeichen.
- [x] **Eine OKUN-Anmeldung ersetzt den Schlüssel nicht** und umgekehrt.
- [x] **Der Lauf kann sich keine Freigabe selbst erteilen.** Ein Vorschlag, der
      nicht freigegeben ist, lässt sich nicht als erledigt melden — HTTP 409 mit
      Begründung. Ein Programm, das sich selbst freigeben kann, hat keine
      Freigabe.
- [x] Die Einsortierung in die vier Töpfe passiert **im System**, nicht im Lauf.
      So gilt für beide dieselbe Regel, und der Bericht auf der Fundeseite zeigt
      genau das, was dann tatsächlich geschieht.

### Was der Zeitplan wirklich kann
Ich kann mich nicht aus der App heraus wecken — die App kann nichts zurufen.
Möglich ist ein Zeitplan, der von sich aus eine Sitzung startet; kleinste
Taktung ist **stündlich**. Für „sofort nach der Freigabe" heißt das im Schnitt
eine halbe Stunde. Das ist die ehrliche Antwort, und stündlich statt täglich ist
der Unterschied zwischen „morgen" und „gleich".

Nachweis: 17 Prüfungen (`pruefungen/h2-fundelauf.mjs`), davon der größere Teil
zu dem, was der Lauf **nicht** darf.

## Block D16 (12.09.) — Kein Lohn ohne freigegebenen Monat

Der eigentliche Vorteil daran, dass Zeiterfassung und Lohnabrechnung bei uns
zusammenhängen: Niemand tippt mehr „fünf Stunden nachts, zehn am Sonntag, drei
Vierundzwanzig-Stunden-Dienste" ein. Der Mitarbeiter stempelt, die Regeln der
Zuschlags-Engine liegen darüber, und das Geld steht in der Abrechnung. Das gab
es schon — was fehlte, war die andere Hälfte.

### Der Preis für den Vorteil
Wenn die gestempelte Zeit direkt Geld wird, darf nicht abgerechnet werden,
solange sie noch wackelt. Eine Schicht, die abends nachgetragen wird, wäre ein
Zuschlag, der **nach** der Abrechnung entsteht — und auf dem Beleg stünde eine
Zahl, die morgen nicht mehr stimmt.

- [x] **Die Standortleitung gibt den Monat frei, erst dann fließt er ein.** Mit
      der Freigabe sind die Zeiten gesperrt; darauf ruht die Abrechnung.
- [x] **Wer aufgehalten wird, steht mit Namen und Grund im Lauf** — und auf der
      Lohnseite in einem Kasten, der stehen bleibt, statt nur kurz aufzublitzen.
      Es geht darum, dass jemand diesen Monat kein Geld bekommt.
- [x] **Drei Gründe werden unterschieden:** kein Abschluss vorhanden · Abschluss
      vorhanden, aber nicht freigegeben · alles frei. „Geprüft" ist nicht
      „freigegeben".
- [x] **Wo die Regel nicht greift:** Wer ein festes Gehalt bezieht und in dem
      Monat gar keine Zeiten erfasst hat, hat nichts freizugeben. Ihn zu
      blockieren wäre keine Sorgfalt, sondern eine Schikane.
- [x] **Bei Stundenlohn greift sie immer** — dort ist die erfasste Zeit nicht nur
      Grundlage der Zuschläge, sondern des Entgelts selbst.
- [x] Eine bereits gerechnete Abrechnung wird **nicht fortgeschrieben**, solange
      der Monat offen ist: Die neuen Zuschläge fließen nicht ein.

### Monat und Monat bleiben getrennt
Eine Nachtschicht, die am letzten Tag eines Monats beginnt und erst im nächsten
endet, gehört zu dem Tag, an dem sie **begonnen** hat. Sonst wanderten Zuschläge
stillschweigend über die Monatsgrenze, und ein längst freigegebener Vormonat
würde nachträglich teurer. Eigens nachgewiesen.

### Nebenbei: das Abrechnungsjahr wird zuerst geprüft
Bis hierher fiel ein Jahr ohne hinterlegte Rechengrößen erst auf, wenn die erste
Person gerechnet wurde. Seit die Freigabe vorgeschaltet ist, kann es passieren,
dass gar niemand gerechnet wird — dann wäre das fehlende Jahr stillschweigend
durchgegangen, mit der Meldung „0 abgerechnet". Das Jahr ist eine Eigenschaft
des Laufs, nicht einer Person, und wird jetzt vorab geprüft.

Nachweis: 22 Prüfungen (`pruefungen/d16-monatsfreigabe.mjs`) und 10 Modultests
für die Regel selbst — sie entscheidet über Geld und gehört zu den Stellen, die
man einzeln nachrechnen können muss.

## Block §137 (12.09.) — Die Mitarbeiter-App, Etappe 1

Die App war eine Schreibtisch-Oberfläche im Telefonformat: fünf Symbole unten,
hinter zweien davon Aufklapp-Menüs — also neun Wege, die erst ein zweiter
Fingertipp sichtbar machte. Und die Startseite zeigte Kacheln mit
Wochenstunden, Resturlaub und Punkten. Alles interessant, nichts davon der
Grund, warum jemand um zehn vor sechs das Telefon aus der Tasche holt.

### Der schwerste Fund: ein Knopf, der nichts tat
Auf der Startseite stand **„Einstempeln" — und der Knopf hat nichts gestempelt.**
Er hat nur die Anzeige umgeschaltet. Wer darauf gedrückt hat und losgegangen
ist, war nicht eingestempelt. In einem System, in dem die gestempelte Zeit
direkt Geld wird, ist das der schlimmste Fehler von allen: **Er sieht aus wie
Erfolg.**

### Eine Stempeluhr, ein Aufruf
Vorher legte die Zeiten-Seite die Zeitbuchung selbst an, startete danach die
Erfassung und merkte sich beide Kennungen im Browser — vier Aufrufe, von denen
einer abbrechen konnte. Jetzt gibt es **einen Aufruf je Handgriff**
(`/api/time-tracking/stempeln`), der Server entscheidet, was erlaubt ist, und
antwortet mit dem neuen Zustand.

- [x] **Der Zustand kommt vom Server**, nicht aus dem Browser. Ein Gerät, das
      eine Weile offline war, weiß nicht mehr, was inzwischen geschah.
- [x] **Die Reihenfolge lässt sich nicht umgehen:** zweimal einstempeln,
      Pause ohne Einstempeln, Pause beenden ohne Pause — alles abgelehnt, mit
      einem Satz, der sagt, wie es weitergeht.
- [x] **Man stempelt für sich selbst.** Die Person kommt aus der Sitzung, nicht
      aus der Anfrage; eine mitgeschickte fremde Kennung ändert nichts.
- [x] **Eine vergessene Pause endet mit dem Ausstempeln** — sonst liefe sie bis
      in alle Ewigkeit weiter.
- [x] **Über zwölf Stunden eingestempelt?** Dann steht das als Hinweis da —
      sofort, nicht erst beim Monatsabschluss.

### Der Zeitpunkt vom Gerät — die Vorbereitung auf Etappe 2
Im Funkloch entsteht der Stempel auf dem Telefon und wird später übertragen.
Dann zählt die Zeit des Stempelns, nicht die des Hochladens. Ein mitgeschickter
Zeitpunkt wird deshalb angenommen, aber eng geführt: **nie aus der Zukunft, nie
älter als 24 Stunden, und immer als nachgereicht gekennzeichnet** (`quelle` am
Zeiteintrag). Die Standortleitung sieht beim Monatsabschluss, welcher Eintrag
vom Gerät kam und welcher aus dem Funkloch — ohne diese Kennzeichnung wäre der
Zeitpunkt eine Behauptung, die niemand prüfen kann, und er entscheidet über Lohn.

### Vier Menüpunkte statt neun
**Heute** (der Stempelknopf, groß und ohne Scrollen) · **Plan** · **Nachrichten**
· **Ich**. Die Aufklapp-Menüs sind weg, jeder Punkt führt direkt irgendwohin.

Neu dabei, weil vorher am Telefon kaum erreichbar:
- **Lohnabrechnungen** an eigener Stelle, nach Jahren sortiert, mit dem Monat
  als Überschrift statt eines Dateinamens. Sie lagen bisher in der Personalakte
  zwischen Verträgen und Zeugnissen — ordentlich abgelegt und trotzdem am
  falschen Platz.
- **Krankmelden in zwei Angaben:** seit wann, voraussichtlich bis wann. Die App
  sagt selbst, ob eine Bescheinigung nötig ist (§5 EntgFG und die betriebliche
  Regelung), und die Kamera steht bereit, um sie gleich abzufotografieren —
  zugeordnet wird sie automatisch der eben gemeldeten Fehlzeit.
- **Ich** trägt die zwei Zahlen, nach denen im Betrieb am häufigsten gefragt
  wird: Resturlaub und Stundenkonto.

Nachweis: 29 Prüfungen am laufenden System (`pruefungen/b2-stempeluhr.mjs`) und
17 Modultests für die Reihenfolge der Handgriffe und den Zeitpunkt.

## Block §138 (12.09.) — Die Mitarbeiter-App, Etappe 2: das Funkloch

Eine Pflegekraft steht im Keller eines Altbaus und will einstempeln. Bisher
bekam sie eine Fehlermeldung, und die Zeit war weg. Wer das zweimal erlebt hat,
stempelt nicht mehr über die App — und dann stimmt weder die Arbeitszeit noch
der Lohn. Dasselbe galt für die Krankmeldung um halb sechs aus dem Schlafzimmer
mit einem Balken Empfang.

Ab jetzt wird **gemerkt statt verloren**: Stempel, Pause, Krankmeldung,
Urlaubsantrag und Nachricht wandern ohne Netz in eine Warteschlange auf dem
Gerät und gehen raus, sobald wieder Empfang da ist — **mit der Uhrzeit des
Handgriffs, nicht der der Übertragung.**

### Vier Entscheidungen, die alles bestimmen

- [x] **Die Reihenfolge hält.** Nachgereicht wird strikt in der Reihenfolge des
      Entstehens, und beim ersten Vorgang, der nicht durchgeht, ist Schluss für
      diesen Durchlauf. Sonst käme „gehen" vor „kommen" an, der Server lehnte es
      zu Recht ab — und die Zeit wäre trotzdem weg.
- [x] **Nur das Nötige kommt hinein.** Gemerkt wird, was ohne Rückfrage gültig
      bleibt. **Nicht** gemerkt wird, was eine Antwort braucht — etwa eine
      Zusage zum Einspringen: Bis die überträgt, hat vielleicht längst jemand
      anderes zugesagt, und dann stünden zwei Leute in derselben Schicht.
- [x] **Aufgeben ist erlaubt.** Was der Server dauerhaft ablehnt (400, 403) oder
      was nach 20 Versuchen nicht ankommt, fliegt raus. Eine Schlange, die sich
      nie leert, ist schlimmer als keine. Eine abgelaufene Anmeldung (401) gilt
      dagegen nicht als Ablehnung — nach dem nächsten Anmelden geht es.
- [x] **Nichts verschwindet still.** Jeder verworfene Vorgang bleibt als rote
      Meldung stehen, bis jemand sie wegklickt, samt Grund vom Server. Bei etwas,
      das über Lohn entscheidet, ist „ist wohl nicht durchgegangen" keine
      zulässige Antwort.

### Was man ohne Netz sieht
Die Uhr zeigt den **Stand einschließlich dessen, was noch wartet** — sonst
stünde „nicht eingestempelt", obwohl die Person längst arbeitet, und sie drückte
ein zweites Mal. Lesbar bleiben im Funkloch außerdem der eigene Dienstplan, die
Dienste, der Stempelzustand und die eigenen Fehlzeiten; sie kommen aus dem
Zwischenspeicher und sind als **gespeicherter Stand** gekennzeichnet. Was nicht
auf ein Telefon gehört, bleibt ungespeichert: Lohnabrechnungen und
Mitarbeiterlisten im Zwischenspeicher wären ein Datenschutzproblem, kein
Komfortgewinn.

Kein „Background Sync": Den gibt es auf iPhones nicht, und genau dorthin soll
die App. Nachgereicht wird, wenn die App offen ist — beim Start, sobald das Netz
zurückkommt, und alle halbe Minute. Das genügt; der Weg aus dem Keller nach oben
dauert länger.

Die Leiste hängt **im Rahmen der ganzen Anwendung**, nicht nur in der
Mitarbeiter-App: Auch eine Standortleitung schreibt Nachrichten aus dem Keller.

Nachweis: 21 Modultests für die Regeln der Warteschlange (jeder Ausgang einzeln
nachgerechnet, besonders die Fälle, in denen aufgegeben wird) und 23 Prüfungen
am laufenden System (`pruefungen/b3-warteschlange.mjs`) für die andere Hälfte —
dass der Server eine ganze Kette aus dem Funkloch mit den richtigen Uhrzeiten
verbucht, Wiederholungen und falsche Reihenfolge mit 409 und einem Grund
ablehnt, und Krankmeldung, Urlaubsantrag und Nachricht nachträglich annimmt.

## Block §139 (12.09.) — Die Mitarbeiter-App, Etappe 3: die native Hülle

Die App lädt die laufende Anwendung, sie bringt sie nicht mit. Das ist eine
Entscheidung, keine Abkürzung: OKUN Workforce rechnet Gehälter. Eine App, die
den Stand vom Tag der Einreichung mitbrächte, wäre am Tag darauf falsch — und
jede Korrektur an der Lohnabrechnung müsste durch eine Store-Prüfung.

Damit ist die Frage nicht „wie packe ich die Seite ein", sondern: **Was kann ein
Browser nicht, das diese App können muss?** Fünf Dinge.

### 1. Benachrichtigungen, die ankommen, wenn die App zu ist
Web-Push erreicht ein iPhone nur, solange die Seite auf dem Startbildschirm
liegt und der Dienst-Arbeiter lebt — Apple beendet den nach einiger Zeit. Wer
Sonntagabend einen Ausfall für Montag sechs Uhr meldet, erreicht damit
niemanden. Jetzt läuft es über APNs und FCM.

Beide Wege stehen nebeneinander hinter **einem** Aufruf (`sendPushToEmployee`),
kein Aufrufer muss sie unterscheiden. Der heikle Teil ist nicht das Senden,
sondern das Aufräumen: **Wann wird eine Gerätekennung gelöscht?** Zu früh heißt,
jemand bekommt nichts mehr und erfährt es nie. Gelöscht wird deshalb nur bei
den zwei Antworten, mit denen Google genau das meint — ein ungültiges Feld in
*unserem* Aufruf kostet kein Gerät.

- [x] **Das Gerät gehört dem, der es anmeldet.** Beim Web-Push (§111) ließ sich
      einmal das eigene Gerät als Empfänger für die Meldungen einer anderen
      Person eintragen. Hier kommt die Person aus der Sitzung, und eine
      mitgeschickte fremde Kennung ändert nichts.
- [x] **Das Diensttelefon darf den Besitzer wechseln.** Meldet sich dort jemand
      Neues an, übernimmt er den Eintrag — sonst bekäme der Vorgänger weiterhin
      die Dienstpläne seines Nachfolgers auf den Sperrbildschirm.
- [x] **Abmelden trägt das Gerät aus**, bevor die Sitzung weg ist.

### 2. Die Kamera für den Krankenschein
Vorher das Dateifeld, jetzt die Kamera der Hülle — mit einem verkleinerten Bild
zurück. Ein Krankenschein aus einer Telefonkamera sind sonst fünf Megabyte, und
die überträgt sich mit einem Balken Empfang nicht. Genau dort steht die Person
aber, wenn sie den Schein beim Arzt abfotografiert.

### 3. Face ID und Fingerabdruck
Hinter zwei Fingertipps liegt eine Lohnabrechnung, hinter drei die
Personalliste des Standorts. Telefone liegen im Dienstzimmer und werden
verliehen. Eine Anmeldung, die Wochen hält — und das soll sie —, braucht eine
zweite, schnelle Tür.

**Freiwillig** (erzwungen schalten die Leute das Telefonschloss ganz ab),
**erst nach einer Minute** (wer zur Kamera wechselt, wird nicht gesperrt),
**im Zweifel zu** (Abbruch und Fehler lassen nicht durch), und **nicht
einschaltbar ohne funktionierenden Sensor** — sonst käme jemand nie wieder
hinein.

### 4. Löschen des Kontos, in der App
Apple verlangt seit 2022, dass eine App mit Konto das Löschen auch **in** der
App anbietet (Richtlinie 5.1.1 v); ein „schreiben Sie uns" genügt ausdrücklich
nicht und ist ein häufiger Ablehnungsgrund. Art. 17 DSGVO gibt das Recht
ohnehin.

Was hier **nicht** steht, ist ein Knopf, der sofort alles löscht — das wäre
nicht erlaubt. Lohnunterlagen müssen sechs Jahre aufbewahrt werden (§147 AO,
§257 HGB, §28f SGB IV), und ein solcher Knopf risse der Person am Ende ihre
eigene Lohnsteuerbescheinigung weg. Der Antrag geht deshalb an den Arbeitgeber
und wird mit dem Löschkonzept (§128) abgearbeitet.

- [x] Neue Seite **Ich → Meine Daten**: Auskunft als PDF, Daten zum Mitnehmen,
      Löschung beantragen — und der Stand des eigenen Antrags samt Antwort.
- [x] Offene Anträge stehen bei der Leitung **ganz oben** auf der
      Datenschutzseite. Art. 12 Abs. 3 DSGVO gibt einen Monat; eine Frist hält
      nur, wer den Antrag sieht, ohne ihn zu suchen.
- [x] **Eine Ablehnung ohne Begründung gibt es nicht** (Art. 12 Abs. 4). Der
      Text landet in der App der Person.
- [x] Wird die Person gelöscht, gilt ihr Antrag automatisch als erledigt und
      zeigt auf den Löschbericht. Von Hand nachziehen würde vergessen — und in
      ihrer App stünde ewig „liegt vor".

### 5. Kein weißer Bildschirm ohne Netz
`native/web/fehler.html` liegt **im** Programm und kommt ohne Stilblatt,
Schriftart und Bild von außen aus — nichts davon käme an. Ohne sie sähe ein
Prüfer bei Apple nichts und lehnte ab; ein Mitarbeiter im Zug wüsste nicht, ob
sein Telefon kaputt ist oder nur der Tunnel lang.

### Die zwei Dinge, die sonst zur Ablehnung führen
Beides eingebaut, weil es später teuer wird: **`NSCameraUsageDescription`,
`NSPhotoLibraryUsageDescription` und `NSFaceIDUsageDescription`** stehen mit
verständlichen deutschen Sätzen in der Info.plist — fehlen sie, wird ohne
Prüfung abgelehnt. Und **`POST_NOTIFICATIONS`** steht im Android-Manifest: ohne
sie fragt Android 13 gar nicht erst nach Mitteilungen, die Anmeldung läuft
scheinbar durch, und es kommt nie etwas an. Der stillste aller Fehler.

Dazu: keine Google-Sicherung der App-Daten (`allowBackup=false`) auf einem
Telefon mit Lohndaten, und `WKAppBoundDomains` auf iOS, damit der
Offline-Zwischenspeicher aus §138 in Apples WebView überhaupt lebt.

Nachweis: 33 Prüfungen am laufenden System (`pruefungen/b4-app.mjs`) für Gerät
und Löschantrag, 6 Modultests für den Umgang mit toten Gerätekennungen. Der
Ablaufplan bis zur Veröffentlichung steht in **`APP-STORES.md`** — samt der
ehrlichen Liste dessen, was noch gegen eine Ablehnung spricht.

## Block §140 (12.09.) — Aufgeräumt nach dem ersten Blick auf dem Telefon

Vier Funde aus der Praxis, drei davon Oberfläche — und einer, der es nicht war.

### Die Leiste unten trägt wieder nur Ziele
Dort standen sieben Felder: die vier Ziele plus Suche, Konto und Abmelden.
Suche und Konto gibt es schon oben in der Leiste; zwei Wege zum selben Ort sind
kein Komfort, sondern eine Frage, die sich der Mensch stellen muss („sind die
beiden dasselbe?"). Und Abmelden ist ein Handgriff von zweimal am Tag — der
gehört nicht auf die Fläche, die man hundertmal antippt. Er steht weiterhin im
Menü oben rechts, unter „Mein Konto" und unter „Ich".

### Das Zeichen führt nach Hause
Auf das OKUN-Zeichen zu tippen tat bisher nichts. Auf jeder Website der Welt
führt das Logo aufs Dashboard — jetzt auch hier, und zwar auf das der eigenen
Rolle.

### Ein Knopf statt zweier ungleicher
Unten links ein grauer Käfer, 40 Pixel, 80 vom Rand. Unten rechts ein türkiser
Fragezeichen-Kreis, 48 Pixel, 96 vom Rand. Andere Ecke, andere Größe, andere
Höhe, andere Farbe — vier Unterschiede ohne einen Grund. Das sah nicht nach
zwei Funktionen aus, sondern nach zwei Systemen im selben Programm.

Dabei beantworten beide dieselbe Lage: **„Ich komme hier gerade nicht weiter."**
Ob daraus eine Frage wird oder eine Meldung, entscheidet sich erst danach. Also
ein Knopf, ruhig gehalten, und die Wahl kommt nach dem Antippen. Der dauerhaft
sichtbare rote Käfer ist damit weg — er sagte jedem Benutzer den ganzen Tag
„hier ist etwas kaputt".

### Der eine, der keine Oberfläche war
Auf dem Bild von „Mein Konto" stand **„Konto unwiderruflich löschen — löscht
Ihren Account und anonymisiert Ihre Mitarbeiterdaten"**. Der Knopf tat genau
das: Benutzerkonto weg, Name und E-Mail des Mitarbeiters überschrieben mit
„Gelöschter Mitarbeiter" — **ohne jede Prüfung.**

In einem Programm, das Löhne rechnet, ist das aus zwei Richtungen falsch. Gegen
das Gesetz: Das Lohnkonto muss sechs Jahre zuordenbar bleiben (§41 Abs. 1 EStG,
§28f SGB IV), Buchungsbelege zehn (§147 AO, §257 HGB) — die Betriebsprüfung
fände Abrechnungen ohne Person. Und gegen den Menschen selbst: Mit dem Namen
verschwindet die Grundlage seiner eigenen Lohnsteuerbescheinigung.

Daneben stand „Meine Daten exportieren — **alle** gespeicherten Daten". Ausgegeben
wurden vier Tabellen, gekappt bei 500 Zeilen; der Katalog aus §128 kennt
fünfunddreißig. Eine Auskunft, die unvollständig ist und sich vollständig nennt,
ist schlimmer als gar keine — sie sieht aus wie die Erfüllung von Art. 15 DSGVO.

- [x] Beides ersetzt durch **einen** Baustein (`MeineDatenrechte`), den „Mein
      Konto" und die App-Seite „Meine Daten" gemeinsam benutzen: vollständige
      Auskunft aus dem Katalog, Löschung über den Antrag aus §139.
- [x] Der alte Sofort-Löschweg **antwortet jetzt mit 409** und sagt, warum und
      wie es richtig geht — als Fehler, nicht still, damit es auffällt, falls
      ihn doch noch jemand ruft.
- [x] Der alte, unvollständige Export ist **entfernt**.
- [x] Ein Zugang ohne Personalakte (Geschäftsführung) bekommt keine Knöpfe, die
      ins Leere greifen, sondern den Satz, der erklärt, warum es hier nichts
      abzurufen gibt.

Nachweis: 4 zusätzliche Prüfungen in `pruefungen/b4-app.mjs` (jetzt 37). Die
Prüfung ruft den Löschweg **wirklich** auf — käme die alte Fassung zurück, wäre
danach ein Testkonto weg und die halbe Nachweisreihe fiele aus. Genau das ist
beabsichtigt: Diese Rückkehr darf nicht leise passieren.

## Block §142 (19.09.) — Der Lauf behebt jetzt selbst

Stufe 2 hat gelesen, nachgedacht und einen Vorschlag hingeschrieben. Das war
als Zwischenschritt richtig, aber es war auch der Punkt, an dem der Nutzen
aufhörte: Ein Vorschlag, den trotzdem ein Mensch umsetzen muss, spart die
Arbeit nicht, er verschiebt sie.

Ab jetzt behebt der Lauf Kleinigkeiten selbst. Drei Spuren.

### Die eine Entscheidung, an der alles hängt
**Wo verläuft die Grenze, und wer zieht sie?**

Nicht der Lauf. Er sagt, was er geändert hat und was er dafür hält — und der
Server entscheidet anhand der **geänderten Dateien**. Wer sich selbst einstuft,
stuft sich im Zweifel großzügig ein, und der Zweifel fällt hier auf Lohndaten.

Die Regeln stehen deshalb in `src/lib/behebung.ts` und nicht in der Anweisung
des Laufs: **Eine Regel, die in einem Text steht, den ein Modell liest, ist eine
Bitte. Eine Regel, die der Server prüft, ist eine Regel.**

| | Was | Wer entscheidet |
|---|---|---|
| **direkt** | Reine Anzeige. Höchstens 3 Dateien, 40 Zeilen, nur `.tsx` unter `src/app` oder `src/components`, nicht an heiklen Stellen | niemand — geht raus |
| **sammeln** | Alles mit Verhalten. Fertig gebaut und geprüft, auf eigenem Zweig | du, auf der Fundeseite |
| **abgelehnt** | Wird nicht angefasst | — |

### Die wichtigste Zeile im ganzen Block
- [x] **Prüfungen und Tests sind unantastbar.** Ein Lauf, der seine eigene
      Prüfung ändern darf, bekommt jede Änderung grün — dann ist das
      Sicherheitsnetz nur noch Dekoration. Eine einzige verbotene Datei kippt
      die ganze Behebung, auch wenn sie nur als Beifang neben einer harmlosen
      mitläuft. Das ist der einzige Verstoß, der nicht „sammeln" auslöst,
      sondern rundheraus abgelehnt wird.

Ebenso tabu: die Datenbank, Anmeldung und Rechte, Lohn, Datenschutz, die
native Hülle — und die Regeldatei selbst. Sonst schriebe sich der Lauf die
Erlaubnis.

### Was sonst noch gilt
- [x] **Ungeprüft geht nichts, auf beiden Spuren.** Was gesammelt wird, landet
      später genauso auf der Anlage — nur mit einem Menschen dazwischen, und
      der sieht einer roten Prüfung nicht an, dass sie rot ist.
- [x] **Eine leere Prüfreihe ist kein grünes Ergebnis.** Null Prüfungen und
      null Fehler sieht in einer Zusammenfassung aus wie „keine Fehler" — es
      heißt aber „nichts geprüft". Wird ausdrücklich abgewiesen.
- [x] **Geld und Recht nur nach ausdrücklicher Freigabe** — und auch dann nur
      gesammelt, nie direkt. Bestätigt wurde die Absicht, nicht der Code.
- [x] **Höchstens zwei Behebungen je Lauf.** Ein Lauf, der schiefgeht, richtet
      dann auch nur begrenzt Schaden an.
- [x] **Verworfen heißt nicht erledigt.** Der Fund bleibt offen — abgelehnt
      wurde der Weg, nicht das Problem.
- [x] **Was draußen ist, lässt sich nicht nachträglich freigeben.** Eine
      Zustimmung im Nachhinein ist keine.

### Nachlesbar, sonst nicht zu verantworten
Auf der Fundeseite steht zu jeder Behebung: die Dateien, die Zahl der Zeilen,
was sie geprüft hat, der Zweig, der Commit. Oben die, die auf eine Entscheidung
warten, darunter das Protokoll dessen, was ohne Rückfrage rausging. **Eine
Automatik, die man nicht nachlesen kann, ist eine, der man nicht widersprechen
kann.**

Was dort bewusst fehlt: ein Knopf „alles freigeben". Wer zehn Behebungen auf
einmal durchwinkt, hat keine davon gelesen — und dann ist das Tor keines.

### Das zweite Tor für Verbesserungen
Ein Verbesserungsvorschlag durchläuft zwei Freigaben: erst *ob* daran
gearbeitet wird, dann *ob dieser Weg richtig war*. Das erste Tor stand seit
§133, das zweite ist neu.

Nachweis: 26 Modultests für die Regeln und 40 Prüfungen am laufenden System
(`pruefungen/h3-behebung.mjs`) — die Fälle, in denen NICHT gehandelt werden
darf, gründlicher als die anderen. Der Maßstab dabei: Ein zu streng abgelehnter
Fund kostet einen Klick, ein zu großzügig durchgewinkter im schlimmsten Fall
einen falschen Lohn.

## Block §143 (19.09.) — Der Melder hört, was aus seinem Fund wurde

Bisher verschwand eine Meldung im Nichts. Wer einen Fehler meldete, wusste
danach nicht, ob ihn jemand gelesen hat, ob daran gearbeitet wird, und ob es
jemals behoben wurde. **Beim zweiten Mal meldet man dann nichts mehr** — und
genau die Leute, die den Betrieb kennen, hören auf, uns zu sagen, was kaputt
ist.

### Der Moment, um den es geht
Jemand meldet sonntags um elf, dass ein Knopf nicht funktioniert. Eine Stunde
später steht in seinem Kanal: *„Ist behoben."* Das ist kein Beiwerk — das ist
der Unterschied zwischen einem Werkzeug, dem man etwas erzählt, und einem, dem
man nichts mehr erzählt. Seit §142 läuft die Behebung ohnehin von selbst; was
fehlte, war nur, es dem zu sagen, der es gemeldet hat.

### Drei Nachrichten, nicht mehr
- [x] **eingegangen** — sofort beim Melden, mit der Nummer zum Nachfragen
- [x] **wir sind dran** — nur, wenn es sich hinzieht (ab 20 Minuten). Bei einer
      Kleinigkeit, die in derselben Viertelstunde rausgeht, wären zwei
      Nachrichten hintereinander nur Lärm — und wer drei Nachrichten für einen
      Tippfehler bekommt, stellt sie ab
- [x] **behoben** — samt Einladung zum Widerspruch: Wer das liest und es geht
      immer noch nicht, soll das loswerden können, ohne alles neu zu schreiben

Jede geht in den Kanal **und** per E-Mail. Der Kanal ist der verlässliche Weg,
die E-Mail der laute — wer sonntags meldet und das Programm zumacht, sähe eine
reine Kanalnachricht erst beim nächsten Anmelden.

Ohne Fachbegriffe. Kein Commit, kein Dateiname, kein „null pointer". Der Melder
ist eine Pflegekraft, keine Entwicklerin; was technisch passiert ist, steht auf
der Fundeseite, wo jemand es lesen will.

### Der Kanal zu OKUN
Neu in **Nachrichten**, bei jedem ganz oben: **OKUN Workforce**. Dort landen
die Rückmeldungen — und was man hineinschreibt, kommt bei OKUN als E-Mail an.

Bewusst **kein gewöhnlicher Direktchat**: Direktchats sind unantastbar (§129),
niemand liest sie mit, auch OKUN nicht. Genau deshalb sitzt OKUN nicht als
Teilnehmer in einem Kundenraum, sondern hat eine eigene Tür — eine eigene
Raumart mit genau einem menschlichen Mitglied. Die Grenze bleibt, wo sie war.

- [x] Jeder hat seinen eigenen; der Kanal einer Kollegin ist für niemanden
      sonst lesbar
- [x] Nicht verwaltbar, nicht schließbar, OKUN taucht in keiner Personenauswahl auf
- [x] Ein Plattformzugang hat selbst keinen — er schriebe sich sonst selbst

### Zwei Funde aus dem eigenen Prüflauf
Beim Nachweis fiel auf, dass der stündliche Lauf **seinen eigenen, gerade
angelegten Fund nicht mehr fand**. Ursache: Die Liste der offenen Funde war
nach Alter sortiert und bei hundert abgeschnitten — sobald hundert offen
standen, fiel jede NEUE Meldung hinten heraus, egal wie dringend. Jetzt kommt
der Rückstand von vorn **und** alles aus den letzten 24 Stunden.

Die zweite Ursache lag in den Prüfungen selbst: `h-funde` und `h2-fundelauf`
legten bei jedem Lauf Funde an und räumten nicht auf — in einer Woche hatten
sich genau hundert angesammelt. Beide schließen jetzt, was sie anlegen. **Eine
Prüfung, die Müll hinterlässt, wird irgendwann selbst zur Fehlerquelle.**

Nachweis: 11 Modultests für die Texte (unter anderem, dass keine Fachbegriffe
durchrutschen) und 26 Prüfungen am laufenden System
(`pruefungen/h4-rueckmeldung.mjs`).

## Block §144 (19.09.) — Gruppen eröffnen, ohne vierzigmal zu klicken

Der Fund aus dem Betrieb: *„Wenn ich als Standortleitung die Mitarbeiter suche,
findet er nicht alle."* Drei Dinge dahinter, und das dritte war das eigentliche.

### Alle auf einmal
- [x] **„Alle Mitarbeiter auswählen"** — eine Gruppe fürs ganze Haus baute man
      sonst mit vierzig Einzelklicks, und beim achtunddreißigsten verrutscht
      einer. Bei aktiver Suche heißt der Knopf „Alle n Treffer auswählen": So
      wird aus *Frühdienst* eingeben und einmal klicken eine fertige Gruppe.
      Nochmal drücken hebt die Auswahl wieder auf.

### Die Suche greift weiter
- [x] Gesucht wird über **Name, Position, Standort und Rolle**. Vorher nur über
      den Namen: Wer „Pflege" tippte, um die Pflegekräfte zu finden, bekam eine
      leere Liste und hielt die Suche für kaputt.
- [x] Mehrere Wörter werden **UND-verknüpft** — „pflege haus2" grenzt wirklich
      ein, statt alles zu zeigen, was irgendeines der Wörter enthält.
- [x] Eine leere Trefferliste sagt jetzt, dass sie leer ist, statt einfach
      nichts zu zeigen.

### Und der eigentliche Grund, warum jemand fehlte
Er fehlte wirklich — aber nicht an der Suche. **Im Chat sind Benutzerkonten die
Teilnehmer** (§131), und wer angelegt, aber noch nie angemeldet war, hat keins.
Er kann also gar keine Nachricht empfangen.

Ihn trotzdem zur Auswahl zu stellen wäre die schlechtere Lösung gewesen: Man
setzte jemanden in eine Gruppe, in der er nie etwas liest, und merkte es nie.
Richtig ist, die Lücke zu **benennen**:

> ⚠ 3 Personen fehlen hier (Daniel Krüger, …) — sie haben noch keinen Zugang und
> können deshalb keine Nachrichten empfangen. Unter **Mitarbeiter** lässt sich
> eine Einladung verschicken.

Mit Zahl, mit bis zu fünf Namen (eine Liste mit vierzig liest niemand) und mit
dem Weg, es zu ändern. **Eine Liste, die schweigend unvollständig ist, lässt den
Menschen an der Suche zweifeln statt an der fehlenden Einladung.**

Nachweis: 6 zusätzliche Prüfungen in `pruefungen/e5-chat.mjs` (jetzt 81) —
darunter, dass niemand gleichzeitig in beiden Listen steht und dass die Zahl am
eigenen Mandanten endet.

## Block §145 (20.09.) — Zwei feste Gespräche, die jeder schon hat

Unter **Nachrichten** stehen ab sofort ganz oben zwei Gespräche, die niemand
anlegen muss und die niemand schließen kann:

| | Wer antwortet | Wie schnell |
|---|---|---|
| **OKUN Assistent** | ein Programm | sofort |
| **OKUN Workforce** | Menschen bei OKUN | wenn jemand gelesen hat |

### Warum zwei und nicht einer
Beides in einen Raum zu legen wäre bequem und falsch. Man wüsste nie, ob
gerade eine Maschine oder ein Mensch geantwortet hat — und würde dem einen
Dinge erzählen, die für den anderen gedacht waren. Hinter der einen Tür sitzt
etwas, das sofort antwortet und das Programm erklärt; hinter der anderen
Menschen, die vielleicht erst morgen antworten, dafür aber **entscheiden**
können.

### Der Assistent
- [x] **Begrüßt, statt leer dazustehen** — und sagt im selben Atemzug, was er
      *nicht* kann: in Daten sehen oder etwas ändern. Sonst fragt ihn der erste
      Mensch nach seinem Resturlaub und ist enttäuscht.
- [x] **Die eigene Frage steht sofort im Verlauf**, die Antwort kommt Sekunden
      später über dieselbe regelmäßige Abfrage wie die einer Kollegin. Ein
      Absenden-Knopf, der acht Sekunden dreht, sieht aus wie ein hängendes
      Programm.
- [x] **Er antwortet immer** — notfalls mit einer ehrlichen Absage und dem
      Verweis auf das Gespräch daneben. Ein Gespräch, in dem auf eine Frage gar
      nichts folgt, ist schlimmer als eines mit einer Absage: Man wartet, lädt
      neu, fragt noch einmal.
- [x] Nur die letzten zwölf Beiträge als Zusammenhang. Was vor drei Wochen
      gefragt wurde, hilft bei der heutigen Frage selten — kostet aber jedes Mal.

### Der Systemtext liegt jetzt an einer Stelle
Der Assistent wird von zwei Seiten gerufen: aus dem Fenster hinter dem
Fragezeichen (§140) und aus diesem Gespräch. Beide benutzen dieselbe Datei
(`src/lib/assistent.ts`). Zwei Kopien wären nach dem ersten Umbau
auseinandergelaufen — **und dann bekäme derselbe Mensch auf dieselbe Frage zwei
verschiedene Antworten, je nachdem, wo er sie stellt.**

### Noch ein Prüfungsfehler derselben Art
`b3-warteschlange` zählte ungelesene Nachrichten **über alle Räume** und
erwartete null. Das stimmte, solange es außer Kollegengesprächen nichts gab —
seit es die festen Räume gibt, hat dort jeder etwas Ungelesenes. Gezählt wird
jetzt im Raum. Dieselbe Korrektur wie in `e5-chat` einen Block zuvor: **Eine
Prüfung, die an fremdem Zustand hängt, prüft nicht das, was sie behauptet.**

Nachweis: 12 zusätzliche Prüfungen in `pruefungen/h4-rueckmeldung.mjs`
(jetzt 38).

## Block §147 (21.09.) — HR Stufe 3: BEM aus den Fehlzeiten

**§167 Abs. 2 SGB IX:** Wer innerhalb eines Jahres länger als sechs Wochen
arbeitsunfähig war, dem *muss* ein betriebliches Eingliederungsmanagement
angeboten werden. Ohne dokumentiertes Angebot ist eine spätere
krankheitsbedingte Kündigung praktisch nicht haltbar.

**Das ist die Stufe, die nur wir bauen können** — weil die Fehlzeiten schon im
System liegen. Ein getrenntes Personalwerkzeug müsste sie abtippen lassen, und
dann rechnet sie niemand aus, und dann fällt es erst auf, wenn ein Gericht
danach fragt.

### Drei Wörter im Gesetz, die gern falsch gelesen werden
- [x] **„innerhalb eines Jahres"** — zwölf rollende Monate, nicht das
      Kalenderjahr. Wer im November vier Wochen und im Februar drei Wochen
      fehlt, ist über der Schwelle, obwohl in keinem Kalenderjahr sechs Wochen
      zusammenkommen.
- [x] **„oder wiederholt"** — es müssen keine sechs Wochen am Stück sein.
      Einzelne Tage zählen zusammen.
- [x] **„länger als"** — bei genau 42 Tagen ist die Schwelle noch *nicht*
      überschritten. Erst der dreiundvierzigste löst aus. Ein Tag Unterschied,
      und er entscheidet über eine Rechtspflicht.

Dazu: überlappende Krankmeldungen zählen nicht doppelt (eine
Folgebescheinigung, die einen Tag zurückreicht, darf nicht zu früh auslösen),
Urlaub zählt gar nicht mit, und nach einem Abschluss wird **ab dem Abschluss**
neu gezählt — sonst löste derselbe Zeitraum ein zweites Mal aus.

### Was das Programm nicht tut
Es entscheidet nichts und bietet nichts von selbst an. Es rechnet die Schwelle
aus und sagt, dass ein Angebot fällig ist. **Ein BEM-Angebot ist ein Gespräch
zwischen Menschen; eine automatische E-Mail dazu wäre der falsche Ton für den
Anlass.**

Eine **Ablehnung wird festgehalten**, nicht verworfen: Die Teilnahme ist
freiwillig, und die dokumentierte Ablehnung ist der Nachweis, dass angeboten
wurde — das Wertvollste am ganzen Vorgang. Ein **Abschluss braucht dagegen ein
Ergebnis**: Ohne wäre das Verfahren nicht durchgeführt, sondern nur abgehakt,
und genau das prüft ein Arbeitsgericht.

### Gesundheitsdaten, also eng
- [x] Die Standortleitung sieht BEM **standardmäßig nicht**. Der Betrieb kann
      es freischalten — in kleinen Häusern führt sie das Gespräch selbst.
- [x] **Die Leitung kann sich diese Freigabe nicht selbst erteilen.** Beim Bauen
      aufgefallen: `/api/org-settings` nahm bis dahin jedes Feld von jeder
      Leitung entgegen. Ohne diese Sperre wäre die ganze Sichtbarkeitsregel
      eine Bitte gewesen.
- [x] Ein Mitarbeiter sieht hier gar nichts — nicht einmal sich selbst. Sein BEM
      erfährt er durch das Angebot, nicht durch eine Liste im Programm.
- [x] **Keine Übersicht „wer war wie oft krank".** Angezeigt wird nur, wer über
      der Schwelle liegt oder in einem Verfahren ist. Eine solche Liste kann man
      nicht bauen, ohne dass sie irgendwann auch so benutzt wird.
- [x] Niemals eine Diagnose — nur das Verfahren. In der Auskunft nach Art. 15
      steht es trotzdem: Die Person darf wissen, was über ihr Verfahren
      festgehalten ist.

### Zwei Fehler, die der Prüflauf gefunden hat
**Eine Antwort, die sich nur einmal lesen lässt.** Ich hatte die 403-Antwort als
Modulkonstante angelegt. Eine `NextResponse` trägt einen Datenstrom, und der ist
nach dem ersten Lesen verbraucht — ab der zweiten Anfrage kam ein 403 mit
**leerem Körper**: Status richtig, Begründung weg. Jetzt eine Funktion.

**Eine Prüfung, die an fremdem Zustand hing.** `i2-bem` rechnete zuerst mit den
Fehlzeiten einer Person aus den Testdaten — und fiel im Gesamtlauf um, weil
andere Nachweise deren Fehlzeiten anlegen und löschen. Sie hat jetzt eine eigene
Person. Und sie räumt sie auch wieder weg: Beim ersten Versuch blieb „BEM
Nachweis" stehen, stand alphabetisch vorn und wurde vom Lohnnachweis d12 als
Testperson gegriffen, der daraufhin umfiel. **Wer jemanden anlegt, räumt ihn
auch weg.**

Nachweis: 26 Modultests für die Rechenwege (jeder Grenzfall der Schwelle
einzeln) und 32 Prüfungen am laufenden System (`pruefungen/i2-bem.mjs`).

## Block §148 (22.09.) — HR Stufe 4: Recruiting und Karriereseite

**Der erste Teil dieses Programms ohne Anmeldung.** Bis hierher lag alles hinter
einer Anmeldung, und jede Zugriffsfrage lief über `scope.ts`. Eine Karriereseite
ist das Gegenteil: Sie soll von Google gefunden und von Fremden gelesen werden.
Deshalb hat dieser Block eine Regel, die über allem steht — **nach draußen geht
ausschließlich, was jemand ausdrücklich veröffentlicht hat.** Entschieden wird
das an genau einer Stelle (`src/lib/karriere.ts`), nicht in drei Routen.

### Was ein Träger davon hat
- [x] **Stellen ausschreiben** — die Standortleitung für ihren Standort, die
      Unternehmensebene auch unternehmensweit. Eine Anzeige entsteht als
      **Entwurf** und geht nicht versehentlich online.
- [x] **Karriereseite** unter `/karriere/<adresse>` — Überschrift, Über-uns-Text,
      alle offenen Stellen, Bewerbungsformular. Kein eigener Webauftritt nötig.
- [x] **Google for Jobs** — jede Anzeige trägt ein schema.org `JobPosting` im
      Quelltext. Das ist der wirksamste Kanal für einen kleinen Träger, und er
      kostet nichts. Google prüft streng: Fehlt `datePosted` oder
      `hiringOrganization`, wird die Anzeige stillschweigend ignoriert — man
      merkt nichts, es passiert nur nichts. Deshalb sind beide Pflichtfelder in
      den Modultests festgenagelt.
- [x] **XML-Feed** unter `/karriere/<adresse>/stellen.xml` für Indeed,
      StepStone, kimeta und die Bundesagentur. Adresse einmal dort eintragen,
      danach holen sie sich die Anzeigen selbst. Eine echte API-Anbindung gäbe
      es bei jedem auch — aber nur gegen Vertrag, Schlüssel und in drei
      verschiedenen Formaten. Der Feed ist das, was ein Träger am Montag
      einrichten kann.
- [x] **Bewerber-CRM** — Pipeline (neu → gesichtet → Gespräch → Zusage /
      Absage), Bewerber von Hand einpflegen, Unterlagen ansehen, dem Bewerber
      direkt aus dem Vorgang schreiben. Jede E-Mail und jeder Standwechsel steht
      im Verlauf.
- [x] **Übernahme in die Personalakte** — aus der Bewerbung entsteht in einem
      Zug ein Mitarbeiter samt Einladung, die Bewerbungsunterlagen wandern in
      die Akte, und die **Pflichtnachweise aus dem Katalog (§146) werden
      automatisch zugewiesen**. Genau am Einstellungstag denkt daran sonst
      niemand.

### Drei Entscheidungen, die nicht offensichtlich sind

**Ohne Impressum geht die Seite nicht online.** Eine geschäftsmäßige Seite ohne
Anbieterkennzeichnung verstößt gegen §5 DDG und ist abmahnfähig. Das wäre ein
unschöner Weg, eine neue Funktion kennenzulernen. Der Schalter „online stellen"
lehnt deshalb ab und sagt, was fehlt — er warnt nicht bloß.

**Bewerberdaten verschwinden von selbst.** Sie sind die einzigen Personendaten
im System, für die es nach Verfahrensende keine Rechtsgrundlage mehr gibt. Sechs
Monate ab Absage (§15 Abs.4 AGG, §61b ArbGG); länger nur mit ausdrücklicher
Einwilligung in den Bewerberpool. Die Frist entsteht beim Wechsel in einen
Endstand und fällt weg, wenn die Bewerbung ins Verfahren zurückkommt. Wer
eingestellt wurde, wird nie gelöscht — aus der Bewerbung ist eine Personalakte
geworden. Steht als eigene Datenart im Löschkonzept (§128).

**Ein Honigtopf statt eines Captchas.** Das Formular hat ein unsichtbares Feld,
das kein Mensch sieht und ein Automat ausfüllt. Wer es ausfüllt, bekommt
„danke" und wird verworfen — merkte er, dass er auffiel, probierte er es mit
einem anderen Feld noch einmal. Ein Captcha würde dasselbe leisten und dabei
echte Bewerber vertreiben.

### Nebenbei repariert: /api/org-settings
Die Schnittstelle reichte den ganzen Körper der Anfrage an die Datenbank durch.
Damit konnte jeder, der sie erreicht, **jede Spalte** der Tabelle beschreiben —
einschließlich der Bankverbindung des Unternehmens. Mit diesem Block wäre auch
das Impressum der öffentlichen Seite dazugekommen. Jetzt eine Liste erlaubter
Felder, nach Rolle getrennt: Anschrift, Betriebsnummer, Bankverbindung und die
BEM-Freigabe kann nur die Unternehmensebene setzen.

Nachweis: 40 Modultests für die Rechenwege (Adressen, Löschfristen, JSON-LD,
das offene Formular) und 77 Prüfungen am laufenden System
(`pruefungen/j-recruiting.mjs`) — davon ein ganzer Abschnitt allein dafür, dass
ein Fremder weder Entwurf noch geschlossene Anzeige noch abgeschaltete Seite zu
sehen bekommt.

### Nachgereicht
- **Nachweis-Anforderung mit Rückweg** — fertig, Block §149 unten.
- **Belehrungen digital** — fertig, Block §150 unten.

## Block §149 (22.09.) — Nachweise anfordern, mit Rückweg

**Das Loch, das der Fristenmotor gelassen hat.** §146 rechnet aus, wer was
schuldig ist. Was danach kam, war Handarbeit: anrufen, eine E-Mail schreiben,
sich merken, wer geantwortet hat. Genau dort ging es verloren.

### Der Ablauf
1. Der Betrieb fordert etwas an — für einen oder für alle auf einmal.
2. Der Mensch bekommt eine Nachricht und kann es **direkt in der App
   hochladen**. Ein Foto der Bescheinigung genügt.
3. Der Betrieb wird benachrichtigt, sieht sich das Dokument an und **nimmt es
   ab oder fragt nach** — mit einem Gespräch direkt am Vorgang.
4. Die Abnahme trägt die Frist als erfüllt ein, und der Motor rechnet das
   nächste Ablaufdatum selbst aus.

Der Einstieg dafür steht dort, wo die Lücke sichtbar wird: In der Fristenliste
hat jeder fehlende oder abgelaufene Nachweis jetzt einen Knopf
„Bei … anfordern". Vorher musste man sich merken, wer was schuldig ist, und es
auf einer anderen Seite noch einmal eintippen — das tat niemand.

### Drei Entscheidungen
- **Einreichen darf nur der Mensch, abnehmen nur der Betrieb.** Das ist der
  ganze Sinn der Sache: Wer sich seinen Nachweis selbst abhaken kann, braucht
  keinen. Durchgesetzt als Zustandsautomat in `src/lib/anforderung.ts`, nicht
  in der Oberfläche — und jede Ablehnung sagt im Klartext, warum.
- **Hochladen und einreichen sind ein Knopf.** Zwei wären eine Falle: Man lädt
  hoch, geht weg, und beim Betrieb kommt nie etwas an.
- **Das Gespräch hängt am Vorgang, nicht im Chat.** Die Rückfrage („Das Zeugnis
  ist älter als drei Monate") gehört dorthin, wo der Nachweis liegt. Im Chat
  wäre sie nach zwei Tagen weggescrollt — und in einem halben Jahr fände
  niemand mehr, warum etwas zweimal eingereicht wurde.

**Erinnern, ohne zu drangsalieren:** frühestens alle sieben Tage, nie an jemanden,
bei dem der Betrieb selbst am Zug ist. Eine tägliche Mahnung liest niemand mehr.

Die Datei landet in der Personalakte, nicht am Vorgang — dort gehören
Unterlagen hin, und dort überleben sie den Abschluss. Wer selbst eingereicht
hat, sieht sie auch wieder; eine fremde Leitung kommt nicht heran.

Nachweis: 27 Modultests für den Zustandsautomaten (jeder verbotene Übergang
einzeln) und 47 Prüfungen am laufenden System (`pruefungen/i3-anforderung.mjs`).
Gesamtlauf: 1015/1015 in 30 Prüfungen, 651 Modultests.

## Block §150 (22.09.) — Belehrungen digital

**Der Fall aus der Praxis.** In einer Kita liegen jeden Monat vier, fünf Seiten
Belehrungen zur Unterschrift: Hygiene, Brandschutz, Schweigepflicht,
Unfallverhütung. Sie werden an jede Einrichtung geschickt, dort ausgedruckt,
herumgereicht, unterschrieben, eingesammelt und abgeheftet. Drei Wochen später
weiß niemand mehr, wer fehlt.

Jetzt: einmal hochladen, an alle verteilen, per Klick bestätigen. Der Betrieb
sieht jederzeit, **wer noch fehlt** — die Frage, die ein Ordner mit
Unterschriftenlisten nicht beantwortet.

### Was einen Nachweis belastbar macht
Eine Unterweisung nach §12 ArbSchG, eine Belehrung nach §43 IfSG, eine
Einweisung nach DGUV Vorschrift 1 — sie alle verlangen keinen bestimmten
Schriftträger. Verlangt wird der **Nachweis**: dass diese Person diesen Inhalt
zu diesem Zeitpunkt zur Kenntnis genommen hat. Dafür drei Entscheidungen:

- [x] **Jeder Beleg trägt Kopien, keine Verweise.** Name, bestätigter Wortlaut
      und Fingerabdruck (SHA-256) des Dokuments — aus dem Augenblick des
      Klicks. Ein Beleg, der auf die heutige Fassung zeigt, belegt nichts: Nach
      einer Änderung sähe er so aus, als hätte jemand etwas bestätigt, das es
      damals nicht gab.
- [x] **Eine verteilte Belehrung ist unveränderlich.** Titel, Dokument und
      Bestätigungssatz sind ab dem Verteilen festgeschrieben. Änderbar bleibt
      nur, was niemandem den Boden wegzieht: die Frist (verlängern hilft) und
      der Hinweistext. Wer etwas anderes will, schließt die Runde und verteilt
      eine neue — die alten Belege bleiben, wie sie sind.
- [x] **Bestätigen kann nur die Person selbst.** Weder die Leitung noch ein
      Kollege. Eine Belehrung, die jemand für einen anderen abhakt, belegt
      nichts.

### Was „gelesen" hier ehrlicherweise heißt
Niemand kann prüfen, ob ein Mensch etwas gelesen hat — auf Papier genauso
wenig. Festgehalten wird, was sich feststellen lässt: **wann das Dokument
ausgeliefert wurde** (das weiß der Server, nicht der Browser) und wann
bestätigt. Der Bestätigen-Knopf lebt erst nach dem Öffnen. Liegt zwischen
beidem keine Sekunde, steht das im Beleg — das System nennt ihn dann „dünn
belegt", und der Betrieb kann nachfassen. Das ist mehr, als eine
Unterschriftenliste hergibt.

**Wiederholung:** Eine Runde lässt sich als neue Runde klonen; der Titel
bekommt den Monat, das Dokument wird geteilt statt kopiert (derselbe
Fingerabdruck belegt genau das). Erinnern geht wie bei §149 höchstens alle
sieben Tage.

**Der Beleg gehört auch dem Menschen:** Er sieht in seiner App, was er wann
bestätigt hat — im Wortlaut von damals. Und in der Auskunft nach Art.15 DSGVO
steht es ebenfalls.

Nachweis: 35 Modultests (Unveränderlichkeit, Fingerabdruck, Belastbarkeit des
Belegs, Wiederholungsrhythmus) und 60 Prüfungen am laufenden System
(`pruefungen/i4-belehrung.mjs`). Gesamtlauf: **1075/1075 in 31 Prüfungen**, 686
Modultests, Bauen sauber.

## Block §151 (22.09.) — Das HR-Modul im Browser durchgespielt

Die 1080 Prüfungen sprechen mit den **Schnittstellen**. Sie sagen nichts
darüber, ob eine Seite überhaupt rendert oder ob ein Knopf tut, was daraufsteht.
Deshalb einmal alles im echten Browser bedient: jede neue Seite, jeder Reiter,
und die drei Abläufe von Anfang bis Ende — Stelle ausschreiben bis Bewerbung,
Nachweis anfordern bis Abnahme, Belehrung verteilen bis Bestätigung.

**Ergebnis: Das HR-Modul selbst trug keinen Fehler.** Alle Seiten rendern, alle
Reiter schalten, alle drei Abläufe laufen durch. Gefunden wurden vier andere
Dinge — drei davon älter als dieses Modul.

### Die Glocke war für jeden kaputt
`Header.tsx` und `CommandRail.tsx` fragten das Postfach mit `user.id` ab — der
Kennung des **Benutzerkontos**, nicht der des **Mitarbeiterdatensatzes**. Die
beiden sind nie gleich. Folge: auf jeder Seite und in jeder Rolle eine Absage
(403 beim Mitarbeiter, 404 bei der Leitung), die Glocke blieb dauerhaft leer.

Gemerkt hat es nie jemand, weil beide Aufrufer den Fehler verschlucken
(`.catch(() => {})`) — und eine leere Glocke sieht aus wie eine Glocke ohne neue
Nachrichten.

Das betraf §149 und §150 unmittelbar: Beide verschicken Benachrichtigungen, und
die wären in der Oberfläche nie angekommen. `/api/notifications` fällt jetzt ohne
Angabe auf das **eigene** Postfach zurück; ein Konto ohne Mitarbeiterdatensatz
(die Unternehmensebene) bekommt eine leere Liste statt eines Fehlers. Die fremde
Kennung bleibt möglich und wird weiter geprüft — mit Gegenprobe in
`e-kommunikation.mjs`.

### Dieselbe Verwechslung in der Frühwarnung
`/api/controlling/early-warning` legt Benachrichtigungen an und bekam ebenfalls
`user.id`. Die Meldungen landeten in einem Postfach, das es nicht gibt, und
waren für niemanden lesbar.

### Das Stundenkonto fragte ins Leere
Die Kachel auf `/employee/ich` rief `/api/hours-account` ohne Jahr und Monat auf
— 400 bei jedem Seitenaufruf. Beigetragen hat die Antwort nie etwas; angezeigt
wurde immer schon der Wert aus dem Mitarbeiterdatensatz. Sie richtig zu stellen
hätte es schlimmer gemacht: Diese Schnittstelle liefert die Über- und
Unterstunden **eines Monats**, und das ist unter der Überschrift „Stundenkonto"
die falsche Zahl. Die Abfrage ist jetzt weg.

### Zwei stumme Knöpfe (aus §149/§150)
Nach „Abnehmen" verschwand der Vorgang wortlos aus der Liste — er rutschte unter
„erledigt", das zugeklappt ist. Aus Sicht des Anwenders passierte nichts, und
der Zweifel führt zum zweiten Klick auf einen Knopf, den es nicht mehr gibt.
Dasselbe beim Schließen einer Belehrungsrunde. Beide melden jetzt, was geschehen
ist.

### Und ein Prüfstand, der sich selbst vergiftete
`f5-regelpakete` ordnet dem Reha-Standort das Regelpaket der **Kita** zu — das
ist sein Zweck — und nahm es nie zurück. Zwei Prüfungen später plant
`f-dienstplan` denselben Standort, der Rechendienst sucht nach Erzieherinnen,
findet nur Pflegefachkräfte und liefert einen leeren Plan. Ein einziger
abgebrochener Lauf vergiftete damit jeden folgenden.

Das ist genau Regel 1 der `pruefungen/README.md`. `f5` stellt den Ausgangszustand
jetzt wieder her, und `f-dienstplan` stellt seinen eigenen her, statt sich darauf
zu verlassen.

**Bekannt, nicht behoben:** `lohnPerson()` in `helfer.mjs` legt für jede
Lohn-Prüfung eine Person an und räumt sie nie weg — inzwischen 182 Karteileichen
am Reha-Standort. Sie stören noch nichts (der Plan rechnet mit 330 Personen
durch), aber sie wachsen mit jedem Lauf. Eigener Vorgang.

Stand nach diesem Block: **1080/1080 in 31 Prüfungen**, 686 Modultests, Bauen
sauber, und zusätzlich 50 Schritte im Browser über drei Rollen und drei Abläufe.

## Block §152 (25.09.) — Artikel 30 und 32: erst die Maßnahme, dann das Dokument

Beim Schreiben der technischen und organisatorischen Maßnahmen fiel die Lücke
auf, die sie hätten beschreiben sollen: **Die Anmeldung hatte keine Bremse.**
Beliebig viele Passwortversuche, und ein Fehlversuch hinterließ keine Spur —
obwohl der Protokolltyp `login_failed` seit Langem existierte und nie
geschrieben wurde. Außerdem lief bei unbekannter E-Mail kein bcrypt, die
Antwortzeit verriet also, welche Adressen ein Konto haben.

TOMs zu schreiben, die Schutz vor unbefugtem Zugriff behaupten, wäre damit
schlicht falsch gewesen. Also erst die Maßnahme.

### Die Bremse
- [x] **Zwei Zähler, nicht einer.** Je Konto (zehn Fehlversuche in einer
      Viertelstunde) und je Absenderadresse (vierzig). Ein Zähler allein sieht
      einen der beiden Angriffe nie: Wer zehn Versuche auf vierhundert Konten
      verteilt, bleibt unter jeder Kontogrenze; wer aus einem Botnetz kommt,
      hat für jeden Versuch eine neue Adresse.
- [x] **Die Sperre läuft ab.** Eine dauerhafte Kontosperre wäre eine Waffe: Wer
      die E-Mail-Adresse einer Standortleitung kennt, sperrt sie sonst mit zehn
      falschen Versuchen dauerhaft aus. Nach einer Viertelstunde geht sie von
      selbst auf — das kostet einen Angreifer vierzig Versuche pro Stunde und
      einen Vertipper eine Kaffeepause.
- [x] **Erst prüfen, dann rechnen.** Die Sperre greift VOR dem bcrypt-Vergleich.
      Andersherum wäre die Bremse selbst der Hebel für eine Überlastung — jeder
      Versuch kostet Kostenfaktor 12.
- [x] **Gleiche Antwort für unbekannte und bekannte Adressen**, samt
      Leerlauf-Vergleich, damit auch die Antwortzeit nichts verrät.
- [x] **Die Adresse wird nur als gesalzenes Kürzel abgelegt.** Gebraucht wird
      „dieselbe wie eben?", nicht die Adresse. Eine Liste, wer sich von wo
      angemeldet hat, soll gar nicht erst entstehen.
- [x] **Aufsperren als Supportfall.** Die Unternehmensebene hebt die Sperre
      eigener Leute auf, OKUN auch die einer ganzen Verbindung — der Fall, dass
      eine Einrichtung hinter einem Anschluss sich gemeinsam ausgesperrt hat.
      Jede Aufhebung wird protokolliert, sonst bliebe genau der Angriff
      unsichtbar, gegen den die Bremse gebaut ist.

### Verzeichnis von Verarbeitungstätigkeiten (Art. 30)
**Zwei Verzeichnisse, nicht eines.** Art. 30 kennt zwei Rollen, und wir sind
beide: Der Kunde ist Verantwortlicher (Abs. 1), OKUN ist Auftragsverarbeiter
(Abs. 2).

Das Verzeichnis des Kunden **erzeugen wir ihm** aus dem Datenkatalog (§128) —
je Datenart Zweck, Rechtsgrundlage mit Fundstelle, betroffene Personen, Daten,
Empfänger und Löschung. Das ist kein Gefallen, sondern der Grund, warum ein
Betrieb so ein Programm kauft: Er bekommt eine Pflicht erledigt, statt eine neue
zu bekommen. Abrufbar unter *Datenschutz → Verarbeitungsverzeichnis*, druckbar
als PDF.

Es **gibt sich ausdrücklich nicht für vollständig aus**. Der Betrieb verarbeitet
auch außerhalb dieses Programms — Bewerbungen auf Papier, eine Videoanlage am
Eingang, die Telefonliste im Flur. Ein erzeugtes Verzeichnis, das das
verschweigt, wäre gefährlicher als keines.

### Maßnahmen (Art. 32)
Zwanzig Maßnahmen in neun Rubriken — gegliedert nach der alten Anlage zu §9
BDSG, weil ein Prüfer diese Gliederung wiedererkennt. Jede trägt einen **Beleg:
den Pfad zu der Datei, in der sie tatsächlich steht.** Ein Test prüft, dass es
die Datei gibt. Wer eine Maßnahme entfernt, ohne den Eintrag zu ändern, bekommt
einen roten Lauf statt ein stilles Dokument.

**Der Stand ist ehrlich gehalten:** 14 umgesetzt, 3 durch den Betreiber
(Verschlüsselung im Ruhezustand, Sicherungen, Netz — das als eigene Leistung
auszugeben wäre gelogen), 3 teilweise. Zu jeder nicht umgesetzten Maßnahme ist
die Lücke benannt; ein Test erzwingt das. Eine TOM-Liste ohne offene Punkte
glaubt niemand — zu Recht, sie sagt nur, dass niemand genau hingesehen hat.

Die drei benannten Lücken: der zweite Faktor ist freiwillig und nicht erzwungen,
die Sitzung gilt dreißig Tage, und ein dokumentierter Wiederherstellungstest der
Sicherung fehlt — eine Sicherung, die nie zurückgespielt wurde, ist eine
Vermutung.

### Nebenbei gefunden: der Fehler hinter der „trägen" Dienstplanung
`f-dienstplan` fiel seit Tagen sporadisch mit „0 Zuweisungen" um, und ich habe
das der Aufwärmphase des Rechendiensts zugeschrieben. Falsch. Nach dem Rechnen
geht die Sitzung in den Stand **`verifying`** — dort wird der Plan gegen die
Regeln gehalten, und erst danach steht er in `week`. Die Prüfung kannte nur
`queued` und `running`, brach deshalb sofort ab und las einen leeren Plan.
Bestanden hat sie nur, wenn die Verifikation zufällig in denselben
Drei-Sekunden-Takt fiel.

Nachweis: 44 Modultests (Bremse, Vollständigkeit der Dokumente, Belegpfade) und
45 Prüfungen am laufenden System (`pruefungen/g2-dsgvo-dokumente.mjs`) —
darunter die Gegenprobe, dass ein anderes Konto von einer Sperre unberührt
bleibt, und dass auch das richtige Passwort eine Sperre nicht aushebelt.
Gesamtlauf: **1125/1125 in 32 Prüfungen**, 727 Modultests, Bauen sauber.

### Noch offen aus diesem Auftrag
- Datenschutzerklärung und Impressum für das Produkt selbst
- Die Löschfristen einzeln gegen ihre Vorschrift prüfen
- Lohn: Pfändung, betriebliche Altersvorsorge, Kurzarbeitergeld,
  Mehrfachbeschäftigung, Bescheinigungen
- Danach: ein Musterregelpaket für den Demo-Zugang

## Block §153 (25.09.) — Impressum und Datenschutzerklärung

**Der Hinweis stand schon da — er zeigte nur ins Leere.** Am Fuß der
Anmeldeseite stand „© 2026 OKUN Workforce · Datenschutz · Impressum", als
reiner Text, ohne Ziel. Das ist schlechter als gar nichts: Es sieht nach
Erfüllung aus. §5 DDG verlangt „leicht erkennbar, unmittelbar erreichbar und
ständig verfügbar".

### Zwei Ebenen, die gern verwechselt werden
- Für die Daten **seiner Mitarbeiter** ist der Kunde Verantwortlicher. Er
  informiert sie nach Art. 13, nicht wir. Was wir dabei tun, steht in seinem
  Verarbeitungsverzeichnis (§152) und im Vertrag zur Auftragsverarbeitung.
- Für **diese Webseite** ist OKUN Verantwortlicher — für den Abruf der
  Anmeldeseite, die öffentlichen Karriereseiten und die Protokolle, die dabei
  entstehen. Dafür braucht es ein eigenes Impressum und eine eigene Erklärung.

Beides liegt jetzt unter `/impressum` und `/datenschutz`, **ohne Anmeldung
erreichbar**, verlinkt von der Anmeldeseite und aus der App unter „Ich".

### Der Abschnitt, den die meisten Erklärungen auslassen
**Art. 22 — automatisierte Entscheidungen.** Ein pauschales „findet nicht
statt" wäre bequem und falsch: Das Programm rechnet Dienstpläne. Die Erklärung
sagt deshalb genau, was gerechnet wird und wo die Grenze verläuft — der Plan ist
ein *Vorschlag*, er wird angezeigt, kann geändert werden und wird erst wirksam,
wenn ein Mensch ihn veröffentlicht. Genau darauf stellt Art. 22 Abs. 1 ab.

Dazu der Workforce Score (freiwillig, ohne Wirkung auf Entgelt oder
Arbeitsverhältnis) und der Hilfe-Assistent (sieht keine Betriebsdaten, bekommt
nur den Text der Frage).

### Was aus Daten wächst, steht nur an einer Stelle
Die Liste der Dienstleister und die Aufbewahrungsfristen veralten am
schnellsten. Beide werden aus dem Datenkatalog (§128) und dem
Verarbeitungsverzeichnis (§152) erzeugt. Ein von Hand geschriebener Absatz
daneben wäre nach dem nächsten Umbau falsch — und eine falsche
Datenschutzerklärung ist schlechter als eine knappe.

### Die Seiten zeigen ihre eigenen Lücken
Solange Pflichtangaben fehlen, steht oben ein Kasten, der sie benennt — mit der
Vorschrift dazu. Ein Impressum, das seine Unvollständigkeit verschweigt, wiegt
in falscher Sicherheit; genau dafür werden Abmahnungen geschrieben.

**Zu setzen sind** (in `.env.example` dokumentiert): `OKUN_FIRMA`,
`OKUN_ANSCHRIFT`, `OKUN_VERTRETEN`, `OKUN_KONTAKT`, dazu `OKUN_REGISTER` und
`OKUN_USTID`, sobald vorhanden, und `OKUN_DSB`, sobald ein
Datenschutzbeauftragter benannt ist.

Nachweis: 24 Modultests und 13 weitere Prüfungen in
`pruefungen/g2-dsgvo-dokumente.mjs`. Gesamtlauf: **1138/1138 in 32 Prüfungen**,
751 Modultests, Bauen sauber.

> Die Texte sind sorgfältig hergeleitet und mit Fundstellen belegt. Die Freigabe
> durch einen Anwalt oder Datenschutzbeauftragten ersetzt das nicht.

## Block §154 (25.09.) — Die Löschfristen einzeln geprüft

Jede der siebzehn Fristen gegen ihre Vorschrift gehalten, mit Herleitung und
einer ehrlichen Angabe, wie belastbar sie ist: **sicher** (die Vorschrift nennt
die Zahl), **Auslegung** (aus einer Wertung hergeleitet, vertretbar aber nicht
zwingend) oder **zu klären** (da gehört die Antwort eines Fachmanns her).

Ein Test hält die Prüfung an den Katalog: Eine neue Datenart ohne geprüfte Frist
lässt den Lauf rot werden. Und jede Herleitung muss eine Fundstelle nennen — der
Test hat beim Schreiben vier Einträge gefunden, in denen ich behauptet hatte,
es gebe keine Vorschrift, ohne die Norm zu nennen, aus der das folgt.

### Der Reflex, der falsch ist
Im Zweifel länger aufbewahren — dem Finanzamt kann man dann nichts vorwerfen.
Art. 5 Abs. 1 lit. e DSGVO sieht das anders: Daten dürfen nur so lange bleiben,
wie der Zweck es verlangt. **Eine zu lange Frist ist genauso ein Verstoß wie
eine zu kurze — nur einer, den niemand bemerkt.**

### Was die Prüfung gefunden hat

**Behoben — und es war mein eigener Fehler:** Die Bestätigung einer Belehrung
wurde beim Ausscheiden gelöscht. Das ist genau der Beleg, für den §150 gebaut
wurde: Behauptet ein ehemaliger Beschäftigter später, nie unterwiesen worden zu
sein, stünde der Betrieb ohne Nachweis da. Art. 17 Abs. 3 lit. e DSGVO nimmt die
Löschung dafür ausdrücklich zurück. Jetzt eine eigene Datenart, drei Jahre
gesperrt (§195 BGB), danach gelöscht.

**Vier Fragen für den Steuerberater und den Datenschutzbeauftragten** — sie
stehen als Fragen da, nicht als Feststellungen, und sind im Programm unter
*Datenschutz → Verarbeitungsverzeichnis* abrufbar:

1. **Zeiterfassung, zwei Jahre — möglicherweise zu kurz.** §16 Abs. 2 ArbZG und
   §17 MiLoG sagen „mindestens zwei Jahre". Die Aufzeichnungen sind aber die
   Grundlage der Lohnabrechnung, und nach §147 Abs. 1 Nr. 5 AO sind Unterlagen,
   die für die Besteuerung von Bedeutung sind, sechs Jahre aufzubewahren. Kommt
   die Betriebsprüfung im vierten Jahr, liegt die Abrechnung vor — ihr Nachweis
   ist gelöscht.
2. **Personalakte, zehn Jahre — zu grob und vermutlich zu lang.** Die Akte wird
   als ein Block mit der längsten denkbaren Frist behandelt. Eine
   Lohnabrechnung ist ein Buchungsbeleg, ein Arbeitszeugnis nicht. Und die
   Frist für Buchungsbelege wurde durch das Vierte
   Bürokratieentlastungsgesetz von zehn auf **acht** Jahre verkürzt (§147
   Abs. 3 AO, §257 Abs. 4 HGB, seit 1.1.2025). Die Kategorien sind im Programm
   bereits vorhanden — die Unterscheidung lässt sich umsetzen, sobald die
   Zahlen feststehen.
3. **Lohnkonto: §28f SGB IV knüpft nicht an sechs Jahre an**, sondern an die
   letzte Betriebsprüfung. Prüfungen finden etwa alle vier Jahre statt, also
   liegt man meist richtig — aber eben nur meist.
4. **Belehrungsnachweis: Genügen drei Jahre?** Bei Personenschäden aus einer
   unterbliebenen Unterweisung reicht §199 Abs. 2 BGB bis zu dreißig Jahre.

Dazu drei Anmerkungen ohne Handlungsbedarf: warum Krankheitszeiten sechs Jahre
bleiben (Bestandteil der Abrechnung, nie eine Diagnose), warum ein Gespräch zu
zweit ganz verschwindet, und warum der Löschantrag bei den Protokollen steht und
nicht bei den Kontodaten.

Nachweis: 18 Modultests und 8 weitere Prüfungen in
`pruefungen/g2-dsgvo-dokumente.mjs`. Gesamtlauf: **1146/1146 in 32 Prüfungen**,
769 Modultests, Bauen sauber.

## Block §155 (26.09.) — Lohn Teil 1: Pfändung (§§850 ff. ZPO)

**Warum das gefährlicher ist als der Rest der Abrechnung.** Bei jedem anderen
Rechenfehler merkt es irgendwann jemand. Hier nicht: Zu viel einbehalten heißt,
dass jemandem das Existenzminimum fehlt. Zu wenig einbehalten heißt, dass der
**Arbeitgeber dem Gläubiger persönlich haftet** (§840 ZPO). Es gibt keine
Seite, auf der ein Fehler harmlos wäre.

### Drei Schritte, die gern verwechselt werden
1. **Was ist überhaupt pfändbares Einkommen?** (§850a) Nicht alles, was
   ausgezahlt wird, darf angefasst werden — die Hälfte der Mehrarbeit, das
   Urlaubsgeld, Erschwerniszulagen bleiben außen vor.
2. **Wie viel davon?** (§850c) Grundfreibetrag, der mit jeder Unterhaltspflicht
   steigt; vom Rest bleiben drei bis neun Zehntel frei; oberhalb eines
   Höchstbetrags ist alles pfändbar.
3. **Wer bekommt es?** (§804 Abs. 3, §850d) Die ältere Pfändung geht vor,
   Unterhalt steht davor — und für den gilt die Tabelle aus Schritt 2 gar nicht.

### Die Unterscheidung, die in der Pflege Geld ausmacht
**Nachtzuschläge sind unpfändbar, Sonntags- und Feiertagszuschläge nicht.** Das
hat das Bundesarbeitsgericht ausdrücklich so entschieden (23.08.2017 –
10 AZR 859/16): Nachtarbeit ist gesundheitlich belastend, der Zuschlag gleicht
eine *Erschwernis* aus (§850a Nr. 3). Sonntagszuschläge gleichen keine
Erschwernis aus, sondern die *Lage* der Arbeitszeit.

Wer beides gleich behandelt, rechnet entweder zulasten des Beschäftigten oder
zulasten des Gläubigers — und im zweiten Fall haftet der Betrieb dafür.

### Was das Programm bewusst NICHT tut
- **Es rät keinen notwendigen Unterhalt.** Bei einer Unterhaltspfändung setzt
  das Gericht diesen Betrag fest. Fehlt er, wird **nichts** einbehalten und
  die Oberfläche sagt warum — lieber gar nichts als eine geratene Zahl.
- **Es rechnet nicht ohne geprüfte Tabelle.** Die Freigrenzen werden zum
  1. Juli angepasst (§850c Abs. 4). Fehlt der Eintrag, wird der Abzug
  verweigert statt mit veralteten Zahlen gerechnet.
- **Es mindert nicht das Netto**, sondern den Auszahlungsbetrag. Steuerlich und
  sozialversicherungsrechtlich ist das Geld verdient — es geht nur an jemand
  anderen. Auf dem Beleg steht es als eigene Zeile je Gläubiger.

> **Vor der ersten echten Pfändung zu prüfen:** Die Tabellenwerte sind nicht
> gegen die amtliche Bekanntmachung im Bundesgesetzblatt abgeglichen; der
> Eintrag ab Juli 2026 ist sogar nur fortgeschrieben. Es sind vier Zahlen je
> Zeitraum — `ungepruefteTabellen()` listet sie auf.

### Nebenbei gefunden: Löschen löschte nicht
Die Prüfung ließ nach dem Aufräumen eine laufende Pfändung zurück. Der Grund
war größer als erwartet: **`DELETE /api/employees/[id]` entfernte nur die eine
Zeile in `Employee`.** Lohnabrechnungen, Zeitbuchungen, Pfändungen und Dateien
blieben liegen — unsichtbar in der Oberfläche, vorhanden in der Datenbank. In
der Prüfdatenbank waren es zwei Abrechnungen, drei Zeitbuchungen und zwei
Pfändungen ohne zugehörigen Menschen.

Der harte Löschweg räumt jetzt über denselben Zugriffsplan ab, den das
Löschkonzept (§128) ohnehin führt, und meldet zurück, wie viel entfernt wurde.
Er bleibt ausdrücklich der Weg für Daten, die es nie hätte geben dürfen — die
Löschung eines ausgeschiedenen Beschäftigten läuft weiter über
`/api/dsgvo/loeschung` und sperrt dort, wo das Gesetz aufbewahren heißt.

Nachweis: 41 Modultests für die Rechenwege (jeder Grenzfall einzeln) und 31
Prüfungen am laufenden System (`pruefungen/d17-pfaendung.mjs`) — darunter, dass
ein zweiter Lohnlauf den Abzug nicht verdoppelt und dass die Standortleitung
keine Pfändung sieht. Gesamtlauf: **1177/1177 in 33 Prüfungen**, 810
Modultests, Bauen sauber.

## Block §156 (26.09.) — Lohn Teil 2: Betriebliche Altersvorsorge

**Der Fehler, den fast jede selbstgebaute Abrechnung macht.** Man merkt sich
„acht Prozent sind frei" und rechnet damit. Das ist zweimal zur Hälfte richtig
— und deshalb besonders gefährlich.

### Zwei Grenzen in der Höhe
- **Steuerfrei** sind Beiträge bis **8 %** der Beitragsbemessungsgrenze RV
  (§3 Nr. 63 EStG).
- **Beitragsfrei** in der Sozialversicherung sind sie nur bis **4 %**
  (§1 Abs. 1 Satz 1 Nr. 9 SvEV).

Dazwischen liegt ein Bereich, in dem der Beitrag steuerfrei ist und trotzdem
verbeitragt wird. **Steuerbrutto und Beitragsbrutto sinken unterschiedlich
stark.** Wer eine Zahl führt, zieht dort zu wenig Sozialversicherung ab — und
das fällt erst bei der Betriebsprüfung auf, dann vier Jahre rückwirkend.

### Zwei Grenzen im Zeitraum — derselbe Fehler in der anderen Achse
- **Steuerlich** ist der Höchstbetrag ein **Jahresbetrag**. Er darf jederzeit
  ausgeschöpft werden, auch auf einen Schlag im Dezember (R 3.63 LStR). Was ein
  Monat nicht braucht, bleibt nutzbar.
- **Beitragsrechtlich** wird bei laufendem Entgelt **monatlich** gerechnet: ein
  Zwölftel der 4 % je Monat, **ohne Nachholung**. Was ein Monat nicht
  ausschöpft, ist verfallen.

Wer beide als Jahresbetrag führt, lässt im Januar das Zwölffache beitragsfrei
durchlaufen. Das Programm führt deshalb zwei getrennte Zähler:
`steuerfreiBisherImJahr` für die Steuer, `svfreiBisherImMonat` für die
Beiträge. Beitragsfrei kann außerdem nur sein, was steuerfrei ist — ist der
Jahresrahmen erschöpft, ist der Monatsrahmen gegenstandslos.

Beispiel bei einer BBG von 8.450 € im Monat (2026): 8.112 € steuerfrei im
Jahr, 338 € beitragsfrei im Monat. Wandelt jemand 507 € um, sinkt das
Steuerbrutto um 507 €, das Beitragsbrutto aber nur um 338 €.

### Der Zuschuss ist nicht einfach 15 %
§1a Abs. 1a BetrAVG verpflichtet den Arbeitgeber, 15 % weiterzugeben — aber
nur, *„soweit er durch die Entgeltumwandlung Sozialversicherungsbeiträge
einspart"*. Oberhalb der 4-%-Grenze spart er nichts, also schuldet er dort
auch nichts. Das Programm nennt **beide Zahlen**: die Pflicht und das, was
vereinbart ist. Wer weniger vereinbart, bekommt es beim Anlegen gesagt — nicht
erst auf der Abrechnung, wenn schon unterschrieben ist.

Ein pauschaler Zuschuss auf den ganzen Betrag ist zulässig und wird oft
vereinbart; er ist dann freiwillig, und genau so steht er da.

### Was das Programm bewusst NICHT tut
- **Altverträge nach §40b EStG a.F.** (vor 2005 geschlossen) werden nicht
  gerechnet. Sie laufen nach eigenen Regeln. Das Programm erkennt sie, weist
  die Umwandlung aus, mindert aber nichts und sagt, dass Beiträge und
  Pauschsteuer von Hand gehören — statt sie still falsch zu rechnen.
- **Es löscht keinen abgerechneten Vertrag.** Wurde damit schon ein Monat
  abgerechnet, wird er beendet, nicht gelöscht — sonst weist ein Beleg eine
  Umwandlung aus, deren Vertrag es nicht mehr gibt.
- **Der Zuschuss mindert das Entgelt nicht.** Er kommt obendrauf: mehr an die
  Versorgung, gleiches Brutto.

### Wer was darf
Anlegen und ändern darf die Unternehmensebene. Die Standortleitung sieht ihren
Standort mit — anders als bei einer Pfändung (§155), denn eine Entgelt&shy;um&shy;wandlung
ist nichts Belastendes, sondern ein Anspruch (§1a Abs. 1 BetrAVG), und sie
verändert das Brutto. Der Beschäftigte sieht seinen eigenen Vertrag; er hat ihn
schließlich geschlossen.

Nachweis: 28 Modultests für die Rechenwege und 36 Prüfungen am laufenden System
(`pruefungen/d18-bav.mjs`) — darunter der Bereich zwischen 4 % und 8 %, in dem
das Beitragsbrutto über dem Steuerbrutto liegt, und ein Beitrag über dem
Jahresrahmen.

## Block §157 (26.09.) — Lohn Teil 3: Kurzarbeitergeld (§§95 ff. SGB III)

**Zwei Fehler, die in entgegengesetzte Richtungen Geld kosten.**

### Fehler eins: zweimal zahlen
Wer in einem Monat mit Kurzarbeit das volle Monatsgehalt abrechnet und
obendrein Kurzarbeitergeld auszahlt, zahlt zweimal — und das zweite bekommt er
nicht erstattet. Abgerechnet wird deshalb das **Istentgelt**: das tatsächlich
erzielte Bruttoarbeitsentgelt (§106 Abs. 1 SGB III). Es tritt an die Stelle des
vertraglichen Entgelts, und die Abrechnung sagt das auf dem Beleg.

### Fehler zwei: auf der Bruttodifferenz rechnen
Kurzarbeitergeld ist **nicht** 60 % der Differenz der Bruttobeträge, sondern
60 % (mit Kind 67 %) der Differenz der **pauschalierten Nettobeträge**
(§§105, 106 SGB III). Bei 4.000 € Soll und 2.000 € Ist sind das nicht 1.200 €,
sondern rund 696 €. Wer nach Brutto rechnet, zahlt über 500 € im Monat aus
eigener Tasche — je Person.

Das pauschalierte Netto ist eine eigene Größe (§153 SGB III): Bruttoentgelt
minus 20 % Sozialversicherungspauschale, minus Lohnsteuer, minus Soli — **ohne
Kirchensteuer** und unabhängig davon, was tatsächlich abgeführt wird.

### Was fast immer vergessen wird
Auf das **fiktive Entgelt** — 80 % des Ausfalls — fallen Beiträge zu Renten-,
Kranken- und Pflegeversicherung an, und die trägt der **Arbeitgeber allein**
(§249 Abs. 2 SGB V, §168 Abs. 1 Nr. 1a SGB VI). Die Erstattung aus der Pandemie
ist ausgelaufen. Im Beispiel oben sind das 616 € im Monat, die in den
Arbeitgeberkosten stehen — sonst sähe Kurzarbeit billiger aus, als sie ist.
Zur Arbeitslosenversicherung fallen keine Beiträge an.

### Die Fristen, an denen es scheitert
- **§99 Abs. 2 SGB III** — Geld gibt es frühestens ab dem Kalendermonat, in dem
  die Anzeige bei der Agentur eingegangen ist. Deshalb ist das Eingangsdatum
  ein Pflichtfeld, und deshalb sagt der Lohnlauf es, wenn ein Monat davor liegt.
- **§109 Abs. 1 SGB III** — der Leistungsantrag muss binnen drei Monaten nach
  Ablauf des Abrechnungsmonats gestellt sein. Das ist eine **Ausschlussfrist**:
  danach ist der Anspruch erloschen. Die Frist steht an jeder Antwort, und ab
  30 Tagen davor wird sie beim Eintragen genannt.

### Der Betrag aus der amtlichen Tabelle geht vor
Die Agentur rechnet nach ihrer „Tabelle zur Berechnung des
Kurzarbeitergeldes". Sie entsteht aus demselben Programmablaufplan, aber mit
einer eingeschränkten Vorsorgepauschale (§153 Abs. 1 Satz 2 Nr. 2 SGB III
verweist nur auf §39b Abs. 2 Satz 5 Nr. 3 Buchstabe a und b EStG). Bei üblichen
Entgelten stimmt das Ergebnis überein, bei niedrigen kann es um einige Euro
abweichen. Wer den Tabellenwert abliest, trägt ihn ein — dann gilt er, und das
Programm nennt die eigene Abweichung, damit ein systematischer Fehler auffällt
statt sich zwölf Monate zu wiederholen.

### Nebenbei geregelt: Pfändung trifft Kurzarbeit
Kurzarbeitergeld tritt an die Stelle des ausgefallenen Entgelts und ist deshalb
pfändbar wie Arbeitseinkommen (§850 Abs. 4 ZPO). Es geht in die
Pfändungsbemessung ein — sonst bliebe bei Kurzarbeit zu wenig einbehalten, und
dafür haftet der Betrieb dem Gläubiger persönlich (§840 ZPO).

### Für die Agentur
Die **Abrechnungsliste** je Monat: Person, Personalnummer, Soll- und
Iststunden, Soll- und Istentgelt, Ausfall in Prozent, Leistungssatz,
Kurzarbeitergeld und die Beiträge auf das fiktive Entgelt, mit Summen und der
Betriebsschwelle nach §96 Abs. 1 Nr. 4 SGB III. Sie stellt die
Unternehmensebene; die Standortleitung sieht ihre Leute, aber stellt keinen
Antrag.

Nachweis: 34 Modultests und 45 Prüfungen am laufenden System
(`pruefungen/d19-kurzarbeit.mjs`) — darunter, dass das Kurzarbeitergeld weder
im Steuer- noch im Beitragsbrutto noch im Netto steht und dass es unter
60 % der Bruttodifferenz bleibt. Gesamtlauf: **1258/1258 in 35 Prüfungen**,
872 Modultests, Bauen sauber.

## Block §158 (26.09.) — Lohn Teil 4: Zwei Arbeitgeber und die Abfindung

### Die Beitragsbemessungsgrenze gehört der Person, nicht dem Arbeitgeber
Zwei halbe Stellen in zwei Häusern, Festanstellung plus Wochenenddienst beim
Nachbarträger — in der Pflege der Normalfall. Wenn jeder Arbeitgeber die
Grenze voll auf sein eigenes Entgelt anwendet, zahlt die Person auf denselben
Euro **zweimal** Beiträge. §22 Abs. 2 SGB IV teilt die Grenze deshalb im
Verhältnis der Entgelte auf: Wer die Hälfte des Gesamtentgelts zahlt,
verbeitragt die Hälfte der Grenze.

Ohne Angabe des anderen Entgelts wird ganz normal gerechnet — mit voller
Grenze. Das ist bewusst der sichere Weg: Zu viel abgeführte Beiträge holt sich
die Person über die Krankenkasse zurück, zu wenig abgeführte holt sich die
Rentenversicherung beim Betrieb. Und das letzte Wort hat ohnehin die Kasse, die
das Gesamtentgelt feststellt (§28i SGB IV); bis dahin ist die Zahl im Programm
die Angabe des Beschäftigten, und die Abrechnung sagt das.

Dazu die Regel, die am häufigsten überrascht: **Ein** Minijob neben einer
Hauptbeschäftigung bleibt geringfügig, der **zweite** wird mit ihr
zusammengerechnet und ist versicherungspflichtig (§8 Abs. 2 SGB IV) — nur die
Arbeitslosenversicherung bleibt außen vor.

### Die Abfindung: eine Änderung, die viele Programme noch nicht kennen
Bis einschließlich 2024 durfte der Arbeitgeber die **Fünftelregelung** schon
beim Lohnsteuerabzug anwenden. Das Wachstumschancengesetz hat die dafür nötige
Vorschrift (**§39b Abs. 3 Satz 9 EStG**) zum **1. Januar 2025 gestrichen**.

Seitdem versteuert der Arbeitgeber die Abfindung als gewöhnlichen sonstigen
Bezug. Die Ermäßigung nach §34 EStG gibt es weiterhin — aber die Person holt
sie sich über ihre Einkommensteuererklärung. Wer das nicht mitbekommen hat,
behält zu wenig Lohnsteuer ein; das fehlt nicht dem Finanzamt, sondern der
Person, die einen Bescheid mit einer Nachzahlung bekommt.

Der Hinweis steht deshalb an drei Stellen: **beim Erfassen** (vor der
Unterschrift), **im Lohnlauf** und **auf dem Beleg**, neben dem Betrag. Dazu
eine Abschätzung der **Zusammenballung** (§34 Abs. 1, Abs. 2 Nr. 2 EStG) — ob
die Abfindung die bis Jahresende entgangenen Einnahmen übersteigt. Das Programm
entscheidet das nicht; es rechnet die Faustregel und sagt, wie es dazu kommt.

Sozialversicherung: eine echte Abfindung ist **vollständig beitragsfrei**
(§14 SGB IV) — kein Arbeitsentgelt, sondern Entschädigung. Restlohn,
Urlaubsabgeltung oder Karenzentschädigung wären es dagegen nicht, und auch das
steht dabei.

### Nebenbei gefunden: die beitragsfreie Zahlung verbrauchte eine Grenze
Die anteilige Jahres-Beitragsbemessungsgrenze für Einmalzahlungen wurde aus
`svBrutto + sonstigeBezuege` der Vormonate gebildet — **einschließlich
beitragsfreier** Zahlungen. Eine Abfindung im März verkleinerte damit den
Rahmen für das Weihnachtsgeld im November, und das Weihnachtsgeld wurde zu
niedrig verbeitragt. Beitragsfreie Bezüge werden jetzt abgezogen.

Nachweis: 24 Modultests und 25 Prüfungen am laufenden System
(`pruefungen/d20-mehrfach-abfindung.mjs`) — darunter, dass bei zwei gleich
hohen Entgelten genau die Hälfte der Beiträge anfällt. Gesamtlauf:
**1283/1283 in 36 Prüfungen**, 896 Modultests, Bauen sauber.

### Noch offen im Lohn-Block
- Bescheinigungen (Arbeitsbescheinigung §312 SGB III, Entgeltbescheinigung für
  Krankengeld und Mutterschaftsgeld)
- Eine Oberfläche für Pfändung, Entgeltumwandlung und Kurzarbeit: alle drei
  sind derzeit nur über die Schnittstelle erfassbar.

## Zur Zertifizierung — Stand der Überlegung

Zwei getrennte Dinge, die oft verwechselt werden:

- **ELStAM selbst abrufen** braucht ERiC und ein Organisationszertifikat.
  Abgegrenzt und machbar, laufender Aufwand: einmal im Jahr die neue Version.
  Sinnvoll, sobald der monatliche Handgriff bei genug Kunden Arbeit macht.
- **SV-Meldungen (ITSG)** brauchen eine jährlich zu wiederholende Systemprüfung
  des ganzen Programms. Eine Dauerverpflichtung, keine einmalige Hürde. Lohnt
  nur, wenn die Lohnabrechnung ein eigenes Produkt wird.

Der jetzige Stand ist bewusst dazwischen: **wir rechnen, der Steuerberater
meldet.** Kein einziger externer Zugang nötig.

## Offen und bewusst so
- Der Zugriff auf **ELStAM** braucht einen zertifizierten Zugang, den der
  Arbeitgeber hat und nicht die Software. Die Liste holt er oder sein
  Steuerberater; wir lesen sie ein (D8). Dass er sie holt, kann ihm niemand
  abnehmen — wir warnen, wenn der Stand veraltet. Gehört in seinen Vertrag.
- **npm audit** meldet 12 Befunde, alle in `postcss` innerhalb von Next.js und
  alle schon vor diesem Block vorhanden. Die Behebung hieße Next 16 — eigener
  Vorgang, nicht nebenbei.

## Noch offen aus der Nachweis-Phase
- [x] **Krankenschein mit Fehlzeit verknüpfen** — fertig. Siehe Block C6 oben.
