# Deine Liste

Alles, was **nicht programmiert werden kann** — weil es ein Konto, eine
Unterschrift, einen Kauf oder eine Zahl aus einer Satzung braucht. Nach
Reihenfolge, nicht nach Bereich: Was oben steht, blockiert das meiste darunter.

> Stand: 05.10.2026 · Was fertig ist, steht in `STAND.md`.
> Zum Abhaken: `- [ ]` zu `- [x]` machen.

---

## Reihenfolge auf einen Blick

```
1. D-U-N-S-Nummer  ─────────►  Apple-Konto  ─►  APNs-Schlüssel  ─►  App Store
                                             └─►  .dmg beglaubigen
2. Domain verbinden ────────►  ┐
3. Firmenangaben   ─────────►  ┴─► Impressum/Datenschutz öffentlich ─► Stores
4. Website steht ──────────►  gemeinsam schärfen ─► Download-Seite
5. Firebase        ─────────►  Push auf Android (und mit Apple auch iOS)
6. Steuerberater   ─────────►  erster echter Kunde
7. Code-Signing    ─────────►  Windows-Programm ohne Warnung
```

**Erledigt am 27.09.:** Die Umlagesätze U1/U2 standen hier als deine Aufgabe.
Das war falsch einsortiert — sie gehören dem Kunden, nicht dir (siehe unten
unter *Wenn ein Kunde kommt*). Deine Recherche ist eingelesen, 24 Kassen
stehen im System.

**Erledigt am 29.09.:** Die Website steht, und die Wortmarke ist überall die
echte — auch auf dunklem Grund und im Kopf jeder E-Mail.

**Erledigt am 03.10.:** Die drei Bildschirmfotos stehen auf der Startseite —
Dienstplan, Stempeluhr, Lohnabrechnung, derselbe Mensch im selben Monat. Und
das Regelpaket für den neuen Kunden (Wohngruppe) ist gebaut, der Kunde
angelegt, die zehn Mitarbeiterprofile erstellt.

**Erledigt am 05.10.:** Der echte Schriftzug ist überall drin. In den
Markendateien lag vorher ein anderer — mein Fehler, zweimal gegen die falsche
Vorlage gemessen.

Punkt 1 und 2 dauern Wochen und hängen an Dritten. **Damit anfangen**, alles
andere läuft daneben.

---

## 1 · Was Wochen dauert — heute anstoßen

### 🔴 D-U-N-S-Nummer beantragen
Kostenlos, dauert 1–2 Wochen. Ohne sie gibt es kein Apple Developer Program
als Organisation.

**Blockiert:** Apple-Konto → APNs-Schlüssel → Push auf dem iPhone → App Store
→ auch das beglaubigte `.dmg` für macOS.

→ https://developer.apple.com/support/D-U-N-S/

### 🔴 Domain verbinden — `okun-workforce.com`
Gekauft bei Squarespace (28.09.). **Im Code ist sie schon überall
eingetragen**, sie muss nur noch mit Railway verbunden werden.

**Schritt für Schritt: `DOMAIN.md`.** Kurzfassung:

1. Bei **Railway** die Domain anmelden (Service der App → Settings →
   Networking → Custom Domain), für `okun-workforce.com` **und**
   `www.okun-workforce.com`. Railway nennt dir dann die Werte.
2. Bei **Squarespace** die alten A-Einträge auf `@` löschen — sie zeigen noch
   auf Squarespace-Hosting und blockieren den neuen Eintrag.
3. Neu setzen: **ALIAS** auf `@`, **CNAME** auf `www`, dazu den TXT von
   Railway. Ohne den TXT gibt es einen 404.
4. `APP_URL=https://okun-workforce.com` bei Railway als Variable — sonst
   zeigen alle Links in verschickten E-Mails weiter auf die alte Adresse.

> **Die nackte Domain geht**, ohne `app.` davor. Squarespace kann ALIAS auf
> `@`, Railway akzeptiert ALIAS. Ich hatte zuerst das Gegenteil behauptet —
> falsch, und auf Nachfrage korrigiert.

**Blockiert:** Impressum und Datenschutzerklärung öffentlich, beide Stores,
die Seite zum Herunterladen des Windows-Programms.

### 🔴 Code-Signing-Zertifikat für Windows kaufen
Ohne Signatur zeigt Windows beim ersten Start „Unbekannter Herausgeber". Bei
einem Programm, das Gehälter anzeigt, installiert das niemand.

Ein OV-Zertifikat kostet ~200–400 €/Jahr; ein EV-Zertifikat (~400–700 €/Jahr)
umgeht zusätzlich die SmartScreen-Aufwärmphase. Anbieter: DigiCert, Sectigo,
GlobalSign.

**Blockiert:** die Auslieferung des Windows-Programms an Kunden. Details:
`DESKTOP.md`.

---

## 2 · Konten, Schlüssel und Firmenangaben

### 🔴 Firebase-Projekt anlegen und `FCM_SERVICE_ACCOUNT` setzen
Kostenlos, ~20 Minuten. **Ohne diesen Schlüssel verschickt das System keine
einzige Benachrichtigung** — es schreibt nur ins Protokoll, dass es wollte.

1. https://console.firebase.google.com → Projekt „OKUN Workforce"
2. Projekteinstellungen → Dienstkonten → **Neuen privaten Schlüssel erzeugen**
3. Die heruntergeladene JSON-Datei **als eine Zeile** bei Railway als
   `FCM_SERVICE_ACCOUNT` hinterlegen
4. Für Android: `google-services.json` herunterladen (ich baue sie ein)
5. Für iOS: den APNs-Schlüssel (.p8) aus dem Apple-Konto in Firebase
   hochladen — **wartet auf Punkt 1**

Schritt für Schritt: `APP-STORES.md`, Teil B.

### 🟡 Apple Developer Program — 99 $/Jahr
Wartet auf die D-U-N-S-Nummer.

### 🟡 Google-Play-Entwicklerkonto — 25 $ einmalig
Geht sofort, unabhängig von allem anderen.

### 🔴 Firmenangaben für Impressum und Datenschutzerklärung
**Es gibt eine Vorlage zum Ausfüllen: `impressum-angaben.md`.** Ausfüllen und
mir schicken, oder direkt bei Railway unter *Variables* eintragen.

Vier davon sind Pflicht nach §5 DDG und ohne sie ist das Impressum
unvollständig:

| | |
|---|---|
| `OKUN_FIRMA` | vollständiger Firmenname **mit Rechtsform**, wie im Register |
| `OKUN_ANSCHRIFT` | ladungsfähige Anschrift — **kein Postfach** |
| `OKUN_VERTRETEN` | vertretungsberechtigte Person, Vor- und Nachname |
| `OKUN_KONTAKT` | E-Mail, die wirklich gelesen wird |

Dazu, sobald vorhanden: `OKUN_REGISTER` (Gericht **und** Nummer), `OKUN_USTID`
(die USt-IdNr., nicht die Steuernummer vom Finanzamt). Und für den
Datenschutz: `OKUN_DSB` (nur ab 20 Personen Pflicht, §38 BDSG),
`OKUN_SUPPORT_EMAIL`.

**Acht Variablen, nicht elf.** In der ersten Fassung dieser Liste standen
`OKUN_ABSENDER`, `OKUN_NAME` und `OKUN_ART` mit dabei — das war mein Fehler:
Die sind Konstanten im Code, sie zu setzen hätte nichts bewirkt.

`OKUN_FIRMA` und `OKUN_KONTAKT` braucht außerdem das `.deb`-Paket des
Desktop-Programms — Debian verlangt einen Verantwortlichen mit E-Mail.

**Solange sie fehlen, steht im Impressum, dass sie fehlen** — mit Paragraph.
Das ist Absicht: Ein Impressum, das eine Pflichtangabe stillschweigend
auslässt, ist abmahnbar.

**Blockiert:** beide App Stores (die verlangen eine erreichbare URL),
und rechtlich jeden echten Kunden.

---

## 3 · Zahlen und Unterschriften

### 🔴 Steuerberater die Rechnung gegenzeichnen lassen
Eine echte Abrechnung eines echten Monats, Zeile für Zeile. Solange das nicht
jemand mit Berufshaftpflicht bestätigt hat, ist jede Zahl hier nur *von uns*
gerechnet.

**Blockiert:** den ersten echten Kunden. Details: `ABLAUFPLAN.md`, Punkt 1.

### 🔴 Eine echte ELStAM-Änderungsliste besorgen
Der Import ist gebaut, aber nur an nachgebauten Dateien geprüft. Eine echte
Liste zeigt, ob das Format stimmt.

### 🟡 Aufbewahrungsfristen gegenzeichnen lassen
Vier Fristen stehen mit Vorschrift in `src/lib/dsgvo-katalog.ts`, sind aber
ungeprüft. Steuerberater **oder** Datenschutzbeauftragter.

### 🟡 Vermögensschadenhaftpflicht klären
Wer Gehälter rechnet, haftet. Vor dem ersten echten Kunden klären.

### 🟡 AVVs mit den Dienstleistern
Auftragsverarbeitungsverträge mit Anthropic (Claude), Railway (Hosting) und
Google (Push/FCM). Ohne sie kein DSGVO-konformer Betrieb beim Kunden.

### 🟡 Datenschutzerklärung und Impressum öffentlich erreichbar
Beide Stores verlangen eine URL. Die Texte sind gebaut — sie brauchen die
Domain aus Punkt 1 und die `OKUN_*`-Angaben.

---

## 4 · Die Website

**Sie steht.** `okun-workforce.com` zeigt jetzt Startseite, „Alles, was
Personal ausmacht" mit allen 95 Funktionen, Kontakt mit Formular, Impressum
und Datenschutz — und oben rechts auf jeder Seite den Knopf „Anmelden". Die
Texte sind deine und liegen in `src/lib/website-inhalt.ts`; wer sie ändern
will, ändert diese eine Datei, keinen Code.

Entschieden ist damit auch: keine Selbstregistrierung, keine Preise auf der
Seite, Kontakt über Formular und E-Mail. Was noch offen ist:

### 🟡 Das Logo als SVG — ist unterwegs
- [ ] **Die freigestellte SVG schicken, wenn sie da ist.** Der fertige Prompt
      für den Gestalter (oder ChatGPT) steht im Verlauf. Die jetzige Fassung
      ist aus deinem Bild gerechnet und funktioniert — sie ist nur gerechnet
      statt gezeichnet. Mit Vektoren wird die Fassung für dunklen Grund exakt
      statt berechnet, und das Logo lässt sich groß drucken.
- [ ] **Dabei fragen: Wie heißt die Schrift?** Der Schriftzug ist
      höchstwahrscheinlich gezeichnet, nicht gesetzt: Unter rund sechzig freien
      Schriften ist der beste Treffer Montserrat Bold mit 84,8 % — ein echter
      Treffer liegt bei 94 bis 98 %. Die Überschriften der Website stehen
      deshalb in Montserrat, und im Code steht ausdrücklich, dass das die
      nächstgelegene freie Schrift ist und nicht die des Logos. Falls es doch
      eine gekaufte Schrift ist: **Ist eine Weblizenz dabei?** Ohne die darf
      sie nicht auf die Website.

### 🟡 Die Website gemeinsam fertig machen
- [ ] **Einmal zusammen durchgehen, bis sie endgültig gut ist.** Sie steht und
      sie stimmt — aber „steht" ist nicht dasselbe wie „gut". Was ich dafür von
      dir brauche, ist kein Auftrag, sondern eine Stunde gemeinsames Draufsehen:
      Reihenfolge der Abschnitte, Schärfe der Überschriften, was zuerst ins Auge
      springt, was fehlt. Das ist nichts, was ich allein entscheiden sollte —
      es ist die Seite, mit der dein Haus sich vorstellt.

### 🟡 Noch offen auf der Website
- [ ] **Darf ein Kunde namentlich genannt werden?** Eine Referenz wirkt mehr
      als jeder Satz über uns. Nur mit seiner Zustimmung.
- [ ] **Die Download-Seite für das Windows-Programm** fehlt noch. Sie kommt,
      sobald die .exe signiert ist (Punkt 1) — eine unsignierte Datei zum
      Herunterladen anzubieten, schreckt mehr Leute ab, als sie überzeugt.

---

## 4b · Der neue Kunde: Wohngruppe

Das Regelpaket ist gebaut und gerechnet (Score 98, Freigabe erteilt). Kunde,
Standort, die 18 Dienstzeiten und die zehn Mitarbeiterprofile sind angelegt.
Drei Dinge kann nur der Betrieb selbst:

### 🔴 E-Mail-Adressen der zehn Beschäftigten eintragen
Beim Einrichten gibt es sie noch nicht; bis dahin steht eine Platzhalter-
adresse da, an die nichts zugestellt werden kann. **Solange sie fehlt, kann
niemand eingeladen werden** — das Programm lehnt die Einladung mit einem Satz
ab, der sagt, was zu tun ist.

### 🟡 Zwei Angaben bestätigen, die ich geschätzt habe
- **Tage pro Woche** je Person: aus dem Pensum geschätzt (Pensum ÷ 8 Stunden).
  Das ist die einzige Zahl in den Stammdaten, die nicht im Regelwerk steht.
- **Die festen Einsätze der 25-%-Kraft** (Mo 07:45–19:15, Do 07:15–08:30). Ich
  habe nur ihre Verfügbarkeit hinterlegt — „nur Mo und Do" —, nicht die festen
  Zeiten. Der Plan gibt ihr derzeit andere Dienste an diesen Tagen.

### 🟡 Die Fixtermine der Leitung eintragen
Teamsitzung, WWS-Sitzung, Gesamtsitzung. Das Regelwerk nennt sie selbst als
ERSTEN Schritt der Planung, noch vor dem Rechnen — sie gehören als Termin in
den Plan, nicht als Regel ins Paket, und sie ändern sich monatlich.

---

## 5 · Ausliefern

### 🟡 Das `.dmg` auf einem Mac bauen und beglaubigen
Das Windows-Programm und die Linux-Pakete baue ich hier. **macOS braucht
einen Mac** und die Beglaubigung („notarization") über das Apple-Konto —
hängt an derselben D-U-N-S-Nummer.

```bash
npm run desktop:mac
```

### 🟡 Prüfer-Zugang mit gefüllten Testdaten anlegen
Apple prüft ihn wirklich und lehnt sonst ab, ohne die App gesehen zu haben.
Was hineingehört: `APP-STORES.md`, Teil D.

### 🟡 Einreichen in App Store und Play Store
Erst wenn alles darüber steht. Der ganze Ablauf: `APP-STORES.md`.

### 🟡 Eine Seite zum Herunterladen
Die `.exe`, das `.AppImage` und das `.deb` müssen irgendwo liegen. Gehört zur
Domain und zur überarbeiteten Startseite.

---

## 6 · Wenn ein Kunde kommt

> **Das hier machst nicht du, sondern der Kunde** — in seinem eigenen Zugang.
> Es steht trotzdem auf dieser Liste, weil du beim Einrichten dabei bist und
> es sonst niemand sagt.

### 🟢 Unternehmensdaten je Kunde vollständig eintragen
Betriebsnummer, Steuernummer, IBAN, Berufsgenossenschaft. Ohne sie kein SEPA
und kein DATEV-Export.

### 🟢 Erstattungsstufe je Krankenkasse wählen (§175)
Die **Sätze** stehen im System: 24 Kassen, 79 Stände, mit Quelle und
Stichtag. Niemand muss mehr Zahlen aus Satzungen abtippen.

Was der Kunde tut: für jede Krankenkasse **seiner** Beschäftigten die
Erstattungsstufe auswählen, die **sein** Betrieb mit dieser Kasse vereinbart
hat — 50 %, 70 %, 80 %. Ein Auswahlfeld unter *Lohnverwaltung → Umlagesätze*.
Dort steht auch von selbst, für welche seiner Kassen noch nichts hinterlegt
ist.

Höhere Stufe heißt höhere Umlage, aber mehr Erstattung bei langen
Krankheitsfällen. Steht die Vereinbarung noch nicht fest, ist das eine
Sache zwischen dem Kunden und seiner Kasse, keine Eingabe.

Fehlt eine seiner Kassen im Katalog, kann er ihre Sätze selbst eintragen —
oder er sagt dir den Namen, und ich hole sie nach (siehe unten).

### 🟢 Je Mitarbeiter: die Angaben, die man nicht raten kann
Steuer-ID, Sozialversicherungsnummer, Krankenkasse, Steuerklasse.
`ABLAUFPLAN.md`, Punkt 4.

### 🟢 Im Kundenvertrag festhalten
Wer die ELStAM holt, wer meldet, wer haftet. `ABLAUFPLAN.md`, Punkt 5.

---

## 7 · Später, bewusst nach hinten

### 🟢 Die drei Anfragen verschicken (ITSG, ELSTER, Steuerberater)
Für die Entscheidung, ob wir das Meldewesen selbst machen.
`LOHN-ZERTIFIZIERUNG.md`.

### 🟢 Lizenzierung für Steuer und Lohn anschreiben
Erst wenn alles Übrige steht.

### 🟢 Den Umlagekatalog aktuell halten — jedes Jahr, und wenn eine Kasse fehlt
**Das ist eure Aufgabe, nicht die des Kunden.** Die Sätze gelten pro Jahr;
manche Kassen ändern sie mitten im Jahr (2026 gleich drei).

- **Jährlich, im Dezember/Januar:** neue Sätze holen, mit
  `recherche-auftrag-umlagen.md`, und mit `npm run umlagen:import` einlesen.
  Alte Stände bleiben stehen — Nachrechnungen für das Vorjahr brauchen sie.
- **Wenn ein Kunde eine Kasse meldet, die fehlt:** dieselbe Recherche, nur
  für diese eine Kasse.
- **Alle 24 Kassen sind geprüft** (Stand 27.09.2026): jede Zahl gegen die
  Veröffentlichung der Kasse selbst gehalten, keine Abweichung. Bei einer neu
  hinzukommenden Kasse steht in der Maske so lange „übernommen, ungeprüft",
  bis jemand ihre Satzung wirklich aufgeschlagen hat. Bei den
  Pfändungstabellen waren zwei von acht falsch — das Feld gibt es deshalb.

---

## Was ich als Nächstes mache

Damit du weißt, was du **nicht** übernehmen musst:

1. **Die SVG einbauen**, sobald sie da ist — der Weg steht
   (`logo:aufbauen` → `logo:negativ`), das ist eine Sache von Minuten
2. **Die Website mit dir durchgehen** und umsetzen, was dabei herauskommt
3. Die Firmenangaben eintragen, sobald du `impressum-angaben.md` ausgefüllt
   hast — falls du sie nicht selbst bei Railway setzen willst
4. `google-services.json` einbauen, sobald Firebase da ist
5. Die Seite zum Herunterladen bauen, sobald die .exe signiert ist

---

## Schon erledigt

- [x] Insolvenzgeldumlage 2026, Pfändungsfreigrenzen, Mindestlohn
      nachgeschlagen (26.09.) — **zwei Pfändungstabellen waren falsch** und
      sind korrigiert
