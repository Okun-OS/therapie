# Anfragen zum Abschicken

Fertige Texte. Kopieren, Anrede prüfen, abschicken. Nichts davon muss
umformuliert werden.

> **Wen anschreiben?** Das steht in `SUCHAUFTRAEGE.md` — dort liegen die
> Suchaufträge für ChatGPT, mit denen sich passende Kanzleien und die
> zuständigen Stellen finden lassen. Hier stehen nur die Briefe selbst.

> Absender überall: **OKUN Systems UG (haftungsbeschränkt)**, Potsdamer Platz 1,
> 10785 Berlin, vertreten durch Felix Okun, kontakt@okun-systems.com,
> Amtsgericht Charlottenburg HRB 292175 B.

---

## 1 · Steuerberater — die Abrechnung gegenzeichnen lassen

**Das ist der wichtigste Brief auf dieser Seite.** Er blockiert den ersten
echten Kunden.

Dass man so etwas fragt, ist nicht unüblich: Es ist eine *prüferische
Durchsicht*, ein ganz normales Mandat, abgerechnet nach Zeit. Was zählt, ist
die **schriftliche** Bestätigung — das ist der Unterschied zwischen „hat mal
draufgeschaut" und „jemand mit Berufshaftpflicht steht dafür ein".

**An:** einen Steuerberater mit Schwerpunkt Lohn, oder ein Lohnbüro
**Betreff:** Prüferische Durchsicht einer Entgeltabrechnung — Mandatsanfrage

> Sehr geehrte Damen und Herren,
>
> wir sind ein Softwarehaus aus Berlin und haben eine Personalsoftware
> entwickelt, die neben Dienstplanung und Zeiterfassung auch die
> Entgeltabrechnung rechnet.
>
> Bevor wir damit zu einem Kunden gehen, möchten wir, dass ein Steuerberater
> die Ergebnisse unabhängig nachrechnet. Konkret geht es um:
>
> * **einen vollständigen Abrechnungsmonat** für eine überschaubare Zahl von
>   Beschäftigten (etwa zehn bis zwanzig), inklusive Lohnsteuer,
>   Sozialversicherung, Umlagen U1/U2 und Zuschlägen,
> * eine **schriftliche Rückmeldung**, ob die errechneten Beträge zutreffen,
>   und wo nicht, an welcher Stelle und warum.
>
> Wir liefern Ihnen dazu die Abrechnung als PDF, die Lohnkonten und auf Wunsch
> die Eingangsdaten in jedem Format, das Ihnen die Arbeit erleichtert.
>
> Drei Fragen vorab:
>
> 1. Übernehmen Sie eine solche prüferische Durchsicht, und in welchem Rahmen
>    (Honorar nach Zeit oder Pauschale)?
> 2. Welche Unterlagen brauchen Sie von uns, damit die Prüfung belastbar ist?
> 3. Wären Sie bereit, uns die Bestätigung schriftlich zu geben, sodass wir sie
>    gegenüber einem Kunden als Nachweis verwenden dürfen?
>
> Für Rückfragen stehe ich jederzeit zur Verfügung.
>
> Mit freundlichen Grüßen
> Felix Okun
> OKUN Systems UG (haftungsbeschränkt)

### Gleich mitfragen — spart einen zweiten Brief

Der Steuerberater sieht ELStAM-Änderungslisten täglich. Häng diese Absätze an:

> Zwei Dinge würden uns darüber hinaus helfen:
>
> 4. Könnten Sie uns eine **anonymisierte ELStAM-Änderungsliste** als
>    Beispieldatei überlassen? Unser Importverfahren ist gebaut, aber bisher
>    nur gegen nachgebaute Dateien geprüft. Uns geht es ausschließlich um das
>    Dateiformat, nicht um Inhalte.
> 5. Könnten Sie die **Aufbewahrungsfristen** bestätigen, die wir im Programm
>    hinterlegt haben? Wir legen sie als ein Blatt bei: sieben Fristen aus dem
>    Steuer- und Sozialversicherungsrecht, jeweils mit Fundstelle, dazu zehn
>    Datenarten, bei denen wir löschen. Zum Gegenlesen und Abhaken.

> **Warum Frage 4 hierher gehört:** Eine echte Änderungsliste entsteht nur in
> einem laufenden Arbeitgeberverhältnis. Entweder du wartest auf den ersten
> Kunden — oder du fragst jemanden, der sie ohnehin täglich sieht. Anonymisiert
> reicht völlig; gebraucht wird nur das Format.

### 🔴 Berichtigung zu Frage 5 — nachschicken

**Hier stand „Es sind vier", und das ist falsch.** Es sind **zehn Fristen**, und
außerdem zehn Datenarten, bei denen das Programm löscht statt aufzubewahren.
„Vier" war die Zahl der verschiedenen *Jahreszahlen* (2, 3, 6 und 10 Jahre) —
nicht die Zahl der Zeilen. Nachgezählt im Katalog selbst (20 Datenarten).

Falls der Brief mit „vier" schon heraus ist: Das ist kein Beinbruch, aber es
gehört richtiggestellt, **bevor** eine Unterschrift darunter kommt. Ein Satz
genügt:

> Nachtrag zu Frage 5: Die Zahl „vier" in meiner Anfrage war die Zahl der
> verschiedenen Fristlängen, nicht die der Positionen. Tatsächlich sind es
> zehn Fristen, dazu zehn Datenarten, bei denen wir löschen. Ich lege das
> vollständige Blatt bei; der Umfang bleibt eine Seite plus Erläuterungen.

**Das Blatt selbst liegt jetzt bereit:** `AUFBEWAHRUNGSFRISTEN.md`. Es wird aus
dem Katalog gerechnet (`npm run fristen:blatt`), nicht von Hand geschrieben —
damit kann es gar nicht erst etwas anderes behaupten als das Programm tut. Es
ist in drei Blöcke geteilt, und die Teilung ist der Punkt: **Block A** (sieben
Fristen) ist das, wofür ein Steuerberater einstehen kann, **Block B** (drei
Fristen) nicht — dazu unten, Abschnitt 4.

---

## 2 · ITSG — Systemuntersuchung

Für die Entscheidung, ob OKUN die SV-Meldungen **selbst** macht. Bis dahin
läuft das über den Steuerberater, und das ist in Ordnung — siehe
`LOHN-ZERTIFIZIERUNG.md`.

**An:** ITSG GmbH, Systemuntersuchung von Entgeltabrechnungsprogrammen
**Betreff:** Systemuntersuchung — Anfrage zu Ablauf, Dauer und Kosten

> Sehr geehrte Damen und Herren,
>
> wir entwickeln eine Personalsoftware mit integrierter Entgeltabrechnung und
> prüfen derzeit, ob wir die Meldeverfahren zur Sozialversicherung selbst
> abbilden oder über einen Steuerberater abwickeln lassen. Für diese
> Entscheidung fehlen uns belastbare Zahlen.
>
> Wir bitten Sie um Auskunft zu folgenden Punkten:
>
> 1. Was kostet die **erstmalige** Systemuntersuchung eines
>    Entgeltabrechnungsprogramms, was die **jährliche Wiederholung**?
> 2. Wie lange dauert eine Erstprüfung vom Antrag bis zum Zertifikat?
> 3. Zu welchem **Stichtag** muss die Wiederholungsprüfung jedes Jahr
>    vorliegen?
> 4. Welche Meldeverfahren muss ein Programm **mindestens** abdecken, um
>    geprüft werden zu können — ist ein Teilumfang möglich?
> 5. Was kostet das **Trust-Center-Zertifikat** für die Übermittlung, und
>    welche Laufzeit hat es?
> 6. Gibt es Anforderungen an das Unternehmen selbst — Rechtsform, Nachweise,
>    Berufshaftpflicht?
>
> Vielen Dank im Voraus.
>
> Mit freundlichen Grüßen
> Felix Okun
> OKUN Systems UG (haftungsbeschränkt)

---

## 3 · ELSTER-Entwicklerbetreuung — ERiC

**An:** ELSTER-Entwicklerbetreuung (über das Entwicklerportal von ELSTER)
**Betreff:** ERiC für ELStAM, Lohnsteueranmeldung und Lohnsteuerbescheinigung

> Sehr geehrte Damen und Herren,
>
> wir entwickeln eine Personalsoftware mit integrierter Entgeltabrechnung und
> möchten die steuerlichen Meldeverfahren künftig direkt aus dem Programm
> übermitteln.
>
> Wir bitten um Auskunft zu folgenden Punkten:
>
> 1. Welche Schritte sind nötig, um **ERiC** für die Verfahren **ELStAM**,
>    **Lohnsteueranmeldung** und **elektronische Lohnsteuerbescheinigung** zu
>    beziehen und produktiv einzusetzen?
> 2. Fallen dafür Gebühren an?
> 3. Wie lange dauert die Freischaltung für den Produktivbetrieb
>    erfahrungsgemäß?
> 4. In welchem Rhythmus erscheinen neue ERiC-Versionen, und wie lange sind
>    ältere Versionen produktiv zulässig?
> 5. Welche Anforderungen bestehen an das **Organisationszertifikat** und
>    dessen Laufzeit?
>
> Vielen Dank im Voraus.
>
> Mit freundlichen Grüßen
> Felix Okun
> OKUN Systems UG (haftungsbeschränkt)

---

## 4 · Datenschutzbeauftragter oder Fachanwalt — Block B gegenzeichnen

**Warum dieser Brief überhaupt nötig ist, obwohl der Steuerberater schon
gefragt ist:** Drei der zehn Fristen folgen nicht aus dem Steuerrecht. Sie
stehen im Arbeitszeitgesetz, im Mindestlohngesetz und in der DSGVO selbst.
Dafür steht ein Steuerberater nicht ein — er wird freundlich nicken und hat
dann trotzdem nichts bestätigt, was im Streitfall trägt. Seine
Berufshaftpflicht deckt Steuer- und Sozialversicherungsrecht, nicht Art. 5
Abs. 2 DSGVO.

**An:** einen externen Datenschutzbeauftragten oder einen Fachanwalt für
IT-Recht bzw. Arbeitsrecht
**Betreff:** Kurzmandat — Prüfung von Lösch- und Aufbewahrungsfristen einer
Personalsoftware

> Sehr geehrte Damen und Herren,
>
> wir sind ein Softwarehaus aus Berlin und betreiben eine Personalsoftware
> (Dienstplanung, Zeiterfassung, Entgeltabrechnung), die bei Kunden als
> Auftragsverarbeiter eingesetzt wird.
>
> Die Software löscht beim Ausscheiden einer beschäftigten Person nicht
> pauschal, sondern entscheidet je Datenart: löschen, anonymisieren oder nach
> Art. 18 DSGVO sperren, bis eine gesetzliche Aufbewahrungsfrist abgelaufen
> ist. Diese Entscheidungen sind dokumentiert und jeweils mit Fundstelle
> belegt, aber nicht anwaltlich geprüft.
>
> Der steuer- und sozialversicherungsrechtliche Teil ist bei einem
> Steuerberater in Prüfung. Uns geht es hier um den übrigen Teil:
>
> 1. **Arbeitszeitnachweise** — zwei Jahre, gestützt auf §16 Abs. 2 ArbZG und
>    §17 MiLoG.
> 2. **Nachweise über erfolgte Unterweisungen** — drei Jahre gesperrt,
>    gestützt auf Art. 17 Abs. 3 lit. e DSGVO und die Regelverjährung.
> 3. **Zugriffsprotokolle** — drei Jahre, gestützt auf die
>    Rechenschaftspflicht (Art. 5 Abs. 2 DSGVO).
> 4. **Bewerbungsunterlagen** — sechs Monate nach Abschluss des Verfahrens,
>    gestützt auf §15 Abs. 4 AGG.
> 5. **Zehn weitere Datenarten, die wir vollständig löschen** — darunter
>    Angaben zum betrieblichen Eingliederungsmanagement. Hier ist die Frage
>    nicht, ob wir zu lange aufbewahren, sondern ob wir zu früh löschen.
>
> Wir legen das vollständige Blatt bei; es ist eine Seite Tabelle mit
> Erläuterungen. Gebeten wird um eine **schriftliche Bestätigung**, dass die
> Fristen und Fundstellen zutreffen, oder um den Hinweis, welche Frist richtig
> wäre und warum.
>
> Zwei Fragen vorab:
>
> * Übernehmen Sie ein solches Kurzmandat, und in welchem Rahmen?
> * Dürfen wir die Bestätigung unseren Kunden gegenüber als Nachweis
>   verwenden?
>
> Mit freundlichen Grüßen
> Felix Okun
> OKUN Systems UG (haftungsbeschränkt)

### Wenn ohnehin jemand draufschaut — eine Frage mitnehmen

Für die Übermittlung an Anthropic und Resend in die USA fehlt noch eine
Folgenabschätzung (Transfer Impact Assessment). Das ist eine Seite, kein
Projekt, und wer gerade im Mandat ist, macht sie mit:

> Darüber hinaus: Wir übermitteln an zwei Dienstleister in die USA, in beiden
> Fällen auf Grundlage der Standardvertragsklauseln (Modul 2). Könnten Sie uns
> eine kurze Folgenabschätzung für diese Übermittlungen erstellen oder die
> von uns entworfene gegenlesen?

> **Was dieser Brief NICHT ist:** eine Anfrage, einen Datenschutzbeauftragten
> zu bestellen. Pflicht ist das erst ab 20 Personen (§38 BDSG) — ihr seid
> weit darunter. Gefragt ist eine einmalige Durchsicht, kein Dauermandat.

---

## 5 · Versicherungsmakler — Vermögensschadenhaftpflicht

**Nicht direkt bei einem Versicherer anfragen, sondern bei einem Makler mit
Schwerpunkt IT.** Der Grund ist nicht der Preis, sondern die
Tätigkeitsbeschreibung: Ob „Entgeltabrechnung" im Vertrag steht oder nicht,
entscheidet über genau den Schaden, um den es hier geht — und das verhandelt
ein Makler, kein Formular.

**Die Begründung im Einzelnen und alle Fallen stehen in `VERSICHERUNG.md`.**
Dieser Brief ist nur der Anfang davon.

**An:** einen Versicherungsmakler für IT- und Technologieunternehmen
**Betreff:** IT-Haftpflicht mit Vermögensschadendeckung — Angebotsanfrage,
Softwarehaus mit Entgeltabrechnung

> Sehr geehrte Damen und Herren,
>
> wir sind die OKUN Systems UG (haftungsbeschränkt) aus Berlin, ein
> Softwarehaus mit derzeit einem Geschäftsführer und ohne Angestellte. Wir
> entwickeln und betreiben eine Personalsoftware, die unsere Kunden selbst
> bedienen: Dienstplanung, Zeiterfassung und **Entgeltabrechnung**. Die
> Software läuft als Mietmodell (SaaS) auf Servern in der EU; die Kunden sind
> kleine und mittlere Betriebe, überwiegend aus dem Sozial- und
> Bildungsbereich.
>
> Wir suchen eine Haftpflichtversicherung, die **echte Vermögensschäden**
> abdeckt. Der Schaden, der uns realistisch trifft, ist nicht ein zerstörter
> Gegenstand, sondern ein falsch gerechneter Beitrag: eine Nachforderung bei
> einer Betriebsprüfung, ein Säumniszuschlag, eine verspätete Meldung.
>
> Bitte beantworten Sie uns vor einem Angebot die folgenden Punkte
> **schriftlich** — sie entscheiden darüber, ob eine Police für uns überhaupt
> etwas wert ist:
>
> 1. Steht in der versicherten Tätigkeit ausdrücklich **„Entwicklung und
>    Betrieb von Software zur Personalverwaltung einschließlich
>    Entgeltabrechnung"**? Falls nicht: Welche Formulierung schließt diesen
>    Bereich ein?
> 2. Enthält die Police einen **Ausschluss für Lohn-, Finanzbuchhaltung oder
>    Steuerberatung**? Wenn ja, in welchem Wortlaut, und greift er auch dann,
>    wenn nicht wir, sondern der Kunde die Abrechnung auslöst?
> 3. Gilt die Deckung nach dem **Verstoßprinzip** oder dem
>    **Anspruchserhebungsprinzip** („claims made")?
> 4. Wie lang ist die **Nachhaftung**, und gibt es
>    **Rückwärtsdeckung** für Pflichtverletzungen aus der Zeit vor
>    Vertragsbeginn, die noch niemandem aufgefallen sind?
> 5. Welche **Deckungssumme** empfehlen Sie für diese Tätigkeit, und wie oft
>    steht sie im Jahr zur Verfügung (Maximierung)?
> 6. Sind **Datenschutzverstöße** mitversichert, und zwar getrennt nach
>    Ansprüchen Betroffener (Art. 82 DSGVO), Bußgeldern und den Kosten eines
>    Datenschutzvorfalls?
> 7. Ist **Mangelbeseitigung** (Nacherfüllung, Nachprogrammierung)
>    ausgeschlossen? Wir gehen davon aus — bitte bestätigen Sie es, damit wir
>    nicht damit rechnen.
> 8. Welche Anforderungen stellt der Versicherer an **unsere eigenen
>    Verträge**, insbesondere an eine Haftungsbegrenzung in unseren AGB? Wir
>    möchten unsere Verträge an die Police anpassen, nicht umgekehrt.
> 9. Verlangt der Versicherer Nachweise über **Qualitätssicherung**? Wir
>    können eine automatisierte Prüfstrecke und eine unabhängige Durchsicht
>    unserer Abrechnungsergebnisse durch einen Steuerberater belegen.
>
> Über eine Einschätzung und ein Angebot würden wir uns freuen.
>
> Mit freundlichen Grüßen
> Felix Okun
> OKUN Systems UG (haftungsbeschränkt)

> **Punkt 9 ist kein Angeberei-Satz**, sondern ein Preisargument: Eine
> gegengezeichnete Abrechnung und eine Prüfstrecke sind genau das, was ein
> Risikoprüfer sehen will. Darum lohnt es, diesen Brief **nach** der Antwort
> des Steuerberaters zu schicken — nicht davor.

---

## Was mit den Antworten passiert

Schick sie mir, dann trage ich die Zahlen in `LOHN-ZERTIFIZIERUNG.md` ein. Dort
steht die Entscheidung schon vorbereitet — sie hängt an zwei Fragen, und keine
davon ist die Gebühr:

1. **Wie viele Kunden?** Der Monatsschritt bei ELStAM kostet je Kunde ein paar
   Minuten. Bei drei Kunden ist das nichts, bei dreißig ist es eine Stelle.
2. **Ist Lohnabrechnung ein Produkt oder Beiwerk?** Beiwerk zur Dienstplanung
   verträgt keine jährliche Systemprüfung. Ein eigenes Produkt schon — dann
   trägt es sie auch.

Solange die Antwort auf 2 „Beiwerk" lautet, ist der heutige Weg über den
Steuerberater der richtige, und die Anfragen 2 und 3 sind reine Vorbereitung.
