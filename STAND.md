# Stand — wo wir gerade stehen

**Diese Seite ist die Wahrheit.** Nicht das Gespräch, nicht die Erinnerung.
Wer wissen will, wo etwas steht, liest hier — und nur hier.

Zuletzt aktualisiert: **10.09.2026**

> **Regel für Claude:** Diese Datei wird bei **jedem** abgeschlossenen Punkt
> aktualisiert, im selben Commit wie die Arbeit. Nie später, nie gesammelt.
> Wenn diese Datei und die Wirklichkeit auseinandergehen, ist das ein Fehler
> wie jeder andere.

---

## Woran gerade gearbeitet wird

| | |
|---|---|
| **Baustelle** | Lohnabrechnung → eigene Komplettlösung |
| **Meilenstein** | 1 von 4 — „Ein echter Kunde kann abgerechnet werden" |
| **Zuletzt fertig** | Automatische Prüfung im Repo (Teil 6.1) — `npm run pruefen` |
| **Als Nächstes** | Fahrplan Teil 2.2 — Lohnsteuerbescheinigung |
| **Danach** | Teil 1.4–1.6 geldwerte Vorteile, bAV, Pfändungen |

Der ausführliche Plan: `FAHRPLAN-KOMPLETTLOESUNG.md`

---

## Alle Baustellen im Überblick

| Bereich | Stand | Nächster Schritt |
|---|---|---|
| **Mitarbeiter & Stammdaten** (A) | ✅ fertig, nachgewiesen | — |
| **Arbeitszeit** (B) | ✅ fertig, nachgewiesen | — |
| **Abwesenheit** (C) | ✅ fertig, nachgewiesen | Krankenschein mit Fehlzeit verknüpfen |
| **Lohn** (D) | 🔨 in Arbeit | Geldwerte Vorteile, bAV, Pfändungen |
| **Kommunikation** (E) | ⚠️ E5 fehlt | Mitarbeiter-Chat |
| **Dienstplanung** (F) | ⚠️ F5/F6 offen | Kundenmodul-Mechanik, Freischaltung je Kunde |
| **Grundlagen & Betrieb** (G) | ⚠️ G1/G2 offen | DSGVO: Auskunft und Löschkonzept |

✅ fertig · 🔨 in Arbeit · ⚠️ offen

---

## Was wirklich offen ist

Nach Dringlichkeit, nicht nach Bereich.

### Dringend
- [x] ~~**G3 Automatische Prüfung vor dem Ausrollen**~~ ✅ — 303 Nachweise
      liegen jetzt im Repo unter `pruefungen/`, ein Befehl prüft alles
      (`npm run pruefen`), und bei jedem Push läuft es automatisch.

### Lohn — der aktuelle Schwerpunkt
- [x] ~~Sonstige Bezüge (Weihnachts-/Urlaubsgeld, Boni)~~ — Teil 1.1 ✅
- [x] ~~Minijob und Übergangsbereich~~ — Teil 1.2 ✅
- [x] ~~Ein-/Austritte im Monat, Teilmonate~~ — Teil 1.3 ✅
- [ ] Geldwerte Vorteile, bAV, Pfändungen — Teil 1.4–1.6
- [ ] Alles Weitere: siehe `FAHRPLAN-KOMPLETTLOESUNG.md`

### Sonst offen
- [ ] **E5 Mitarbeiter-Chat** — fehlt ganz, es gibt nur Support-Tickets
- [ ] **F5 Kundenmodul-Mechanik** — Entwurf liegt in `solver-service/rulepacks/`,
      nicht verdrahtet
- [ ] **F6 Freischaltung je Kunde** — Dienstplanung soll gesperrt sein, bis sie
      für den Kunden gebaut wurde
- [ ] **G1 DSGVO Auskunft und Datenexport** — fehlt
- [ ] **G2 DSGVO Löschkonzept** — teilweise
- [ ] **Krankenschein mit Fehlzeit verknüpfen** — Datei liegt in der Akte, die
      Abwesenheit im Kalender, beides ist nicht verbunden

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
| 🟡 | Die drei Anfragen verschicken (ITSG, ELSTER, Steuerberater) | die Zertifizierungs-Entscheidung |
| 🟡 | Vermögensschadenhaftpflicht klären | den ersten echten Kunden |
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
