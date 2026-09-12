# Stand — wo wir gerade stehen

**Diese Seite ist die Wahrheit.** Nicht das Gespräch, nicht die Erinnerung.
Wer wissen will, wo etwas steht, liest hier — und nur hier.

Zuletzt aktualisiert: **12.09.2026**

> **Regel für Claude:** Diese Datei wird bei **jedem** abgeschlossenen Punkt
> aktualisiert, im selben Commit wie die Arbeit. Nie später, nie gesammelt.
> Wenn diese Datei und die Wirklichkeit auseinandergehen, ist das ein Fehler
> wie jeder andere.

---

## Woran gerade gearbeitet wird

| | |
|---|---|
| **Baustelle** | Mitarbeiter-App für die Stores — Etappe 1 von 5 fertig |
| **Zuletzt fertig** | §137 App-Umbau: Stempeluhr, vier Menüpunkte, Lohn, Krankmelden |
| **Als Nächstes** | Etappe 2: Offline — Stempel und Anträge im Funkloch merken |
| **Danach** | Etappe 3: native Hülle (Capacitor) für Apple |

> **Die Übergangsversion beim Lohn ist vollständig** (Meilenstein 1 von 4).
> Rechnen, Beleg zustellen, ELStAM nachführen, rückwirkend korrigieren, DATEV an
> den Berater, SEPA an die Bank, Jahr abschließen. Gemeldet wird über den
> Steuerberater — bis zur Zertifizierung (Fahrplan Teil 4/5).

Der ausführliche Plan: `FAHRPLAN-KOMPLETTLOESUNG.md`

---

## Alle Baustellen im Überblick

| Bereich | Stand | Nächster Schritt |
|---|---|---|
| **Mitarbeiter & Stammdaten** (A) | ✅ fertig, nachgewiesen | — |
| **Arbeitszeit** (B) | ✅ fertig, nachgewiesen | — |
| **Abwesenheit** (C) | ✅ fertig, nachgewiesen | — |
| **Lohn** (D) | ✅ Übergangsversion fertig | Beitragsnachweis, Bescheinigungen |
| **Kommunikation** (E) | ✅ fertig, nachgewiesen | — |
| **Dienstplanung** (F) | ✅ fertig, nachgewiesen | — |
| **Grundlagen & Betrieb** (G) | ✅ fertig, nachgewiesen | Fristen vom Datenschutzbeauftragten gegenzeichnen lassen |

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
- [ ] Geldwerte Vorteile, bAV, Pfändungen — Teil 1.4–1.6
- [ ] Beitragsnachweis, AAG, DEÜV-Daten — Teil 3 (Meilenstein 2)
- [ ] Alles Weitere: siehe `FAHRPLAN-KOMPLETTLOESUNG.md`

### Sonst offen
- [ ] **Mitarbeiter-App in die Stores** — Etappe 1 (Umbau aufs Telefon) ist
      fertig. Offen: Offline (2), native Hülle für Apple (3), Play Store (4),
      App Store (5)
- [x] ~~**Test- und Fehlererfassung im System, Stufe 1**~~ ✅ — zwei Wege zum
      Melden (Käfer und ausführliches Formular), vier Arten, Ampel für die
      Meldequalität, Freigabe für Verbesserungsvorschläge, Rückfragen
- [x] ~~**Fehlerkreislauf Stufe 2**~~ ✅ — eigener schmaler Zugang, stündlicher
      Zeitplan, Bericht auf der Fundeseite. Der Lauf schreibt Vorschläge und
      Rückfragen, ändert aber noch keinen Code
- [ ] **Fehlerkreislauf Stufe 3** — automatische Behebung für den Kleinkram,
      je Bereich einschaltbar. Erst sinnvoll, wenn der Bericht ein paar Wochen
      gezeigt hat, dass die Einschätzung stimmt
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
| 🔴 | **`FUNDE_TOKEN` und `FUNDE_URL` setzen** (Railway + Sitzungsumgebung) | den stündlichen Fundelauf — er läuft, findet aber nichts |
| 🔴 | **D-U-N-S-Nummer beantragen** (kostenlos, dauert 1–2 Wochen) | das Apple Developer Program — und damit den App Store |
| 🟡 | Google-Play-Entwicklerkonto (25 $ einmalig) | den Play Store |
| 🟡 | Datenschutzerklärung und Impressum öffentlich erreichbar | beide Stores |
| 🟢 | Unternehmensdaten je Kunde vollständig eintragen | SEPA und DATEV je Kunde |

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
