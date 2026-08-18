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
- [ ] **A5 Dateiablage** — **fehlt.** Kein Upload, kein Speicher, nirgends.
      Fundament für A6, C4 und D3/D4. Offene Entscheidung: wohin die Dateien gehen.
- [ ] **A6 Personalakte** — **fehlt.** Arbeitsvertrag, Zeugnisse, Bescheinigungen,
      Krankenscheine. Hängt an A5.

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
- [ ] **E4 Einspringen: Benachrichtigung der Infragekommenden** — **fehlt.**
      In der Vertretungs-Route wird keine einzige Benachrichtigung ausgelöst.
      Ohne das erfährt niemand von der Anfrage.
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
| steht, aber unbewiesen | 22 |
| teilweise | 2 |
| fehlt | 11 |
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
