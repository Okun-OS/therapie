# Die App in die Stores

Diese Datei ist der Ablaufplan von hier bis zur veröffentlichten App. Sie sagt,
was fertig ist, was OKUN besorgen muss und was am Mac zu tun ist. Wer sie von
oben nach unten abarbeitet, kommt durch.

Stand: **12.09.2026** — Etappe 3 (native Hülle) ist gebaut.

---

## Was die Hülle ist und was nicht

Die App lädt die laufende Anwendung, sie bringt sie nicht mit. Das ist eine
bewusste Entscheidung und der Grund steht in `capacitor.config.ts`: OKUN
Workforce rechnet Gehälter. Eine App, die den Stand vom Tag der Einreichung
mitbrächte, wäre am Tag darauf falsch — und jede Korrektur müsste durch eine
Store-Prüfung, die zwei Tage bis zwei Wochen dauert.

**Die Hülle steuert das bei, was ein Browser nicht kann:**

| | Wo im Programm |
|---|---|
| Echte Push-Nachrichten (APNs/FCM), auch bei geschlossener App | `src/lib/push-geraet.ts`, `/api/push/geraet` |
| Kamera für den Krankenschein, verkleinert statt fünf Megabyte | `src/lib/nativ.ts` → `kameraFoto()` |
| Face ID / Fingerabdruck als Sperre vor Lohn- und Dienstdaten | `src/components/app/Geraetesperre.tsx` |
| Warteschlange fürs Funkloch (§138) | `src/lib/warteschlange.ts` |
| Löschantrag in der App (Apple 5.1.1 v) | `/employee/daten` |
| Eigene Fehlerseite statt weißem Bildschirm ohne Netz | `native/web/fehler.html` |

**Warum das wichtig ist:** Apple lehnt reine Lesezeichen ab (Richtlinie 4.2,
„Minimum Functionality"). Die sechs Punkte oben sind die Antwort darauf. Sie
gehören auch in die Notiz an die Prüfung (siehe unten) — ein Prüfer, der sie
nicht findet, lehnt ab, obwohl sie da sind.

---

## Teil A — Was OKUN besorgen muss

Ohne diese Dinge geht es nicht weiter. Alles andere ist gebaut.

| | Wofür | Stand |
|---|---|---|
| **D-U-N-S-Nummer** | Apple Developer Program als Organisation | in Arbeit |
| **Apple Developer Program**, 99 $/Jahr | App Store | wartet auf D-U-N-S |
| **Google Play Developer**, 25 $ einmalig | Play Store | offen |
| **Firebase-Projekt** (kostenlos) | Push für iOS **und** Android | offen |
| **APNs-Schlüssel** (.p8) aus dem Apple-Konto | Push auf dem iPhone | wartet auf Apple |
| **Datenschutzerklärung**, öffentlich erreichbar | beide Stores verlangen eine URL | offen |
| **Impressum**, öffentlich erreichbar | Pflicht in Deutschland | offen |
| **Eigene Domain** statt `…up.railway.app` | Vertrauen, und nötig für App-Links | offen |
| **Prüfer-Zugang** mit gefüllten Testdaten | Apple prüft sonst gar nicht erst | anzulegen |

> **Zur Domain:** Sie steht an drei Stellen und muss überall dieselbe sein —
> `capacitor.config.ts` (bzw. `OKUN_APP_URL`), `ios/App/App/Info.plist` unter
> `WKAppBoundDomains`, und `APP_URL` in der Umgebung von Railway. Weicht eine
> ab, lädt die App nichts oder der Offline-Zwischenspeicher bleibt tot.

---

## Teil B — Firebase einrichten (einmalig, ~20 Minuten)

Firebase ist der Weg zu beiden Push-Diensten. Für Android ist es FCM direkt,
für iOS leitet Firebase an Apples APNs weiter.

1. `console.firebase.google.com` → **Projekt hinzufügen**, Name „OKUN
   Workforce". Google Analytics kann aus bleiben.
2. **Android-App hinzufügen**, Paketname exakt `de.okun.workforce`.
   `google-services.json` herunterladen und nach `android/app/` legen.
   *(Fehlt die Datei, baut Android trotzdem — nur ohne Push. Das ist Absicht:
   die Entwicklungsumgebung soll ohne Google-Konto laufen.)*
3. **iOS-App hinzufügen**, Bundle-ID exakt `de.okun.workforce`.
   `GoogleService-Info.plist` herunterladen und in Xcode ins Ziel **App**
   ziehen (Haken bei „Copy items if needed").
4. Im Apple-Entwicklerkonto unter **Keys** einen **APNs-Auth-Key** erzeugen
   (.p8, lädt sich nur EINMAL herunter — sicher ablegen). In Firebase unter
   *Projekteinstellungen → Cloud Messaging → Apple-App-Konfiguration*
   hochladen, zusammen mit Key-ID und Team-ID.
5. In Firebase: *Projekteinstellungen → Dienstkonten → **Neuen privaten
   Schlüssel erzeugen***. Die heruntergeladene JSON-Datei **als eine Zeile** in
   die Railway-Umgebung eintragen:

   ```
   FCM_SERVICE_ACCOUNT={"type":"service_account","project_id":"…", …}
   ```

   Ohne diese Variable verschickt das System nichts und schreibt stattdessen
   eine Zeile ins Protokoll (`[push:nativ:entwicklung]`). Nichts geht kaputt.

---

## Teil C — Am Mac bauen

Voraussetzung: macOS mit Xcode (aus dem Mac App Store) und Android Studio.
Beides ist kostenlos, Xcode braucht rund 15 GB.

```bash
git clone … && cd therapie
npm install

# Die Adresse der laufenden Anlage — ohne sie zeigt die App auf die
# Vorgabe aus capacitor.config.ts.
export OKUN_APP_URL=https://app.okun-systems.de

npm run app:ios        # baut, synchronisiert und öffnet Xcode
npm run app:android    # dasselbe für Android Studio
```

`npm run app:sync` allein reicht, wenn sich nur die Konfiguration geändert hat.
**Wichtig:** Weil die App die Anlage lädt, muss nach einer Änderung am Programm
NICHT neu eingereicht werden. Nur Änderungen an der Hülle selbst — Rechte,
Symbole, Name, Adresse — brauchen eine neue Version im Store.

### In Xcode noch von Hand
- **Signing & Capabilities** → Team auswählen (erscheint nach der
  Apple-Anmeldung).
- **+ Capability → Push Notifications** hinzufügen.
- **+ Capability → Background Modes**, Haken bei *Remote notifications*.
- Symbole: `ios/App/App/Assets.xcassets/AppIcon.appiconset` — 1024×1024 liegt
  als `public/brand/icon-1024.png` bereit.

### In Android Studio noch von Hand
- Einen **Signierschlüssel** erzeugen (*Build → Generate Signed Bundle*) und
  **sicher aufbewahren**. Geht er verloren, lässt sich die App im Play Store
  nie wieder aktualisieren — sie müsste unter neuem Namen neu veröffentlicht
  werden und alle Nutzer müssten sie neu installieren.
- Symbole: `android/app/src/main/res/mipmap-*`.

---

## Teil D — Was in den Store-Eintrag gehört

### Der Prüfer-Zugang (beide Stores, Apple prüft ihn wirklich)

Ein Zugang, der **funktioniert und etwas zeigt**. Ein leerer Dienstplan ist ein
Ablehnungsgrund („app appears incomplete"), und zwar ein häufiger.

Anzulegen über `/okun/test-accounts` oder als Mitarbeiter an einem eigens dafür
eingerichteten Standort. Dieser Zugang muss enthalten:

- eine **volle Dienstwoche** im Plan, auch in der Zukunft
- mindestens **eine Lohnabrechnung** zum Herunterladen
- **zwei bis drei Chatnachrichten** von einer zweiten Person
- eine **abgeschlossene Zeitbuchung**, damit „Meine Zeiten" nicht leer ist
- Resturlaub und Stundenkonto ungleich null

> Der Zugang darf **nicht** gelöscht oder abgelaufen sein, solange die App im
> Store steht — Apple prüft auch bei jedem Update erneut.

### Notiz an die Prüfung (App Review Notes)

Frei übersetzbar, sinngemäß:

> Diese App ist das Werkzeug für Beschäftigte eines Pflege- und
> Therapieunternehmens. Sie ist kein Browser-Lesezeichen: Sie nutzt die Kamera
> (Arbeitsunfähigkeitsbescheinigung abfotografieren), Face ID / Touch ID
> (Sperre vor Lohn- und Personaldaten, unter „Ich" einschaltbar), Push über
> APNs (kurzfristige Dienstausfälle) und arbeitet ohne Netz weiter: Stempeln,
> Krankmeldung und Anträge werden auf dem Gerät gemerkt und später übertragen.
> Das Löschen des Kontos lässt sich in der App beantragen (Ich → Meine Daten);
> sofort gelöscht wird nicht, weil deutsche Aufbewahrungsfristen für
> Lohnunterlagen das verbieten (§147 AO, §257 HGB, §28f SGB IV) — der Antrag
> geht an den Arbeitgeber, der ihn bearbeitet, und der Stand ist in der App zu
> sehen.
> Zugänge legt der Arbeitgeber an; eine Selbstregistrierung gibt es nicht.

### Datenschutz-Angaben (App Privacy / Data Safety)

Ehrlich ausfüllen. Was die App erhebt und womit sie es verknüpft:

| Art | Zweck | Mit der Person verknüpft |
|---|---|---|
| Name, E-Mail | Anmeldung, Zuordnung zur Personalakte | ja |
| Beschäftigungsdaten (Zeiten, Dienste, Abwesenheiten) | Kernzweck | ja |
| Finanzdaten (Lohnabrechnung) | Kernzweck | ja |
| Gesundheitsdaten (Krankmeldung, Bescheinigung) | Kernzweck | ja |
| Fotos (nur die Bescheinigung) | Kernzweck | ja |
| Gerätekennung für Push | Benachrichtigungen | ja |

**Nicht** angekreuzt wird: Werbung, Tracking über Apps hinweg, Weitergabe an
Dritte, Standort. Nichts davon gibt es, und eine falsche Angabe hier ist der
eine Fehler, den beide Stores hart bestrafen.

Alterseinstufung: **4+ / USK 0**. Es gibt keine Inhalte, die etwas anderes
rechtfertigen.

---

## Teil E — Was noch gegen eine Ablehnung spricht

Ehrlich aufgelistet, damit niemand überrascht wird:

1. **Richtlinie 4.2 bleibt das Hauptrisiko.** Die App lädt eine Website. Die
   sechs nativen Punkte oben sind die Antwort darauf, und sie sind echt — aber
   die Entscheidung trifft ein Mensch. Falls abgelehnt: auf die Notiz
   verweisen, die Funktionen einzeln benennen, und notfalls ein kurzes Video
   beilegen, das Kamera, Face ID und das Stempeln im Flugmodus zeigt.
2. **Die Datenschutzerklärung muss öffentlich stehen**, bevor eingereicht wird
   — ohne erreichbare URL wird gar nicht erst geprüft.
3. **Eine Domain auf `up.railway.app`** wirkt provisorisch. Kein formaler
   Ablehnungsgrund, aber ein unnötiger.
4. **Der Prüfer-Zugang muss halten.** Läuft er während der Prüfung ab, wird
   abgelehnt, und der nächste Anlauf kostet wieder Tage.

---

## Wo was liegt

| Datei | Was |
|---|---|
| `capacitor.config.ts` | Adresse, Bundle-ID, Startbildschirm, Push-Vorgaben |
| `native/web/fehler.html` | Die Seite ohne Netz — liegt IM Programm |
| `ios/App/App/Info.plist` | Rechtetexte, `WKAppBoundDomains`, Hintergrundmodus |
| `android/app/src/main/AndroidManifest.xml` | Rechte, keine Google-Sicherung |
| `src/lib/nativ.ts` | Die einzige Stelle, an der „App oder Browser" entschieden wird |
| `src/lib/push-geraet.ts` | Versand über FCM, samt Umgang mit toten Kennungen |
| `pruefungen/b4-app.mjs` | 33 Nachweise für Gerät und Löschantrag |
