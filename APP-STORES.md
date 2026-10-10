# Die App in die Stores

Diese Datei ist der Ablaufplan von hier bis zur veröffentlichten App. Sie sagt,
was fertig ist, was OKUN besorgen muss und was am Mac zu tun ist. Wer sie von
oben nach unten abarbeitet, kommt durch.

Stand: **10.10.2026** — die Hülle ist gebaut, Push ist auf beiden Seiten
verdrahtet. Was fehlt, sind Konten und zwei gebaute Apps.

---

## Die Reihenfolge — was heute geht und was wartet

Push in den Store-Apps ist keine Firebase-Aufgabe, sondern eine
Veröffentlichungs-Aufgabe: Es klingelt erst, wenn die App installiert ist.
Firebase ist nur ein Schritt davon.

**Heute, ohne auf irgendetwas zu warten:**

1. **Firebase-Projekt anlegen** und `FCM_SERVICE_ACCOUNT` bei Railway setzen
   (20 Minuten, kostenlos → `FIREBASE.md`, Teil 2). Danach ist die
   Server-Seite für beide Stores fertig — ein Schlüssel für Android und iOS.
2. **Android-App in Firebase hinzufügen**, `google-services.json` an mich.
3. Dann baue ich die **Android-App** und du bekommst eine `.apk` zum
   Aufspielen. **Damit klingelt es auf deinem eigenen Android-Telefon — ohne
   Play Store, ohne Konto, ohne Wartezeit.** Das ist der schnellste Weg, Push
   überhaupt einmal in echt zu sehen, und er hängt an keinem einzigen Konto.

> **Nachgewiesen am 10.10.2026**, damit Schritt 3 keine Zusage auf Verdacht
> ist: Die App lässt sich auf diesem Server bauen. Dafür fehlte das
> Android-SDK; es ist jetzt eingerichtet, und `./gradlew assembleDebug` liefert
> eine `app-debug.apk` von 9,9 MB. Nachgesehen im fertigen Paket: Paketname
> `de.okun.workforce` (genau der, der in Firebase einzutragen ist), das Recht
> `POST_NOTIFICATIONS`, und die Firebase-Bestandteile sind enthalten.
>
> **Die Einschränkung:** Ohne `google-services.json` weiß die App nicht, mit
> welchem Firebase-Projekt sie reden soll. `android/app/build.gradle` sagt das
> beim Bauen selbst: *„google-services.json not found, google-services plugin
> not applied. Push Notifications won't work."* Die App läuft dann ganz normal
> — nur klingelt sie nicht. Deshalb ist Schritt 1 und 2 vorher nötig, und
> deshalb baue ich die `.apk` neu, sobald du mir die Datei schickst.
>
> Der Bau scheitert übrigens zwei-, dreimal an einer Drosselung von Maven
> Central (HTTP 429) und kommt bei jedem Versuch weiter. Das ist eine Grenze
> dieser Maschine, kein Projektfehler.

**Sobald die D-U-N-S-Nummer da ist (beide Stores, dieselbe Nummer):**

4. **Google-Play-Konto als Organisation** (25 $) → ich baue das `.aab`, du
   lädst hoch. Store-Eintrag siehe Teil D.
5. **Apple Developer Program** (99 $/Jahr) → **APNs-Schlüssel** erzeugen und
   in Firebase hochladen → iOS-App in Firebase hinzufügen.
6. **iOS bauen und einreichen** — dafür braucht es einen Mac oder einen
   macOS-Läufer, siehe Teil A.

**Was dabei nicht auf dem Weg liegt:** Der Browser-Push (VAPID) hat mit alldem
nichts zu tun und ist in fünf Minuten eingeschaltet. Er erreicht keine
Store-App, aber jeden, der im Browser arbeitet. Siehe `FIREBASE.md`, Teil 1.

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

| | Wofür | Stand (10.10.2026) |
|---|---|---|
| **D-U-N-S-Nummer** | **beide** Entwicklerkonten als Organisation | beantragt, läuft |
| **Apple Developer Program**, 99 $/Jahr | App Store | wartet auf D-U-N-S |
| **Google Play Developer**, 25 $ einmalig | Play Store | wartet auf D-U-N-S |
| **Firebase-Projekt** (kostenlos) | Push für iOS **und** Android | offen, geht sofort |
| **APNs-Schlüssel** (.p8) aus dem Apple-Konto | Push auf dem iPhone | wartet auf Apple |
| **Ein Mac** oder ein Mac in der Cloud | iOS überhaupt bauen | **ungeklärt — siehe unten** |
| **Prüfer-Zugang** mit gefüllten Testdaten | Apple prüft sonst gar nicht erst | lege ich an |
| ~~Datenschutzerklärung und Impressum~~ | beide Stores verlangen eine URL | ✅ erledigt |
| ~~Eigene Domain~~ | Vertrauen, App-Links | ✅ `okun-workforce.com` |

> **Zur Domain:** Sie steht an drei Stellen und muss überall dieselbe sein —
> `capacitor.config.ts` (bzw. `OKUN_APP_URL`), `ios/App/App/Info.plist` unter
> `WKAppBoundDomains`, und `APP_URL` in der Umgebung von Railway. Weicht eine
> ab, lädt die App nichts oder der Offline-Zwischenspeicher bleibt tot.

### Die D-U-N-S-Nummer schließt BEIDE Stores auf

Das stand hier bis zum 10.10. falsch — als wäre sie nur für Apple nötig.
Google schreibt auf seiner eigenen Hilfeseite zum Entwicklerkonto:

> „Ohne eine solche Nummer können Sie kein Entwicklerkonto für eine
> Organisation erstellen."

Es ist dieselbe Nummer für beide. Google nennt als Dauer **bis zu 30 Tage**.

**Und kein privates Play-Konto nehmen, um schneller zu sein.** Private Konten,
die nach dem 13.11.2023 erstellt wurden, müssen vor der ersten
Veröffentlichung einen geschlossenen Test mit **mindestens 12 Testern über 14
zusammenhängende Tage** bestehen. Zwölf Menschen, die zwei Wochen lang eine
Dienstplan-App auf dem Telefon behalten — das wäre die eigentliche Hürde.
Googles Seite nennt die Regel ausdrücklich nur für private Konten.

### Der Punkt, der noch ungeklärt ist: **iOS braucht einen Mac**

Eine iOS-App lässt sich nur auf macOS bauen und einreichen. Das ist Apples
Regel und lässt sich nicht umgehen — auch nicht bei einer Hülle, die nur eine
Webseite lädt. Auf einem Windows-Rechner geht es nicht, und auf diesem Server
hier auch nicht.

Drei Wege, vom günstigsten zum bequemsten:

| | Was | Kosten | Wofür geeignet |
|---|---|---|---|
| **A** | **macOS-Läufer bei GitHub Actions** | im kostenlosen Kontingent, danach nach Minuten | Baut und reicht ein, ohne dass jemand einen Mac besitzt. Einmal einzurichten — **das kann ich machen**, sobald das Apple-Konto steht. |
| **B** | **Mac in der Cloud mieten** (MacStadium, MacInCloud) | ab ~25 €/Monat | Wenn du zwischendurch selbst in Xcode schauen willst |
| **C** | **Einen Mac kaufen** (Mac mini) | ab ~700 € | Lohnt erst, wenn regelmäßig an der Hülle gearbeitet wird |

**Mein Rat: A.** Die Hülle ändert sich fast nie — sie lädt ja nur die Anlage.
Ein Gerät anzuschaffen, das zweimal im Jahr fünf Minuten läuft, wäre teuer
geschlafene Hardware. Für Android brauchst du gar nichts: Das baut sich auf
deinem Windows-Rechner mit Android Studio, oder ebenfalls hier.

---

## Teil B — Firebase einrichten

**Steht jetzt vollständig in `FIREBASE.md`** — mit allem, was dazugehört:
welche Variablen wohin, was ein Geheimnis ist und was nicht, und woran man im
Protokoll erkennt, dass etwas fehlt.

Das Wichtigste daraus, weil es hier falsch dargestellt war: Firebase bringt
den **nativen** Weg (App aus dem Store). Der Weg über den Browser braucht es
nicht — der läuft über VAPID-Schlüssel, ohne Google-Konto, und lässt sich in
fünf Minuten einschalten.

---

## Teil C — Am Mac bauen

Voraussetzung: macOS mit Xcode (aus dem Mac App Store) und Android Studio.
Beides ist kostenlos, Xcode braucht rund 15 GB.

```bash
git clone … && cd therapie
npm install

# Die Adresse der laufenden Anlage — ohne sie zeigt die App auf die
# Vorgabe aus capacitor.config.ts.
export OKUN_APP_URL=https://okun-workforce.com

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
