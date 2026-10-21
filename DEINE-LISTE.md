# Deine Liste

Alles, was **nicht programmiert werden kann** — weil es ein Konto, eine
Unterschrift, einen Kauf oder eine Zahl aus einer Satzung braucht. Nach
Reihenfolge, nicht nach Bereich: Was oben steht, blockiert das meiste darunter.

> Stand: 21.10.2026 · Was fertig ist, steht in `STAND.md`.
> Zum Abhaken: `- [ ]` zu `- [x]` machen.

---

## Reihenfolge auf einen Blick

```
HEUTE MÖGLICH
  Zwei Briefe abschicken ──►  Fristen gegengezeichnet (Block B)
                         └─►  Angebote für die Haftpflicht

LÄUFT SCHON — WARTET AUF ANTWORT
  D-U-N-S-Nummer ──beantragt 21.10.──►  Apple-Konto ─► APNs ─► App Store
                 (bis 30 Tage)                    └─►  .dmg beglaubigen
                                     └─►  Play-Konto ─► Play Store
                                          Beide Stores, eine Nummer.
  Steuerberater  ──angeschrieben 21.10.──►  erster echter Kunde
                                      └─►  Fristen Block A
                                      └─►  ELStAM-Beispieldatei

ERLEDIGT
  Domain · Firmenangaben · Impressum · Website · Benachrichtigungen
  AVVs (alle fünf) · Cloudflare R2 · Code-Signing (Azure)
```

**Es sind nur noch zwei eigenständige Punkte offen** — die beiden Briefe oben.
Alles andere wartet entweder auf eine Antwort von außen oder ist Bauarbeit und
steht damit auf meiner Liste, nicht auf deiner.

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

**Erledigt am 21.10.:** Vier Punkte auf einmal.

* **Der Steuerberater ist angeschrieben** — die prüferische Durchsicht einer
  Entgeltabrechnung. Das war der Punkt, der den ersten echten Kunden
  blockiert hat. Jetzt wartet er auf Antwort; woran eine gute zu erkennen
  ist, steht in `SUCHAUFTRAEGE.md`.
* **Die D-U-N-S-Nummer ist (erneut) beantragt.** Sie stand hier seit dem
  10.10. als „läuft"; ob der erste Antrag je angekommen ist, ließ sich nicht
  feststellen. Falls D&B wegen eines Doppeleintrags nachfragt: einfach sagen,
  dass nur ein Eintrag gewünscht ist.
* **Alle fünf AVVs stehen.** Resend und Google waren die letzten beiden. Das
  Verzeichnis im Programm (*Datenschutz → Verzeichnis*) zeigt keinen offenen
  Vertrag mehr — und das ist die Fassung, die einem Kunden vorgelegt wird,
  nicht diese Liste.
* **Die Azure-Variablen stehen bei Railway** — damit ist das Code-Signing
  für Windows vollständig eingerichtet. Offen ist nur noch der erste
  signierte Bau, und der ist keine Einkaufs-, sondern eine Bausache.
* **Die Postleitzahl ist geklärt.** Im Impressum steht 10785; nachgesehen am
  21.10., die Seite antwortet mit genau dieser Angabe.
* **Cloudflare R2 ist eingerichtet** — privater Bucket `okun-programm`, ein
  Token, der nur lesen darf, und die vier Angaben bei Railway. Damit haben
  die Programmdateien einen Ort; die Adresse dafür ist
  `okun-workforce.com/programm/…` und steht auf der eigenen Domain, damit
  der Speicher dahinter austauschbar bleibt.
* **Die Benachrichtigungen sind eingeschaltet.** Alle drei VAPID-Variablen
  stehen bei Railway, auch die öffentliche mit `NEXT_PUBLIC_`. Damit klingelt
  es im Browser und auf dem iPhone, wenn die Seite auf dem Startbildschirm
  liegt. Was noch fehlt, ist nur der Weg über die Stores — und der wartet auf
  die D-U-N-S-Nummer, nicht auf dich.

**Von der Liste gestrichen am 21.10. — der Testkunde.** Hier stand ein ganzer
Abschnitt „4b · Der neue Kunde: Wohngruppe" mit zehn E-Mail-Adressen, zwei zu
bestätigenden Schätzungen und den Fixterminen der Leitung. Das war ein
**Regelpaket zum Ausprobieren**, mit dem du nachsehen wolltest, ob die
Dienstpläne stimmen — kein Betrieb, der auf etwas wartet. Drei rote Punkte
weniger, und keiner davon durch Arbeit erledigt, sondern durch eine
Richtigstellung von dir.

**Drei Punkte von dieser Liste gestrichen, 05.10. (von dir berichtigt):** Die
D-U-N-S-Nummer ist beantragt. Die Domain war längst verbunden — ich hatte sie
noch als offen geführt, obwohl die Anlage seit Tagen unter
`okun-workforce.com` läuft. Und die Firmenangaben stehen bei Railway; das
Impressum ist vollständig, mit HRB 292175 B. Nachgemessen am 05.10.:
`okun-workforce.com` und `/impressum` antworten mit 200, und die Seite meldet
keine fehlende Pflichtangabe mehr.

**Erledigt am 08.10.:** Die Website ist fertig — Schrift, Hintergrundbilder,
alles. Sie steht nicht mehr auf dieser Liste.

**Berichtigt am 08.10.:** Hier stand, ohne Firebase verschicke das System
„keine einzige Benachrichtigung". Falsch. Der Weg über den Browser braucht
Google überhaupt nicht und lässt sich in fünf Minuten einschalten — du hast
darauf gewartet, ohne dass du musstest. Anleitung: `FIREBASE.md`.

**Jetzt oben: die zwei Briefe** (Fristen Block B, Haftpflicht). Alles andere
hängt an Dritten und läuft — oder ist Bauarbeit und steht auf meiner Liste.

---

## 1 · Was Wochen dauert — jetzt anstoßen

### ✅ Code-Signing für Windows — eingerichtet am 21.10.

**Erledigt.** Azure Artifact Signing steht: Identitätsprüfung bestanden
(gültig bis 7.1.2029), Zertifikatsprofil `okun-public`, eine App-Registrierung
mit der Rolle *Artifact Signing Certificate Profile Signer*, und die sechs
Variablen liegen bei Railway. Die Einzelheiten samt der beiden Ablauftermine
stehen in `DESKTOP.md`.

**Was noch aussteht, ist kein Einkauf mehr, sondern ein Bau:** Erst die erste
wirklich signierte `.exe` zeigt, ob die Kette hält. Das sieht man sofort —
Windows nennt dann „OKUN Systems UG (haftungsbeschränkt)" statt „Unbekannter
Herausgeber".

<details>
<summary>Warum es so lange der oberste Punkt war</summary>

Ohne Signatur zeigt Windows beim ersten Start „Unbekannter Herausgeber". Bei
einem Programm, das Gehälter anzeigt, installiert das niemand.

**Im Bau ist die Stelle fertig vorbereitet** (§187): Sobald das Zertifikat da
ist, wird ein Befehl in eine Umgebungsvariable gesetzt, und jede ausgelieferte
Datei wird signiert. Ohne Zertifikat baut es weiter, warnt aber bei jeder
Datei. Nachgemessen, auch der Fall, dass das Signieren scheitert: dann bricht
der Bau ab und hinterlässt keine `.exe`.

**Die eine Sache, die die Entscheidung bestimmt:** Seit Juni 2023 gibt es kein
Zertifikat mehr als Datei mit Kennwort. Der private Schlüssel muss auf
zertifizierter Hardware liegen — **USB-Stick oder Cloud-Tresor**. Mit Stick
kann nur der Rechner signieren, in dem er steckt; jede Auslieferung wäre
Handarbeit. Mit Cloud-Tresor signiert der Bau selbst.

</details>

### Wo du es gekauft hast

**Empfehlung: Azure Artifact Signing** (früher „Trusted Signing"), **9,99 $ im
Monat** für 5.000 Signaturen. Kein Zertifikatskauf, keine Hardware, und der Bau
signiert selbst. Du gehst ins Azure-Portal, suchst „Artifact Signing Accounts",
legst ein Konto in der Region **North Europe** an, dann eine Identitätsprüfung
(**Organization → Public**) und zuletzt ein Zertifikatsprofil. Nachgesehen am
05.10.2026.

Zwei Dinge, die man vorher wissen muss:

1. **Die 3-Jahres-Hürde gilt nicht mehr.** In der Vorschauphase verlangte Azure
   drei Jahre Firmengeschichte — für die UG ein Ausschluss. Ein
   Microsoft-Moderator hat am 17.08.2026 klargestellt: nur Land und Region,
   **kein Mindestalter**. Die alte Regel steht noch in vielen Texten.
2. **Du musst dich persönlich ausweisen.** Zur Firmenprüfung gehört eine
   Identitätsprüfung von dir: Ausweis oder Pass per Handy, über die
   Microsoft-Authenticator-App. Dein Name muss im Antrag **genau so** stehen
   wie im Ausweis.

Die **Identitätsprüfung dauert 1 bis 20 Werktage** — deshalb steht dieser
Punkt oben. Bereitlegen: Firmenname genau wie im Register, Registeranschrift,
**HRB 292175 B**, die Website, **zwei verschiedene E-Mail-Adressen auf
okun-systems.com** (beide gelesen, Links von außen müssen ankommen,
Bestätigungen verfallen nach sieben Tagen), Handelsregisterauszug aus den
letzten zwölf Monaten, Ausweis, Handy.

> Nachträglich korrigieren geht nicht: Jede Änderung braucht eine **neue**
> Prüfung. Vor dem Absenden die Vorschau („Certificate subject preview")
> gegenlesen.

**Falls Azure nicht klappt:** Certum (EU, Polen), „Standard Code Signing in the
Cloud", **ab 209 €** — Cloud-Signatur ist kostenlos dabei, der Bau kann also
auch damit selbst signieren. Teurer und umständlicher: SSL.com mit 129 $/Jahr
plus 180 $/Jahr für die Cloud-Signatur.

**Nicht nehmen: einen USB-Stick.** Dann kann nur der Rechner signieren, in dem
er steckt — jede Auslieferung wäre Handarbeit an einem Windows-Rechner.

### Und eine Korrektur: EV lohnt nicht mehr

Hier stand, ein EV-Zertifikat überspringe die SmartScreen-Aufwärmphase. **Das
war bis 2024 richtig und ist es nicht mehr** — Microsoft hat den
Sofort-Vertrauensvorschuss für EV abgeschafft. EV und OV sammeln ihren Ruf
seitdem gleich, über Installationszahlen. Auch EV-signierte Programme zeigen am
Anfang die Warnung.

**Also: kein Grund, für EV das Dreifache zu zahlen.** Was wirklich hilft, ist
immer mit derselben Identität zu signieren — jeder Wechsel setzt den
gesammelten Ruf zurück.

**Blockiert:** die Auslieferung des Windows-Programms an Kunden. Die
Abwägung im Detail: `DESKTOP.md`, Abschnitt §187.

### 🟡 D-U-N-S-Nummer — beantragt am 21.10., bis 30 Tage

**Berichtigt am 10.10.: Sie blockiert BEIDE Stores, nicht nur Apple.** Hier
stand „ohne sie gibt es kein Apple Developer Program als Organisation" — das
stimmt, ist aber nur die Hälfte. Google schreibt auf seiner eigenen Hilfeseite:
*„Ohne eine solche Nummer können Sie kein Entwicklerkonto für eine
Organisation erstellen."*

Die gute Nachricht: **Es ist dieselbe Nummer.** Eine beantragen, beide Stores
aufschließen. Google nennt als Dauer bis zu 30 Tage.

**Blockiert:**
* Apple Developer Program → APNs-Schlüssel → Push auf dem iPhone → App Store
* das beglaubigte `.dmg` für macOS
* **das Google-Play-Entwicklerkonto als Organisation** → Push auf Android

### ✅ Domain verbunden — `okun-workforce.com`
Steht. Die Anlage läuft darunter, `APP_URL` ist gesetzt. Wie es gemacht wurde,
bleibt in `DOMAIN.md` stehen — falls die Einträge einmal nachzusehen sind.

> Zwei Dinge hatte ich hier falsch behauptet und auf Nachfrage berichtigt:
> dass die nackte Domain ohne `app.` nicht gehe (sie geht), und dass dieser
> Punkt noch offen sei (war er nicht).

---

## 2 · Konten, Schlüssel und Firmenangaben

### ✅ Benachrichtigungen einschalten — erledigt am 21.10.

**Weg 1 steht.** Die drei VAPID-Variablen liegen bei Railway, einschließlich
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Im Browser klingelt es, und auf dem iPhone
auch, sobald die Seite auf dem Startbildschirm liegt. **Weg 2 (Firebase)
bleibt offen — aber er wird erst gebraucht, wenn die App in den Stores
liegt**, und das hängt an der D-U-N-S-Nummer. Vorher gibt es dort nichts
einzurichten.

**Hier stand, ohne den Firebase-Schlüssel verschicke das System „keine
einzige Benachrichtigung". Das war falsch**, und es hat dich Wochen gekostet,
in denen du auf ein Google-Konto gewartet hast, das du dafür gar nicht
brauchst.

Es sind zwei getrennte Wege, und nur einer braucht Firebase:

| | Weg | Erreicht | Braucht |
|---|---|---|---|
| **1** | **Web-Push** | jeden im Browser, und das iPhone mit der Seite auf dem Startbildschirm | **nichts.** Kein Google-Konto, kein Store |
| **2** | **Nativ (Firebase)** | die App aus den Stores, auch wenn sie zu ist | Firebase, für iOS zusätzlich das Apple-Konto |

**✅ Weg 1 ist eingeschaltet** — `npm run push:schluessel` erzeugt die
Schlüssel, alle drei stehen bei Railway. Nichts mehr zu tun.

**🟡 Weg 2 für Android:** Firebase-Projekt anlegen, Dienstkonto-Schlüssel nach
Railway, `google-services.json` an mich. Zwanzig Minuten, kostenlos. **Aber
erst, wenn das Play-Konto steht** — ohne Store bringt der Weg nichts, was Weg 1
nicht schon kann. Und das Konto wartet auf die D-U-N-S-Nummer.

**🔴 Weg 2 für iPhone:** wartet auf die D-U-N-S-Nummer — und auf einen Mac,
siehe `APP-STORES.md`.

**Jeder Schritt einzeln, mit den genauen Feldern und was ein Geheimnis ist:
`FIREBASE.md`.**

### 🟡 Apple Developer Program — 99 $/Jahr
Wartet auf die D-U-N-S-Nummer.

### 🔴 Google-Play-Entwicklerkonto — 25 $ einmalig, **als Organisation**

**Berichtigt am 10.10.:** Hier stand „geht sofort, unabhängig von allem
anderen". Das war falsch und in zwei Richtungen teuer.

**Es braucht die D-U-N-S-Nummer** — als Organisationskonto geht es ohne sie
gar nicht (Googles eigene Hilfeseite). Wartet also auf denselben Punkt wie
Apple.

**Und nimm trotzdem kein privates Konto, um schneller zu sein.** Private
Konten, die nach dem 13.11.2023 erstellt wurden, müssen vor der
Veröffentlichung einen **geschlossenen Test mit mindestens 12 Testern über 14
zusammenhängende Tage** fahren. Zwölf Leute, die zwei Wochen lang eine
Dienstplan-App auf dem Telefon lassen — das wäre die eigentliche Hürde, nicht
die 25 $. Für Organisationskonten gilt die Regel nicht; Googles Seite nennt
ausdrücklich nur private Konten.

> Der Umweg über ein privates Konto wäre also kein Umweg, sondern zwei
> Wochen Mehrarbeit plus zwölf Freiwillige.

Danach brauche ich von dir das `google-services.json` aus dem
Firebase-Projekt; den Rest baue ich ein. **Der ganze Weg in die Stores steht
in `APP-STORES.md`.**

### ✅ Firmenangaben für Impressum und Datenschutzerklärung
Stehen bei Railway. Das Impressum ist vollständig: OKUN Systems UG
(haftungsbeschränkt), Potsdamer Platz 1, 10785 Berlin, vertreten durch Felix
Okun, kontakt@okun-systems.com, Amtsgericht Charlottenburg HRB 292175 B.

Offen ist nur noch `OKUN_USTID` — die Seite schreibt dort „Wird
nachgereicht". Sobald die USt-IdNr. vom Bundeszentralamt da ist, bei Railway
eintragen, dann verschwindet der Satz von selbst. (Die USt-IdNr., nicht die
Steuernummer vom Finanzamt — das sind zwei verschiedene Nummern.)

Freiwillig, falls einmal nötig: `OKUN_DSB` (ein Datenschutzbeauftragter ist
erst ab 20 Personen Pflicht, §38 BDSG).

> **Der Firmenname steht jetzt an zwei Stellen** — bei Railway für das
> Impressum und in `desktop/package.json` für die Pakete des
> Desktop-Programms. Das ist kein Versehen: Der Bau läuft ohne die
> Railway-Umgebung, und bis zum 05.10. stand deshalb in jedem gebauten `.deb`
> ein erfundener Absender auf `okun.de`. Beide Stellen müssen **wortgleich**
> sein, weil derselbe Name ins Signaturzertifikat kommt — sonst zeigt Windows
> zwei verschiedene Herausgeber. `npm run desktop:pruefen` prüft das.

---

## 3 · Zahlen und Unterschriften

### 🟡 Steuerberater die Rechnung gegenzeichnen lassen — angeschrieben 21.10., wartet auf Antwort
Eine echte Abrechnung eines echten Monats, Zeile für Zeile. Solange das nicht
jemand mit Berufshaftpflicht bestätigt hat, ist jede Zahl hier nur *von uns*
gerechnet.

**Der Brief steht fertig in `ANFRAGEN.md`** — kopieren, abschicken. **Wen
anschreiben**, findet der Suchauftrag in `SUCHAUFTRAEGE.md`, Abschnitt 1. Das ist
kein ungewöhnliches Anliegen, sondern eine *prüferische Durchsicht*: ein
normales Mandat, nach Zeit abgerechnet. Entscheidend ist, dass die Bestätigung
**schriftlich** kommt.

**Blockiert:** den ersten echten Kunden. Details: `ABLAUFPLAN.md`, Punkt 1.

### 🟡 Eine echte ELStAM-Änderungsliste besorgen — mitgefragt am 21.10.
Der Import ist gebaut, aber nur an nachgebauten Dateien geprüft. Eine echte
Liste zeigt, ob das Format stimmt.

**Sie entsteht nur in einem laufenden Arbeitgeberverhältnis** — also entweder
beim ersten Kunden, oder, schneller, beim Steuerberater, der solche Listen
täglich sieht. **Anonymisiert reicht**; gebraucht wird nur das Format.

**Steht als Frage 4 im Brief an den Steuerberater und ist damit unterwegs.**
Dieser Punkt wartet jetzt auf dieselbe Antwort wie der darüber — du musst
dafür nichts mehr tun.

### 🟡 Aufbewahrungsfristen gegenzeichnen lassen — **es braucht zwei Unterschriften, nicht eine**

**Das Blatt zum Gegenzeichnen liegt jetzt bereit:
`AUFBEWAHRUNGSFRISTEN.md`.** Es wird aus dem Katalog gerechnet
(`npm run fristen:blatt`), nicht getippt — es kann also nichts anderes
behaupten als das, was das Programm tatsächlich löscht. Eine Prüfung hält das
fest: Kommt eine Datenart dazu und erzeugt niemand das Blatt neu, wird sie rot.

**Berichtigung, 21.10.:** Hier stand „vier Fristen". Es sind **zehn**, dazu
zehn Datenarten, bei denen gelöscht wird — zusammen zwanzig Zeilen. „Vier" war
die Zahl der verschiedenen Fristlängen (2, 3, 6 und 10 Jahre). Dieselbe falsche
Zahl steht in dem Brief, den du am 21.10. abgeschickt hast; **ein Satz zum
Nachschicken steht in `ANFRAGEN.md`**, direkt unter Frage 5.

**Und der eigentliche Punkt: ein Steuerberater kann das nicht allein
unterschreiben.** Seine Berufshaftpflicht trägt Steuer- und
Sozialversicherungsrecht. Drei der zehn Fristen stehen aber im
Arbeitszeitgesetz, im Mindestlohngesetz und in der DSGVO selbst — dafür steht
er nicht ein, auch wenn er freundlich nickt. Darum ist das Blatt geteilt:

| | Woraus die Fristen folgen | Wer unterschreibt | Stand |
|---|---|---|---|
| **Block A** | §41 EStG, §147 AO, §257 HGB, §28f SGB IV, SGB III, ZPO — **7 Fristen** | Steuerberater | ✉️ gefragt 21.10. |
| **Block B** | §16 ArbZG, §17 MiLoG, Art. 5 und 17 DSGVO — **3 Fristen** | Datenschutzbeauftragter **oder** Fachanwalt (IT-/Arbeitsrecht) | 🔴 **Brief steht fertig** |
| **Block C** | wo wir **löschen** statt aufzubewahren — **10 Datenarten** | beide, je nach Fundstelle | mit den Blöcken mit |

**Was du tun musst:** den Brief aus `ANFRAGEN.md`, Abschnitt 4, abschicken —
mit dem Blatt im Anhang. Wen anschreiben: ein externer
Datenschutzbeauftragter oder ein Fachanwalt; ein Kurzmandat, keine
Dauerbestellung. Ein Datenschutzbeauftragter ist bei euch ohnehin erst ab 20
Personen Pflicht (§38 BDSG).

> **Block C ist der Teil, den man weglassen würde, und der teurere.** Zu lange
> aufzubewahren kostet ein Bußgeld. Zu früh zu löschen heißt, bei der Prüfung
> nichts vorlegen zu können — und das zahlt der Kunde, der euch dann in
> Anspruch nimmt. Darum steht auf dem Blatt auch, wo wir löschen, mit der
> Frage, ob das richtig ist.

> **Nicht beim Steuerberater mitfragen und bei der Aufsichtsbehörde auch
> nicht.** Die Berliner Datenschutzbeauftragte beantwortet Fragen, aber sie
> zeichnet nichts gegen und gibt keine verbindliche Auskunft. Ein Nachweis
> gegenüber einem Kunden entsteht dort nicht.

### 🟡 Vermögensschadenhaftpflicht klären — **`VERSICHERUNG.md`**

Wer Gehälter rechnet, haftet. **Worauf zu achten ist, steht jetzt vollständig
in `VERSICHERUNG.md`; der Brief an den Makler in `ANFRAGEN.md`, Abschnitt 5.**
Die drei Dinge, an denen es hängt — alles andere ist Verhandlung:

1. **„Entgeltabrechnung" muss in der versicherten Tätigkeit stehen.** Steht
   dort nur „Softwareentwicklung", lehnt der Versicherer genau den Schaden ab,
   gegen den du dich versichert hast — zu Recht.
2. **Der Ausschluss für „Lohn- und Finanzbuchhaltung"** steht in vielen
   IT-Policen weit hinten und macht sie für euch leer. Den Satz suchen,
   zitieren, schriftlich beantworten lassen.
3. **Nachhaftung und Rückwärtsdeckung.** Die meisten Policen zahlen, wenn der
   Anspruch während der Laufzeit *gestellt* wird. Ein Abrechnungsfehler fällt
   aber erst bei der Betriebsprüfung auf — Jahre später. Fünf Jahre
   Nachhaftung, und **abschließen, bevor der erste echte Kunde abrechnet**:
   danach gibt es für die Zeit davor keine Deckung mehr.

> **Und eine Reihenfolge, die Geld spart:** erst die Antwort des
> Steuerberaters, dann den Makler anschreiben. Eine unabhängig
> gegengezeichnete Abrechnung ist das stärkste Argument im Risikogespräch.

> **Was ich dabei nicht kann:** einen Preis nennen und einen Versicherer
> empfehlen. Beides entscheidet das Angebot, und jede Zahl, die ich hier
> hinschriebe, wäre geraten. Was ich kann, ist die neun Fragen zu stellen, auf
> die es ankommt — die stehen im Brief.

### ✅ AVVs mit den Dienstleistern — alle fünf erledigt
Auftragsverarbeitungsverträge. Ohne sie kein DSGVO-konformer Betrieb beim
Kunden — und sobald ein Kunde selbst einen AVV mit dir schließt, musst du ihm
diese Kette nachweisen (Art. 28 Abs. 4 DSGVO: du haftest ihm gegenüber für
deine Unterauftragnehmer).

**Es sind fünf, nicht drei.** Hier standen bis zum 05.10. nur Anthropic,
Railway und Google — der E-Mail-Versand und die SMS fehlten, und das sind
gerade die beiden mit US-Übermittlung. Maßgeblich ist das Verzeichnis im Code
(`src/lib/dsgvo-verzeichnis.ts`), nicht diese Liste; es erscheint im Programm
unter *Datenschutz → Verzeichnis*. Dort steht seit dem 21.10. **kein offener
Vertrag mehr** — vier geschlossen, einer nicht nötig.

Verhandeln muss man nichts, alle fünf haben ein Standarddokument zum Annehmen:

| | Wer | Wofür | Daten | Stand |
|---|---|---|---|---|
| 1 | **Railway** | Hosting und Datenbank — hier liegt **alles** | EU | ✅ **unterschrieben 18.10.** |
| 2 | **Anthropic** | der Hilfe-Assistent (sieht keine Betriebsdaten) | **USA** | ✅ **gilt automatisch** |
| 3 | **Resend** | E-Mails: Einladungen, Benachrichtigungen, Lohnbelege | **USA** | ✅ **geschlossen 21.10.** |
| 4 | **Twilio** | SMS für den zweiten Anmeldefaktor | **USA** | ⚪ **nicht nötig — noch nicht in Benutzung** |
| 5 | **Google** | Push an die App aus dem Store | EU, für iPhones weiter an Apple | ✅ **geschlossen 21.10.** |

### Was ich nebenbei behoben habe (§195)

Beim Nachsehen, was wir bei Twilio haben, stand im Code eine Notlösung aus der
Entwicklung: Fehlten die Twilio-Angaben, schrieb das Programm den
**Anmeldecode im Klartext ins Serverprotokoll** und meldete dem Benutzer
trotzdem „Code gesendet".

Zwei Fehler auf einmal. Ein zweiter Faktor, den man im Protokoll nachschlagen
kann, ist keiner — und bei Railway liest das jeder mit Projektzugang. Und wer
auf die SMS wartete, suchte den Fehler bei seinem Telefon.

Ist behoben: In der Entwicklung bleibt die Konsole, im Betrieb wird nichts
verschickt, **nichts protokolliert** und ehrlich ein Fehler gemeldet. Acht
Tests halten das fest.

**Für dich heißt das nichts** — es konnte niemanden treffen, weil der Faktor
nie eingeschaltet war. Aber es hätte, sobald du ihn einschaltest.

### Anthropic: Da gibt es nichts zu unterschreiben

**Berichtigt am 18.10.** Hier stand „offen" und daneben die Aufgabe, eine
Nutzung zum Training vertraglich auszuschließen. Beides war falsch.

Nachgesehen bei Anthropic selbst: Der Vertrag ist in die Commercial Terms
**eingebunden** — *„When you accept Anthropic's Commercial Terms of Service,
you also accept our DPA."* Die Standardvertragsklauseln gelten als
geschlossen. Mit dem Anlegen des Zugangs ist er in Kraft.

Und das Training ist bereits ausgeschlossen: Die Commercial Terms sagen,
Anthropic *„may not train models on Customer Content from Services"* — das
umfasst Ein- und Ausgaben.

**Was trotzdem zu tun ist, und zwar für alle fertigen Verträge:** den Vertrag
als PDF mit Datum ablegen. Ein Vertrag, der nur als Webseite existiert, ist in
zwei Jahren ein toter Link. Bei Anthropic zusätzlich die
**Unterauftragnehmerliste** (anthropic.com/subprocessors) — es gibt 15 Tage
Widerspruchsfrist bei neuen Einträgen.

### Twilio: Da haben wir gar nichts — und das ist die Antwort

**Nachgesehen am 18.10.** Der SMS-Zweitfaktor ist gebaut, aber **nicht
eingeschaltet**: Es gibt kein Twilio-Konto, keine Zugangsdaten, und die drei
nötigen Variablen stehen nirgends. Es fließt heute keine einzige
Telefonnummer dorthin. **Ohne Verarbeitung gibt es nichts zu vereinbaren** —
du musst dort also nichts abschließen.

Der Eintrag bleibt trotzdem im Verzeichnis stehen, mit genau diesem Vermerk.
Wer die Variablen eines Tages setzt, schaltet damit eine Übermittlung in die
USA ein, und der Vertrag gehört **vorher** geschlossen.

> **Dabei ist mir ein echter Fehler aufgefallen** — siehe unten unter
> „Was ich nebenbei behoben habe".

### Die zwei offenen

**Es sind nur noch zwei: Resend und Google.** Resend zuerst — dort gehen
Lohnbelege per E-Mail hinaus, das ist nach Railway die zweite Stelle, an der
es wirklich um Personaldaten geht. Google hat bis zum Firebase-Projekt ohnehin
Zeit.

Bei Resend gehört dazu: entweder der Anbieter ist nach dem **EU-US Data
Privacy Framework** zertifiziert (dann prüfen und den Eintrag aufbewahren),
oder es braucht **Standardvertragsklauseln** samt Folgenabschätzung.

> Anthropic stützt sich ausdrücklich **nicht** auf das Framework, sondern auf
> die Standardvertragsklauseln (Modul 2). Eine Folgenabschätzung für die
> Übermittlung bleibt dort also nötig — das ist eine Seite, kein Projekt.

> Solange ein Vertrag auf „offen" steht, sagt das Verzeichnis das dem Kunden —
> genauso wie das Impressum sagt, wenn eine Pflichtangabe fehlt. Nach jedem
> abgeschlossenen AVV den Stand in `dsgvo-verzeichnis.ts` umstellen; schick mir
> einfach, welcher durch ist.

---

## 4 · Die Website — ✅ fertig

**Abgeschlossen am 08.10.2026.** `okun-workforce.com` steht: Startseite mit
Hintergrundbild, „Alles, was Personal ausmacht" mit allen 95 Funktionen,
Kontakt mit Formular, Impressum und Datenschutz. Die Texte sind deine und
liegen in `src/lib/website-inhalt.ts` — wer sie ändern will, ändert diese eine
Datei, keinen Code.

Entschieden ist damit auch: keine Selbstregistrierung, keine Preise auf der
Seite, Kontakt über Formular und E-Mail.

Gemacht wurde zuletzt: die Überschriftenschrift auf **Manrope** (die
nächstgelegene frei lizenzierbare Schrift zum Schriftzug, nachgemessen —
`npm run schrift:messen`), die drei Hintergrundbilder in den beiden Aufmachern
und im Schlusskasten, und eine Prüfung, die nachrechnet, ob der Text darauf
lesbar bleibt — bei Bildschirm- und bei Telefonbreite.

### Zwei Kleinigkeiten, falls sie dir mal über den Weg laufen

Nichts davon hält etwas auf. Beides sind Verbesserungen, keine Lücken.

- [ ] **Das Logo als freigestellte SVG.** Die jetzige Fassung ist aus deinem
      Bild gerechnet und funktioniert überall. Mit Vektoren würde die Fassung
      für dunklen Grund exakt statt berechnet, und das Logo ließe sich groß
      drucken — für Messestand, Briefbogen, Fahrzeugbeschriftung.
- [ ] **Beim Gestalter fragen, wie die Schrift heißt** — und ob eine
      **Weblizenz** dabei ist. Ohne die darf sie nicht auf die Website. Wenn
      ja, ist der Austausch zwei Zeilen Code.

### Was dabei offen geblieben ist — aber nicht an der Website hängt
- [ ] **Darf ein Kunde namentlich genannt werden?** — Gemeint ist: Auf der
      Website steht nirgends, wer das Programm benutzt. Ein echter Name
      („Kita Sonnenschein, Potsdam, seit Januar 2026") überzeugt mehr als
      jeder Satz, den wir über uns selbst schreiben. Nur kann ich das nicht
      entscheiden und auch nicht ohne Erlaubnis hinschreiben: Der Name eines
      Betriebs mitsamt der Aussage „führt hier seine Personaldaten" ist eine
      Veröffentlichung über ihn, nicht über uns.

      **Was ich von dir bräuchte:** eine kurze schriftliche Zustimmung des
      Kunden — eine E-Mail genügt, in der steht, dass er mit Namen, Ort und
      Art der Einrichtung genannt werden darf, und was genau dort stehen
      soll. Am besten gleich mit einem Satz von ihm, den wir zitieren können.

      **Falls er nicht will** (völlig normal, gerade bei Trägern): Dann geht
      es auch ohne Namen — „eine Kita mit acht Gruppen in Brandenburg", „eine
      Wohngruppe mit fünf Bewohnern". Das trägt den Nachweis, dass es im Echten
      läuft, und nennt niemanden. Auf der Seite steht derzeit keine Variante
      von beidem; sag mir, welche es sein soll.
- [ ] **Die alten Planungsprofil-Felder auch aus der Datenbank löschen?**
      Kinder-Abholzeiten, Wochenend-Vereinbarung, Folgetage und
      Planungsnotiz sind seit §200 aus der Maske entfernt — sie sind nie in
      einen Plan geflossen. In der Datenbank stehen sie noch, mit allem, was
      je eingetragen wurde. Löschen hieße: Was dort steht, ist weg, auch in
      der Produktion. Das mache ich nur auf dein ausdrückliches Ja. Bis dahin
      stört es nicht: Geschrieben wird es nicht mehr, gelesen nur noch von der
      DSGVO-Auskunft — die muss nennen, was gespeichert ist.
- [ ] **Die alten Zeitbuchungen nachrechnen?** Bis §206 hatte `totalMinutes`
      drei verschiedene Bedeutungen: Beim Stempeln war es die Zeit **ohne**
      Pause, bei einer Korrektur und beim Nachtragen **mit** — und sechzehn
      Stellen in der Anzeige haben die Pause noch einmal abgezogen. Korrigierte
      Buchungen wurden dadurch **zu hoch** bezahlt, gestempelte zu niedrig
      angezeigt, auch im §16-ArbZG-Nachweis. Die Rechnung selbst ist seit §206
      eindeutig; **was vorher in der Datenbank steht, ist unverändert falsch.**

      Das lässt sich nachrechnen. Aber es ändert bezahlte Beträge, und zwar in
      der Produktion — **das mache ich nur auf dein ausdrückliches Ja.** Vorher
      zeige ich dir eine Liste: welche Buchungen, welcher Monat, welche
      Differenz, und ob jemand zu viel oder zu wenig bekommen hat. Sag Bescheid,
      dann rechne ich sie dir zuerst aus, ohne etwas zu ändern.
- [ ] **Die Download-Seite für das Windows-Programm.** Die baue ich, sobald
      das Zertifikat da ist — eine unsignierte Datei zum Herunterladen
      anzubieten, schreckt mehr Leute ab, als sie überzeugt. Hängt also am
      Zertifikat, nicht an der Website.

---

## 4b · Der Testkunde Wohngruppe — gestrichen am 21.10.

Hier standen drei Punkte: zehn E-Mail-Adressen eintragen, zwei geschätzte
Angaben bestätigen, die Fixtermine der Leitung nachtragen. **Alle drei sind
weg** — du hast klargestellt, dass die Wohngruppe ein Regelpaket zum
Ausprobieren war, mit dem du nachsehen wolltest, ob die Dienstpläne stimmen.

Es wartet dort also kein Betrieb. Kunde, Standort, die 18 Dienstzeiten und die
zehn Profile bleiben als Testdaten im System stehen; das Regelpaket ist
gerechnet (Score 98) und taugt weiter als Vorführung. Wird daraus doch ein
echter Kunde, kommen die drei Punkte zurück.

> **Der Weg für echte Kunden bleibt derselbe** und steht nicht mehr auf dieser
> Liste, sondern in `UEBERGABE-KUNDEN.md`: Mitarbeiter öffnen → Kasten
> „Zugang zur App" → „Adresse eintragen" → „Ändern und einladen". Ohne Adresse
> lehnt das Programm die Einladung ab und sagt, was zu tun ist.

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

### 🟢 Die zwei Anfragen verschicken (ITSG, ELSTER)
Für die Entscheidung, ob wir das Meldewesen selbst machen. **Beide Briefe
stehen fertig in `ANFRAGEN.md`.** Die dritte Anfrage — der Steuerberater —
ist inzwischen nach oben gewandert, weil sie den ersten Kunden blockiert.

Hintergrund und die Entscheidung dahinter: `LOHN-ZERTIFIZIERUNG.md`.

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

1. `google-services.json` einbauen, **sobald das Play-Konto steht** — vorher
   bringt Firebase nichts, was der Weg über den Browser nicht schon kann.
   (Wenn du es trotzdem früher auf dem Telefon haben willst: Firebase-Projekt
   anlegen, `google-services.json` an mich, dann schicke ich dir die fertige
   `.apk` — ohne Store, ohne Konto.)
2. **Den macOS-Läufer bei GitHub Actions einrichten**, sobald das
   Apple-Konto steht. Damit braucht niemand einen Mac zu kaufen.
3. Die **Seite zum Herunterladen** bauen, sobald die .exe signiert ist.
4. **Die SVG einbauen**, falls sie noch kommt — der Weg steht
   (`logo:aufbauen` → `logo:negativ`), eine Sache von Minuten.
5. Die **AVV-Stände** in `dsgvo-verzeichnis.ts` umstellen, sobald du mir
   sagst, welcher Vertrag durch ist.

---

## Schon erledigt

- [x] Insolvenzgeldumlage 2026, Pfändungsfreigrenzen, Mindestlohn
      nachgeschlagen (26.09.) — **zwei Pfändungstabellen waren falsch** und
      sind korrigiert
