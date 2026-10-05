# OKUN Workforce zum Herunterladen

Ein Programm für Windows, macOS und Linux, das man installiert wie jedes
andere: Symbol im Startmenü, eigenes Fenster, kein Browsertab zwischen
zwanzig anderen.

> **Es ist eine Hülle, keine zweite Anwendung.** Alles, was OKUN Workforce
> kann, kann es weiterhin genau einmal — auf dem Server. Was hier gebaut wird,
> ist das Fenster darum.

---

## Warum eine Hülle und keine mitgelieferte Anwendung

Dieselbe Überlegung wie bei der Telefon-App (§139): Die Seiten entstehen auf
dem Server, dort liegen Lohn, Zeiten und Rechte. Ein Programm, das den Stand
vom Tag der Auslieferung mitbrächte, wäre am Tag darauf falsch — und jede
Korrektur an der Lohnabrechnung müsste den Weg über eine neue Installation bei
jedem Kunden nehmen. Bei einem Programm, das Gehälter rechnet, ist das
untragbar.

### Was es dann überhaupt bringt

Nicht „dieselbe Seite in einem Fenster ohne Adressleiste":

| | |
|---|---|
| **Es ist ein Programm** | Startmenü, Taskleiste, Dock — mit eigenem Symbol. Wer morgens den Rechner anmacht, klickt ein Programm an und sucht kein Lesezeichen. |
| **Es merkt sich das Fenster** | Größe und Lage über das Beenden hinaus. |
| **Es druckt sauber** | Ohne Kopf- und Fußzeile des Browsers. Ein Lohnbeleg mit „1/2 — workforce.beispiel.de/company/payroll?id=…" am Rand gehört nicht in eine Personalakte. |
| **Die Anlage ist einstellbar** | Eigene Domain, eigener Server, Testanlage. Einmal eintippen, bleibt gespeichert. |
| **Fremde Seiten bleiben draußen** | Ein Link nach außen geht in den Systembrowser. Eine fremde Seite im selben Fenster sähe aus wie ein Teil des Programms. |
| **Kein weißer Bildschirm** | Antwortet die Anlage nicht, steht im Klartext da, welche Adresse versucht wurde und woran es lag. |

### Was es bewusst nicht tut

Es hält **keine Daten auf dem Rechner**. Kein Zwischenspeicher mit Gehältern
in einem Ordner, den die nächste Datenrettung findet. Was die Anlage schickt,
lebt im Fenster und verschwindet mit ihm. Gespeichert werden genau zwei
Kleinigkeiten: die Adresse der Anlage und die Fenstergröße.

---

## Bauen

```bash
npm run desktop            # einmal starten, ohne zu paketieren
npm run desktop:pruefen    # die 17 Nachweise der Hülle
npm run desktop:linux      # AppImage + .deb
npm run desktop:win        # Installationsprogramm für Windows (.exe)
npm run desktop:mac        # .dmg — nur auf einem Mac
```

Die fertigen Dateien liegen in `desktop/pakete/` (nicht im Repo — über hundert
Megabyte je Stück).

### Die Adresse der Anlage mitgeben

```bash
OKUN_APP_URL=https://workforce.ihre-einrichtung.de npm run desktop:linux
```

Ohne Angabe zeigt das Programm auf die Anlage von OKUN. **Im Programm selbst
lässt sich die Adresse ändern** (Menü → Datei → Adresse der Anlage) — ein Kunde
mit eigenem Server muss dafür nichts neu bauen und niemanden anrufen.

Nur `https`. Die einzige Ausnahme ist `localhost` für die Entwicklung: Dort
gibt es kein Netz, über das mitgelesen werden könnte.

### Für das .deb-Paket

Debian verlangt einen Verantwortlichen mit E-Mail-Adresse. Er kommt aus
denselben Angaben wie das Impressum:

```bash
OKUN_FIRMA="…" OKUN_KONTAKT="…" npm run desktop:linux
```

---

## Was gebaut wird

| Ziel | Datei | Größe | Was der Benutzer tut |
|---|---|---|---|
| Windows | `.exe` (NSIS) | ~112 MB | Doppelklick, Weiter, fertig — **ohne Administratorrechte**. In Einrichtungen hat die Verwaltung die selten, und auf die IT zu warten heißt oft: es passiert nie. |
| Linux | `.AppImage` | ~126 MB | Herunterladen, ausführbar machen, starten. Keine Installation. |
| Linux | `.deb` | ~100 MB | Für verwaltete Arbeitsplätze. |
| macOS | `.dmg` | — | Ins Programme-Verzeichnis ziehen. **Nur auf einem Mac zu bauen.** |

Die hundert Megabyte sind die Chrome-Grundlage von Electron und nicht die
Anwendung: Im Paket selbst liegen sieben Dateien.

> **Warum `desktop/` ein eigenes npm-Paket ist.** Der Paketbauer packt immer
> alle Produktionsabhängigkeiten des Projekts ein, in dem er läuft — eine
> Liste in `files` ändert daran nichts. Der erste Versuch aus dem
> Hauptverzeichnis heraus ergab **280 MB**: Prisma mit seinem Rechenkern, der
> Anthropic-Zugang, der Mailversand. Nichts davon braucht ein Fenster, das
> eine Webseite lädt — und jedes Stück davon wäre auf jedem Kundenrechner zu
> pflegen und auf Sicherheitslücken zu prüfen. Deshalb hat
> `desktop/package.json` **keine Abhängigkeiten**, und gebaut wird mit
> `--project desktop`.

---

## Sicherheit

Die drei Zeilen, auf die es ankommt, stehen in `desktop/haupt.js`:

```js
nodeIntegration: false,   // die Seite bekommt kein Node
contextIsolation: true,   // sie lebt in ihrem eigenen Kontext
sandbox: true,            // und in einer Sandbox
```

Was die geladene Seite auf dem Rechner darf, steht vollständig in
`desktop/bruecke.js` und ist eine kurze Liste: die eigene Adresse erfragen,
sie ändern, drucken, die Fassung erfragen. **Wer diese Liste erweitert, öffnet
eine Tür und muss sie begründen.**

Dazu:

- **Fremde Adressen** werden weder im Fenster geöffnet noch in einem neuen
  Fenster — sie gehen in den Systembrowser.
- **Kein `http`** außer auf dem eigenen Rechner.
- **Kein Debug-Zugang**, keine `webview`-Elemente.
- **Kamera, Mikrofon, Ort** werden abgelehnt. Die Anlage braucht sie nicht;
  wer sie anfragt, ist nicht die Anlage.
- **Ein zweiter Start** holt das vorhandene Fenster nach vorn. Zwei Fenster
  mit demselben Lohnmonat sind ein Weg, versehentlich zweimal freizugeben.

### Keine Selbstaktualisierung — mit Absicht

Die Hülle enthält keine Anwendung. Korrekturen an Lohn, Dienstplan oder Recht
gehen über den Server und sind beim nächsten Öffnen da; niemand wartet auf ein
Programm-Update. Was sich hier ändern könnte, ist das Fenster selbst — selten.
Eine Selbstaktualisierung bräuchte dafür einen dauerhaft erreichbaren
Ausgabekanal und eine Signatur: zwei Angriffsflächen für einen Nutzen, den es
kaum gibt.

Wird das später anders gesehen: `publish: { provider: 'generic', url: … }` in
`desktop/electron-builder.js` plus `electron-updater`.

---

## Nachweise

```bash
npm run desktop:pruefen
```

17 Prüfungen an einem echten Fenster (`pruefungen/desktop/huelle.mjs`). Sie
prüfen nicht die Anwendung — das tun die 1401 Nachweise daneben —, sondern die
vier Entscheidungen, die nur in der Hülle stecken:

1. Die Hülle zeigt die eingestellte Anlage.
2. Sie geht nirgendwo anders hin.
3. Antwortet die Anlage nicht, steht das im Klartext da.
4. Die Seite bekommt kein Node, kein Dateisystem, sondern genau die kurze
   Liste aus `bruecke.js`.

Sie laufen nicht im Gesamtlauf: Sie brauchen Electron, Playwright und einen
Bildschirm (`xvfb`), und eine Prüfung, die aus Umgebungsgründen rot wird, wird
nach zwei Wochen ignoriert.

---

## Was noch fehlt

| | Was | Warum es noch nicht geht |
|---|---|---|
| 🔴 | **Die .exe signieren** | Der Bau ist vorbereitet (§187, siehe unten) — es fehlt das Zertifikat. Ein Kauf, keine Programmierarbeit. |
| 🔴 | **.dmg bauen und beglaubigen** | Braucht einen Mac und das Apple-Developer-Konto. Ohne Beglaubigung („notarization") warnt macOS beim ersten Start. Hängt an derselben D-U-N-S-Nummer wie der App Store — siehe `APP-STORES.md`. |
| 🟡 | **Eine Seite zum Herunterladen** | Die Dateien müssen irgendwo liegen. Gehört zur eigenen Domain und zur überarbeiteten Startseite. |
| 🟢 | Fassungsnummer gemeinsam führen | `desktop/package.json` hat eine eigene Version. Solange die Hülle sich kaum ändert, ist das in Ordnung; sobald sie öfter ausgeliefert wird, sollte ein Befehl beide setzen. |

🔴 dringend · 🟡 bald · 🟢 wenn ein Kunde kommt

---

## §187 Die Signatur für Windows — was zu kaufen ist und warum

Ohne Signatur zeigt Windows beim ersten Start „Unbekannter Herausgeber". Bei
einem Programm, das Gehälter anzeigt, installiert das niemand.

### Die eine Sache, die man vorher wissen muss

**Seit dem 1. Juni 2023 gibt es kein Zertifikat mehr als Datei mit Kennwort.**
Die Zertifizierungsstellen müssen den privaten Schlüssel auf zertifizierter
Hardware halten — entweder auf einem USB-Stick, den sie per Post schicken, oder
in einem Cloud-Tresor.

Das klingt nach einer Fußnote und entscheidet alles:

* **Mit USB-Stick** kann nur die Person signieren, die den Stick eingesteckt
  hat. Der Bau läuft hier auf einem Server — er könnte dann nicht signieren.
  Jede Auslieferung ginge über einen Windows-Rechner von Hand.
* **Mit Cloud-Tresor** signiert der Bau selbst. Das Zertifikat liegt beim
  Anbieter, der Bau ruft ihn über einen Befehl.

Wer den Stick nimmt, kauft sich eine Handarbeit bei jeder Auslieferung ein.

### Die drei Wege

| | Was | Kosten | Signiert der Bau selbst? |
|---|---|---|---|
| **A** | **Azure Artifact Signing** (früher Trusted Signing) | Basis-Stufe, 5.000 Signaturen/Monat — der Preis steht beim Anlegen im Portal | ja |
| **B** | **OV-Zertifikat im Cloud-Tresor** (Sectigo, DigiCert, SSL.com) | rund 220–450 €/Jahr, Tresor teils extra | ja |
| **C** | **OV- oder EV-Zertifikat auf USB-Stick** | dasselbe, EV eher 300–650 €/Jahr | nein |

**Empfehlung: A.** Es ist der einzige Weg, bei dem der Bau hier signieren kann,
ohne dass jemand Hardware verwaltet. Deutschland ist unter den zugelassenen
Ländern. Gebraucht werden ein Azure-Konto, ein Entra-Verzeichnis und eine
Identitätsprüfung der OKUN Systems UG — **die dauert 1 bis 20 Werktage**, also
früh anfangen.

**EV statt OV** lohnt nur aus einem Grund: Ein frisches OV-Zertifikat muss sich
bei Microsofts SmartScreen erst „einlaufen" — die ersten Wochen warnt Windows
weiter, bis genug Installationen gezählt sind. EV überspringt das. Wer in den
ersten Wochen viele Erstinstallationen erwartet, zahlt dafür gern; wer mit
wenigen Kunden anfängt, kann es aussitzen.

### Was für die Prüfung bereitliegen muss

Die Angaben müssen zum Handelsregister passen — und zum Impressum:

* **OKUN Systems UG (haftungsbeschränkt)**, genau so geschrieben
* Die Anschrift aus dem Handelsregister
* Eine **E-Mail auf einer Domain des Unternehmens**, die wirklich gelesen wird
  (Bestätigungslinks laufen nach sieben Tagen ab)
* Der Handelsregisterauszug; falls nachgefragt wird, darf er **nicht älter als
  zwölf Monate** sein
* Eine zweite E-Mail auf derselben Domain

Der Name im Zertifikat ist später der, den Windows im Installationsprogramm
anzeigt. Deshalb steht er seit §187 wortgleich in `desktop/package.json`.

### Wie signiert wird, wenn es da ist

Im Bau ist die Stelle vorbereitet. Der Befehl des Anbieters kommt über eine
Umgebungsvariable; `{datei}` wird durch den Pfad der zu signierenden Datei
ersetzt:

```bash
OKUN_SIGN_BEFEHL='azuresigntool sign -kvu … -fd sha256 -tr http://timestamp.acs.microsoft.com "{datei}"' \
  npm run desktop:win
```

**Ohne diese Variable wird unsigniert gebaut — und der Bau sagt es.** Für jede
unsignierte Datei erscheint eine Warnung mit ihrem Pfad. Zum Ausprobieren ist
das in Ordnung; still unsigniert auszuliefern wäre es nicht. Nachgemessen am
Bau vom 05.10.2026: vier Dateien, vier Warnungen — das Programm selbst,
`elevate.exe`, das Deinstallationsprogramm und das Installationsprogramm.

**Scheitert der Befehl, scheitert der Bau.** Auch das ist nachgewiesen: Mit
einem Befehl, der Fehlercode 7 zurückgibt, bricht `npm run desktop:win` ab und
hinterlässt keine `.exe`. Eine Signatur, die klemmt, darf nicht in einem
scheinbar erfolgreichen Bau untergehen.

Zeitstempel nicht vergessen (`-tr`): Ohne ihn werden alle ausgelieferten
Dateien ungültig, sobald das Zertifikat abläuft. Mit ihm bleiben sie gültig.

### Zwei Dinge, die beim Einhängen hochkamen

**Der Haken ist umgezogen.** Bis electron-builder 24 lag er unter `win.sign`,
seit 25 unter `win.signtoolOptions.sign`. Der alte Platz wird nicht ignoriert,
sondern bricht den Bau mit `configuration.win should be one of these: null`
ab — eine Meldung, die nichts verrät. `npm run desktop:pruefen` prüft die
Bauanleitung jetzt gegen das Schema des **installierten** Paketbauers; zieht
die nächste Fassung wieder einen Schlüssel um, wird das in zwei Sekunden rot
statt nach einem vollständigen Bau.

**Der Verantwortliche im `.deb` war erfunden.** In der Bauanleitung stand
`OKUN_FIRMA || 'OKUN'` und `OKUN_KONTAKT || 'kontakt@okun.de'`. Diese Variablen
stehen nur in der Umgebung des Servers, nicht in der eines Baus — also griff
praktisch immer der Rückfallwert, und jedes gebaute `.deb` trug einen Absender
auf einer Domain, die es nicht gibt. Jetzt ist `desktop/package.json` die eine
Quelle für beides; fehlt die Angabe dort, bricht der Bau ab, statt etwas
einzusetzen. Die Umgebungsvariablen überschreiben weiterhin — für einen Bau im
Auftrag eines anderen Hauses.
