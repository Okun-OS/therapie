# Weg zur eigenen Lohnabrechnung — Zertifizierung, Kosten, Reihenfolge

Notiert am 10.09.2026. **Entscheidung nachgetragen am 21.10.2026 — Abschnitt 7.**

**Entscheidung, die dahintersteht:** Übergangsweise bleibt es beim heutigen
Stand — *wir rechnen, der Steuerberater meldet.* Perspektivisch soll die
Lohnabrechnung vollständig bei OKUN liegen. Dieses Papier sagt, was dafür nötig
ist, in welcher Reihenfolge es sinnvoll ist, und wo man die echten Zahlen
erfragt.

> **21.10.2026 — die Richtung ist entschieden, und zwar weiter als dieses
> Papier bisher annahm:** Die vollständige Lohnabrechnung soll **selbst
> zertifiziert** bei OKUN liegen — eigene Systemuntersuchung, eigener
> ELSTER-Zugang, eigene Auszahlung. Ausdrücklich **keine** eingebettete
> Fremd-Engine, auch nicht als Abkürzung. Begründung des Eigentümers:
> Unabhängigkeit und Wert des eigenen Produkts. Was das an Zulassungen heißt,
> steht in Abschnitt 7; die Vorgänge dazu laufen über
> `AGENTENAUFTRAEGE.md`.

> **Zu den Zahlen:** Gebühren und Fristen sind hier bewusst NICHT geschätzt.
> Sie ändern sich, und eine geratene Zahl in einer Investitionsentscheidung ist
> schlimmer als keine. Unten steht stattdessen, wen man mit welchen Fragen
> anschreibt.

---

## 1. Was heute gilt

| | |
|---|---|
| Lohnsteuer | amtlicher Programmablaufplan des BMF, exakt |
| Sozialabgaben | eigene Rechnung mit den Rechengrößen aus `lohnjahre.ts` |
| ELStAM | Arbeitgeber holt die Liste, wir lesen sie ein |
| Meldewesen | Steuerberater, über unsere DATEV-Datei |
| Auszahlung | SEPA-Datei, die der Kunde bei seiner Bank hochlädt |
| Externe Zugänge | **keine** |

Das trägt für die ersten Kunden. Es hat genau zwei Nahtstellen, an denen der
Kunde selbst tätig werden muss: die ELStAM-Liste abholen und die SEPA-Datei
hochladen. Beides gehört in seinen Vertrag.

---

## 2. Die zwei Zertifizierungen — sie sind sehr verschieden

### ELStAM über ELSTER (ERiC)

- **Was:** Registrierung als Softwarehersteller im Entwicklerbereich, Bezug der
  Übermittlungsbibliothek ERiC, Organisationszertifikat, Nachweis gegen die
  Testumgebung.
- **Charakter:** eher Registrierung und technischer Konformitätsnachweis als
  eine Prüfung im Sinne einer Zulassung.
- **Laufend:** mehrmals im Jahr neue ERiC-Versionen nachziehen.
- **Was es bringt:** der monatliche Handgriff des Kunden entfällt. An- und
  Abmeldung von Mitarbeitern und der Abruf der Änderungsliste laufen automatisch.
- **Einschätzung:** abgegrenzt und machbar. Der sinnvolle **erste** Schritt.

### SV-Meldungen über die ITSG

- **Was:** Systemuntersuchung des Entgeltabrechnungsprogramms nach den
  Gemeinsamen Grundsätzen, dazu ein Zertifikat des ITSG-Trust-Centers für die
  Übermittlung an die Datenannahmestellen.
- **Gültigkeit:** **ein Kalenderjahr.** Die Grundsätze werden jährlich geändert,
  die Prüfung entsprechend jährlich wiederholt. Es gibt keinen Zustand „fertig".
- **Charakter:** Dauerverpflichtung, keine einmalige Hürde.
- **Einschätzung:** lohnt erst, wenn die Lohnabrechnung ein eigenes Produkt ist
  und nicht Beiwerk zur Dienstplanung.

---

## 3. Was zur Komplettlösung sonst noch fehlt

Die Zertifizierungsgebühr ist der kleinste Posten. Das hier ist der Aufwand:

> **Berichtigt am 21.10.2026.** Dieser Abschnitt war sechs Wochen alt und hat
> als „fehlt" geführt, was längst gebaut und je mit einer eigenen Prüfung am
> laufenden System belegt ist. Eine veraltete Mängelliste ist in einer
> Investitionsentscheidung genauso schädlich wie eine geratene Zahl — und sie
> hätte hier zur falschen Reihenfolge geführt. **Vom Rechenkern fehlt nur noch
> ein Punkt.**

**Rechenkern**
- [x] **Rückwirkende Aufrollung** — `pruefungen/d9-aufrollung.mjs`
- [x] Minijob und Übergangsbereich (Midijob) — `d11-minijob.mjs`,
      `src/lib/beschaeftigungsart.ts`
- [x] Mehrfachbeschäftigung — `d20-mehrfach-abfindung.mjs`
- [x] Kurzarbeitergeld — `d19-kurzarbeit.mjs`
- [x] Sonstige Bezüge (Einmalzahlungen) — `d10-einmalzahlung.mjs`
- [ ] **Geldwerte Vorteile, Firmenwagen, Sachbezüge** — dazu gibt es keine
      Zeile Code. Der einzige echte Rest, und bei Trägern verbreitet:
      Jobticket, Essenszuschuss, die 50-€-Grenze.
- [x] Betriebliche Altersvorsorge, Entgeltumwandlung — `d18-bav.mjs`
- [x] Pfändungen und Abtretungen — `d17-pfaendung.mjs`

**Meldewesen (braucht ITSG)**
- [ ] An-, Ab-, Jahres-, Unterbrechungs- und Sofortmeldung (DEÜV)
- [ ] Beitragsnachweis je Krankenkasse, monatlich, mit Schätzung und Korrektur
- [ ] AAG — Erstattungsanträge U1/U2 bei Entgeltfortzahlung
- [ ] Lohnnachweis an die Berufsgenossenschaft
- [ ] A1-Bescheinigungen bei Auslandseinsätzen

**Steuer (braucht ERiC)**
- [ ] Lohnsteueranmeldung
- [ ] Elektronische Lohnsteuerbescheinigung zum Jahreswechsel
- [ ] ELStAM-An-/Abmeldung und Abruf der Änderungsliste

**Betrieb**
- [ ] Jahreswechsel als eigener, geprobter Vorgang
- [ ] Aufbewahrung und Nachvollziehbarkeit über Jahre hinweg
- [ ] Ein Verfahren für den Fall, dass eine Meldung von der Annahmestelle
      abgelehnt wird

---

## 4. Vorgeschlagene Reihenfolge

**Stufe 0 — jetzt (erledigt)**
Rechnen bei uns, melden über den Steuerberater. Kein externer Zugang.

**Stufe 1 — sobald es weh tut**
Rückwirkende Aufrollung und sonstige Bezüge. Beides braucht keine
Zertifizierung, beides fällt beim ersten echten Kunden auf.

**Stufe 2 — ab etwa einer Handvoll Kunden**
ELStAM über ERiC. Nimmt dem Kunden den Monatsschritt ab und ist der erste
Zugang, den wir selbst halten. Danach: Lohnsteueranmeldung und elektronische
Lohnsteuerbescheinigung über denselben Weg.

**Stufe 3 — nur wenn Lohnabrechnung ein eigenes Produkt wird**
ITSG-Systemprüfung und das volle Meldewesen. Ab hier ist es eine jährliche
Verpflichtung.

Der Übergang ist bewusst billig gebaut: `src/lib/elstam.ts` liest heute eine
Datei. Käme ein automatischer Abruf dazu, blieben Abgleich, Bestätigung und
Nachweis unverändert — nur die Herkunft der Sätze wechselte.

---

## 5. Anfrageliste — hier kommen die echten Zahlen her

### An die ITSG (Systemuntersuchung von Entgeltabrechnungsprogrammen)

1. Was kostet die erstmalige Systemuntersuchung eines
   Entgeltabrechnungsprogramms, was die jährliche Wiederholung?
2. Wie lange dauert eine Erstprüfung vom Antrag bis zum Zertifikat?
3. Zu welchem Stichtag muss die Wiederholungsprüfung jedes Jahr vorliegen?
4. Welche Meldeverfahren muss ein Programm mindestens abdecken, um überhaupt
   geprüft werden zu können — geht ein Teilumfang?
5. Was kostet das Trust-Center-Zertifikat für die Übermittlung, und wie lange
   läuft es?
6. Gibt es Auflagen an das Unternehmen selbst (Rechtsform, Nachweise,
   Haftpflicht)?

### An die ELSTER-Entwicklerbetreuung

1. Welche Schritte sind nötig, um ERiC für die Verfahren **ELStAM**,
   **Lohnsteueranmeldung** und **elektronische Lohnsteuerbescheinigung** zu
   beziehen und produktiv einzusetzen?
2. Fallen dafür Gebühren an?
3. Wie lange dauert die Freischaltung für den Produktivbetrieb erfahrungsgemäß?
4. In welchem Rhythmus erscheinen neue ERiC-Versionen, und wie lange sind
   ältere Versionen produktiv zulässig?
5. Gibt es Anforderungen an das Organisationszertifikat und dessen Laufzeit?

### An einen Steuerberater oder ein Lohnbüro (Gegenrechnung)

1. Was kostet die Lohnabrechnung je Mitarbeiter und Monat, wenn wir die
   Vorerfassung liefern?
2. Welches Format wollen Sie von uns — passt unsere DATEV-Datei?
3. Wer holt die ELStAM — Sie oder der Mandant?
4. Würden Sie die Rechnung unseres Programms einmal gegenzeichnen?

> Frage 4 ist unabhängig von allem anderen **vor dem ersten echten Kunden zu
> klären.** Die Lohnsteuer ist amtlich, aber Sozialabgaben und Zuschlagslogik
> rechnen weiterhin wir.

---

## 6. Wovon die Entscheidung wirklich abhängt

Nicht von der Gebühr, sondern von zwei Fragen:

1. **Wie viele Kunden?** Der Monatsschritt bei ELStAM kostet je Kunde ein paar
   Minuten. Bei drei Kunden ist das nichts, bei dreißig ist es eine Stelle.
2. **Ist Lohnabrechnung ein Produkt oder Beiwerk?** Beiwerk zur Dienstplanung
   verträgt keine jährliche Systemprüfung. Ein eigenes Produkt schon — dann
   trägt es sie auch.

Solange die Antwort auf 2 „Beiwerk" lautet, ist der heutige Stand richtig.

> **Nachtrag 21.10.2026:** Die Antwort auf Frage 2 ist gefallen, und sie lautet
> **„eigenes Produkt"**. Damit trägt es die jährliche Prüfung. Abschnitt 6
> bleibt stehen, weil die Abwägung richtig war — nur ist sie jetzt entschieden.

---

## 7. Nachgetragen am 21.10.2026 — die drei Türen

Recherchiert, nicht erinnert; Quellen stehen in der Sitzung und in
`AGENTENAUFTRAEGE.md`. Alles hier ist **Ausgangspunkt für die Anfragen**, nicht
schon die Antwort: Gebühren und Fristen nennen die Stellen selbst.

### Tür A — ELSTER / ERiC: die kleine

**Kein Produktzulassungsverfahren.** Registrierung als Hersteller im
ELSTER-Entwicklerbereich (das Bayerische Landesamt für Steuern prüft und richtet
den Zugang ein, Zugangsdaten laut Quelle binnen Tagen), danach **Hersteller-ID**
beantragen. **ERiC ist eine C-Bibliothek und wird kostenlos bereitgestellt.** Je
Arbeitgeber braucht es ein **ELSTER-Organisationszertifikat** mit der
Steuernummer seiner lohnsteuerlichen Betriebsstätte — unternehmensbezogen und
nicht an eine Person gebunden; enthält es keine gültige Steuernummer, lehnt die
Finanzverwaltung die Anmeldung ab.

Damit: ELStAM an-/abmelden **und die Änderungsliste selbst abrufen**,
Lohnsteueranmeldung, elektronische Lohnsteuerbescheinigung.

**Damit löst sich ein Punkt der Eigentümerliste von selbst auf:** Die „echte
ELStAM-Änderungsliste", die wir beim Steuerberater erbitten, holt sich das
Programm danach selbst.

### Tür B — ITSG-Systemuntersuchung: die große

Seit dem **7. SGB IV-ÄndG (1.1.2021) gesetzlich vorgeschrieben.** Die ITSG prüft
im Auftrag des GKV-Spitzenverbands, der Spitzenverband erteilt den Bescheid, die
ITSG das Zertifikat „systemuntersucht". Ablauf: **Systemprüfung, Pilotierung,
laufende Qualitätssicherung.** Der Antrag muss **vor dem Einsatz beim ersten
Kunden** gestellt werden. Gültigkeit jeweils ein Jahr, weil die Gemeinsamen
Grundsätze jährlich geändert werden. Dazu ein **Trust-Center-Zertifikat** für die
Übermittlung an die Datenannahmestellen, dazu eine Produktmodifikations-ID, die
bei jeder eingehenden Meldung geprüft wird. Ohne Zertifikat kann ein Arbeitgeber
mit unserer Software **keine** Meldung abgeben.

Damit: DEÜV An-, Ab-, Jahres-, Unterbrechungs- und Sofortmeldung,
Beitragsnachweis je Krankenkasse, AAG-Erstattung U1/U2, **eAU-Abruf**,
Datenaustausch Entgeltersatzleistungen, Lohnnachweis an die
Berufsgenossenschaft.

**Drei Fragen, die über den Zeitplan entscheiden** — alle drei stehen im Brief:

1. **Gebühren** erst- und wiederholt. Nicht öffentlich.
2. **Die Pilotierung braucht offenbar echte Meldungen** eines echten
   Arbeitgebers. Wie macht das ein Hersteller, der noch keinen Kunden im
   Meldebetrieb hat? Das ist die eigentliche Henne-Ei-Frage.
3. **Lösen wir heute schon eine Antragspflicht aus?** Unser Programm rechnet
   bei Kunden, übermittelt aber nichts. „Vor dem Einsatz beim ersten Kunden"
   könnte beides heißen.

> **Und die Erkenntnis, die die Reihenfolge bestimmt: Die Zulassung ist nicht
> das Nadelöhr, das Meldewesen ist.** Die fünfzehn Verfahren aus Abschnitt 3
> müssen gebaut sein, bevor ein Antrag Sinn hat. Die Gebühr ist der kleinste
> Posten — das stand schon immer hier und gilt umso mehr.

### Tür C — Auszahlung über EBICS: gar keine Erlaubnis

Zahlungsauslösedienste sind nach **§§10, 11, 34 ZAG erlaubnispflichtig**, und die
BaFin sagt ausdrücklich, dass eine **Nebentätigkeit nicht davon befreit** — eine
Lohnsoftware ist also nicht schon deshalb frei, weil Zahlungsverkehr nicht ihr
Hauptzweck ist.

**Aber:** Nach dem überarbeiteten **BaFin-Merkblatt zum ZAG (Februar 2023)** und
der **EBA-Auskunft 2021_6235** gilt ein Konto, das über **EBICS** genutzt und
verwaltet wird, **nicht als online zugänglich** — mangels Online-Banking liegt
dann weder Zahlungsauslöse- noch Kontoinformationsdienst vor. Eine
**Transportunterschrift (Typ T)** ist keine Zahlungsautorisierung.

Der Aufbau, der daraus folgt: **Wir übertragen, der Kunde zeichnet** — über die
verteilte elektronische Unterschrift, im EBICS-Client oder der App seiner Bank.
Einrichtung je Kunde: Teilnahmeerklärung bei seiner Bank, drei Schlüsselpaare
(Authentifikation, Verschlüsselung, Unterschrift) erzeugt unsere Software, INI-
Brief ausgedruckt und unterschrieben zur Bank, danach Bankschlüssel abholen.

**Was niemals passieren darf:** Geld über ein Konto von OKUN führen. Das wäre
Finanztransfergeschäft und eine ganz andere Erlaubnis.

**Auflage für diese Einschätzung:** Sie stammt aus BaFin-Merkblatt und
Kanzleibeiträgen, die EBICS-Mechanik aus Bankunterlagen, teils schweizerischen.
**Vor dem Produktivbetrieb gehört eine schriftliche anwaltliche Einschätzung
dazu** — der Aufbau entscheidet, nicht die Absicht.

### Tür B' — eAU: möglicherweise eine eigene, kleinere Tür

Seit 2023 holt **der Arbeitgeber** die Arbeitsunfähigkeit elektronisch bei der
Kasse ab („Datenaustausch eAU"); der Mitarbeiter reicht nichts mehr ein.

Und hier der Fund, der eigenes Nachgehen verdient: Die AOK nennt als zulässige
Zugangswege nicht nur ein systemgeprüftes Entgeltabrechnungsprogramm, sondern
auch ein **systemuntersuchtes Zeiterfassungssystem** und eine systemgeprüfte
**Ausfüllhilfe** (das SV-Meldeportal der ITSG ist so eine und ist für Arbeitgeber
seit 1.1.2025 kostenpflichtig; es hat sv.net abgelöst, das im Juli 2024
abgeschaltet wurde).

**OKUN ist ein Zeiterfassungssystem.** Träfe das zu, wäre die
Krankmeldungs-Automatik **ohne** die große Tür erreichbar — und zwar der ganze
Ablauf: abfragen, bei Bestätigung selbst abhaken, bei Fehlanzeige den
Mitarbeiter per Push erinnern, bis es vorliegt. Das ist der Hebel mit dem
besten Verhältnis von Nutzen zu Zulassungsaufwand im ganzen Papier.

**Das ist eine Krankenkassen-Webseite, keine Rechtsgrundlage.** Es gehört gegen
die Verfahrensbeschreibung des GKV-Spitzenverbands und eine schriftliche
ITSG-Auskunft gehalten — Auftrag 3 in `AGENTENAUFTRAEGE.md` tut genau das.

### Reihenfolge, die daraus folgt

| Stufe | Was | Zulassung | Wirkung |
|---|---|---|---|
| 0 | Modus „extern" + echte DATEV-Anbindung statt eigener CSV | keine | beseitigt den Medienbruch heute |
| 1 | **ELSTER/ERiC** | Registrierung + Hersteller-ID | ELStAM selbst, LSt-Anmeldung, Jahresbescheinigung |
| 1b | **eAU** über die Zeiterfassungs-Tür, falls sie existiert | kleine Systemuntersuchung (?) | Krankmeldungs-Automatik, unabhängig vom Lohn |
| 2 | Die fünfzehn Meldeverfahren **bauen** | keine | das eigentliche Nadelöhr |
| 3 | **ITSG-Systemuntersuchung**, selbst | Bescheid + Trust Center, jährlich | alle SV-Meldungen |
| 4 | **EBICS-Auszahlung** | keine, aber Rechtsgutachten | Gehälter aus OKUN auslösen |

Stufe 0 und 1 kosten nichts und wirken sofort. Stufe 2 ist der Brocken. Stufe 3
ist die Entscheidung, die am 21.10. gefallen ist.
