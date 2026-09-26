# Weg zur eigenen Lohnabrechnung — Zertifizierung, Kosten, Reihenfolge

Notiert am 10.09.2026.

**Entscheidung, die dahintersteht:** Übergangsweise bleibt es beim heutigen
Stand — *wir rechnen, der Steuerberater meldet.* Perspektivisch soll die
Lohnabrechnung vollständig bei OKUN liegen. Dieses Papier sagt, was dafür nötig
ist, in welcher Reihenfolge es sinnvoll ist, und wo man die echten Zahlen
erfragt.

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

**Rechenkern**
- [ ] **Rückwirkende Aufrollung.** Ändert sich etwas am März, müssen April und
      Mai neu gerechnet und die Differenz fortgeschrieben werden. Heute
      überschreiben wir nur Entwürfe. **Der größte Brocken — und er hat mit
      Zertifizierung nichts zu tun.**
- [ ] Minijob und Übergangsbereich (Midijob) mit eigener Beitragsberechnung
- [ ] Mehrfachbeschäftigung
- [ ] Kurzarbeitergeld
- [ ] Sonstige Bezüge (Einmalzahlungen) — der Ablaufplan kann es bereits,
      wir reichen es noch nicht durch
- [ ] Geldwerte Vorteile, Firmenwagen, Sachbezüge
- [ ] Betriebliche Altersvorsorge, Entgeltumwandlung
- [ ] Pfändungen und Abtretungen

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
