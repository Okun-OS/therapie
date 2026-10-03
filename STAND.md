# Stand — wo wir gerade stehen

**Diese Seite ist die Wahrheit.** Nicht das Gespräch, nicht die Erinnerung.
Wer wissen will, wo etwas steht, liest hier — und nur hier.

Zuletzt aktualisiert: **27.09.2026**

> **Regel für Claude:** Diese Datei wird bei **jedem** abgeschlossenen Punkt
> aktualisiert, im selben Commit wie die Arbeit. Nie später, nie gesammelt.
> Wenn diese Datei und die Wirklichkeit auseinandergehen, ist das ein Fehler
> wie jeder andere.

---

## Woran gerade gearbeitet wird

| | |
|---|---|
| **Baustelle** | Keine |
| **Zuletzt fertig** | §182/§183 „Diese Gruppe ist unterwegs" vor der Planung — und die Belegschaft beim Einrichten einspielen |
| **Nachweisstand** | 1588/1588 in 43 Prüfungen, 44 im Browser, 17 am Programmfenster, 136 im Rechendienst, 1034 Modultests |
| **Als Nächstes** | Echte Bildschirmfotos aus der App auf die Website |
| **Danach** | Eigene Domain, dann die Dateien zum Herunterladen dort hinlegen |

> **Der Lohn-Block ist vollständig** (§155–§162). Pfändung, betriebliche
> Altersvorsorge, Kurzarbeitergeld, Mehrfachbeschäftigung, Abfindung, die
> Umlagen U1/U2/Insolvenzgeld und die drei Bescheinigungen — mit Masken zum
> Erfassen. Gemeldet wird weiterhin über den Steuerberater, bis zur
> Zertifizierung (Fahrplan Teil 4/5).

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
| **Lohn** (D) | ✅ vollständig (§155–§162) | — |
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
- [x] ~~**Oberflächen** für Pfändung, bAV, Kurzarbeit und Umlagesätze~~ ✅ §162 —
      alle vier auf `/company/lohnverwaltung`. Dabei fand sich ein Fehler, den
      die HTTP-Prüfungen nicht finden konnten: „undefined" als Pfändungsart
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
- [x] ~~**Kundenpaket Kita (zwei Etagen, acht Gruppen)**~~ ✅ §163 — Regelpakete
      können jetzt bewerten statt nur zu verbieten. Die Abnahme fand vier
      Fehler, darunter einen, der jeden Plan dieser Kita unbrauchbar machte
- [x] ~~**Kita-Paket, zweite Runde**~~ ✅ §164/§165 — Nachmittagsbesetzung bis
      15:30, keine Dienstenden zwischen 15:30 und 17:00, Springerin nur zur
      Kernzeit, Leitungsstatus im Bericht, Vertretung zuerst auf der Etage
- [x] ~~**Kita-Paket, dritte Runde**~~ ✅ §166/§167 — höchstens eine fremde
      Kraft je Gruppe, jede Gruppe besetzt (mit Rechnung in der Meldung),
      Abgabesperre bei Eingewöhnung, und ein Maßnahmenvorschlag, der vor dem
      Anzeigen nachgerechnet wird
- [x] ~~**Kita-Paket, vierte Runde**~~ ✅ §168 — eine Kraft verlässt ihre
      Stammgruppe nur, wenn dort eine eigene bleibt. „Jede Gruppe ist besetzt"
      reichte nicht: Sie kann von einer Fremden besetzt sein
- [x] ~~**Maßnahmen entscheiden**~~ ✅ §169 — der Vorschlag „Gruppe 7 am
      Donnerstag aufteilen" lässt sich genehmigen, ablehnen und kommentieren.
      Die Entscheidung hängt am Tag, nicht am Rechenlauf: Nach der nächsten
      Krankmeldung wird neu gerechnet, und sie steht noch. Genehmigtes geht in
      die nächste Rechnung ein, Abgelehntes ändert nichts
- [x] ~~**Demo-Mandant für das Kita-Paket**~~ ✅ §171 — `npm run seed:kita`
      legt den Betrieb aus dem Kundenregelwerk als eigenen Mandanten an. Der
      erste Lauf daraus fand drei Fehler, die die Abnahme im Rechendienst
      nicht finden konnte: Die Rolle wurde nie übertragen (jede rollenbasierte
      Regel lief ins Leere), die Leitung stand mit ihren 40 Vertragsstunden an
      jedem Tag in einer Gruppe, und das Planungsprofil stand jeder fremden
      Leitung offen
- [x] ~~**Den Umlagekatalog prüfen**~~ ✅ §176 — alle 79 Stände von 24 Kassen
      gegen die Veröffentlichung der Kasse selbst gehalten, keine einzige
      Abweichung. Zwei Stellen waren knifflig: VIACTIV führt die Sätze auf
      der Webseite noch als Stand 2025, und die Knappschaft nennt im
      Merkblatt keine Erstattungsstufe. Beides über eine zweite Quelle
      geklärt und in der Prüfnotiz festgehalten
- [x] ~~**Umlagekatalog und Erstattungsstufe**~~ ✅ §175 — die Sätze von 24
      Kassen sind hinterlegt, der Betrieb wählt nur noch seine Stufe aus einer
      Liste statt drei Zahlen abzutippen. Dabei kam heraus, dass Kassen ihre
      Sätze unterjährig ändern (2026 gleich drei) — der alte Bau konnte das
      nicht abbilden und hätte ab dem Stichtag jeden Monat falsch gerechnet
- [x] ~~**Die flackernde Abnahme**~~ ✅ §174 — eine Prüfung kippte bei jedem
      dritten Lauf um und sprach dabei von einer Regel. Drei Ursachen, keine
      davon die Regel: Die Prüfung verlangte einen von zwei gleich guten
      Plänen; eine Abgabesperre klebte an der Vorlage und vergiftete jeden
      späteren Lauf; und ein abgebrochener Rechenlauf sah aus wie eine
      verletzte Regel. Alle drei behoben, drei volle Läufe ohne Ausreißer
- [x] ~~**Maßnahmen im echten Browser**~~ ✅ §172 — 22 Prüfungen über den
      ganzen Weg. Sie fanden, dass eine genehmigte Maßnahme beim nächsten
      Rechnen vom Bildschirm verschwand: richtig gerechnet, aber die Leitung
      konnte ihre eigene Entscheidung nicht mehr sehen
- [x] ~~**Rechnen blockiert die Auskunft nicht mehr**~~ ✅ §170 — der
      Rechendienst rechnete bisher in seiner Ereignisschleife und schwieg
      dabei auf `/health` und `/version`. Die App las das als „nicht
      erreichbar" — ausgerechnet während er arbeitete. Aufgefallen in der
      Abnahme, als eine Paketzuordnung mitten in einem laufenden Plan scheiterte

### Sonst offen
- [x] ~~**„Diese Gruppe ist unterwegs" — vor der Planung sagbar**~~ ✅ §182 —
      bisher gab es dafür nur die Maßnahme „aufteilen", und die entsteht erst,
      NACHDEM der Rechendienst gemeldet hat, dass er die Gruppe nicht besetzen
      kann. Eine Leitung, die die Gruppenfahrt seit sechs Wochen im Kalender
      stehen hat, musste erst einen Fehlschlag abwarten, um ihn zu bestätigen.
      Jetzt steht der Zeitraum an der Gruppe, mit Anfang, Ende und Grund: Sie
      braucht keine Besetzung, es kommt niemand von außen dazu, und ihre
      eigenen Kräfte bleiben bei ihr — eine Fahrt ist Arbeitszeit, keine
      Abwesenheit. **Dabei gefunden:** Die Abgabesperre aus §166 ließ sich
      über die Schnittstelle gar nicht setzen. Die Maske schickte sie, die
      Route reichte sie weiter, und der Schreibhelfer ignorierte sie; beim
      Lesen kam sie ebenfalls nicht zurück. Die Regel war im Rechendienst
      gebaut, geprüft — und unerreichbar
- [x] ~~**Die Belegschaft beim Einrichten anlegen**~~ ✅ §183 — wer ein
      Regelpaket baut, hat die Belegschaft ohnehin vor sich. Sie wird jetzt
      unter dem Regelpaket eingespielt: Name, Stunden, Tage, Gruppe, Funktion,
      Tagesmuster, feste freie Tage, Schichtvorliebe — mehr nicht. Erst
      prüfen, dann anlegen; stimmt eine Zeile nicht, wird keine einzige
      angelegt. Die E-Mail-Adresse trägt der Betrieb selbst nach; bis dahin
      steht eine auf `.invalid`, an die nichts zugestellt werden kann, und die
      Einladung wird mit einem Satz abgelehnt, der sagt was zu tun ist. Ein
      zweiter Durchlauf ändert, statt zu verdoppeln — und lässt eine schon
      eingetragene echte Adresse unangetastet
- [x] ~~**Der Durchstich bis ins Konto der Beschäftigten**~~ ✅ §181 — bis dahin
      hatte im Demo-Betrieb mit Regelpaket nur die Leitung einen Zugang. Der
      Plan war auf ihrem Bildschirm geprüft, nie im Konto der Kraft, für die er
      gerechnet wurde. Jetzt hat jede Kraft ein eigenes Konto, und
      `pruefungen/f7-durchstich.mjs` geht die ganze Kette: planen,
      veröffentlichen, als Beschäftigte ansehen — mit den Gegenproben, dass
      eine Kollegin den Plan nicht sieht und ohne Anmeldung niemand.
      **Der Durchstich hat drei echte Fehler gefunden:**
      (1) Tagesmuster im Regelpaket und Stundenzahl in den Stammdaten konnten
      einander widersprechen — dann kam nicht ein schlechterer Plan heraus,
      sondern gar keiner, für den ganzen Standort, mit einer Meldung die drei
      falsche Ursachen nannte;
      (2) `/api/employee-planning-profile` hatte gar keine Zugriffsprüfung —
      jede angemeldete Person konnte jedes Planungsprofil lesen und
      überschreiben;
      (3) wer acht Wochen krankgeschrieben war, wurde als schwere
      Regelverletzung gemeldet („0 statt 35 Std."), obwohl der Plan stimmte
- [x] ~~**Das Regelpaket kennt keine Namen mehr**~~ ✅ §181 — Tagesmuster,
      feste freie Tage, Rollen und Schichtvorlieben standen als Tabellen mit
      sechzehn Vornamen im Kita-Paket. Das sind Angaben aus Arbeitsverträgen,
      keine Betriebsregeln. Sie stehen jetzt in den Personalakten; das Paket
      beschreibt nur noch das Haus (Etagen öffnen und schließen, Gruppe 1 nie
      unter zwei, wer abgibt lässt jemanden zurück) und überlebt damit jeden
      Personalwechsel. Eine Gegenprobe im Rechendienst schlägt an, sobald
      wieder ein Vorname in den Code wandert. Muster und Stundenzahl werden
      beim Speichern gemeinsam geprüft — in beide Richtungen, denn es gibt
      zwei Türen in denselben Widerspruch
- [x] ~~**Die echte Wortmarke, überall**~~ ✅ §180 — auf dunklem Grund stand
      bisher kein Logo, sondern nachgebauter HTML-Text in Inter: andere
      Schrift, andere Sperrung, andere Strichstärke als im echten Logo. Der
      Grund war real — „OKUN" steht im Logo fast schwarz und wäre auf #0F1112
      unsichtbar. Die Antwort ist jetzt eine Negativfassung, die
      `npm run logo:negativ` aus derselben Datei erzeugt: nur das Dunkel wird
      gegen Weiß getauscht, das Zeichen bleibt Byte für Byte unberührt
      (nachgewiesen in `src/lib/__tests__/marke.test.ts`). Dieselbe Marke steht
      damit in Website, Anmeldung, Erstinstallation und im Kopf jeder E-Mail.
      Dazu die Schrift des Logos — nachgemessen als Gantari 600 — über den
      Überschriften der Website
- [x] ~~**Die Startseite vor der Anmeldung**~~ ✅ §177/§179 — drei Seiten:
      Startseite, „Alles, was Personal ausmacht" mit allen 95 Funktionen,
      und Kontakt mit Formular. Die Texte kommen vom Eigentümer und stehen
      in `src/lib/website-inhalt.ts`, zum Ändern ohne Code. Die
      Positionierung ist bewusst größer als Dienstplanung: ein
      durchgängiges System für Personalarbeit, vom Recruiting bis zum Lohn.
      Offen bleibt: echte Screenshots aus der App — dafür muss der
      Demo-Mandant erst einen veröffentlichten Plan haben
- [x] ~~**Eine herunterladbare Fassung fürs Gerät**~~ ✅ §173 — ein Programm
      mit eigenem Symbol im Startmenü. `npm run desktop:win` baut das
      Installationsprogramm für Windows (ohne Administratorrechte
      installierbar), `npm run desktop:linux` AppImage und .deb. Beides hier
      gebaut und gestartet. **Offen:** die .exe signieren (Zertifikat kaufen),
      das .dmg braucht einen Mac. Ausführlich: `DESKTOP.md`
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

**Die vollständige Liste zum Abhaken steht in `DEINE-LISTE.md`.** Sie ist nach
Reihenfolge sortiert statt nach Bereich: Was oben steht, blockiert das meiste
darunter.

Die sieben, die am meisten aufhalten:

| | Was | Blockiert |
|---|---|---|
| 🔴 | **D-U-N-S-Nummer beantragen** (kostenlos, 1–2 Wochen) | Apple-Konto → Push aufs iPhone → App Store → das beglaubigte `.dmg` |
| 🔴 | **Domain `okun-workforce.com` mit Railway verbinden** (Anleitung: `DOMAIN.md`) | Impressum, beide Stores, die Seite zum Herunterladen. Im Code ist sie schon eingetragen |
| 🔴 | **Firmenangaben für Impressum und Datenschutz** (Vorlage: `impressum-angaben.md`) | beide Stores und rechtlich jeden echten Kunden — vier Angaben sind Pflicht nach §5 DDG |
| 🟡 | **Entscheiden, was auf die Startseite gehört** | dass ich sie baue: Selbstanmeldung oder Gespräch, Preise, Kontaktweg — Produktentscheidungen, keine Programmierarbeit |
| 🔴 | **Firebase anlegen, `FCM_SERVICE_ACCOUNT` setzen** | jede Benachrichtigung — ohne den Schlüssel verschickt das System nichts |
| 🔴 | **Eine echte ELStAM-Änderungsliste besorgen** | den Import passgenau zu machen — geprüft ist er bisher nur an nachgebauten Dateien |
| 🔴 | **Steuerberater die Rechnung gegenzeichnen lassen** | den ersten echten Kunden |

🔴 dringend · 🟡 bald · 🟢 wenn ein Kunde kommt

Alles Weitere — Konten, Zertifikate, AVVs, Haftpflicht, Store-Einreichung —
steht in `DEINE-LISTE.md`. Der Hintergrund zum Lohnteil: `ABLAUFPLAN.md`

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
| `DEINE-LISTE.md` | **was Daniel erledigen muss** — Konten, Unterschriften, Zahlen, nach Reihenfolge |
| `impressum-angaben.md` | Vorlage zum Ausfüllen: die acht Angaben für Impressum und Datenschutzerklärung |
| `recherche-auftrag-umlagen.md` | fertiger Auftragstext, um die U1/U2-Sätze je Kasse zusammensuchen zu lassen |
| `DOMAIN.md` | die Domain mit Railway verbinden — Schritt für Schritt, mit den Einträgen bei Squarespace |
| `DESKTOP.md` | das Programm zum Herunterladen: bauen, einstellen, was offen ist |
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
