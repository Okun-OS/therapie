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

- [ ] **B1 Zeiterfassung, Unternehmenssicht** — steht (677 Z.)
- [ ] **B2 Zeiterfassung, Mitarbeitersicht** — steht (691 Z.)
- [ ] **B3 Zeiterfassungsprotokolle und Druck** — steht
- [ ] **B4 Freigabe und Monatsabschluss** — steht
- [ ] **B5 Überstunden beantragen und genehmigen** — steht
- [ ] **B6 Stundenkonto** — steht

## C · Abwesenheit

- [ ] **C1 Urlaubsanträge** — steht (341 Z.)
- [ ] **C2 Urlaubsjahresplanung** — steht (704 Z.)
- [ ] **C3 Urlaubsregeln** — steht
- [ ] **C4 Abwesenheiten** — teilweise. Erfassung steht; der Abgleich mit dem
      Krankenschein fehlt (hängt an A5).
- [ ] **C5 Schließzeiten** — steht

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

- [ ] **E1 Push-Infrastruktur** — steht (web-push, VAPID)
- [ ] **E2 Benachrichtigungen** — steht für Planveröffentlichung, Tauschanfragen,
      Urlaub, Zeiterfassung, Frühwarnung, Rundruf
- [ ] **E3 Einspringen: Anfrage und Kandidatensuche** — steht (270 Z.)
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
- [ ] **8 Lohn-Stammdaten am Mitarbeiter** — Steuerklasse, Kinderfreibeträge,
      Versicherung, Kirchensteuer, Bundesland, Lohn, Steuer-ID, SV-Nummer,
      Krankenkasse, Bankverbindung, Adresse, Ein- und Austritt
- [ ] **9 Anlegen auf Unternehmensebene** mit allen Angaben, danach Zuordnung
      zu einem Standort
- [ ] **10 Am Standort nur noch dienstplanbezogene Angaben** ändern

## Unternehmensebene aufräumen
- [ ] **11 Dienstplanung entfernen** (Dienstpläne, Urlaubsplanung, Vertretungen)
- [ ] **12 Planungsmodell und Regeln entfernen**
- [ ] **13 Scores und KI-Analyse entfernen** (Workforce Score, Insights,
      Fairness Engine, Personalrisiko, KI-Controlling)
- [ ] **14 Standort öffnen und dort alles sehen** — Dienstpläne, Urlaub,
      Mitarbeiter, Regeln, Vertretungen, Auswertungen
- [ ] **15 Unternehmensonboarding** prüfen und entfernen, wenn überflüssig
