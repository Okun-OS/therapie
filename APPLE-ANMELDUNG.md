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

**Eine Apple-ID mit einer Adresse auf `okun-systems.com`** — zum Beispiel
`felix.okun@okun-systems.com` oder `apple@okun-systems.com`. Apple schreibt:
*„Your work email address needs to be associated with your organization's
domain name."*

Eine private Adresse (gmail, icloud) geht zwar technisch, führt aber zu
Rückfragen und Verzögerung.

> **Nicht die persönliche Apple-ID vom iPhone nehmen.** Diese ID wird der
> *Account Holder* des Firmenkontos: Sie besitzt die App, die Verträge und
> die Auszahlungen. Sie sollte der Firma gehören und nicht an einem privaten
> Gerät hängen — und sie muss bleiben, wenn später jemand anderes die App
> betreut.

---

## Schritt 1 — Die D-U-N-S-Nummer gegen Apples Datenbestand prüfen

**https://developer.apple.com/enroll/duns-lookup/**

Dort die Firmendaten eingeben und nachsehen, was Dun & Bradstreet über die
OKUN Systems UG gespeichert hat.

**Worauf es ankommt:** Der Firmenname muss dort **genau** so stehen wie im
Handelsregister — `OKUN Systems UG (haftungsbeschränkt)`. Nicht „OKUN
Systems", nicht „Okun Systems UG". Apple gleicht ab; weicht es ab, bleibt die
Anmeldung liegen, ohne dass jemand sagt warum.

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

- **Legal Entity Name**: `OKUN Systems UG (haftungsbeschränkt)` — genau wie
  in der D-U-N-S-Datenbank. Dieser Name erscheint später im App Store als
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

## Schritt 6 — Bezahlen

99 USD, in Euro abgerechnet, per Kreditkarte. **Die Mitgliedschaft verlängert
sich jährlich automatisch.**

> Läuft sie aus, verschwindet die App aus dem Store — nicht sofort, aber sie
> verschwindet. Der Tag sollte im Kalender stehen.

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

## Schritt 8 — Die Verträge annehmen

Nach der Freischaltung: **https://appstoreconnect.apple.com** →
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
2. **Der Name in der Apple-ID ist nicht der echte Name.** Siehe Schritt 0.1.
   Apple nennt das selbst als Verzögerungsgrund.
3. **Der Firmenname weicht vom D-U-N-S-Eintrag ab.** Ein fehlendes
   „(haftungsbeschränkt)" genügt.
4. **„Individual" statt „Organization" gewählt.** Lässt sich nicht umstellen.

---

## Was NICHT nötig ist

- **Kein Mac.** Weder für die Anmeldung noch später für den Bau — dafür
  richte ich einen macOS-Läufer bei GitHub Actions ein.
- **Keine fertige App.** Die Anmeldung läuft unabhängig davon.
- **Keine Umsatzsteuer-ID.** Sie wird im Impressum noch nachgereicht; Apple
  fragt im Anmeldeverfahren nicht danach. Für die Steuerdaten in App Store
  Connect (Schritt 8) wird sie allerdings gebraucht — spätestens dann sollte
  sie da sein.
