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

| | Was | Kosten (nachgesehen 05.10.2026) | Signiert der Bau selbst? |
|---|---|---|---|
| **A** | **Azure Artifact Signing** (früher Trusted Signing) | **9,99 $/Monat**, 5.000 Signaturen, 1 Zertifikatsprofil. Kein Zertifikatskauf. | ja |
| **B** | **Standard Code Signing in der Cloud, Certum** (EU, Polen) | **ab 209 €** für die Laufzeit, Cloud-Signatur „SimplySign" kostenlos dabei | ja |
| **C** | **OV + eSigner, SSL.com** | 129 $/Jahr Zertifikat **plus** 180 $/Jahr Cloud-Signatur = 309 $ | ja |
| **D** | **Zertifikat auf USB-Stick**, beliebige Stelle | wie B/C, aber per Post | **nein** |

**Empfehlung: A.** Am billigsten, kein Zertifikatskauf, keine Hardware, und der
Bau signiert selbst. Deutschland ist als EU-Land zugelassen (Organisationen in
EU, UK, USA, Kanada, Australien, Neuseeland, Japan, Südkorea, Singapur,
Schweiz, Norwegen, Israel).

**Region: North Europe** (Irland). West Europe wäre naheliegender, nimmt aber
keine neuen Kunden mehr auf — der Versuch endet mit
`RequestDisallowedByAzure: The selected region is currently not accepting new
customers`. North Europe liegt weiterhin in der EU. Weitere Ausweichregionen,
falls auch die einmal dichtmacht: Poland Central (EU), Switzerland North.

> **Die 3-Jahres-Hürde gilt nicht mehr.** In der Vorschauphase 2025 verlangte
> Azure drei Jahre nachweisbare Firmengeschichte — für eine junge UG ein
> Ausschluss. Das steht noch in vielen Texten und auch in automatisch
> erzeugten Antworten im Microsoft-Forum. Ein Microsoft-Moderator hat am
> 17.08.2026 ausdrücklich klargestellt: „country/region onboarding pre-reqs,
> **no minimum org age restrictions**". Die offizielle Voraussetzungsliste
> nennt nur Land und Region.

**EV statt OV lohnt für SmartScreen nicht mehr.** Hier stand vorher, EV
überspringe die Aufwärmphase. Das war bis 2024 richtig und ist es nicht mehr:
Microsoft hat den Sofort-Vertrauensvorschuss für EV abgeschafft. Seitdem
sammeln EV und OV ihren Ruf gleich — über Installationszahlen, nicht über die
Zertifikatsklasse. Auch EV-signierte Programme zeigen am Anfang die Warnung.
**Das heißt für uns: Es gibt keinen Grund, für EV das Dreifache zu zahlen.**

Was wirklich hilft, ist Stetigkeit: **immer mit derselben Signaturidentität
signieren.** Jeder Wechsel des Zertifikats oder des Herausgebernamens setzt den
gesammelten Ruf zurück. Deshalb steht der Name an einer Stelle
(`desktop/package.json`) und nicht an vier.

### Was für die Prüfung bereitliegen muss

Die Angaben müssen zum Handelsregister passen — und zum Impressum:

* **OKUN Systems UG (haftungsbeschränkt)**, genau so geschrieben
* Die Anschrift aus dem Handelsregister
* Die Registernummer als „Business Identifier": **HRB 292175 B**
* Die Website des Unternehmens: `https://okun-workforce.com`
* **Zwei E-Mail-Adressen auf einer Domain des Unternehmens**, verschieden,
  beide gelesen, beide für Nachrichten von außen mit Links erreichbar
  (Bestätigungslinks laufen nach sieben Tagen ab). Die zweite darf eine
  Verteilerliste sein, muss aber auf derselben Domain liegen.
* Der Handelsregisterauszug; falls nachgefragt wird, muss er **in den letzten
  zwölf Monaten ausgestellt** worden sein und noch mindestens zwei Monate
  gelten. Für Nachreichungen gibt es **drei Versuche**.

**Und eine Person weist sich persönlich aus.** Das überrascht die meisten: Zur
Organisationsprüfung gehört eine Identitätsprüfung des Vertreters — Vor- und
Nachname genau wie im Ausweis, dann ein Lichtbildausweis (Pass,
Personalausweis oder Führerschein) über ein Mobiltelefon, per
Microsoft-Authenticator-App. Also: **Felix Okun braucht seinen Ausweis und ein
Handy**, und der Name muss im Antrag genau so stehen wie im Ausweis.

Der Name im Zertifikat ist später der, den Windows im Installationsprogramm
anzeigt. Deshalb steht er seit §187 wortgleich in `desktop/package.json`. Und
weil jede Änderung eine **neue** Identitätsprüfung erfordert — nachträglich
korrigieren geht nicht —, lohnt es sich, die Felder vor dem Absenden mit der
Vorschau („Certificate subject preview") zu vergleichen.

### Wie signiert wird, wenn es da ist

**Bei Azure (Weg A) braucht es keinen Befehl.** electron-builder 26 redet
selbst mit Azure Artifact Signing. Drei Angaben aus dem Portal, dazu die
Anmeldedaten, die Azure selbst liest:

```bash
OKUN_AZURE_ENDPUNKT=https://neu.codesigning.azure.net \
OKUN_AZURE_KONTO=<Name des Artifact-Signing-Kontos> \
OKUN_AZURE_PROFIL=<Name des Zertifikatsprofils> \
AZURE_TENANT_ID=… AZURE_CLIENT_ID=… AZURE_CLIENT_SECRET=… \
  npm run desktop:win
```

Der Endpunkt muss zur Region des Kontos passen: `neu` für North Europe, `weu`
für West Europe, `plc` für Poland Central, `swn` für Switzerland North. Der **Herausgebername kommt nicht aus der Umgebung**, sondern
aus `desktop/package.json`: Es gibt ihn an einer Stelle, damit er nicht an
zweien auseinanderlaufen kann.

Stehen nur zwei der drei Variablen, **bricht der Bau ab**. Sonst liefe er still
über den anderen Weg oder unsigniert weiter, und niemand sähe, dass Azure
gemeint war.

**Bei jedem anderen Weg (B, C, D)** kommt der Befehl des Anbieters über eine
Umgebungsvariable; `{datei}` wird durch den Pfad der zu signierenden Datei
ersetzt:

```bash
OKUN_SIGN_BEFEHL='signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 "{datei}"' \
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
