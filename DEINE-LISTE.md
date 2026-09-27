# Deine Liste

Alles, was **nicht programmiert werden kann** — weil es ein Konto, eine
Unterschrift, einen Kauf oder eine Zahl aus einer Satzung braucht. Nach
Reihenfolge, nicht nach Bereich: Was oben steht, blockiert das meiste darunter.

> Stand: 27.09.2026 · Was fertig ist, steht in `STAND.md`.
> Zum Abhaken: `- [ ]` zu `- [x]` machen.

---

## Reihenfolge auf einen Blick

```
1. D-U-N-S-Nummer  ─────────►  Apple-Konto  ─►  APNs-Schlüssel  ─►  App Store
                                             └─►  .dmg beglaubigen
2. Eigene Domain   ─────────►  Impressum/Datenschutz öffentlich  ─►  beide Stores
3. Firebase        ─────────►  Push auf Android (und mit Apple auch iOS)
4. Steuerberater   ─────────►  erster echter Kunde
5. Code-Signing    ─────────►  Windows-Programm ohne Warnung
```

**Erledigt am 27.09.:** Die Umlagesätze U1/U2 standen hier als deine Aufgabe.
Das war falsch einsortiert — sie gehören dem Kunden, nicht dir (siehe unten
unter *Wenn ein Kunde kommt*). Deine Recherche ist eingelesen, 24 Kassen
stehen im System.

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

### 🔴 Eigene Domain einrichten
Statt `…up.railway.app`. Nötig für Impressum, App-Links und dafür, dass das
Produkt nicht nach Testaufbau aussieht.

**Blockiert:** Impressum und Datenschutzerklärung öffentlich, beide Stores,
die Seite zum Herunterladen des Windows-Programms.

**Wenn sie steht, sag mir Bescheid** — dann trage ich sie in
`capacitor.config.ts` und in die Vorgabe des Desktop-Programms ein.

### 🔴 Code-Signing-Zertifikat für Windows kaufen
Ohne Signatur zeigt Windows beim ersten Start „Unbekannter Herausgeber". Bei
einem Programm, das Gehälter anzeigt, installiert das niemand.

Ein OV-Zertifikat kostet ~200–400 €/Jahr; ein EV-Zertifikat (~400–700 €/Jahr)
umgeht zusätzlich die SmartScreen-Aufwärmphase. Anbieter: DigiCert, Sectigo,
GlobalSign.

**Blockiert:** die Auslieferung des Windows-Programms an Kunden. Details:
`DESKTOP.md`.

---

## 2 · Konten und Schlüssel

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

### 🟡 `OKUN_*`-Angaben bei Railway setzen
Ohne sie steht im Impressum, was fehlt. Es sind:

`OKUN_FIRMA` · `OKUN_ANSCHRIFT` · `OKUN_VERTRETEN` · `OKUN_REGISTER` ·
`OKUN_USTID` · `OKUN_KONTAKT` · `OKUN_DSB` · `OKUN_SUPPORT_EMAIL` ·
`OKUN_ABSENDER` · `OKUN_NAME` · `OKUN_ART`

Dieselben Angaben braucht auch das `.deb`-Paket des Desktop-Programms
(`OKUN_FIRMA`, `OKUN_KONTAKT`) — Debian verlangt einen Verantwortlichen mit
E-Mail-Adresse.

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

## 4 · Ausliefern

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

## 5 · Wenn ein Kunde kommt

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

## 6 · Später, bewusst nach hinten

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
- **20 von 24 Kassen sind noch ungeprüft.** Geprüft heißt: jemand hat die Zahl
  gegen die Veröffentlichung der Kasse gehalten. In der Maske steht bei diesen
  „übernommen, ungeprüft". Bei den Pfändungstabellen waren zwei von acht
  falsch — das Feld gibt es deshalb.

---

## Was ich als Nächstes mache

Damit du weißt, was du **nicht** übernehmen musst:

1. Die Startseite vor der Anmeldung überarbeiten
2. Domain eintragen, sobald sie steht
3. `google-services.json` einbauen, sobald Firebase da ist
4. Die Seite zum Herunterladen bauen, sobald die Domain steht

---

## Schon erledigt

- [x] Insolvenzgeldumlage 2026, Pfändungsfreigrenzen, Mindestlohn
      nachgeschlagen (26.09.) — **zwei Pfändungstabellen waren falsch** und
      sind korrigiert
