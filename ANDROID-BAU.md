# Das Android-Paket bauen

§273. Was hier steht, ist gemessen und nicht erinnert: Das Paket
`app-release.aab` wurde am 30.10.2026 auf diesem Server gebaut, unterschrieben
und geprüft.

---

## Was dabei herauskommt

| | |
|---|---|
| Paketname | `de.okun.workforce` |
| Version | `versionCode 1`, `versionName 1.0` |
| Ziel-Android | SDK 36 (Android 16) |
| Datei | `android/app/build/outputs/bundle/release/app-release.aab`, ~7 MB |

Die Hülle bringt die Anwendung nicht mit, sie lädt sie
(`capacitor.config.ts`, §139). Im Paket liegt nur die Notfallseite
`fehler.html` für den Fall, dass das Telefon die Anlage gar nicht erreicht.

---

## Der Befehl

```bash
cd android
export ANDROID_HOME=…/android-sdk
./gradlew bundleRelease -I spiegel.gradle
```

Für ein Testpaket zum Aufstecken aufs Telefon: `assembleDebug` statt
`bundleRelease`.

### Warum `-I spiegel.gradle` dabeistehen muss

Ohne das Init-Skript scheitert der Bau. Nicht an unserem Code:

```
Could not GET 'https://repo.maven.apache.org/maven2/…/junit-4.13.2.jar'.
Received status code 429 from server: Too Many Requests
```

Maven Central drosselt nach IP, und diese Bau-Umgebung teilt ihre IP mit
vielen anderen. Gemessen am 30.10.2026, dieselbe Datei, dieselbe Minute:

| Quelle | Antwort |
|---|---|
| `repo.maven.apache.org` | **429** |
| `maven-central.storage-download.googleapis.com` | **200**, 384 581 Bytes |
| `dl.google.com/dl/android/maven2` | 404 (führt nur Android-Bibliotheken) |

`spiegel.gradle` tauscht die Quelle gegen Googles vollständigen Spiegel von
Maven Central — ohne eine Zeile im Projekt zu ändern.

> **Die Falle dabei:** Der Fehler zeigte sich zuerst als
> `Cannot invoke "java.util.List.get(int)" because "path" is null` beim Prüfen
> der Bibliotheks-Metadaten. Das klingt nach einem Fehler im Android-Plugin
> und ist keiner — es ist dieselbe Drosselung, nur eine Stufe früher und
> schlecht gemeldet. Wer danach sucht, sucht am falschen Ort.

---

## Der Upload-Schlüssel

Google Play nimmt nur unterschriebene Pakete an.

```
Alias      okun-upload
Verfahren  RSA 4096
Gültig bis 22.10.2056   (Play verlangt mindestens 2033)
SHA-256    BF:50:C1:A8:E7:5C:27:AA:C3:74:7E:B2:8B:FB:ED:71:
           D1:9D:41:D7:B2:0D:EB:7C:25:E6:7B:91:07:FF:E7:7C
```

Der Fingerabdruck im fertigen Paket (`META-INF/OKUN-UPL.RSA`) ist mit diesem
verglichen worden und stimmt Zeichen für Zeichen. `jarsigner -verify` sagt
`jar verified`.

### Wo das Geheimnis liegt — und wo nicht

`android/app/build.gradle` liest es aus zwei Quellen, in dieser Reihenfolge:

1. `android/okun-signatur.properties` — für den Bau von Hand.
2. Die Umgebungsvariablen `OKUN_KEYSTORE_PFAD`, `OKUN_KEYSTORE_KENNWORT`,
   `OKUN_SCHLUESSEL_NAME`, `OKUN_SCHLUESSEL_KENNWORT` — für den Bau auf einem
   Server, wo die Werte aus dem Geheimnis-Speicher kommen.

Fehlt beides, baut `bundleRelease` weiterhin — nur unsigniert, und sagt es:
`OKUN: kein Upload-Schlüssel gefunden`. Das ist Absicht. Ein Bau, der ohne
Schlüssel abbricht, lässt sich nicht prüfen; einer, der sich stillschweigend
selbst unterschreibt, täuscht.

> **§273 Was in `.gitignore` nicht eingeschaltet war.** Googles Vorlage führt
> `#*.jks` und `#*.keystore` — **auskommentiert**. Ein Schlüssel in diesem
> Verzeichnis wäre mitcommittet worden, und wer ihn aus der Git-Historie
> liest, kann Aktualisierungen von OKUN Workforce unterschreiben und an jedes
> Telefon ausliefern, auf dem die App installiert ist. Die Zeilen sind jetzt
> scharf, dazu `okun-signatur.properties`.

### Wenn der Schlüssel verloren geht

Kein Weltuntergang, solange die **Play App-Signatur** eingeschaltet ist
(beim Anlegen der App akzeptiert, siehe `PLAY-ANMELDUNG.md` §272): Den
eigentlichen Signaturschlüssel verwahrt Google, der Upload-Schlüssel lässt
sich zurücksetzen. Ohne Play-Signatur wäre ein verlorener Schlüssel das Ende
gewesen — die App hätte nie wieder aktualisiert werden können.

---

## Was dem Paket noch fehlt

**`android/app/google-services.json` aus Firebase.** Ohne sie wird das
`com.google.gms.google-services`-Plugin nicht angewandt, und native
Push-Nachrichten funktionieren nicht. Die App stürzt deshalb **nicht** ab —
das ist nachgesehen: `pushAnmelden()` in `src/lib/nativ.ts` steht vollständig
in `try/catch`, `registrationError` wird behandelt, und seit §273 hat auch
`register()` selbst ein `catch`. Fehlt Firebase, kommt sofort
`keine Gerätekennung` zurück statt nach 15 Sekunden Warten.

Für ein Paket im internen Testkanal reicht das. Vor der Veröffentlichung
gehört die Datei hinein — Push ist in `STORE-TEXTE.md` zugesagt, und was
zugesagt ist, muss gehen.
