# Apple Developer Program — Schritt für Schritt

Was zu tun ist, bis OKUN Systems bei Apple als Entwickler eingetragen ist.
Danach kann die App eingereicht werden; bis dahin geht es nicht, und zwar
unabhängig davon, wie fertig sie ist.

Stand: **30.10.2026**. Alle Angaben unten sind an diesem Tag gegen Apples
eigene Seiten geprüft — nicht aus dem Gedächtnis geschrieben. Die Links sind
die, die Apple selbst verwendet.

Kosten: **99 USD im Jahr**, in Euro abgerechnet. Dauer: **wenige Tage bis
zwei Wochen**, abhängig davon, wie schnell Apple den Rückruf schafft.

---

## Vorweg: Was bereitliegen muss

Alles davon ist vorhanden — nachgesehen am 30.10.2026 auf
`okun-systems.com/impressum` und `okun-workforce.com/impressum`:

| Was Apple fragt | Ihr Wert |
|---|---|
| Rechtsform und Firmenname | **OKUN Systems UG (haftungsbeschränkt)** |
| Anschrift | Potsdamer Platz 1, 10785 Berlin |
| Handelsregister | Amtsgericht Charlottenburg (Berlin), HRB 292175 B |
| Telefon (Apple ruft dort an) | **030 13883330** — steht öffentlich im Impressum |
| Website der Organisation | **https://okun-systems.com** |
| Arbeits-E-Mail auf der Firmendomain | …@okun-systems.com |
| D-U-N-S-Nummer | liegt vor |

> **Warum `okun-systems.com` und nicht `okun-workforce.com`:** Apple fragt
> nach der Website der ORGANISATION, nicht nach der des Produkts, und
> verlangt, dass die Domain zur Organisation gehört und die Seite echten
> Inhalt hat — „Links zu sozialen Netzwerken oder Seiten mit minimalem Inhalt
> werden nicht akzeptiert". `okun-systems.com` erfüllt das: Nachgesehen am
> 30.10.2026, eine vollständige Firmenseite mit Impressum und Telefonnummer.

---

## Schritt 0 — Die beiden Dinge, an denen es am häufigsten scheitert

**Diese zwei Minuten sparen im Zweifel zwei Wochen.** Beides lässt sich
hinterher nur mit Verzögerung korrigieren.

### 0.1 Der Name in der Apple-ID muss der echte Name sein

Öffnen: **https://account.apple.com** → *Persönliche Daten*

Dort muss stehen: **Vorname `Felix`, Nachname `Okun`** — der Name aus dem
Ausweis.

Apple schreibt dazu wörtlich: *„Make sure both your first and last names are
your legal names. Using an alias, nickname, or company name as your first or
last name will cause a delay in the approval of your enrollment."*

Steht dort „OKUN", „OKUN Systems" oder ein Kürzel, jetzt ändern.

### 0.2 Zwei-Faktor-Anmeldung muss an sein

Dieselbe Seite → *Anmeldung und Sicherheit* → **Zwei-Faktor-Authentifizierung
aktiviert**.

Ohne sie bricht die Anmeldung mitten im Verfahren ab. Apple verlangt sie für
Organisationen ausdrücklich.

### 0.3 Welche Apple-ID überhaupt

**Apple unterscheidet hier zwei Dinge, und ich hatte sie zuerst in einen Topf
geworfen.** Noch einmal nachgelesen am 30.10.2026 auf der Anmeldeseite:

| | Wortlaut bei Apple | Heißt |
|---|---|---|
| **Apple-ID** | *„We **recommend** that your Apple Account uses your email address from your organization."* | Empfehlung |
| **Arbeits-E-Mail im Formular** | *„Your work email address **needs to be** associated with your organization's domain name."* | Pflicht |

Also: **Die Apple-ID darf Ihre eigene bleiben.** Pflicht ist nur, dass die
Arbeits-E-Mail, die Sie IM ANMELDEFORMULAR eintragen, auf
`okun-systems.com` endet.

Eine Firmenadresse auch als Apple-ID zu nehmen, bleibt der sauberere Weg —
der Zugang hängt dann nicht an einem privaten Gerät. Aber es ist eine
Abwägung und keine Vorschrift, und die Abwägung gehört dem Eigentümer.

> **Nicht die persönliche Apple-ID vom iPhone nehmen.** Diese ID wird der
> *Account Holder* des Firmenkontos: Sie besitzt die App, die Verträge und
> die Auszahlungen. Sie sollte der Firma gehören und nicht an einem privaten
> Gerät hängen — und sie muss bleiben, wenn später jemand anderes die App
> betreut.

### 0.4 „Dann habe ich ja nicht meinen eigenen Entwickler-Zugang"

Doch. Das ist der häufigste Einwand gegen 0.3, und er beruht auf einem
Missverständnis, das die Anleitung oben nicht ausgeräumt hat. Drei Dinge,
alle am 30.10.2026 auf Apples eigenen Seiten nachgesehen:

**1. Die Firmenadresse gehört Ihnen.**
`apple@okun-systems.com` ist kein fremder Zugang — es ist ein Postfach, das
Sie einrichten und kontrollieren. „Der Firma gehörend" heißt nicht „jemand
anderem gehörend", sondern: Es hängt nicht an einem privaten Gerät und nicht
an einem privaten Vertrag. Geht das iPhone verloren oder wechselt die private
Apple-ID, bleibt der Zugang zur App bestehen.

**2. Ihre private Apple-ID kann trotzdem im Konto arbeiten.**
Ein Organisationskonto hat ein Team. Jedes Mitglied meldet sich mit SEINER
EIGENEN Apple-ID an — verwaltet wird das in App Store Connect unter *Users
and Access*. Die Rollen:

| Rolle | Darf |
|---|---|
| **Account Holder** | alles; nimmt Verträge an, verlängert die Mitgliedschaft, gibt Bankdaten frei |
| **Admin** | Menschen und Zugriffe verwalten, Apps verwalten |
| **App Manager** | Apps in App Store Connect verwalten |
| **Developer** | Zertifikate und Profile, also der technische Teil |
| **Marketing / Finance** | Store-Auftritt beziehungsweise Abrechnungen |

Sie können sich also mit Ihrer privaten Apple-ID als **Admin** ins Team
holen und vom iPhone aus arbeiten, ohne sich dort abzumelden. Der Account
Holder ist die Firmenadresse; gearbeitet wird mit der ID, die Sie ohnehin
benutzen.

**3. Die Entscheidung ist nicht endgültig.**
Die Rolle des Account Holders lässt sich später an ein anderes Teammitglied
übergeben — Apple hat dafür ein eigenes Verfahren (*Membership details →
Update your information → Transfer Account Holder role*). Voraussetzung: Die
Person ist schon im Team, hat Zwei-Faktor-Anmeldung an und darf die Firma
rechtlich binden.

**Und warum dann überhaupt eine Firmenadresse?**
Weil Apple es auf der Anmeldeseite verlangt: *„Your work email address needs
to be associated with your organization's domain name."* Eine private Adresse
führt zu Rückfragen und Verzögerung — und das ist der eine Teil des
Verfahrens, bei dem Warten nichts nützt.

> **Falls Sie schon einen Entwickler-Zugang als Einzelperson haben:** Dann
> sagen Sie es mir, bevor Sie anfangen. Ob sich ein bestehender Zugang in ein
> Firmenkonto umwandeln lässt, habe ich NICHT geprüft — Apples Seite dazu war
> am 30.10.2026 nicht erreichbar, und ich schreibe hier nichts hin, was ich
> nicht nachgesehen habe. Es gibt zwei mögliche Wege (umwandeln oder neu
> anmelden und die Apps übertragen), und welcher stimmt, sehe ich dann nach.

---

## Schritt 1 — Die D-U-N-S-Nummer gegen Apples Datenbestand prüfen

**https://developer.apple.com/enroll/duns-lookup/**

Dort die Firmendaten eingeben und nachsehen, was Dun & Bradstreet über die
OKUN Systems UG gespeichert hat.

**Worauf es ankommt:** Der Firmenname muss **Zeichen für Zeichen so
eingetragen werden, wie er bei D&B gespeichert ist** — nicht so, wie er im
Handelsregister steht. Apple gleicht gegen D&B ab; weicht es ab, bleibt die
Anmeldung liegen, ohne dass jemand sagt warum.

> **§271 Und das heißt im Zweifel: ohne Umlaut.**
>
> Hier stand zuerst, der Name müsse „genau wie im Handelsregister" lauten,
> also `OKUN Systems UG (haftungsbeschränkt)` mit ä. Das war falsch, und der
> Eigentümer hat es gemerkt: D&B hatte ihm ausdrücklich gesagt, ihr System
> führe keine Umlaute — einzutragen sei `haftungsbeschrankt`, und
> ausdrücklich NICHT `haftungsbeschraenkt`.
>
> D&B ist ein amerikanisches System. Was dort steht, ist für Apple die
> Wahrheit, auch wenn das Handelsregister es anders schreibt. **Der Abgleich
> schlägt die Rechtschreibung.** Eine „korrigierte" Schreibweise wäre genau
> die, die hängen bleibt.
>
> Deshalb ist der Blick in die Suche oben keine Kür: Dort steht, was Apple
> erwartet.

Ebenso prüfen: Anschrift und Telefonnummer.

**Wenn etwas falsch ist:** Korrektur bei D&B über
**https://support.dnb.com/?CUST=APPLEDEV**. Rechnen Sie mit **bis zu zwei
Arbeitstagen**, bis die Änderung bei Apple ankommt. Diese zwei Tage
unbedingt abwarten — eine Anmeldung mit altem Datenbestand wird abgelehnt und
muss neu laufen.

> Falls die Nummer brandneu ist: Apple sagt, nach dem Erhalt noch **bis zu
> zwei Arbeitstage** warten, bevor man sich anmeldet. Erst dann hat Apple die
> Daten von D&B.

---

## Schritt 2 — Die Anmeldung starten

**https://developer.apple.com/programs/enroll/**

Mit der Apple-ID aus Schritt 0.3 anmelden. Dann **„Start your enrollment"**.

> Es geht auch über die **Apple-Developer-App** auf einem iPhone. Für eine
> Organisation ist der Weg über den Browser der übersichtlichere — dort sieht
> man alle Felder auf einmal.

---

## Schritt 3 — „Organization" wählen, nicht „Individual"

Apple fragt, als was Sie sich anmelden.

**Entity Type → Company / Organization.**

Das ist die eine Stelle, die sich **nicht mehr ändern lässt**, ohne von vorne
anzufangen. Als Einzelperson angemeldet stünde später im App Store „Felix
Okun" als Anbieter statt „OKUN Systems UG" — und für ein Programm, das
Gehälter rechnet, ist das der falsche Anbieter.

---

## Schritt 4 — Die Firmendaten eintragen

Aus der Tabelle oben. Wichtig dabei:

- **Legal Entity Name**: genau wie in der D-U-N-S-Datenbank — nach Auskunft
  von D&B ohne Umlaut, also `OKUN Systems UG (haftungsbeschrankt)`. Dieser Name erscheint später im App Store als
  Anbieter der App; jeder Nutzer sieht ihn.
- **Website**: `https://okun-systems.com`
- **D-U-N-S Number**: aus Schritt 1
- **Phone**: `+49 30 13883330`

---

## Schritt 5 — Bestätigen, dass Sie unterschreiben dürfen

Apple fragt, ob Sie befugt sind, die Firma rechtlich zu binden. Wörtlich:
*„You must be the organization's owner/founder, executive team member, senior
project lead, or an employee with legal authority."*

Als Geschäftsführer der UG trifft das zu. Die Frage ist ernst gemeint: Apple
prüft es beim Rückruf.

---

## Schritt 6 — Abschicken, und die Enrollment-ID notieren

Nach dem Absenden erscheint:

> **Your enrollment is being processed.**
> Enrollment ID: ………
> *„Once we verify your authority to sign legal agreements, we'll email you
> with instructions on how to complete your enrollment."*

**Die Enrollment-ID aufschreiben.** Bei jeder Rückfrage an Apple ist sie das
Erste, wonach gefragt wird.

> **§271 Hier stand zuerst „Bezahlen".** Das war die falsche Reihenfolge, und
> es ist am lebenden Fall aufgefallen (30.10.2026, Anmeldung der OKUN Systems
> UG): Bezahlt wird NICHT beim Absenden. Apple prüft zuerst und schickt dann
> erst die Anweisung zum Abschluss. Die 99 USD kommen danach — siehe
> Schritt 8.

**Und noch eines, bevor Sie die Seite verlassen:** Auf derselben Seite stehen
alle eingetragenen Angaben noch einmal untereinander. Lesen Sie sie durch,
besonders die **Website**. Apple schreibt daneben:

> *„The information on this account will be used for verification and legal
> agreements, so please make sure your information is correct. To edit your
> account information, contact us."*

Das heißt: **Ab hier ändert man nichts mehr selbst.** Ein Tippfehler in der
Adresse der Website — bei dieser Anmeldung war um ein Haar ein `.comn` stehen
geblieben — führt zur Ablehnung, und die Begründung nennt ihn nicht. Lieber
jetzt eine Mail an den Support als in zehn Tagen von vorne anfangen.

---

## Schritt 7 — Warten, und ans Telefon gehen

Apple prüft und **ruft an**, unter der Nummer aus dem D-U-N-S-Eintrag:
**030 13883330**.

Das ist der Schritt, an dem die meisten Anmeldungen liegen bleiben — nicht
weil etwas falsch war, sondern weil niemand abgenommen hat. Der Anruf kommt
aus den USA oder aus Irland und sieht nach Werbung aus.

Gefragt wird: ob es die Firma gibt, ob Sie dort arbeiten, ob Sie
unterschreiben dürfen. Drei Minuten.

**Rechnen Sie mit zwei bis vierzehn Tagen.**

---

## Schritt 8 — Bezahlen und die Verträge annehmen

Erst jetzt, und erst nach der E-Mail von Apple: **99 USD**, in Euro
abgerechnet, per Kreditkarte. **Die Mitgliedschaft verlängert sich jährlich
automatisch.**

> Läuft sie aus, verschwindet die App aus dem Store — nicht sofort, aber sie
> verschwindet. Der Tag gehört in den Kalender.

Danach: **https://appstoreconnect.apple.com** →
*Agreements, Tax, and Banking*.

Dort liegt der **Paid Applications Agreement** (auch wenn die App kostenlos
ist — er wird für vieles vorausgesetzt) sowie Steuer- und Bankdaten.

Ohne angenommene Verträge lässt sich nichts einreichen, und die Meldung dazu
nennt den Grund nicht.

---

## Was danach kommt — das mache dann ich

Sobald das Konto steht, brauche ich von Ihnen zwei Dinge aus dem
Apple-Konto. Beides erkläre ich dann Schritt für Schritt; hier nur, damit Sie
wissen, was noch kommt:

1. **Einen APNs-Schlüssel** (`.p8`) — damit Push-Nachrichten auf dem iPhone
   ankommen. Wird in Firebase hinterlegt.
2. **Einen Zugang für den Bau** — App Store Connect API-Schlüssel, damit der
   macOS-Läufer bei GitHub Actions die App bauen und hochladen kann. Dann
   braucht niemand einen Mac.

Dazu lege ich den Prüfer-Zugang mit gefüllten Testdaten an (Apple prüft ihn
wirklich — ein leerer Dienstplan ist ein Ablehnungsgrund) und trage die
Store-Texte und Bildschirmfotos ein. Beides liegt schon bereit:
`STORE-TEXTE.md` und `store/`.

---

## Die vier Fallstricke, in der Reihenfolge ihrer Häufigkeit

1. **Niemand geht ans Telefon.** Siehe Schritt 7. Der Anruf kommt
   unangekündigt und sieht nach Werbung aus.
   
   Dazu gehört auch: **das Postfach im Blick behalten**, das als Arbeits-
   E-Mail eingetragen wurde. Dort kommt die Anweisung zum Abschluss an,
   und sie landet gern im Spam.
2. **Der Name in der Apple-ID ist nicht der echte Name.** Siehe Schritt 0.1.
   Apple nennt das selbst als Verzögerungsgrund.
3. **Der Firmenname weicht vom D-U-N-S-Eintrag ab.** Ein fehlendes
   „(haftungsbeschrankt)" genügt — und ebenso ein hinzugefügter Umlaut, den
   D&B gar nicht führt. Maßgeblich ist der Datensatz, nicht das Register.
4. **„Individual" statt „Organization" gewählt.** Lässt sich nicht umstellen.

---

## Was NICHT nötig ist

- **Kein Mac** — für die Anmeldung ohnehin nicht, und für den Bau auch nicht:
  dafür richte ich einen macOS-Läufer bei GitHub Actions ein.

  > Nachtrag vom 30.10.2026: Ein Mac ist vorhanden. Damit wird der Läufer zur
  > Bequemlichkeit statt zur Notwendigkeit — er lohnt trotzdem, weil er bei
  > jeder Änderung von selbst baut und niemand daran denken muss.
- **Keine fertige App.** Die Anmeldung läuft unabhängig davon.
- **Keine Umsatzsteuer-ID.** Sie wird im Impressum noch nachgereicht; Apple
  fragt im Anmeldeverfahren nicht danach. Für die Steuerdaten in App Store
  Connect (Schritt 8) wird sie allerdings gebraucht — spätestens dann sollte
  sie da sein.
