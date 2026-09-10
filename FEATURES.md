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

- [ ] **A1 Mitarbeiter anlegen und verwalten** — steht (778 Z.)
- [ ] **A2 Mitarbeiterprofil, Sicht des Mitarbeiters** — steht (781 Z.)
- [ ] **A3 Einladung und Registrierung** — steht
- [ ] **A4 Rollen und Rechte** — steht (Mitarbeiter / Admin / Unternehmen / OKUN)
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

- [ ] **D1 Lohnberechnung** — steht, und zwar echt: §32a EStG,
      Beitragsbemessungsgrenzen, Steuerklassen 1–6, GKV/PKV, Kirchensteuer, Soli.
      Jahreswerte müssen jährlich nachgezogen werden.
- [ ] **D2 Zuschlagsregeln** — steht (924 Z.)
- [ ] **D3 Lohnabrechnung als Dokument** — **fehlt.** Es wird gerechnet, aber kein
      Beleg erzeugt.
- [ ] **D4 Zustellung an den Mitarbeiter** — **fehlt.** Im Mitarbeiterbereich gibt
      es zum Lohn keine einzige Seite.
- [ ] **D5 DATEV-Export** — **fehlt.**
- [ ] **D6 Auszahlung per SEPA-Datei** — **fehlt.** Bewusst als Datei zum Upload
      bei der Bank, nicht als eigene Zahlungsauslösung (erlaubnispflichtig, ZAG).
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

- [ ] **F1 Rechenkern** — steht, am 17.08. in mehreren Punkten korrigiert
- [ ] **F2 Plan erzeugen, bearbeiten, veröffentlichen** — steht
- [ ] **F3 Wünsche und Konfliktlösung** — steht
- [ ] **F4 Schichttausch** — steht
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
- [ ] **G4 Mandantentrennung** — steht, am 17.08. gehärtet (Dienste waren
      standortübergreifend sichtbar)
- [ ] **G5 Prüfprotokolle** — steht

---

## Zählung

| Zustand | Anzahl |
|---|---|
| steht, aber unbewiesen | 20 |
| abgehakt (getestet) | 2 |
| teilweise | 2 |
| fehlt | 9 |
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

## Noch offen aus der Nachweis-Phase
- [ ] **Krankenschein mit Fehlzeit verknüpfen** — die Datei liegt in der
      Personalakte, die Abwesenheit im Kalender; beides ist noch nicht
      miteinander verbunden.
