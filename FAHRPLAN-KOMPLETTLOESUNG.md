# Fahrplan zur eigenen Komplettlösung

**Ziel:** OKUN rechnet, meldet und bescheinigt selbst. Der Kunde braucht keinen
Steuerberater für die Lohnabrechnung und kein zweites System.

Erstellt am 10.09.2026. Arbeitsdokument — abhaken, ergänzen, korrigieren.

> **Wo wir stehen, steht in `STAND.md`.** Diese Datei hier ist der Plan, nicht
> der Fortschritt. Wer wissen will, was gerade dran ist, schaut dort.

**Legende:**
`[OKUN]` = programmiere ich · `[DU]` = nur du kannst das · `[BEIDE]` = zusammen
Größe: **S** unter einem Tag · **M** ein bis drei Tage · **L** eine Woche ·
**XL** mehrere Wochen. Das sind Schätzungen meiner Arbeit, keine Zusagen.

---

## Teil 0 — Wo wir heute stehen

Damit der Plan einen ehrlichen Nullpunkt hat.

| Bereich | Stand |
|---|---|
| Lohnsteuer | **amtlicher BMF-Programmablaufplan**, exakt, 2025 + 2026 |
| Sozialabgaben | eigene Rechnung, Rechengrößen als geprüfte Jahresdaten |
| Steuerfreie Zuschläge | §3b EStG, steuer- und beitragsfrei getrennt |
| ELStAM | Änderungsliste wird eingelesen, Stand wird überwacht |
| Rückwirkende Änderungen | Aufrollung mit Korrektur im Folgemonat |
| Lohnbeleg | PDF nach §108 GewO, in der Personalakte |
| DATEV | CSV je Lohnart |
| Auszahlung | SEPA-Datei (pain.001.001.03) |
| Meldewesen | **fehlt** — läuft über den Steuerberater |
| Zertifizierung | **keine** |

Was fehlt, steht unten. Es ist viel — aber es ist endlich und benennbar.

---

## Teil 1 — Den Rechenkern vervollständigen

**Braucht keine Zertifizierung.** Jeder Punkt hier fällt bei einem echten Kunden
auf, lange bevor eine Behörde ins Spiel kommt. Das ist die Pflicht.

### 1.1 Sonstige Bezüge (Einmalzahlungen) `[OKUN]` — ✅ **fertig 10.09.2026**
- [x] Eigene Tabelle für Einmalzahlungen (Art, Bezeichnung, Betrag, Monat)
- [x] Voraussichtlicher Jahresarbeitslohn nach §39b Abs.3 EStG, inklusive
      bereits gezahlter Einmalzahlungen
- [x] `SONSTB` und `JRE4` an den Programmablaufplan durchgereicht — er konnte
      es bereits, wir haben es nur nicht genutzt
- [x] Sozialversicherung an der **anteiligen Jahresgrenze** statt der
      Monatsgrenze, RV und KV getrennt. Märzklausel wird **gemeldet, nicht
      geraten** (§23a Abs.4 SGB IV braucht die Vorjahresdaten)
- [x] Abfindungen beitragsfrei, aber steuerpflichtig
- [x] Eigene Lohnarten im DATEV-Export (0300, 5001)
- [x] Eigene Zeile auf dem Beleg, Steuer darauf getrennt ausgewiesen
- [x] Ein freigegebener Monat lässt sich nicht nachträglich ergänzen
- [x] 21 Modultests, 29 Prüfungen am laufenden System

### 1.2 Minijob und Übergangsbereich `[OKUN]` — ✅ **fertig 10.09.2026**
- [x] Beschäftigungsart am Lohnprofil (regulär / Minijob / kurzfristig). Der
      **Übergangsbereich steht bewusst nicht zur Wahl** — er ergibt sich aus dem
      Entgelt und ist Gesetz, keine Vereinbarung.
- [x] Minijob: 15 % Rente und 13 % Kranken pauschal beim Arbeitgeber, 3,6 %
      Eigenanteil beim Arbeitnehmer, Befreiung auf Antrag, 2 % Pauschsteuer
- [x] Übergangsbereich nach §20 Abs.2a SGB IV mit beiden Bemessungsgrößen —
      die Formel geht an beiden Enden exakt auf (Test)
- [x] Kurzfristige Beschäftigung: beitragsfrei, mit Hinweis auf die Zeitgrenze
- [x] **Die Geringfügigkeitsgrenze steht nicht als Zahl im Code**, sondern folgt
      dem Mindestlohn (§8 Abs.1a SGB IV). Die Herleitung bestätigt sich selbst:
      12,82 € Mindestlohn ergeben genau die amtlichen 556 € für 2025.
- [x] Kein Sprung nach unten an der Schwelle — eigens getestet
- [x] 35 Modultests, 22 Prüfungen am laufenden System
- [ ] **Offen:** Umlagen U1/U2/U3 — gehören zum Beitragsnachweis (Teil 3.1)
- [ ] **Offen:** Zeitgrenzen der kurzfristigen Beschäftigung automatisch zählen
- [ ] **Offen:** Minijobs an die Minijob-Zentrale melden — braucht Teil 5

### 1.3 Ein- und Austritte innerhalb des Monats `[OKUN]` — ✅ **fertig 10.09.2026**
- [x] SV-Tage statt Kalendertagen: jeder volle Monat hat 30, der 31. zählt
      nicht, ein Februar-Teilmonat wird aufgefüllt. **Die Probe: zwei Teilmonate
      desselben Monats ergeben zusammen genau 30** — sonst wird zu viel oder zu
      wenig verbeitragt
- [x] Anteiliges Monatsgehalt nach der Dreißigstel-Methode
- [x] Anteilige Beitragsbemessungsgrenzen
- [x] Wer im Monat gar nicht beschäftigt war, bekommt keine Abrechnung
- [x] **Klassifiziert wird nach dem regelmäßigen Entgelt**, nicht nach dem
      gekürzten Teilbetrag — sonst wäre jemand mit 3.400 € Gehalt in seinem
      ersten halben Monat fälschlich im Übergangsbereich gelandet
- [x] Anteiliger Urlaubsanspruch (§5 BUrlG) mit Aufrundung ab einem halben Tag
- [x] Urlaubsabgeltung (§7 Abs.4, §11 BUrlG) als Betrag — erfasst wird sie als
      Einmalzahlung, damit sie richtig besteuert wird
- [x] Rückwirkender Austritt: über die Aufrollung abgedeckt
- [x] 27 Modultests, 14 Prüfungen am laufenden System

### 1.4 Geldwerte Vorteile und Sachbezüge `[OKUN]` **M**
- [ ] Firmenwagen: 1-Prozent-Regelung und Fahrten Wohnung–Arbeit
- [ ] Sachbezugswerte (Verpflegung, Unterkunft) mit Jahreswerten
- [ ] Jobticket, Essenszuschuss, Kindergartenzuschuss
- [ ] 50-Euro-Sachbezugsfreigrenze mit Überwachung
- [ ] Trennung steuerfrei / steuerpflichtig / pauschalversteuert
- [ ] Pauschalversteuerung nach §37b und §40 EStG

### 1.5 Betriebliche Altersvorsorge `[OKUN]` **M**
- [ ] Entgeltumwandlung: Direktversicherung, Pensionskasse, Unterstützungskasse
- [ ] Steuerfreiheit nach §3 Nr.63 EStG mit Höchstbeträgen
- [ ] Beitragsfreiheit in der Sozialversicherung mit abweichender Grenze
- [ ] Verpflichtender Arbeitgeberzuschuss (15 %)
- [ ] Vermögenswirksame Leistungen

### 1.6 Pfändungen und Abtretungen `[OKUN]` **M**
- [ ] Pfändungsfreigrenzen-Tabelle als Jahresdaten (wie `lohnjahre.ts`)
- [ ] Unterhaltspflichten am Mitarbeiter
- [ ] Berechnung des pfändbaren Betrags
- [ ] Mehrere Pfändungen in der richtigen Reihenfolge
- [ ] Unterhaltspfändung mit eigenem Vorrang
- [ ] Eigene Position auf dem Beleg

### 1.7 Kurzarbeitergeld `[OKUN]` **L**
- [ ] Soll- und Ist-Entgelt je Mitarbeiter
- [ ] Leistungssatz nach Kindern
- [ ] Beitragsberechnung auf das fiktive Entgelt
- [ ] Abrechnungsliste für die Bundesagentur
- [ ] Erstattungsantrag vorbereiten

*Anmerkung: nur bauen, wenn ein Kunde es tatsächlich braucht. Aufwand hoch,
Häufigkeit gering — außer in einer Krise, dann aber bei allen gleichzeitig.*

### 1.8 Mehrfachbeschäftigung `[OKUN]` **M**
- [ ] Mehrere Arbeitsverhältnisse je Person kennzeichnen
- [ ] Zusammenrechnung für die Beitragsbemessungsgrenzen
- [ ] Steuerklasse VI für das zweite Verhältnis
- [ ] Meldung der Mehrfachbeschäftigung

### 1.9 Abfindungen `[OKUN]` **S**
- [ ] Fünftelregelung nach §34 EStG
- [ ] Keine Sozialversicherungspflicht (echte Abfindung)
- [ ] Eigene Lohnart

---

## Teil 2 — Jahreswechsel und Bescheinigungen

Der Jahreswechsel ist bei jeder Lohnsoftware der gefährlichste Moment. Er muss
ein geprobter Vorgang sein, kein Ereignis.

### 2.1 Jahreswechsel als Vorgang `[OKUN]` **M**
- [ ] Prüfliste: sind die Rechengrößen des neuen Jahres eingetragen und geprüft?
- [ ] Ist der neue Programmablaufplan verfügbar?
- [ ] Vorträge: Urlaub, Stundenkonten, Lohnsteuerjahresausgleich
- [ ] Sperre für das neue Jahr, solange die Werte nicht bestätigt sind
      *(steht bereits — `lohnjahre.ts` verweigert ungeprüfte Jahre)*
- [ ] Ein Testlauf über das ganze Vorjahr als Regressionsprüfung

### 2.2 Lohnsteuerbescheinigung `[OKUN]` **M**
- [ ] Jahreswerte je Mitarbeiter sammeln
- [ ] Ausdruck für den Mitarbeiter nach amtlichem Muster
- [ ] Datensatz für die elektronische Übermittlung vorbereiten
      *(Übermittlung selbst erst in Teil 4)*
- [ ] Besonderheiten: unterjähriger Eintritt, mehrere Verhältnisse

### 2.3 Bescheinigungen für Behörden und Kassen `[OKUN]` **L**
- [ ] Arbeitsbescheinigung nach §312 SGB III (Arbeitsagentur)
- [ ] Entgeltbescheinigung für Krankengeld
- [ ] Entgeltbescheinigung für Mutterschaftsgeld
- [ ] Bescheinigung für Elterngeld
- [ ] Verdienstbescheinigung für Behörden (Wohngeld, BAföG, Unterhalt)
- [ ] Jede als PDF in die Personalakte, jede mit Nachweis wer sie erzeugt hat

---

## Teil 3 — Meldewesen vorbereiten (noch ohne Übermittlung)

**Der klügste Zwischenschritt.** Alle Daten werden richtig gerechnet und
aufbereitet — nur verschickt werden sie noch über den Steuerberater. Wenn die
Zertifizierung kommt, kommt nur noch die Übermittlung dazu.

### 3.1 Beitragsnachweis `[OKUN]` **L**
- [ ] Beiträge je Krankenkasse und Beitragsgruppe summieren
- [ ] Umlagen U1 (Krankheit), U2 (Mutterschaft), U3 (Insolvenzgeld)
- [ ] Schätzung für den laufenden Monat, Korrektur im Folgemonat
- [ ] Fälligkeit: drittletzter Bankarbeitstag — Fristenüberwachung
- [ ] Ausdruck je Kasse zur Weitergabe
- [ ] **Aufrollung einbeziehen: korrigierte Beiträge gehören in den
      Ursprungsmonat** *(die Datenstruktur dafür steht bereits)*

### 3.2 DEÜV-Meldungen aufbauen `[OKUN]` **XL**
Die Datensätze erzeugen, prüfen und anzeigen — nur nicht senden.

- [ ] Anmeldung (Grund 10/11/13) bei Eintritt
- [ ] Abmeldung (Grund 30/34/49) bei Austritt
- [ ] Jahresmeldung (Grund 50)
- [ ] Unterbrechungsmeldung (Grund 51/52/53) bei Krankengeld, Elternzeit
- [ ] Sofortmeldung (Grund 20) für die betroffenen Branchen
- [ ] Änderungsmeldungen: Beitragsgruppe, Personengruppe, Krankenkasse
- [ ] Personengruppenschlüssel und Beitragsgruppenschlüssel korrekt vergeben
- [ ] Tätigkeitsschlüssel (9-stellig) am Mitarbeiter erfassen
- [ ] Plausibilitätsprüfungen wie die Annahmestellen sie machen
- [ ] Eine Meldeübersicht: was steht wann an, was ist raus

### 3.3 Erstattungsanträge AAG `[OKUN]` **M**
- [ ] U1: Erstattung der Entgeltfortzahlung bei Krankheit
- [ ] U2: Erstattung bei Mutterschaft
- [ ] Erstattungssatz je Krankenkasse hinterlegen
- [ ] Antrag aus den Abwesenheitsdaten erzeugen
      *(Krankheitstage stehen bereits in der Abrechnung)*
- [ ] Verknüpfung Krankenschein ↔ Fehlzeit *(steht noch offen aus Block C)*

### 3.4 Berufsgenossenschaft `[OKUN]` **M**
- [ ] Mitgliedsnummer und Gefahrtarifstelle je Standort
- [ ] Arbeitsstunden und Entgelte je Gefahrtarifstelle summieren
- [ ] Lohnnachweis (Jahresmeldung) erzeugen
- [ ] Unfallanzeige vorbereiten

### 3.5 Was du dafür besorgen musst `[DU]`
- [ ] Betriebsnummern **aller** beteiligten Krankenkassen je Kunde
- [ ] Erstattungssätze U1/U2 je Kasse
- [ ] BG-Mitgliedsnummer und Gefahrtarifstellen je Kunde
- [ ] Tätigkeitsschlüssel je Mitarbeiter (oder Regel zur Ableitung)
- [ ] Einen Steuerberater, der die aufbereiteten Daten gegenprüft

---

## Teil 4 — Zertifizierung ELSTER (ERiC)

Der erste eigene Zugang. Abgegrenzt, machbar, sofort spürbar für den Kunden.

### 4.1 Vorbereitung `[DU]`
- [ ] Im ELSTER-Entwicklerbereich registrieren
- [ ] Nutzungsvereinbarung abschließen
- [ ] Organisationszertifikat beantragen
- [ ] Die Fragenliste aus `LOHN-ZERTIFIZIERUNG.md` verschicken

### 4.2 ERiC einbinden `[OKUN]` **L**
- [ ] Bibliothek in den Betrieb einbinden (sie ist nativ, kein JavaScript —
      eigener kleiner Dienst wie beim Rechendienst der Dienstplanung)
- [ ] Zertifikatsverwaltung und sichere Ablage
- [ ] Testumgebung anbinden, Testfälle durchlaufen
- [ ] Fehlerbehandlung: was tun, wenn ERiC ablehnt
- [ ] Versionswechsel als Vorgang (mehrmals im Jahr)

### 4.3 ELStAM automatisch `[OKUN]` **M**
- [ ] Anmeldung eines Mitarbeiters
- [ ] Abmeldung bei Austritt
- [ ] Monatliche Änderungsliste automatisch abrufen
- [ ] In den **bestehenden** Abgleich einspeisen — Vergleich, Bestätigung und
      Nachweis bleiben unverändert *(genau dafür ist der Import so gebaut)*
- [ ] Härtefall: was tun, wenn ein Mitarbeiter keine Steuer-ID hat

### 4.4 Lohnsteueranmeldung `[OKUN]` **M**
- [ ] Monats- oder Vierteljahresanmeldung je nach Vorjahressteuer
- [ ] Summen aus den Abrechnungen bilden
- [ ] Übermittlung mit Protokoll
- [ ] Fristenüberwachung (10. des Folgemonats)
- [ ] Korrekturanmeldung nach einer Aufrollung

### 4.5 Elektronische Lohnsteuerbescheinigung `[OKUN]` **M**
- [ ] Jahresdatensatz je Mitarbeiter übermitteln
- [ ] Bis Ende Februar des Folgejahres
- [ ] Ausdruck für den Mitarbeiter mit der vergebenen Nummer

---

## Teil 5 — Zertifizierung ITSG (Sozialversicherung)

Die schwere Nummer. **Gilt ein Kalenderjahr und wird jedes Jahr wiederholt.**

### 5.1 Vorbereitung `[DU]`
- [ ] Kosten und Ablauf bei der ITSG erfragen (Fragenliste steht bereit)
- [ ] Klären, ob ein Teilumfang prüfbar ist oder alles auf einmal muss
- [ ] Trust-Center-Zertifikat beantragen
- [ ] Entscheiden, ob das Unternehmen die Dauerverpflichtung tragen soll

### 5.2 Übermittlung `[OKUN]` **XL**
- [ ] Datenannahmestellen anbinden
- [ ] Verschlüsselung und Signatur nach den Gemeinsamen Grundsätzen
- [ ] Rückmeldungen verarbeiten (Annahme, Ablehnung, Fehlerprotokoll)
- [ ] **Ein Verfahren für abgelehnte Meldungen** — das ist der Punkt, an dem
      Lohnsoftware im Alltag scheitert
- [ ] Meldearchiv mit Nachweis

### 5.3 Systemuntersuchung `[BEIDE]`
- [ ] Testfälle der ITSG durchrechnen
- [ ] Abweichungen beheben
- [ ] Prüfung bestehen
- [ ] **Als jährlichen Vorgang einrichten** — Termin, Verantwortlicher, Puffer

### 5.4 Weitere Meldeverfahren `[OKUN]` **L**
- [ ] A1-Bescheinigung bei Auslandseinsätzen
- [ ] Elektronische Arbeitsunfähigkeitsbescheinigung abrufen (eAU)
- [ ] Entgeltersatzleistungen (Krankengeld-Meldungen)
- [ ] Betriebsdatenpflege gegenüber den Kassen

---

## Teil 6 — Betrieb, Vertrauen, Nachweisbarkeit

**Der Teil, der aus einem Programm ein Unternehmen macht.** Wer fremdes Geld
rechnet, muss beweisen können, dass er es richtig gemacht hat.

### 6.1 Automatische Prüfung vor jedem Ausrollen `[OKUN]` — ✅ **fertig 10.09.2026**
- [x] Alle Nachweise im Repository unter `pruefungen/`
- [x] Ein Befehl: `npm run pruefen`, mit Filter für einzelne Bereiche
- [x] Verständliche Meldung, wenn System oder Testdaten fehlen
- [x] Automatischer Lauf bei jedem Push (`.github/workflows/pruefen.yml`):
      Typen, Modultests, Bauen, Nachweise gegen das gestartete System
- [x] **Der erste Lauf hat sofort etwas gefunden:** drei von zwölf Prüfungen
      bestanden nur einzeln, nicht hintereinander — sie hinterließen sich
      gegenseitig Zustand. Behoben.
- [ ] **Offen `[DU]`:** Kein Ausrollen ohne grünen Lauf. Railway rollt heute bei
      jedem Push aus, unabhängig vom Prüfergebnis. Das lässt sich in den
      Railway-Einstellungen an den Prüflauf koppeln.

### 6.2 Revisionssicherheit `[OKUN]` **L**
- [ ] Jede Abrechnung unveränderlich archivieren, sobald freigegeben
- [ ] Lückenlose Änderungshistorie: wer, wann, was, warum
- [ ] Aufbewahrung nach den gesetzlichen Fristen (Lohnkonten 6 Jahre,
      Beitragsunterlagen bis zur nächsten Prüfung)
- [ ] Export für die Betriebsprüfung (Rentenversicherung, Finanzamt)
- [ ] Digitale Betriebsprüfung: Datenzugriff nach GoBD

### 6.3 Vier-Augen-Prinzip `[OKUN]` **M**
- [ ] Abrechnungslauf, Freigabe und Auszahlung trennbar
- [ ] Freigabe durch eine zweite Person erzwingbar
- [ ] Wer was darf, je Kunde einstellbar

### 6.4 DSGVO `[OKUN]` **M** — *steht offen*
- [ ] Auskunft nach Art.15: alles zu einer Person auf Knopfdruck
- [ ] Datenexport in maschinenlesbarer Form
- [ ] Löschkonzept mit Aufbewahrungsfristen (Lohndaten dürfen nicht einfach weg)
- [ ] Auftragsverarbeitungsverträge `[DU]`
- [ ] Verzeichnis der Verarbeitungstätigkeiten `[DU]`
- [ ] Löschfristen je Datenart dokumentieren

### 6.5 Ausfall und Notfall `[BEIDE]` **M**
- [ ] Datensicherung mit geprüfter Wiederherstellung
- [ ] Was passiert, wenn am 28. die Software steht und Löhne raus müssen
- [ ] Ein Notfallweg: Abrechnungsdaten so exportieren, dass ein Dritter
      auszahlen kann
- [ ] Wiederanlaufzeit zusichern und einhalten können

### 6.6 Support `[DU]`
- [ ] Erreichbarkeit zum Monatsende festlegen — **da ruft jeder gleichzeitig an**
- [ ] Wer antwortet auf steuerliche Fragen? (Wir dürfen nicht beraten —
      Steuerberatungsgesetz)
- [ ] Eskalationsweg zu einem Steuerberater
- [ ] Wissensdatenbank für wiederkehrende Fragen

---

## Teil 7 — Produkt und Geschäft

### 7.1 Haftung `[DU]` — *vor dem ersten Kunden*
- [ ] Vermögensschadenhaftpflicht für Softwarefehler
- [ ] Haftungsabgrenzung im Kundenvertrag
- [ ] Klarstellung: wir rechnen, wir beraten nicht
- [ ] Was passiert bei einer Nachforderung durch eine Betriebsprüfung

### 7.2 Preis `[DU]`
- [ ] Preis je Mitarbeiter und Monat für die Lohnabrechnung
- [ ] Gegenrechnung: was kostet der Steuerberater heute?
- [ ] Einrichtungsgebühr für die Übernahme bestehender Daten
- [ ] Was ist in der Betreuung enthalten, was kostet extra

### 7.3 Übernahme bestehender Daten `[OKUN]` **L**
Der Punkt, an dem Kunden abspringen. Niemand wechselt, wenn er alles neu
eintippen muss.

- [ ] Import aus DATEV
- [ ] Import aus Lexware, Sage und den üblichen Programmen
- [ ] Jahreswerte übernehmen (unterjähriger Wechsel!)
- [ ] Abgleichbericht: stimmt die Übernahme?
- [ ] Parallellauf: einen Monat doppelt rechnen und vergleichen

### 7.4 Der erste Kunde `[BEIDE]`
- [ ] Einen Kunden finden, der bewusst Erster sein will
- [ ] Drei Monate Parallelbetrieb mit dem bisherigen Weg
- [ ] Jede Abweichung untersuchen, keine wegdiskutieren
- [ ] Erst danach den zweiten Kunden

---

## Reihenfolge und Meilensteine

**Meilenstein 1 — „Ein echter Kunde kann abgerechnet werden"**
Teil 1.1, 1.2, 1.3 · Teil 6.1 · Teil 7.1
→ Danach kann ein Betrieb mit Minijobbern, Weihnachtsgeld und unterjährigen
Eintritten sauber abgerechnet werden, mit automatischer Prüfung und geklärter
Haftung. Meldungen weiter über den Steuerberater.

**Meilenstein 2 — „Der Kunde merkt, dass wir mehr können"**
Teil 2 komplett · Teil 3.1, 3.3 · Teil 6.2, 6.3
→ Bescheinigungen, Jahreswechsel, Beitragsnachweis und Erstattungsanträge
kommen aus einem System. Der Steuerberater bekommt fertige Daten statt
Rohmaterial.

**Meilenstein 3 — „Der erste eigene Zugang"**
Teil 4 komplett
→ ELStAM, Lohnsteueranmeldung und Lohnsteuerbescheinigung laufen ohne Dritte.
Der monatliche Handgriff des Kunden entfällt.

**Meilenstein 4 — „Komplettlösung"**
Teil 3.2, 3.4 · Teil 5 komplett · Teil 7.3
→ Alle Meldungen selbst. Datenübernahme von Wettbewerbern. Ab hier braucht der
Kunde niemanden außer OKUN.

---

## Was das realistisch bedeutet

Drei Dinge, die ich nicht beschönige:

**Erstens: Ab Teil 5 gibt es kein Zurück.** Die Systemprüfung ist jährlich. Wenn
sie einmal ausfällt, können deine Kunden von einem Tag auf den anderen nicht
mehr melden. Das ist eine Verpflichtung gegenüber jedem einzelnen Kunden, nicht
nur eine Rechnung.

**Zweitens: Der Wettbewerb ist alt und groß.** DATEV, Sage, Lexware und andere
machen das seit Jahrzehnten. Auf dem Feld „wir rechnen Lohn" gewinnst du nicht
durch bessere Lohnabrechnung.

**Drittens — und das ist der eigentliche Punkt:** Dein Vorsprung liegt nicht in
der Lohnabrechnung. Er liegt darin, dass die **Dienstplanung für jeden Kunden
von Hand gebaut** wird und alles andere im selben System liegt. Kein
Wettbewerber baut dir einen Dienstplan, der deinen Betrieb wirklich abbildet.
Die Lohnabrechnung ist der **Grund, das System nie wieder zu wechseln** — sie
ist der Burggraben, nicht die Burg.

Deshalb die Reihenfolge oben: erst alles, was den Kunden bindet, ohne dich zu
verpflichten. Die Zertifizierung kommt, wenn genug Kunden da sind, die sie
tragen.

---

## Nächster Schritt

Ich fange bei **Teil 1.1 (Sonstige Bezüge)** an — der Ablaufplan des BMF kann es
bereits, wir reichen es nur nicht durch. Danach 1.2 (Minijob), dann 6.1 (die
automatische Prüfung), weil die 200 Nachweise sonst weiter im Arbeitsverzeichnis
liegen.

Deine drei dringendsten Punkte stehen in `ABLAUFPLAN.md`:
Steuerberater gegenzeichnen lassen, eine echte ELStAM-Liste besorgen,
die drei Anfragen verschicken.
