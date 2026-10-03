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
| 🔴 | **Die .exe signieren** | Ohne Signatur zeigt Windows SmartScreen beim ersten Start „Unbekannter Herausgeber". Braucht ein Code-Signing-Zertifikat auf OKUN — ein Kauf, keine Programmierarbeit. |
| 🔴 | **.dmg bauen und beglaubigen** | Braucht einen Mac und das Apple-Developer-Konto. Ohne Beglaubigung („notarization") warnt macOS beim ersten Start. Hängt an derselben D-U-N-S-Nummer wie der App Store — siehe `APP-STORES.md`. |
| 🟡 | **Eine Seite zum Herunterladen** | Die Dateien müssen irgendwo liegen. Gehört zur eigenen Domain und zur überarbeiteten Startseite. |
| 🟢 | Fassungsnummer gemeinsam führen | `desktop/package.json` hat eine eigene Version. Solange die Hülle sich kaum ändert, ist das in Ordnung; sobald sie öfter ausgeliefert wird, sollte ein Befehl beide setzen. |

🔴 dringend · 🟡 bald · 🟢 wenn ein Kunde kommt
