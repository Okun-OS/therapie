# Benachrichtigungen einrichten

Wie aus „das System möchte benachrichtigen" ein Telefon wird, das klingelt.

> Diese Datei beantwortet die Frage „Was muss ich bei Firebase machen?" — und
> fängt mit dem Teil an, für den man Firebase **nicht** braucht.

---

## Das Wichtigste zuerst: Es sind zwei Wege, nicht einer

Das System kann auf zwei getrennten Wegen benachrichtigen. Beide sind gebaut,
beide laufen nebeneinander, und **niemand bekommt etwas doppelt** — ein Gerät
benutzt immer nur einen davon.

| | Weg | Erreicht | Braucht |
|---|---|---|---|
| **1** | **Web-Push** | Jeden, der im Browser arbeitet, und ein iPhone mit der Seite auf dem Startbildschirm | **nichts außer drei Variablen.** Kein Google-Konto, kein Store, keine Wartezeit |
| **2** | **Nativ (Firebase)** | Die App aus dem Play Store und dem App Store, auch wenn sie seit Tagen zu ist | Firebase-Projekt, und für iOS das Apple-Konto |

**Korrektur zu dem, was ich dir vorher gesagt habe:** In `DEINE-LISTE.md`
stand, ohne den Firebase-Schlüssel verschicke das System „keine einzige
Benachrichtigung". Das stimmt so nicht. Ohne Firebase fehlt der **native** Weg
— der für die Store-Apps. Der Weg über den Browser ist davon unberührt und
braucht Google überhaupt nicht.

**Weg 1 kannst du in fünf Minuten einschalten. Heute.** Weg 2 für Android
dauert zwanzig Minuten. Weg 2 für iPhone wartet weiter auf die D-U-N-S-Nummer.

---

## Teil 1 — Web-Push einschalten (5 Minuten, heute)

### Schritt 1: Ein Schlüsselpaar erzeugen

Auf irgendeinem Rechner mit Node, im Projektverzeichnis:

```bash
npm run push:schluessel
```

Heraus kommen zwei Zeichenketten, ein öffentlicher und ein privater Schlüssel.

> **Der private Schlüssel ist ein Geheimnis.** Er gehört nach Railway und
> sonst nirgendwohin — nicht in eine E-Mail an mich, nicht in einen Chat, nicht
> ins Verzeichnis. Wer ihn hat, kann in deinem Namen Benachrichtigungen an
> deine Leute schicken.
>
> Das Paar lässt sich jederzeit neu erzeugen. Dann müssen allerdings alle
> Benutzer die Benachrichtigungen einmal neu erlauben — also nicht aus Spaß
> wechseln.

### Schritt 2: Drei Variablen bei Railway eintragen

*Service der App → Variables → New Variable*

| Variable | Wert |
|---|---|
| `VAPID_PUBLIC_KEY` | der öffentliche Schlüssel |
| `VAPID_PRIVATE_KEY` | der private Schlüssel |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **derselbe** öffentliche Schlüssel noch einmal |

**Warum der öffentliche zweimal?** Die erste Fassung liest der Server, die mit
`NEXT_PUBLIC_` liest der Browser. Nur Variablen mit diesem Vorsatz schickt
Next an den Browser — und genau deshalb darf der private dort **niemals**
stehen. Stünde er mit `NEXT_PUBLIC_` da, könnte ihn jeder Besucher auslesen.

`VAPID_SUBJECT` steht schon und braucht nichts.

Nach dem Speichern baut Railway neu. Zwei, drei Minuten.

### Schritt 3: Nachsehen, ob es wirkt

Melde dich als Mitarbeiter an und geh auf **Vertretungen**. Dort steht der
Knopf, mit dem man Benachrichtigungen erlaubt. Vorher war er wirkungslos —
ohne öffentlichen Schlüssel bricht der Browser still ab.

Erlauben, dann eine Vertretungsanfrage auslösen. Es muss klingeln.

> **Auf dem iPhone** nur, wenn die Seite über *Teilen → Zum Home-Bildschirm*
> abgelegt wurde. Safari erlaubt Benachrichtigungen nicht im normalen Tab.
> Das ist Apples Regel, nicht unsere — und genau der Grund, warum es Weg 2
> überhaupt gibt.

### Was ich davon nachgeprüft habe und was nicht

Weil ich dir sonst „fünf Minuten und es klingelt" sage, ohne es zu wissen:

**Nachgeprüft (08.10.2026):**

* Ein mit `npm run push:schluessel` erzeugtes Paar wird vom Versand
  angenommen. Gegenprobe: ein vertauschtes Paar wird abgelehnt
  („Vapid public key should be 65 bytes long") — die Annahme oben ist also
  keine Nachsicht, sondern eine echte Prüfung.
* Mit gesetztem `NEXT_PUBLIC_VAPID_PUBLIC_KEY` landet der öffentliche
  Schlüssel wirklich im ausgelieferten Programm, und zwar genau in der Seite,
  die ihn braucht (`employee/substitutions`). Ohne die Variable wäre er
  nirgends, und der Knopf bliebe wirkungslos.
* Der Dienst-Arbeiter (`public/sw.js`) hat einen Empfänger für eingehende
  Benachrichtigungen.

**NICHT nachgeprüft:** dass auf einem echten Gerät wirklich etwas klingelt.
Der Browser im Prüfbehälter verweigert das Abonnieren grundsätzlich
(`Registration failed – permission denied`), weil er keinen Zustelldienst hat.
Das ist eine Grenze dieser Maschine, kein Befund über das Programm — aber
nachgewiesen ist es damit eben auch nicht. **Der letzte Schritt gehört dir:
einmal auf deinem Telefon ausprobieren.** Wenn es nicht klingelt, sag Bescheid.

---

## Teil 2 — Firebase für Android (20 Minuten)

Das ist die „Firebase-Sache". Sie bringt Benachrichtigungen in die App aus dem
Play Store, auch wenn die App zu ist.

> **Reihenfolge:** Das Google-Play-Entwicklerkonto (25 $ einmalig) brauchst du
> dafür erst beim Veröffentlichen. Firebase selbst geht sofort und ist
> kostenlos.

### Schritt 1: Projekt anlegen

1. [console.firebase.google.com](https://console.firebase.google.com) →
   **Projekt hinzufügen**
2. Name: **OKUN Workforce**
3. **Google Analytics kann aus bleiben.** Es erhebt Nutzungsdaten, die wir
   nicht brauchen — und jedes Werkzeug, das Personendaten sieht, müsste ins
   Datenschutz-Verzeichnis und in einen Auftragsverarbeitungsvertrag.

### Schritt 2: Android-App hinzufügen

1. In der Projektübersicht das **Android-Symbol**
2. **Paketname exakt:**
   ```
   de.okun.workforce
   ```
   Ein Tippfehler hier fällt erst auf, wenn später keine Benachrichtigung
   ankommt — Firebase prüft den Namen nicht gegen irgendetwas.
3. Spitzname und SHA-1 kannst du leer lassen
4. **`google-services.json` herunterladen** → schick sie mir, ich baue sie ein

### Schritt 3: Den Serverschlüssel holen — der Teil, der zählt

*Zahnrad oben links → Projekteinstellungen → **Dienstkonten** → **Neuen
privaten Schlüssel generieren*** → Bestätigen.

Es lädt eine JSON-Datei herunter. Die muss **als eine einzige Zeile** zu
Railway:

| Variable | Wert |
|---|---|
| `FCM_SERVICE_ACCOUNT` | der komplette Inhalt der JSON-Datei, in einer Zeile |

Die Datei sieht so aus und beginnt mit `{"type":"service_account",…`. Zeilen­
umbrüche im Schlüssel (`\n`) **so lassen, wie sie sind** — das System rechnet
damit und setzt sie selbst wieder um.

> Auch dieser Schlüssel ist ein Geheimnis, und ein größeres als das VAPID-Paar:
> Mit ihm kann man an jedes Gerät senden, das sich je angemeldet hat. Nur nach
> Railway, nirgendwo sonst.

### Schritt 4: Nachsehen

Steht die Variable, verschickt das System nativ. Steht sie nicht, schreibt es
eine Zeile ins Protokoll und macht sonst nichts kaputt:

```
[push:nativ:entwicklung] 2 Gerät(e) von … – "Dienstplan freigegeben": …
```

Das ist Absicht — die Entwicklungsumgebung soll ohne Google-Konto laufen.

---

## Teil 3 — iPhone (wartet auf die D-U-N-S-Nummer)

Für iOS leitet Firebase an Apples eigenen Dienst (APNs) weiter, und dafür
braucht es einen Schlüssel aus dem Apple-Entwicklerkonto. Das Konto hängt an
der D-U-N-S-Nummer.

Wenn es so weit ist:

1. **iOS-App in Firebase hinzufügen**, Bundle-ID exakt `de.okun.workforce`.
   `GoogleService-Info.plist` herunterladen — schick sie mir.
2. Im Apple-Entwicklerkonto unter **Keys** einen **APNs-Auth-Key** erzeugen
   (.p8). **Der lädt sich nur EIN einziges Mal herunter.** Geht er verloren,
   muss ein neuer erzeugt werden.
3. In Firebase unter *Projekteinstellungen → Cloud Messaging →
   Apple-App-Konfiguration* hochladen, zusammen mit **Key-ID** und **Team-ID**.

Dann gilt derselbe `FCM_SERVICE_ACCOUNT` wie für Android — ein Schlüssel für
beide Systeme.

---

## Woran du merkst, dass etwas fehlt

Nichts davon lässt das System abstürzen. Jede Lücke schreibt stattdessen eine
Zeile ins Protokoll:

| Im Protokoll | Was fehlt |
|---|---|
| `[push:dev] an …` | Die VAPID-Schlüssel (Teil 1) |
| `[push:nativ:entwicklung] …` | `FCM_SERVICE_ACCOUNT` (Teil 2) |
| `[push:nativ] Der hinterlegte Schlüssel lässt sich nicht verwenden.` | `FCM_SERVICE_ACCOUNT` ist da, aber beschädigt — meist beim Einfügen zerrissen |
| `[push:nativ] Google verweigert den Zugang: HTTP 401` | Der Schlüssel wurde in Firebase zurückgezogen |

Eine Benachrichtigung, die nicht ankommt, hält nie einen Dienstplan oder eine
Krankmeldung auf. Das ist so gebaut: Benachrichtigungen sind Beiwerk, die
Schicht wird trotzdem besetzt.

---

## Was wohin gehört

| Datei | Wohin |
|---|---|
| Der private VAPID-Schlüssel | nur Railway |
| Die Dienstkonto-JSON | nur Railway, als `FCM_SERVICE_ACCOUNT` |
| `google-services.json` | an mich — kommt nach `android/app/` |
| `GoogleService-Info.plist` | an mich — kommt ins Xcode-Projekt |
| Der APNs-Schlüssel (.p8) | nur in die Firebase-Konsole hochladen |

Die ersten beiden sind Geheimnisse. Die beiden mittleren sind es nicht — sie
stecken ohnehin in jeder ausgelieferten App und enthalten keinen Schlüssel,
mit dem sich etwas versenden ließe.

---

**Dazu passend:** `APP-STORES.md` (die Apps in die Stores bringen),
`DEINE-LISTE.md` (alles, was ein Konto oder eine Unterschrift braucht).
