# Deine Liste

Alles, was **nicht programmiert werden kann** — weil es ein Konto, eine
Unterschrift, einen Kauf oder eine Zahl aus einer Satzung braucht. Nach
Reihenfolge, nicht nach Bereich: Was oben steht, blockiert das meiste darunter.

> Stand: 05.10.2026 · Was fertig ist, steht in `STAND.md`.
> Zum Abhaken: `- [ ]` zu `- [x]` machen.

---

## Reihenfolge auf einen Blick

```
1. D-U-N-S-Nummer  ──beantragt──►  Apple-Konto ─► APNs-Schlüssel ─► App Store
                                               └─►  .dmg beglaubigen
2. Domain verbinden ───erledigt───►  ┐
3. Firmenangaben   ───erledigt───►  ┴─► Impressum/Datenschutz steht
4. Website steht ──────────────────►  gemeinsam schärfen ─► Download-Seite
5. Firebase        ────────────────►  Push auf Android (mit Apple auch iOS)
6. Steuerberater   ────────────────►  erster echter Kunde
7. Code-Signing    ────────────────►  Windows-Programm ohne Warnung
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

**Drei Punkte von dieser Liste gestrichen, 05.10. (von dir berichtigt):** Die
D-U-N-S-Nummer ist beantragt. Die Domain war längst verbunden — ich hatte sie
noch als offen geführt, obwohl die Anlage seit Tagen unter
`okun-workforce.com` läuft. Und die Firmenangaben stehen bei Railway; das
Impressum ist vollständig, mit HRB 292175 B. Nachgemessen am 05.10.:
`okun-workforce.com` und `/impressum` antworten mit 200, und die Seite meldet
keine fehlende Pflichtangabe mehr.

Punkt 1 hängt an Dritten und läuft. **Jetzt oben: das Zertifikat für Windows**
— die Identitätsprüfung dauert bis zu 20 Werktage, alles andere läuft daneben.

---

## 1 · Was Wochen dauert — jetzt anstoßen

### 🔴 Code-Signing-Zertifikat für Windows — jetzt der oberste Punkt
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

**Empfehlung: Azure Artifact Signing** (früher „Trusted Signing"). Der einzige
Weg, bei dem niemand Hardware verwaltet. Deutschland ist zugelassen. Gebraucht
werden ein Azure-Konto und eine **Identitätsprüfung der OKUN Systems UG — die
dauert 1 bis 20 Werktage.** Deshalb steht dieser Punkt jetzt oben.

Bereitlegen: der Firmenname genau wie im Register, die Registeranschrift, der
Handelsregisterauszug (falls nachgefragt: nicht älter als zwölf Monate) und
**zwei E-Mail-Adressen auf einer eigenen Domain**, die gelesen werden —
Bestätigungslinks verfallen nach sieben Tagen.

Alternative, falls Azure nicht geht: ein OV-Zertifikat im Cloud-Tresor bei
Sectigo, DigiCert oder SSL.com, rund 220–450 €/Jahr. EV (~300–650 €/Jahr)
lohnt nur, wenn in den ersten Wochen viele Erstinstallationen anstehen: Ein
frisches OV-Zertifikat muss sich bei SmartScreen erst einlaufen, EV
überspringt das.

**Blockiert:** die Auslieferung des Windows-Programms an Kunden. Die
Abwägung im Detail: `DESKTOP.md`, Abschnitt §187.

### 🟡 D-U-N-S-Nummer — beantragt, läuft
Dauert 1–2 Wochen. Ohne sie gibt es kein Apple Developer Program als
Organisation.

**Blockiert noch:** Apple-Konto → APNs-Schlüssel → Push auf dem iPhone → App
Store → auch das beglaubigte `.dmg` für macOS.

### ✅ Domain verbunden — `okun-workforce.com`
Steht. Die Anlage läuft darunter, `APP_URL` ist gesetzt. Wie es gemacht wurde,
bleibt in `DOMAIN.md` stehen — falls die Einträge einmal nachzusehen sind.

> Zwei Dinge hatte ich hier falsch behauptet und auf Nachfrage berichtigt:
> dass die nackte Domain ohne `app.` nicht gehe (sie geht), und dass dieser
> Punkt noch offen sei (war er nicht).

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
   hochladen — **wartet auf die D-U-N-S-Nummer**

Schritt für Schritt: `APP-STORES.md`, Teil B.

### 🟡 Apple Developer Program — 99 $/Jahr
Wartet auf die D-U-N-S-Nummer.

### 🟡 Google-Play-Entwicklerkonto — 25 $ einmalig
Geht sofort, unabhängig von allem anderen. Danach brauche ich von dir nur das
`google-services.json` aus dem Firebase-Projekt; den Rest baue ich ein.

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

### 🔴 AVVs mit den Dienstleistern
Auftragsverarbeitungsverträge. Ohne sie kein DSGVO-konformer Betrieb beim
Kunden — und sobald ein Kunde selbst einen AVV mit dir schließt, musst du ihm
diese Kette nachweisen (Art. 28 Abs. 4 DSGVO: du haftest ihm gegenüber für
deine Unterauftragnehmer).

**Es sind fünf, nicht drei.** Hier standen bis zum 05.10. nur Anthropic,
Railway und Google — der E-Mail-Versand und die SMS fehlten, und das sind
gerade die beiden mit US-Übermittlung. Maßgeblich ist das Verzeichnis im Code
(`src/lib/dsgvo-verzeichnis.ts`), nicht diese Liste; es erscheint im Programm
unter *Datenschutz → Verzeichnis*, und dort stehen **alle fünf als „Vertrag
offen"**.

Verhandeln muss man nichts, alle fünf haben ein Standarddokument zum Annehmen:

| | Wer | Wofür | Wo liegen die Daten |
|---|---|---|---|
| 1 | **Railway** | Hosting und Datenbank — hier liegt **alles** | EU |
| 2 | **Resend** | E-Mails: Einladungen, Benachrichtigungen, Lohnbelege | **USA** |
| 3 | **Twilio** | SMS für den zweiten Anmeldefaktor | **USA** |
| 4 | **Anthropic** | der Hilfe-Assistent (sieht keine Betriebsdaten) | **USA** |
| 5 | **Google** | Push an die App aus dem Store | EU, für iPhones weiter an Apple |

**Reihenfolge: 1, dann 2.** Bei Railway liegt jede Zeile, die ein Kunde
eingibt. Bei Resend gehen Lohnbelege per E-Mail hinaus — das ist die zweite
Stelle, an der es wirklich um Personaldaten geht.

Bei den drei US-Diensten gehört jeweils dazu: entweder der Anbieter ist nach
dem **EU-US Data Privacy Framework** zertifiziert (dann prüfen und den Eintrag
aufbewahren), oder es braucht **Standardvertragsklauseln** samt
Folgenabschätzung. Bei Anthropic zusätzlich: **die Nutzung der Inhalte zum
Training vertraglich ausschließen.**

> Solange ein Vertrag auf „offen" steht, sagt das Verzeichnis das dem Kunden —
> genauso wie das Impressum sagt, wenn eine Pflichtangabe fehlt. Nach jedem
> abgeschlossenen AVV den Stand in `dsgvo-verzeichnis.ts` umstellen; schick mir
> einfach, welcher durch ist.

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
- [ ] **Die Download-Seite für das Windows-Programm** fehlt noch. Sie kommt,
      sobald die .exe signiert ist — eine unsignierte Datei zum Herunterladen
      anzubieten, schreckt mehr Leute ab, als sie überzeugt.

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
