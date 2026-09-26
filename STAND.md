# Stand — wo wir gerade stehen

**Diese Seite ist die Wahrheit.** Nicht das Gespräch, nicht die Erinnerung.
Wer wissen will, wo etwas steht, liest hier — und nur hier.

Zuletzt aktualisiert: **26.09.2026**

> **Regel für Claude:** Diese Datei wird bei **jedem** abgeschlossenen Punkt
> aktualisiert, im selben Commit wie die Arbeit. Nie später, nie gesammelt.
> Wenn diese Datei und die Wirklichkeit auseinandergehen, ist das ein Fehler
> wie jeder andere.

---

## Woran gerade gearbeitet wird

| | |
|---|---|
| **Baustelle** | Keine — der Lohn-Block ist abgeschlossen |
| **Zuletzt fertig** | §161 Musterregelpaket: womit ein neuer Kunde anfängt |
| **Als Nächstes** | Das Musterregelpaket an einem Demo-Account ausprobieren |
| **Danach** | Oberflächen für Pfändung, bAV, Kurzarbeit und Umlagesätze. Parallel: App in die Stores (wartet auf D-U-N-S) |

> **Der Lohn-Block ist vollständig** (§155–§160). Pfändung, betriebliche
> Altersvorsorge, Kurzarbeitergeld, Mehrfachbeschäftigung, Abfindung, die
> Umlagen U1/U2/Insolvenzgeld und die drei Bescheinigungen. Die Rechenwege
> stehen und sind belegt; was fehlt, sind Eingabemasken für vier davon.
> Gemeldet wird weiterhin über den Steuerberater — bis zur Zertifizierung
> (Fahrplan Teil 4/5).

> **Verkaufsfertig aus Sicht des Datenschutzes** (§152–§154): Verzeichnis der
> Verarbeitungstätigkeiten (Art. 30), technische und organisatorische
> Maßnahmen (Art. 32), Impressum und Datenschutzerklärung für das Produkt
> selbst, und alle Löschfristen einmal durchgeprüft. Vier Fristen warten noch
> auf die Gegenzeichnung.

Der ausführliche Plan: `FAHRPLAN-KOMPLETTLOESUNG.md`

---

## Alle Baustellen im Überblick

| Bereich | Stand | Nächster Schritt |
|---|---|---|
| **Mitarbeiter & Stammdaten** (A) | ✅ fertig, nachgewiesen | — |
| **Arbeitszeit** (B) | ✅ fertig, nachgewiesen | — |
| **Abwesenheit** (C) | ✅ fertig, nachgewiesen | — |
| **Lohn** (D) | ✅ vollständig (§155–§160) | Oberflächen für Pfändung, bAV, Kurzarbeit, Umlagen |
| **Kommunikation** (E) | ✅ fertig, nachgewiesen | — |
| **Dienstplanung** (F) | ✅ fertig, nachgewiesen | — |
| **Grundlagen & Betrieb** (G) | ✅ fertig, nachgewiesen | Vier Fristen gegenzeichnen lassen (§154) |
| **Personal & Recruiting** (I/J) | ✅ fertig, nachgewiesen | — |

✅ fertig · 🔨 in Arbeit · ⚠️ offen

---

## Was wirklich offen ist

Nach Dringlichkeit, nicht nach Bereich.

### Dringend
- [x] ~~**G3 Automatische Prüfung vor dem Ausrollen**~~ ✅ — 670 Nachweise
      liegen jetzt im Repo unter `pruefungen/`, ein Befehl prüft alles
      (`npm run pruefen`), und bei jedem Push läuft es automatisch.

### Lohn — der aktuelle Schwerpunkt
- [x] ~~Sonstige Bezüge (Weihnachts-/Urlaubsgeld, Boni)~~ — Teil 1.1 ✅
- [x] ~~Minijob und Übergangsbereich~~ — Teil 1.2 ✅
- [x] ~~Ein-/Austritte im Monat, Teilmonate~~ — Teil 1.3 ✅
- [x] ~~Beleg und DATEV vollständig~~ ✅
- [x] ~~Jahresabschluss und Werte für die Lohnsteuerbescheinigung~~ — Teil 2.2 ✅
- [x] ~~**Kein Lohn ohne freigegebenen Monat**~~ ✅ — die Standortleitung gibt
      den Monat frei, erst dann fließen die Zuschläge aus der Zeiterfassung in
      die Abrechnung. Wer aufgehalten wird, steht mit Namen und Grund da
- [x] ~~**Pfändung**~~ ✅ §155 — §§850 ff. ZPO, Nachtzuschläge unpfändbar,
      Sonntagszuschläge nicht (BAG 10 AZR 859/16), Rangfolge nach Zustellung
- [x] ~~**Betriebliche Altersvorsorge**~~ ✅ §156 — 8 % steuerfrei im JAHR,
      4 % beitragsfrei im MONAT: zwei Grenzen, zwei Zeiträume
- [x] ~~**Kurzarbeitergeld**~~ ✅ §157 — auf der pauschalierten Nettodifferenz,
      fiktives Entgelt, Abrechnungsliste für die Agentur, beide Fristen
- [x] ~~**Mehrfachbeschäftigung und Abfindung**~~ ✅ §158 — geteilte
      Beitragsbemessungsgrenze; Fünftelregelung entfällt seit 2025 im
      Lohnsteuerabzug
- [x] ~~**Umlagen U1, U2 und Insolvenzgeld**~~ ✅ §159 — waren eine Lücke:
      jeder Arbeitgeber zahlt sie, und sie standen nirgends
- [x] ~~**Bescheinigungen**~~ ✅ §160 — Arbeitsbescheinigung, Krankengeld,
      Mutterschaftszuschuss. Übermittelt wird über den Steuerberater
- [ ] **Oberflächen** für Pfändung, bAV, Kurzarbeit und Umlagesätze — alle vier
      sind derzeit nur über die Schnittstelle erfassbar
- [ ] Beitragsnachweis und DEÜV-Daten — Teil 3 (Meilenstein 2)
- [ ] Alles Weitere: siehe `FAHRPLAN-KOMPLETTLOESUNG.md`

### Datenschutz — abgeschlossen
- [x] ~~**Verzeichnis der Verarbeitungstätigkeiten (Art. 30)**~~ ✅ §152 — für
      OKUN als Auftragsverarbeiter und je Kunde als Verantwortlicher
- [x] ~~**Technische und organisatorische Maßnahmen (Art. 32)**~~ ✅ §152 —
      20 Maßnahmen, jede mit Beleg im Code statt mit einer Behauptung
- [x] ~~**Anmeldeschutz**~~ ✅ §152 — Sperre nach Fehlversuchen, je Konto und
      je Adresse, Prüfung VOR dem Passwortvergleich
- [x] ~~**Impressum und Datenschutzerklärung für das Produkt**~~ ✅ §153
- [x] ~~**Löschfristen geprüft**~~ ✅ §154 — jede Frist mit Herleitung und
      Sicherheitsgrad; vier Fragen bleiben für den Steuerberater offen

### Dienstplanung
- [x] ~~**Musterregelpaket**~~ ✅ §161 — womit ein neuer Kunde anfängt, bis
      sein eigenes Paket aus dem Gespräch entsteht

### Sonst offen
- [ ] **Mitarbeiter-App in die Stores** — Etappe 1 (Umbau aufs Telefon),
      Etappe 2 (Offline) und Etappe 3 (native Hülle) sind fertig. Offen ist
      nur noch das Einreichen selbst (4 Play Store, 5 App Store), und das
      hängt an Dingen, die OKUN besorgen muss: D-U-N-S-Nummer,
      Entwicklerkonten, Firebase-Projekt, öffentliche Datenschutzerklärung
      und Impressum, eigene Domain, Prüfer-Zugang mit gefüllten Daten.
      **Der Ablaufplan steht in `APP-STORES.md`.**
- [x] ~~**Test- und Fehlererfassung im System, Stufe 1**~~ ✅ — zwei Wege zum
      Melden (Käfer und ausführliches Formular), vier Arten, Ampel für die
      Meldequalität, Freigabe für Verbesserungsvorschläge, Rückfragen
- [x] ~~**Fehlerkreislauf Stufe 2**~~ ✅ — eigener schmaler Zugang, stündlicher
      Zeitplan, Bericht auf der Fundeseite. Der Lauf schreibt Vorschläge und
      Rückfragen, ändert aber noch keinen Code
- [x] ~~**Fehlerkreislauf Stufe 3**~~ ✅ — der Lauf behebt Kleinigkeiten selbst.
      Drei Spuren: reine Anzeige geht direkt raus, alles mit Verhalten wird
      fertig gebaut und wartet auf deine Freigabe, Geld und Recht nur nach
      ausdrücklicher Freigabe. Die Grenze zieht der Server anhand der geänderten
      Dateien, nicht der Lauf. Prüfungen und Tests sind unantastbar
- [x] ~~**E5 Mitarbeiter-Chat**~~ ✅ — jeder schreibt jedem am Standort, die
      Standortleitung eröffnet und verwaltet Gruppen. Mitlesen ist bewusst
      nicht dasselbe wie Verwalten: ein Beitritt der Leitung steht sichtbar im
      Verlauf, und Gespräche zu zweit sind für niemanden sonst einsehbar.
- [x] ~~**F5 Kundenmodul-Mechanik**~~ ✅ — Regelpakete laufen im Rechendienst
- [x] ~~**F6 Freischaltung je Kunde**~~ ✅ — gesperrt, bis OKUN sie einrichtet
- [x] ~~**G1 DSGVO Auskunft und Datenexport**~~ ✅ — jeder holt seine Auskunft
      selbst, als PDF und als Datei zum Mitnehmen (Art.15 und Art.20)
- [x] ~~**G2 DSGVO Löschkonzept**~~ ✅ — Katalog über alle 35 Tabellen, Vorschau
      vor jeder Löschung, Sperre statt Löschung wo das Gesetz es verlangt,
      Löschbericht als Nachweis
- [x] ~~**Krankenschein mit Fehlzeit verknüpfen**~~ ✅ — die Bescheinigung wird
      beim Einreichen der passenden Fehlzeit zugeordnet, Lücken (fehlende
      Folgebescheinigung) werden benannt, und die Frist nach §5 EntgFG ist
      einstellbar. Nebenbei: eine versehentlich erfasste Fehlzeit lässt sich
      jetzt auch entfernen

### Bewusst nicht
- **D7 Meldewesen selbst übermitteln** — erst ab Fahrplan Teil 4/5, mit
  Zertifizierung. Bis dahin über den Steuerberater.

---

## Was auf Daniel wartet

Ohne diese Punkte kommt die Arbeit an bestimmten Stellen nicht weiter.

| | Was | Blockiert |
|---|---|---|
| 🔴 | **Steuerberater die Rechnung gegenzeichnen lassen** | den ersten echten Kunden |
| 🔴 | **Eine echte ELStAM-Änderungsliste besorgen** | den Import passgenau zu machen |
| 🟡 | **Aufbewahrungsfristen gegenzeichnen lassen** (Steuerberater oder Datenschutzbeauftragter) | den ersten echten Kunden — die Fristen stehen mit Vorschrift in `src/lib/dsgvo-katalog.ts`, sind aber noch nicht geprüft |
| 🟡 | Die drei Anfragen verschicken (ITSG, ELSTER, Steuerberater) | die Zertifizierungs-Entscheidung |
| 🟡 | Vermögensschadenhaftpflicht klären | den ersten echten Kunden |
| 🔴 | **D-U-N-S-Nummer beantragen** (kostenlos, dauert 1–2 Wochen) | das Apple Developer Program — und damit den App Store |
| 🔴 | **Firebase-Projekt anlegen und `FCM_SERVICE_ACCOUNT` bei Railway setzen** | jede native Benachrichtigung — ohne den Schlüssel verschickt das System nichts und schreibt nur ins Protokoll |
| 🟡 | Google-Play-Entwicklerkonto (25 $ einmalig) | den Play Store |
| 🟡 | Datenschutzerklärung und Impressum öffentlich erreichbar | beide Stores |
| 🟢 | Unternehmensdaten je Kunde vollständig eintragen | SEPA und DATEV je Kunde |
| 🔴 | **Umlagesätze U1/U2 je Krankenkasse eintragen** (§159) | jede korrekte Arbeitgeberkostenrechnung — sie stehen in der Satzung jeder Kasse, das Programm rät sie nicht |
| 🟢 | ~~Insolvenzgeldumlage 2026, Pfändungsfreigrenzen, Mindestlohn~~ ✅ **erledigt am 26.09.** — nachgeschlagen und abgeglichen. Zwei Pfändungstabellen waren falsch und sind korrigiert |
| 🟡 | **`OKUN_*`-Angaben bei Railway setzen** (Firma, Anschrift, Vertretung, Register, USt-IdNr., Datenschutzbeauftragter) | Impressum und Datenschutzerklärung — ohne sie steht dort, was fehlt |
| 🟡 | **AVVs mit den Dienstleistern** (Claude, Hosting, Push) | den ersten echten Kunden |

🔴 dringend · 🟡 bald · 🟢 wenn ein Kunde kommt

Ausführlich: `ABLAUFPLAN.md`

---

## Die Papiere

| Datei | Wofür |
|---|---|
| `STAND.md` | **diese Seite** — wo wir stehen |
| `FEATURES.md` | was fertig ist und wie es nachgewiesen wurde |
| `FAHRPLAN-KOMPLETTLOESUNG.md` | der Weg zur eigenen Lohnabrechnung |
| `ABLAUFPLAN.md` | was Daniel außerhalb des Codes erledigen muss |
| `LOHN-ZERTIFIZIERUNG.md` | Zertifizierung, Kosten, Anfragelisten |
| `PRODUKT-NOTIZEN.md` | Geschäftsmodell und Leitentscheidungen |
| `FEHLERKREISLAUF.md` | Funde erfassen, auswerten, beheben — Stufe 1+2 gebaut |
| `pruefungen/README.md` | wie die Nachweise laufen und wie man neue schreibt |

---

## So wird gearbeitet

Damit es auch nach einer Pause oder in einer neuen Sitzung gleich läuft:

1. **Besprechen → verstehen → implementieren → testen → abhaken.** Nichts wird
   abgehakt, weil es plausibel aussieht.
2. **Jeder Fund wird sofort erledigt**, auch wenn er nicht zur Aufgabe gehört.
3. **Nichts nur vorbereiten.** Entweder es funktioniert, oder es steht als offen
   in dieser Datei.
4. **Keine Zahl, die sich nicht belegen lässt.** Lieber sagen „das weiß ich
   nicht" als eine plausible Zahl erfinden — besonders bei Geld und Gesetzen.
5. **Jede nicht offensichtliche Entscheidung wird im Code begründet**, mit
   fortlaufender `§`-Nummer. Der Code erklärt das *Warum*, nicht das *Was*.
6. **Nachgewiesen wird am laufenden System**, nicht nur mit Modultests.
   Dazu gehört immer: kann eine fremde Leitung das auch?
7. **Diese Datei wird im selben Commit aktualisiert wie die Arbeit.**
