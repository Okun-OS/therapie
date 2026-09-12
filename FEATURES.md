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
