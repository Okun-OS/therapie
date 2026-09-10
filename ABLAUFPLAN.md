# Ablaufplan — was Daniel erledigen muss

Notiert am 10.09.2026. Ziel: eigene, vollständige Lohnabrechnung, damit der
Kunde niemanden außer OKUN braucht.

Alles hier sind Dinge, die **ich nicht programmieren kann** — Auskünfte,
Entscheidungen, Verträge, Daten von außen. Was programmierbar ist, steht in
`FEATURES.md` und mache ich.

Reihenfolge ist nach Dringlichkeit sortiert, nicht nach Aufwand.

---

## Jetzt — bevor der erste echte Kunde abgerechnet wird

### 1. Steuerberater: die Rechnung gegenzeichnen lassen
**Warum:** Die Lohnsteuer rechnet seit dem 10.09. der amtliche
Programmablaufplan des BMF — die ist exakt. **Sozialabgaben, Zuschlagslogik und
die Steuerfreiheit nach §3b rechnen weiterhin wir.** Das ist gut getestet, aber
noch nie von einem Fachmann angesehen worden.

**Was du brauchst:** einen Steuerberater oder ein Lohnbüro, das drei bis fünf
echte Abrechnungen nachrechnet — am besten mit Nachtdiensten, einem Minijobber
und einer Steuerklasse III.

**Was du ihm gibst:** die erzeugten Belege, die DATEV-Datei und den Hinweis, dass
die Lohnsteuer nach dem BMF-Ablaufplan gerechnet ist.

### 2. Klären, wer die ELStAM holt
**Warum:** Steuerklasse und Freibeträge kommen vom Finanzamt und ändern sich
laufend. Bei 3.400 € brutto liegen zwischen Klasse I und III mit einem Kind
286 € im Monat. Für zu wenig einbehaltene Lohnsteuer haftet der **Arbeitgeber**.

**Zu klären, je Kunde:**
- Macht es sein Steuerberater über dessen Software?
- Oder macht er es selbst über „Mein ELSTER"?

**Was ich davon brauche:** **eine echte Änderungsliste als Datei.** Der Import
liest heute CSV mit erkannten Spalten — mit einer echten Datei mache ich ihn in
einer halben Stunde passgenau. Ohne sie ist er geraten.

### 3. Unternehmensdaten je Kunde vollständig eintragen
In OKUN unter *Unternehmen → Einstellungen*:
- [ ] Firmenname, Straße, PLZ, Ort — steht auf jedem Beleg
- [ ] **Betriebsnummer** (von der Bundesagentur für Arbeit)
- [ ] Steuernummer
- [ ] IBAN, BIC, Kontoinhaber — sonst gibt es keine SEPA-Datei
- [ ] DATEV Berater- und Mandantennummer — sonst kann der Berater die Datei
      nicht zuordnen

### 4. Je Mitarbeiter: die Angaben, die man nicht raten kann
- [ ] **Steuer-Identifikationsnummer** — ohne sie ordnet der ELStAM-Import nur
      über den Namen zu, und das ist die unsichere Variante
- [ ] **Krankenkasse und deren Zusatzbeitrag** — jede Kasse hat einen eigenen
      Satz. Steht auf der Mitgliedsbescheinigung.
- [ ] **Hat Kinder** und **Kinder unter 25** — zwei verschiedene Angaben. Der
      Zuschlag für Kinderlose entfällt dauerhaft mit dem ersten Kind, der
      Beitragsabschlag gilt nur für Kinder unter 25 und erst ab dem zweiten.
- [ ] Sozialversicherungsnummer
- [ ] IBAN für die Auszahlung

### 5. Im Kundenvertrag festhalten
- [ ] Der Kunde holt die ELStAM-Änderungsliste und stellt sie bereit
- [ ] Der Kunde lädt die SEPA-Datei bei seiner Bank hoch und gibt sie frei —
      **wir lösen keine Zahlung aus**, das wäre erlaubnispflichtig (ZAG)
- [ ] Meldungen an Sozialversicherung und Finanzamt laufen über seinen
      Steuerberater, solange wir keine eigene Zertifizierung haben
- [ ] Wer haftet wofür — die Lohnsteuerhaftung liegt beim Arbeitgeber
- [ ] Auftragsverarbeitungsvertrag (Lohndaten sind besonders schutzwürdig)

---

## Als Nächstes — Zahlen holen für die Entscheidung

### 6. Die drei Anfragen verschicken
Die fertigen Fragenlisten stehen in **`LOHN-ZERTIFIZIERUNG.md`, Abschnitt 5.**
Abschicken an:
- [ ] **ITSG** — Kosten und Dauer der Systemuntersuchung, jährliche Wiederholung
- [ ] **ELSTER-Entwicklerbetreuung** — ERiC für ELStAM und Lohnsteueranmeldung
- [ ] **Ein Steuerberater / Lohnbüro** — was kostet es, wenn *er* es macht

Die dritte Anfrage ist die wichtigste: sie ist die Gegenrechnung. Ohne sie
weißt du nicht, ob sich die eigene Zertifizierung überhaupt lohnt.

### 7. Die Grundsatzentscheidung treffen
**Ist die Lohnabrechnung ein eigenes Produkt oder Beiwerk zur Dienstplanung?**

Davon hängt alles ab. Beiwerk verträgt keine jährliche Systemprüfung. Ein
eigenes Produkt trägt sie — dann muss es aber auch eigenständig Geld verdienen.

Frag dich konkret: **Würde ein Kunde OKUN kaufen, wenn es nur die
Lohnabrechnung wäre?** Wenn nein, ist es Beiwerk.

---

## Später — wenn die Zahlen da sind

### 8. Stufe 2: ELStAM selbst abrufen
- [ ] Im ELSTER-Entwicklerbereich registrieren
- [ ] Organisationszertifikat beantragen
- [ ] Danach programmiere ich den Abruf — Abgleich und Bestätigung bleiben
      unverändert, nur die Herkunft der Daten wechselt

### 9. Stufe 3: volles Meldewesen
Nur wenn die Antwort auf Frage 7 „eigenes Produkt" lautet.
- [ ] ITSG-Systemuntersuchung beauftragen
- [ ] Trust-Center-Zertifikat beantragen
- [ ] Je Kunde: Berufsgenossenschaft, Mitgliedsnummer, Gefahrtarifstelle
- [ ] Je Kunde: Betriebsnummern aller beteiligten Krankenkassen

---

## Was ich parallel baue

Ohne dass du dafür etwas tun musst — Stand und Reihenfolge in `FEATURES.md`:

1. **Rückwirkende Aufrollung** — wenn im März nachträglich etwas anders ist,
   müssen die Folgemonate neu gerechnet und die Differenz ausgeglichen werden.
   Der größte Brocken, und er hat mit Zertifizierung nichts zu tun.
2. **Sonstige Bezüge** — Weihnachtsgeld, Urlaubsgeld, Bonus. Werden anders
   besteuert als laufender Lohn. Hat jeder Kunde.
3. **Minijob und Übergangsbereich** — heute wird nur gewarnt. In Kita und Reha
   sind Minijobber der Normalfall.
4. Geldwerte Vorteile, betriebliche Altersvorsorge, Pfändungen
5. Datenaufbereitung für die Meldungen, damit beim Zertifizierungsschritt nur
   noch die Übermittlung dazukommt

---

## Die eine Sache, die ich nicht abnehmen kann

Ich kann die Rechnung richtig machen und beweisen, dass sie stimmt. Ich kann
nicht dafür geradestehen. **Punkt 1 — die Gegenzeichnung durch einen
Steuerberater — ist keine Formalie.** Sie ist der Unterschied zwischen einem
Programm, das gut getestet ist, und einem, das jemand mit Berufshaftpflicht
angesehen hat.
