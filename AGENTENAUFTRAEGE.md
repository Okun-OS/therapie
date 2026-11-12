# Agentenaufträge für ChatGPT

Drei Aufträge, jeder für sich vollständig. **Einen pro Unterhaltung** — nicht alle
drei in einen Chat, sonst vermischt sich der Stand.

> **Der Unterschied zu `SUCHAUFTRAEGE.md`:** Dort sucht ChatGPT *Empfänger*. Hier
> ist es der Agent, der einen Vorgang **vorantreibt**: recherchieren, Formulare
> ausfüllen, E-Mails fertig schreiben, Unterlagen zusammenstellen, Stand
> nachhalten.

---

## Was ChatGPT kann und was es nicht kann

Bitte vorher lesen, sonst wartest du auf etwas, das nie kommt.

**Es kann:** Amtsquellen finden und lesen, die richtige Stelle und das richtige
Formular benennen, den Inhalt jedes Feldes vorbereiten, E-Mails und Anträge
fertig formulieren, Unterlagenlisten machen, Fristen und Reihenfolgen ordnen,
und nach jeder Antwort den Stand fortschreiben.

**Es kann nicht:** etwas rechtsverbindlich abschicken, unterschreiben, bezahlen,
sich ausweisen, ein Konto anlegen, ein Entwicklerportal registrieren oder einen
Vertrag zeichnen. Alles davon bleibt bei dir — ChatGPT legt es dir als fertigen
Schritt vor, du drückst ab.

**Zwei Regeln, die in jedem Auftrag unten stehen und die du selbst prüfen
solltest:**

1. **ChatGPT erfindet Ansprechpartner, Adressen und Gebühren**, die vollständig
   plausibel aussehen. Jede Angabe braucht eine Quelle mit Datum. Steht keine
   dabei, ist sie geraten.
2. **Keine Geheimnisse in den Chat.** Keine Steuernummer, keine Zugangsdaten,
   keine Schlüssel, keine Bankverbindung. Dafür stehen in den Aufträgen
   Platzhalter, die du erst beim Absenden ersetzt.

---

## Auftrag 1 · Stellenanzeigen überall selbst veröffentlichen

```
Du bist mein Umsetzungsagent für ein konkretes Vorhaben. Du recherchierst,
füllst aus und formulierst. Abschicken, unterschreiben und bezahlen mache
ich — du legst mir jeden Schritt fertig vor.

WER WIR SIND
OKUN Systems UG (haftungsbeschränkt), Potsdamer Platz 1, 10785 Berlin.
Vertreten durch Felix Okun. Amtsgericht Charlottenburg HRB 292175 B.
kontakt@okun-systems.com, https://okun-workforce.com
Ein Softwarehaus mit einem Geschäftsführer, ohne Angestellte.
(Steuernummer, USt-IdNr. und D-U-N-S-Nummer trage ich selbst ein — frag
danach, aber erwarte sie nicht im Chat.)

WAS WIR GEBAUT HABEN
OKUN Workforce ist eine Personalsoftware im Mietmodell (SaaS): Recruiting,
Personalakte, Dienstplanung, Zeiterfassung, Entgeltabrechnung. Wir sind
damit ein Bewerbermanagementsystem (ATS) im Sinne der Partnerprogramme
der Jobbörsen.

Vorhanden ist schon:
- Stellenverwaltung mit allen Feldern (Titel, Ort, PLZ, Umfang, Stunden,
  Befristung, Beginn, Vergütung von/bis, Beschreibung, Aufgaben, Profil,
  Wir-bieten, Ansprechpartner)
- eine Karriereseite je Kunde mit Bewerbungsformular
- schema.org/JobPosting auf jeder Anzeige (Google for Jobs)
- ein XML-Feed je Kunde unter /karriere/<kunde>/stellen.xml
- eine Bewerber-Pipeline mit Verlauf und Übernahme in die Personalakte

MEIN ZIEL
Eine Stelle wird EINMAL in OKUN geschrieben und von dort aus auf allen
relevanten Kanälen veröffentlicht, aktualisiert und beendet — und die
Bewerbungen kommen in unsere Pipeline zurück. Kein Abschreiben, kein
zweites Portal, in dem jemand pflegen muss.

DIE KANÄLE, UM DIE ES GEHT
1. Bundesagentur für Arbeit (HR-BA-XML-Schnittstelle) — hat Vorrang, weil
   kostenlos und in unserer Zielgruppe (Kitas, Wohngruppen, Pflege,
   Eingliederungshilfe) der wichtigste Kanal
2. Indeed (Partnerprogramm: Job Sync API, Indeed Apply, Disposition Sync)
3. Stepstone (JobFeed bzw. Stepstone Connect, über das Partnernetzwerk)
4. XING / onlyfy (ob es dort überhaupt eine Veröffentlichungs-API für
   Partner gibt, ist offen — bitte klären)
5. kimeta, Jobware, meinestadt, Yourfirm und vergleichbare deutsche
   Börsen: welche nehmen einen Feed oder haben eine API?
6. Ein Multiposting-Anbieter als Generalschlüssel für den langen Schwanz
   (VONQ Hiring API, Broadbean, Wollmilchsau/Jobspreader und wer sonst
   in DACH in Frage kommt)

WAS DU FÜR JEDEN KANAL HERAUSFINDEN SOLLST
a) Gibt es eine Schnittstelle zum VERÖFFENTLICHEN (nicht zum Suchen)?
   Wie heißt sie genau, welche Technik (REST, GraphQL, XML-Feed)?
b) Welches Programm ist für uns das richtige: ATS-/Software-Partner oder
   Direktarbeitgeber? Das ist wichtig: Wir veröffentlichen nicht für uns
   selbst, sondern im Auftrag unserer KUNDEN.
c) Wie kommt man hinein? Nenne die genaue Seite oder E-Mail-Adresse,
   das Formular und — falls öffentlich — welche Felder es verlangt.
d) Was kostet es WEN? Zahlt der Partner, zahlt der Arbeitgeber, ist
   organisches Einstellen kostenlos, und bleibt es das? Wenn der Anbieter
   das nicht öffentlich sagt, schreib „muss erfragt werden" und setz es
   auf die Fragenliste.
e) Welche Voraussetzungen stellt der Anbieter an den Partner?
   Mindestkundenzahl, Mindestumsatz, Vertragslaufzeit, technische
   Zertifizierung, Testphase, Vorlaufzeit bis zur Freischaltung.
f) Ist die technische Dokumentation öffentlich oder erst nach Vertrag?
g) Kommen Bewerbungen zurück, und wie? (Bei Indeed etwa über Indeed
   Apply.) Wenn ja: in welchem Format, und was muss unsere Seite dafür
   bereitstellen?
h) DATENSCHUTZ, und das bitte ernst nehmen: Wir sind gegenüber unseren
   Kunden Auftragsverarbeiter. Fließen beim Veröffentlichen oder beim
   Rückweg Bewerberdaten zum Anbieter, und wenn ja: Gibt es dort einen
   Auftragsverarbeitungsvertrag zum Annehmen, und wird in ein Drittland
   übermittelt (Indeed sitzt in den USA)? Nenne, auf welcher Grundlage
   (Standardvertragsklauseln, Angemessenheitsbeschluss) und wo das
   Dokument liegt.

WAS DU MIR LIEFERN SOLLST

Schritt 1 — eine Übersichtstabelle:
Kanal | Schnittstelle | unser Programm | Wer zahlt was | Voraussetzungen |
Vorlaufzeit | Doku öffentlich? | Rückweg für Bewerbungen | AVV/Drittland |
Quelle (Link + Datum)

Schritt 2 — eine Empfehlung der Reihenfolge, begründet mit Wirkung pro
Aufwand, nicht mit Bekanntheit. Kostenlose Kanäle zuerst.

Schritt 3 — für die ersten DREI Kanäle je ein fertiges Paket:
  - eine abschickbare E-Mail oder ein ausgefülltes Antragsformular
    (Feldname: Inhalt, Zeile für Zeile — auch bei Feldern, die ich
    ankreuzen muss)
  - die Liste der Unterlagen, die ich beilegen muss
  - die Liste der Angaben, die nur ich habe, als ausdrückliche Frage an
    mich
  - was nach dem Absenden passiert und wie lange es dauert

Fang mit der Bundesagentur für Arbeit an. Dort brauchen wir laut deren
eigener Seite eine Kooperationsvereinbarung, die man beim Account- und
Bündnispartnermanagement anfragt. Finde die aktuelle Adresse, schreib die
Anfrage, und kläre dabei mit: Welche Fassung der HR-BA-XML-Spezifikation
gilt, gibt es eine Testumgebung, und wie funktioniert das, wenn wir als
Softwarehaus für VIELE Arbeitgeber übermitteln — brauchen wir eine
Vereinbarung oder jeder Arbeitgeber seine eigene?

WIE DU ARBEITEN SOLLST
- Erst die Übersicht, dann Schritt für Schritt. Nach jedem Schritt sagst
  du mir in einem Satz, was ich jetzt zu tun habe.
- Jede Angabe mit Quelle und Datum. Was du nicht belegen kannst:
  „nicht gefunden". Rate nicht, und erfinde keine Ansprechpartner,
  Adressen oder Preise — ich prüfe das.
- Deutsche Originalquellen vor Blogs und Vergleichsportalen.
- Führe eine Standtabelle mit: Kanal | Stand | zuletzt getan | wartet auf
  wen | nächster Schritt. Schreib sie nach jeder Antwort fort.
- Frag nach, wenn eine Angabe von mir fehlt, statt einen Platzhalter
  stehen zu lassen, der dann im Antrag landet.
```

---

## Auftrag 2 · Die Lohnabrechnung vollständig selbst — Zertifizierung und Zulassungen

```
Du bist mein Umsetzungsagent für ein Zulassungsvorhaben. Du recherchierst
bei den amtlichen Stellen, füllst Anträge inhaltlich aus und schreibst die
Schreiben fertig. Unterschreiben, bezahlen und absenden mache ich.

WER WIR SIND
OKUN Systems UG (haftungsbeschränkt), Potsdamer Platz 1, 10785 Berlin.
Vertreten durch Felix Okun. Amtsgericht Charlottenburg HRB 292175 B.
kontakt@okun-systems.com, https://okun-workforce.com
Softwarehaus, ein Geschäftsführer, keine Angestellten.
(Steuernummer, USt-IdNr. und D-U-N-S trage ich selbst ein.)

WAS UNSER PROGRAMM HEUTE SCHON RECHNET
OKUN Workforce enthält eine eigene Entgeltabrechnung:
- Lohnsteuer nach dem amtlichen Programmablaufplan des BMF
- Sozialversicherungsbeiträge mit den Rechengrößen des jeweiligen Jahres
- Umlagen U1/U2 mit einem Katalog von 24 Krankenkassen
- Zuschläge für Nacht, Sonntag, Feiertag
- Minijob und Übergangsbereich, Mehrfachbeschäftigung
- Einmalzahlungen, rückwirkende Aufrollung, Kurzarbeitergeld,
  betriebliche Altersvorsorge, Lohnpfändung
- Entgeltabrechnung als PDF nach §108 GewO und
  Entgeltbescheinigungsverordnung, Lohnkonto, Jahresabschluss
- SEPA-Datei zur Auszahlung, die der Kunde heute bei seiner Bank hochlädt
- eine Übergabedatei für den Steuerberater (CSV, kein geprüftes
  DATEV-Format)
ELStAM lesen wir heute aus einer Datei ein, die der Arbeitgeber abholt.

WAS WIR NOCH NICHT HABEN — und genau darum geht es
Keinen einzigen eigenen Übermittlungsweg. Heute meldet der Steuerberater
des Kunden. Das soll vollständig zu uns wandern.

MEIN ZIEL, unmissverständlich
Unsere Kunden sollen NICHTS außer OKUN Workforce brauchen: rechnen,
melden, bescheinigen, auszahlen. Wir wollen das SELBST zertifiziert
haben — keine eingebettete Fremd-Engine, kein Partner, der für uns
zertifiziert ist. Begründung: Unabhängigkeit und Wert des eigenen
Produkts. Diese Entscheidung ist gefallen, sie steht nicht zur Debatte;
dein Auftrag ist der Weg dorthin, nicht die Alternative.

Konkret wollen wir am Ende selbst können:
A) Sozialversicherung: DEÜV-Meldungen (An-, Ab-, Jahres-,
   Unterbrechungs-, Sofortmeldung), Beitragsnachweis je Krankenkasse,
   AAG-Erstattungsanträge U1/U2, Datenaustausch Entgeltersatzleistungen,
   Lohnnachweis an die Berufsgenossenschaft
B) Steuer: ELStAM an-/abmelden und Änderungsliste abrufen,
   Lohnsteueranmeldung, elektronische Lohnsteuerbescheinigung
C) Auszahlung: die Überweisung der Gehälter direkt aus OKUN auslösen,
   ohne dass wir dafür eine BaFin-Erlaubnis brauchen

WAS ICH SCHON WEISS — nimm es als Ausgangspunkt und prüfe es nach
- Die Systemuntersuchung von Entgeltabrechnungsprogrammen führt die ITSG
  im Auftrag des GKV-Spitzenverbands durch; seit dem 7. SGB IV-ÄndG
  (1.1.2021) ist sie vorgeschrieben. Sie besteht aus Systemprüfung,
  Pilotierung und laufender Qualitätssicherung, der Antrag muss vor dem
  Einsatz beim ersten Kunden gestellt werden, und sie wird jährlich
  wiederholt, weil die Gemeinsamen Grundsätze jährlich geändert werden.
  Dazu kommt ein Trust-Center-Zertifikat für die Übermittlung.
- Für ELSTER/ERiC gibt es kein Produktzulassungsverfahren, sondern eine
  Registrierung als Hersteller im ELSTER-Entwicklerbereich (Prüfung
  durch das Bayerische Landesamt für Steuern), danach eine Hersteller-ID.
  ERiC ist eine C-Bibliothek und wird kostenlos bereitgestellt. Je
  Arbeitgeber braucht es ein ELSTER-Organisationszertifikat mit der
  Steuernummer der lohnsteuerlichen Betriebsstätte.
- Zum Zahlungsverkehr: Zahlungsauslösedienste sind nach ZAG
  erlaubnispflichtig, und die BaFin sagt ausdrücklich, dass eine
  Nebentätigkeit nicht davon befreit. Nach dem überarbeiteten
  BaFin-Merkblatt (Februar 2023) und der EBA-Auskunft 2021_6235 gilt ein
  Konto, das über EBICS genutzt wird, aber nicht als online zugänglich —
  dann liegt weder Zahlungsauslöse- noch Kontoinformationsdienst vor. Und
  eine Transportunterschrift (Typ T) ist keine Zahlungsautorisierung.

DEINE AUFGABEN, in dieser Reihenfolge

TEIL 1 — ITSG-Systemuntersuchung (der große Brocken)
Finde die amtlichen Unterlagen und beantworte daraus, was sich daraus
beantworten lässt; alles Übrige wird eine Frage an die ITSG:
1. Das aktuelle Antragsformular bzw. die „Vereinbarung zur
   Systemuntersuchung". Wo liegt es, welche Fassung gilt, welche Felder
   hat es?
2. Die aktuellen Gemeinsamen Grundsätze für die Datenerfassung und
   Datenübermittlung (§22 DEÜV-Grundsätze) in der Fassung, die jetzt
   gilt. Welche Meldeverfahren muss ein Programm MINDESTENS abdecken,
   um überhaupt geprüft zu werden — ist ein Teilumfang zulässig?
3. Gebühren: erstmalige Untersuchung, jährliche Wiederholung,
   Trust-Center-Zertifikat. Findest du keine Gebührenordnung, sag es und
   setz es auf die Fragenliste.
4. Dauer vom Antrag bis zum Bescheid, und zu welchem Stichtag die
   Wiederholung jedes Jahr vorliegen muss.
5. Die Pilotierung: Braucht sie einen echten Arbeitgeber als
   Pilotkunden, der echte Meldungen abgibt? Wenn ja — wie macht das ein
   Hersteller, der noch keinen Kunden mit Meldebetrieb hat? Das ist für
   uns eine Kernfrage, bitte ausdrücklich stellen.
6. Die zeitliche Falle: Unser Programm RECHNET heute schon bei Kunden,
   übermittelt aber nichts. Löst das bereits eine Antragspflicht aus,
   oder erst die erste Übermittlung? Frag das wörtlich.
7. Auflagen an das Unternehmen selbst: Rechtsform, Nachweise,
   Berufshaftpflicht, Mindestgröße.
8. Produktmodifikations-ID und was wir melden müssen, wenn sich das
   Programm ändert.
Dann: schreib die Anfrage an die ITSG fertig, mit diesen Fragen,
abschickbar, mit der richtigen Adresse der zuständigen Stelle.

TEIL 2 — ELSTER / ERiC
1. Die genaue Seite für die Herstellerregistrierung, und welche Angaben
   sie verlangt.
2. Wie die Hersteller-ID beantragt wird, und wie lange das dauert.
3. Welche Verfahren wir für ELStAM, Lohnsteueranmeldung und elektronische
   Lohnsteuerbescheinigung umsetzen müssen, wo die
   Schnittstellenbeschreibungen liegen und ob sie erst nach Registrierung
   zugänglich sind.
4. Testumgebung: Wie sieht der Nachweis gegen die Testumgebung aus, und
   gibt es eine Freigabe für den Produktivbetrieb?
5. Organisationszertifikat: Was braucht es, wie lange gilt es, und wie
   läuft das in einem Mietmodell mit vielen Arbeitgebern — eins je
   Arbeitgeber, und wer verwaltet es?
6. Versionszyklus von ERiC und wie lange alte Fassungen produktiv
   zulässig sind.
Dann: die Registrierung inhaltlich vorbereiten (Feld für Feld) und die
Anfrage an die ELSTER-Entwicklerbetreuung fertig schreiben.

TEIL 3 — Auszahlung über EBICS, ohne BaFin-Erlaubnis
1. Was braucht eine Software technisch, um EBICS-fähig zu sein? Gibt es
   fertige Bibliotheken oder Dienste dafür, und welche kommen für einen
   kleinen Anbieter in Frage? Nenne Anbieter mit Quelle.
2. Wie sieht die Einrichtung je Kunde aus (Teilnahmeerklärung bei seiner
   Bank, Schlüsselerzeugung, INI-Brief, Freischaltung)?
3. Welche Unterschriftsklassen gibt es, und wie muss es gebaut sein,
   damit WIR nie zeichnen, sondern immer der Kunde — über verteilte
   elektronische Unterschrift oder die App seiner Bank?
4. Die Rechtsfrage: Prüfe die aktuelle Fassung des BaFin-Merkblatts zum
   ZAG und die EBA-Auskunft 2021_6235 und fasse zusammen, unter welchen
   Bedingungen unser Aufbau erlaubnisfrei ist — und welche Gestaltung
   ihn erlaubnispflichtig machen würde. Nenne ausdrücklich, was wir
   NIEMALS tun dürfen (etwa Geld über ein eigenes Konto führen).
5. Bereite zwei Schreiben vor: eine Anfrage an die BaFin zur
   Erlaubnisfreiheit unseres Aufbaus, und eine Mandatsanfrage an einen
   Fachanwalt für Bank- und Kapitalmarktrecht für eine schriftliche
   Einschätzung. Ich entscheide dann, welchen Weg ich nehme.

TEIL 4 — die Grenze zum Steuerberatungsgesetz
Unsere Kunden bedienen die Software selbst; wir rechnen nicht für sie.
Prüfe, ob das nach §§1 ff. StBerG und der Ausnahme in §6 Nr. 4 StBerG
unproblematisch ist, und formuliere die Frage so, dass ich sie einem
Steuerberater oder Fachanwalt für Steuerrecht schriftlich stellen kann.
Markiere dabei deutlich, wo die Grenze liegt, wenn wir die Abrechnung
einmal doch FÜR einen Kunden durchführen würden.

TEIL 5 — der Plan
Ein Ablaufplan mit Abhängigkeiten: Was muss GEBAUT sein, bevor ein
Antrag Sinn hat? Was läuft parallel? Was ist in Wochen, was in Monaten
zu messen? Nenne ausdrücklich die Reihenfolge, die den geringsten
Blindflug bedeutet — meine Annahme ist ELSTER zuerst (kleine Tür), ITSG
danach (große Tür), EBICS parallel, weil es von beidem unabhängig ist.
Widersprich, wenn du es anders siehst, aber begründe es.

WIE DU ARBEITEN SOLLST
- Amtliche Quellen vor allem anderen: gkv-datenaustausch.de,
  itsg.de, elster.de, bafin.de, Gesetzestexte. Hersteller- und
  Beraterblogs nur zur Ergänzung und als solche gekennzeichnet.
- Jede Zahl, jede Frist und jede Gebühr mit Quelle und Datum. Was du
  nicht belegen kannst: „nicht gefunden" — und dann wird daraus eine
  Frage im Brief. Das ist kein Mangel, sondern das Ergebnis.
- Erfinde keine Ansprechpartner, Aktenzeichen, Formularnummern oder
  Gebühren.
- Keine Steuernummern, Zugangsdaten oder Schlüssel in diesem Chat. Setze
  Platzhalter in eckigen Klammern.
- Führe nach jeder Antwort eine Standtabelle fort:
  Vorgang | Stelle | Stand | wartet auf wen | nächster Schritt | Frist.
- Nach jedem Teil sagst du mir in einem Satz, was ich jetzt tun muss.
```

---

## Auftrag 3 · Krankmeldungen selbst bei der Kasse abrufen (eAU) und nachfassen

```
Du bist mein Umsetzungsagent. Recherchieren, Unterlagen finden, Anträge
inhaltlich ausfüllen, Schreiben fertig formulieren — abschicken und
unterschreiben mache ich.

WER WIR SIND
OKUN Systems UG (haftungsbeschränkt), Potsdamer Platz 1, 10785 Berlin,
vertreten durch Felix Okun, HRB 292175 B (Amtsgericht Charlottenburg),
kontakt@okun-systems.com, https://okun-workforce.com

WAS WIR GEBAUT HABEN
OKUN Workforce ist eine Personalsoftware (SaaS) mit Dienstplanung,
ZEITERFASSUNG, Personalakte, Abwesenheitsverwaltung und Entgeltabrechnung.
Krankmeldungen erfasst das Programm heute als Abwesenheit; die
Arbeitsunfähigkeitsbescheinigung muss der Betrieb bis heute selbst
hinterherholen.

WAS ICH ERREICHEN WILL — der Ablauf, den ich mir vorstelle
1. Der Mitarbeiter meldet sich in OKUN krank (oder die Leitung trägt es
   ein).
2. OKUN fragt die Arbeitsunfähigkeitsdaten SELBST bei der Krankenkasse
   ab — zum richtigen Zeitpunkt, und wiederholt, wenn noch nichts
   vorliegt.
3. Kommt die Bestätigung, wird die Abwesenheit automatisch als
   nachgewiesen abgehakt. Niemand muss ein Papier abgeben oder
   abhaken.
4. Kommt KEINE Bestätigung, bekommt der Mitarbeiter eine
   Push-Nachricht: dass die Kasse für diesen Tag noch keine
   Arbeitsunfähigkeit bestätigen konnte und er sich darum kümmern
   muss — und danach erinnert ihn das Programm weiter, bis es vorliegt.
   Der Betrieb soll dem Mitarbeiter nicht mehr hinterherlaufen müssen.

Das ist der Zweck. Jetzt brauche ich den Weg dorthin, technisch und
rechtlich.

WAS ICH SCHON WEISS — nimm es als Ausgangspunkt und prüfe es nach
- Seit 2023 holt der Arbeitgeber die Arbeitsunfähigkeit elektronisch bei
  der Krankenkasse ab; der Mitarbeiter reicht keine Bescheinigung mehr
  ein. Das Verfahren heißt „Datenaustausch eAU".
- Zugangswege sind nach Darstellung der Krankenkassen: ein
  systemgeprüftes Entgeltabrechnungsprogramm, EIN SYSTEMUNTERSUCHTES
  ZEITERFASSUNGSSYSTEM, oder eine systemgeprüfte Ausfüllhilfe. Das
  SV-Meldeportal der ITSG ist so eine Ausfüllhilfe und ist für
  Arbeitgeber seit 1.1.2025 kostenpflichtig; es hat sv.net abgelöst,
  das im Juli 2024 abgeschaltet wurde.
- Die Kassen empfehlen, den Abruf erst ein bis zwei Tage nach der
  ärztlichen Feststellung vorzunehmen und mit dem Feststellungstag
  abzufragen.
- Das Ende eines Krankengeldbezugs teilt die Kasse nach Darstellung der
  AOK seit 2026 von sich aus über den Datenaustausch
  Entgeltersatzleistungen mit, weshalb der eAU-Abruf vor allem der
  Entgeltfortzahlung dient.

DIE WICHTIGSTE FRAGE ÜBERHAUPT
Wir sind ein Zeiterfassungssystem. Wenn ein systemuntersuchtes
ZEITERFASSUNGSSYSTEM am eAU-Abruf teilnehmen darf, führt zu unserem Ziel
eine viel kleinere Tür als die vollständige Systemuntersuchung eines
Entgeltabrechnungsprogramms. Kläre das belastbar — nicht anhand einer
Krankenkassen-Webseite, sondern anhand der Verfahrensbeschreibung, der
Gemeinsamen Grundsätze und notfalls einer schriftlichen Auskunft der
ITSG. Und kläre dabei:
- Was genau umfasst eine Systemuntersuchung für ein
  Zeiterfassungssystem, im Unterschied zu der für ein
  Entgeltabrechnungsprogramm?
- Welche Verfahren darf ein so untersuchtes System übermitteln — nur
  eAU, oder mehr?
- Was kostet sie, wie lange dauert sie, wie oft wird sie wiederholt?
- Gilt dasselbe für eine „systemgeprüfte Ausfüllhilfe", und wäre das
  für uns der bessere oder der schlechtere Weg?

WEITERE AUFGABEN
1. Finde die amtliche Verfahrensbeschreibung zum Datenaustausch eAU
   (GKV-Spitzenverband, gkv-datenaustausch.de) in der jetzt gültigen
   Fassung. Nenne: welche Datensätze es gibt (Anforderung und
   Rückmeldung), welche Felder verlangt werden, welche Rückmeldearten
   vorkommen — insbesondere der Fall „keine Arbeitsunfähigkeit
   gefunden" —, welche Fristen gelten und ob und wie oft wiederholt
   abgefragt werden darf. Gibt es eine Begrenzung der Abrufe oder eine
   Pflicht, nicht blind zu wiederholen?
2. Die Rechtsgrundlagen, mit Fundstelle: die Abrufpflicht und
   -berechtigung des Arbeitgebers (ich habe §109 SGB IV im Kopf, prüfe
   das), die Vorlagepflicht des Arbeitnehmers nach §5
   Entgeltfortzahlungsgesetz, und die Frage, wann der Arbeitgeber
   überhaupt abrufberechtigt ist.
3. Die rechtliche Seite unseres Ablaufs: Darf das Programm den
   Mitarbeiter automatisch erinnern, wenn die Kasse nichts bestätigt
   hat? Meine Annahme ist ja, weil die Vorlagepflicht beim
   Arbeitnehmer bleibt. Prüfe es und sag, was dabei zu beachten ist.
4. Datenschutz: Arbeitsunfähigkeitsdaten sind Gesundheitsdaten (Art. 9
   DSGVO). Was darf gespeichert werden, was nur verarbeitet, wie lange
   darf es liegen, und wer im Betrieb darf es sehen? Sag mir die
   Grenzen so konkret, dass ich sie in Software gießen kann.
5. Die Übermittlung: Welches Trust-Center-Zertifikat braucht es, an
   welche Datenannahmestellen bzw. Kommunikationsserver wird
   übermittelt, in welchem Format, und was ist der technische Weg
   (Kommunikationsserver der GKV, Zertifikatsverwaltung,
   Verschlüsselung)?
6. Schreib zwei Schreiben fertig: eine Anfrage an die ITSG mit den
   Fragen aus „DIE WICHTIGSTE FRAGE ÜBERHAUPT", und eine an die
   Fachstelle des GKV-Spitzenverbands zur Verfahrensbeschreibung und
   zur Teilnahme. Mit der jeweils richtigen Adresse.

WAS DU MIR LIEFERN SOLLST
- Eine Antwort auf die Kernfrage, mit Belegstelle: große Tür oder
  kleine Tür?
- Eine Liste der Dokumente, die ich brauche, mit Links.
- Eine Beschreibung der Datensätze, die so genau ist, dass ein
  Entwickler danach bauen kann — oder der klare Hinweis, dass sie erst
  nach Registrierung zugänglich ist, und wie man dorthin kommt.
- Die zwei fertigen Schreiben.
- Einen Ablaufplan: was zuerst, was dauert wie lange, was hängt woran.

WIE DU ARBEITEN SOLLST
- Amtliche Quellen zuerst: gkv-datenaustausch.de, itsg.de,
  Gesetzestexte. Krankenkassen-Seiten sind brauchbar, aber sie sind
  Auslegung, nicht Grundlage — kennzeichne sie als solche.
- Jede Angabe mit Quelle und Datum. „Nicht gefunden" ist eine
  zulässige und erwünschte Antwort; dann wird daraus eine Frage im
  Brief.
- Erfinde keine Paragraphen, Formularnummern, Adressen oder Gebühren.
  Ich prüfe das nach.
- Keine Personendaten, keine Versicherungsnummern, keine Zugangsdaten
  in diesem Chat.
- Führe nach jeder Antwort eine Standtabelle fort: Frage | Stand |
  Quelle | offen bei wem | nächster Schritt.
```

---

## Was du mit den Ergebnissen machst

Schick sie mir. Dann trage ich ein:

* Kanäle, Konditionen und Fristen aus Auftrag 1 → ein neuer Abschnitt in
  `FEATURES.md`, sobald gebaut wird, und bis dahin in `DEINE-LISTE.md`.
* Alles aus Auftrag 2 → `LOHN-ZERTIFIZIERUNG.md`. Dort steht die
  Entscheidung schon; was fehlt, sind die echten Zahlen.
* Alles aus Auftrag 3 → ebenfalls `LOHN-ZERTIFIZIERUNG.md`, als eigener
  Abschnitt, weil es ein eigener Zulassungsweg sein könnte.

> **Und eine Erwartung, die ich gleich dämpfen will:** Bei Auftrag 2 wird
> ChatGPT die Gebühren der ITSG wahrscheinlich nicht finden — sie stehen
> nicht öffentlich. Das ist kein schlechtes Ergebnis. Das Ergebnis ist
> dann der fertige Brief mit genau dieser Frage, und die Antwort kommt von
> der ITSG selbst.
