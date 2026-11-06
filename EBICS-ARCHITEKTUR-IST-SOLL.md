# EBICS-Anbindung — Ist-Stand, Behobenes und Architekturvorschlag

> **Stand: 22.10.2026, dritte Fassung.** Die erste war eine Untersuchung, die
> zweite der Stand nach der Behebung von vier Befunden. Diese hier beschreibt
> den Stand, nachdem auch der Zahlungslauf gebaut ist: **Was an uns liegt, ist
> fertig.** Offen sind nur noch die Fragen, die Dritte beantworten müssen —
> eine Bank und ein Anwalt.

> **Es wurde weiterhin keine Bankverbindung eingerichtet, keine Zahlung
> ausgelöst und keine Zeile EBICS-Code geschrieben.**

> **Keine Rechtsauskunft.** Dieses Papier behauptet **nicht**, dass der
> vorgeschlagene Aufbau nach dem Zahlungsdiensteaufsichtsgesetz erlaubnisfrei
> ist. Es sagt, welche Gestaltung dafür sprechen könnte und welche Fragen
> beantwortet sein müssen — von einer Bank und von einem Anwalt.

**Ziel:** Ein Arbeitgeber soll die Gehaltszahlung aus OKUN Workforce an seine
Bank übermitteln und sie **selbst autorisieren** können. Nicht Ziel: dass OKUN
Zahlungen auslöst, freigibt oder Geld bewegt.

---

## 1 · Was an uns liegt, ist fertig

Vier Befunde waren am bestehenden Code gefunden worden, dazu drei offene
Punkte aus der zweiten Fassung. **Alle sieben sind erledigt.**

| | Punkt | Stand |
|---|---|---|
| 1 | Standortleitung konnte die Zahldatei des ganzen Unternehmens abrufen | ✅ behoben (§217) |
| 2 | Kein Schutz gegen doppelte Zahlung | ✅ behoben (§217 Kennung, §218 Vorgang) |
| 3 | Entwürfe waren auszahlbar | ✅ behoben (§217) |
| 4 | Weder Zahldatei noch Bankverbindung hinterließen eine Spur | ✅ behoben (§217) |
| 5 | Kein Zahlungslauf als Vorgang, `paid` wurde nie gesetzt | ✅ gebaut (§218) |
| 6 | Die erzeugte Datei wurde nicht aufbewahrt | ✅ gebaut (§218) |
| 7 | Ausführungsdatum kannte keine Feiertage | ✅ behoben (§218) |

**Nachweis:** **1204 Modultests** und die Prüfungen am laufenden System —
die Lohn-Prüfungen **531/531 in 17 Dateien** (darunter die neue
`d23-zahllauf.mjs` mit 33 Checks und `d-lohn.mjs` mit 53 statt vorher 40),
dazu Mitarbeiter, Zugang, Abwesenheit, DSGVO, Nachweise und Lohnsiegel
**491/491 in 11 Dateien**. tsc und Bauen sauber.

---

## 2 · IST — der Stand jetzt

### 2.1 Die SEPA-Datei

**Gebaut.** `src/lib/lohn-export.ts`, Funktion `sepaXml()`.

* Format **pain.001.001.03**, `PmtMtd` `TRF`, `BtchBookg true`, `SvcLvl`
  `SEPA`, `ChrgBr` `SLEV`.
* **IBAN-Prüfsumme** nach ISO 7064 für Arbeitgeber und Beschäftigte
  (`ibanGueltig()`).
* **Zeichenersetzung** für den SEPA-Zeichensatz (`sepaZeichen()`).
* Ausgeliefert über `src/app/api/payroll/export/route.ts` als Download mit
  `Cache-Control: private, no-store`.

**Neu seit §217 — die Kennung wird aus dem Inhalt gerechnet.**
`zahlungsKennung()` bildet die `MsgId` aus Mandant, Monat, Standortauswahl und
der sortierten Liste aus Empfängerkonto und Betrag:

* **Derselbe Lauf, zweimal abgerufen → dieselbe Kennung.** Erst dadurch *kann*
  eine Bank eine doppelt eingereichte Datei als Dublette erkennen. Vorher war
  die Kennung `OKUN-${Date.now()}`, also bei jedem Abruf eine andere — für die
  Bank zwei verschiedene Aufträge.
* **Ein korrigierter Lauf → andere Kennung.** Ein starrer Wert je Monat hätte
  die berechtigte Nachzahlung mit blockiert.
* Format `OKUN-JJJJMM-XXXXXXXXXX`, 22 Zeichen (erlaubt sind 35). Sie steht
  zusätzlich im Antwortkopf `X-Okun-Kennung`.

**Gespeichert (§218).** Die erzeugte Datei wird unverändert aufbewahrt. Wer
dieselbe Zahlung ein zweites Mal abruft, bekommt **Byte für Byte dieselbe
Datei** zurück — nicht eine neu erzeugte. Der Unterschied ist kein Detail:
Eine neu erzeugte trüge einen neuen Erstellungszeitpunkt, und wer zwei
Dateien vergleicht, sähe Unterschiede, wo keine sind.

**Ausführungsdatum (§218).** Ohne Angabe der nächste Bankarbeitstag mit zwei
Tagen Vorlauf — Wochenenden **und gesetzliche Feiertage** übersprungen, nach
dem Bundesland des Standorts. Ist dort keines hinterlegt, gilt jeder Tag als
Feiertag, der irgendwo in Deutschland einer ist: Das kostet im schlimmsten
Fall einen Tag und erspart eine zurückgewiesene Datei. Ein **gewünschtes**
Datum wird dagegen nicht stillschweigend verschoben, sondern mit Begründung
abgelehnt — wer einen Zahltag nennt, soll nicht an einem anderen zahlen.

### 2.2 Wer was exportieren darf

**Behoben (Befund 1).** `locationFilter(session, locationId)` wird jetzt
**immer** ausgewertet, nicht nur bei ausdrücklicher Standortangabe — und sein
Ergebnis wird als Filter benutzt statt weggeworfen
(`src/app/api/payroll/export/route.ts`).

Dieselbe Lücke bestand schreibend im Belegweg: Ohne Standortangabe erzeugte
eine Standortleitung die Entgeltabrechnungen des **ganzen** Trägers, legte sie
in fremde Personalakten und benachrichtigte fremde Beschäftigte. Auch behoben
(`src/app/api/payroll/beleg/route.ts`).

**Nachgewiesen, nicht behauptet:** `pruefungen/d-lohn.mjs` legt dafür einen
zweiten Standort mit einer Person an — im Seed hat jeder Träger nur einen —
und prüft, dass die Unternehmensebene beide sieht und die Standortleitung den
fremden Standort nicht, weder im DATEV- noch im SEPA-Export. **Gegengeprüft:**
Mit entfernter Sperre steht der fremde Name in der Datei der Leitung.

### 2.3 Entwürfe

**Behoben (Befund 3).** Eine Zahldatei entsteht nur aus Abrechnungen im Stand
`approved` oder `paid` (`ZAHLBAR` in `payroll/export/route.ts`). Sind nur
Entwürfe da, antwortet die Schnittstelle mit 400 und sagt, woran es liegt —
und nicht, es fehle eine Bankverbindung.

`paid` bleibt zugelassen, damit eine bereits bezahlte Datei noch einmal
heruntergeladen werden kann; sie trägt dann dieselbe Kennung, und die Bank
erkennt die Dublette.

### 2.4 Bankverbindungen

* Arbeitgeber: `OrgSettings.iban`, `.bic`, `.kontoinhaber`
* Beschäftigte: `EmployeePayrollProfile.iban`, `.bic`, `.kontoinhaber`

**Weiterhin ohne Verschlüsselung auf Anwendungsebene** — Klartext in der
Datenbank. Siehe offene Punkte, Abschnitt 5.

### 2.5 Protokollierung

**Behoben (Befund 4).** Drei neue Spuren, alle über `logAudit`:

| Vorgang | Datei | Was festgehalten wird |
|---|---|---|
| SEPA-Export | `payroll/export/route.ts` | Kennung, Jahr, Monat, Standort, Anzahl, **Summe**, Ausführungsdatum, übersprungene Entwürfe |
| DATEV-Export | dieselbe | Jahr, Monat, Standort, Anzahl |
| Bankverbindung geändert | `api/org-settings/route.ts`, `api/employees/[id]/payroll-profile/route.ts` | wer, welche Felder, IBAN **gekürzt** vorher/nachher, und ob sie erstmalig gesetzt oder **getauscht** wurde |

Die IBAN steht im Protokoll nur als `DE89…3000` (`ibanGekuerzt()`): genug, um
eine Änderung zu erkennen, zu wenig, um davon zu überweisen. Protokolliert
wird nur, wenn sich wirklich etwas geändert hat — ein Speichern ohne Änderung
erzeugt keinen Eintrag.

**Warum das vor EBICS kommt und nicht danach:** Der häufigste Betrug bei
Gehaltszahlungen ist nicht der gehackte Bankzugang, sondern die
stillschweigend getauschte Kontonummer. Ohne diese Spur ist er unsichtbar.

### 2.6 Der Zahlungslauf (§218)

**Gebaut.** Eine Gehaltszahlung ist kein Download mehr, sondern ein Vorgang
mit Zuständen:

```
erzeugt ─► eingereicht ─► ausgefuehrt
   │            └─────────► abgelehnt
   └─► verworfen
```

* **`erzeugt`** entsteht mit der Datei. Ein nur erzeugter Lauf darf von einem
  neuen abgelöst werden — heruntergeladen heißt nicht eingereicht, und der
  häufigste Fall ist: Fehler bemerkt, korrigiert, neu heruntergeladen.
* **`eingereicht`** trägt die Unternehmensebene ein. Ab da gelten die
  enthaltenen Abrechnungen als **bezahlt**, und **für denselben Zeitraum
  entsteht keine zweite Datei mehr**, solange nicht feststeht, was aus dem
  Lauf geworden ist. Das ist der eigentliche Schutz vor der doppelten
  Gehaltszahlung — er wirkt in der Anlage und nicht erst bei der Bank.
* **`ausgefuehrt`** und **`abgelehnt`** sind Endstände. Eine Ablehnung gibt
  die Abrechnungen wieder frei. Was die Bank getan hat, nimmt die Software
  nicht zurück.
* **`verworfen`** gibt es nur aus `erzeugt`. Eine eingereichte Datei verwirft
  man bei der Bank, nicht in der Software.

**Wer was darf:** Lesen darf, wer auch den Export darf, auf seine Standorte
beschränkt. Den Stand ändern darf nur die Unternehmensebene — „ich habe das
bei der Bank eingereicht" ist eine Aussage über Geld, keine
Standortangelegenheit.

**Warum der Stand heute von Hand gepflegt wird:** Weil die Anlage keine
Bankverbindung hat. Mit EBICS wandert genau dieser Schritt vom Menschen zur
Anlage — die Übertragung trägt `eingereicht` ein, die Rückmeldung der Bank den
nächsten Stand. **Die Zustände bleiben dieselben.** Deshalb stehen sie schon
jetzt vollständig da und nicht erst, wenn die Bank antwortet.

**Was in dieser Tabelle nicht steht:** keine Namen, keine Kontoverbindungen,
keine Beträge je Person. Sie ist der Vorgang, nicht sein Inhalt. Der
Personenbezug liegt an der einzelnen Abrechnung (`PayrollEntry.zahllaufId`)
und verschwindet mit ihr — dort, wo das Löschkonzept (§128) ihn ohnehin führt.

> **Eine Entscheidung, die ausdrücklich getroffen wurde:** Die gespeicherte
> Zahldatei enthält Namen und Kontoverbindungen und steht trotzdem **nicht**
> im personenbezogenen Löschkatalog. Ein Zahlungsauftrag ist ein **Sammelbeleg
> des Arbeitgebers**; eine einzelne Zeile daraus zu entfernen zerstörte das
> Dokument, das eine Betriebsprüfung sehen will. In der Auskunft nach Art. 15
> taucht die Zugehörigkeit trotzdem auf — über die Abrechnung der Person.

### 2.7 EBICS-Bestandteile

**Weiterhin keine.** Keine Bibliothek, kein Schlüsselspeicher, keine
Bankparameter, kein Übertragungsweg, keine Statusabfrage. Der Ist-Stand der
Auszahlung bleibt: **Die Anlage erzeugt eine Datei, und ein Mensch lädt sie bei
seiner Bank hoch.**

---

## 3 · Was OKUN als Betreiber technisch könnte

**Zahlungen auslösen oder autorisieren: nein.** Es gibt keinen Bankzugang,
keinen Schlüssel, keinen Übertragungsweg. Das ist keine Zusage, sondern eine
Eigenschaft des Aufbaus.

**Mit Datenbankzugang weiterhin möglich:** Kontoverbindungen und Beträge
ändern, bevor eine Zahldatei entsteht. Die Datei wäre dann formal korrekt und
vom Kunden freigegeben, und das Geld ginge an ein fremdes Konto.

**Was sich daran seit §217 geändert hat:** Der Weg über die Oberfläche
hinterlässt jetzt eine Spur — wer eine IBAN tauscht, steht im Protokoll, und
die Summe jeder erzeugten Zahldatei ebenfalls. **Ein Eingriff direkt in der
Datenbank umgeht das weiterhin.** Dagegen hilft keine Anwendungslogik, sondern
nur die Trennung von Zugängen und ein Protokoll, das der Betreiber nicht
selbst ändern kann — das ist ein eigenes Thema und steht hier als offener
Punkt, nicht als gelöst.

---

## 4 · SOLL — Architekturvorschlag

### 4.1 Der Grundsatz

> **OKUN überträgt, der Kunde zeichnet.**
> Es darf keinen technischen Weg geben, auf dem OKUN allein einen Auftrag
> bankfachlich autorisiert. Nicht „wir tun es nicht" — **„wir können es
> nicht."**

OKUN tritt gegenüber der Bank allenfalls als Teilnehmer mit
**Transportberechtigung** auf. Die bankfachliche Unterschrift leistet der
Kunde — im Zugang seiner Bank, in deren App oder in seinem eigenen
EBICS-Client.

### 4.2 Bausteine

| Baustein | Aufgabe | Stand |
|---|---|---|
| **Zahllauf** | Ein Auftrag je Mandant, Monat und Auswahl: Summe, Anzahl, Zustand | ✅ da (§218) |
| **Zahldatei** | das erzeugte pain.001, unverändert aufbewahrt | ✅ da (§218) |
| **Bankzugang je Mandant** | Host-ID, Partner-ID, Benutzer-ID, Bank-URL, Einrichtungsstand | wartet auf die Bankantworten (6) |
| **Schlüsselmaterial** | die drei Schlüsselpaare des Teilnehmers | wartet auf Bank und Rechtsrat, siehe 4.4 |
| **Übertragung** | EBICS-Client, Auftragsart für SEPA-Überweisung | wartet auf die Auftragsarten der Bank |
| **Rückmeldung** | Verarbeitungsstatus bei der Bank abholen | wartet auf das Format der Bank |
| **Kennung** | stabil, aus dem Inhalt gerechnet | ✅ da (§217) |
| **Protokoll** | wer hat wann was erzeugt und geändert | ✅ da (§217) |
| **Freigabe-Erfordernis** | keine Zahlung aus Entwürfen | ✅ da (§217) |

### 4.3 Zustände eines Zahllaufs

Gebaut, siehe 2.6. Beide Regeln gelten: **Gezahlt wird nur, was freigegeben
ist** (§217), und **solange ein Lauf eingereicht ist, entsteht für denselben
Zeitraum keine zweite Datei** (§218). Der Doppelzahlungsschutz ist damit
keine Höflichkeit gegenüber der Bank mehr, sondern eine Regel der Anlage.

**Was mit EBICS dazukommt**, sind zwei Übergänge und kein neuer Zustand: Die
Übertragung setzt `eingereicht`, die abgeholte Rückmeldung setzt
`ausgefuehrt` oder `abgelehnt`. Heute setzt beides ein Mensch.

### 4.4 Schlüssel

| Weg | Wo liegt der Unterschriftsschlüssel | Was OKUN könnte |
|---|---|---|
| **A — nur Transport** | Transportschlüssel bei OKUN, Unterschriftsschlüssel **ausschließlich beim Kunden** | übertragen, nicht zeichnen |
| **B — Kunde hat eigenen Client** | alles beim Kunden | nichts (heutiger Zustand mit Komfort) |
| **C — alle Schlüssel bei OKUN** | alles bei OKUN | **alles.** Kommt nicht in Frage. |

**Vorschlag: Weg A**, mit zwei Auflagen. Erstens gehört auch ein
Transportschlüssel nicht in eine Umgebungsvariable neben die übrigen — **der
Vorfall vom 21.10.2026 bei unserem Hoster ist genau der Grund.** Zweitens muss
vor der ersten echten Übertragung schriftlich feststehen, dass eine
Transportunterschrift keine Zahlungsautorisierung ist und welche Rolle unser
Teilnehmer bei der konkreten Bank hat.

---

## 5 · Was offen bleibt — und bei wem

**An uns liegt nichts mehr.** Was noch aussteht, hängt an Dritten oder ist
eine bewusste Entscheidung mit Begründung:

| Punkt | Bei wem | Anmerkung |
|---|---|---|
| Die EBICS-Strecke selbst (4.2) | wartet auf Bank und Rechtsrat | sinnlos, sie vor den Antworten zu bauen |
| Verschlüsselung der Kontoverbindungen auf Anwendungsebene | **bewusst zurückgestellt** | siehe unten |
| Ein Protokoll, das der Betreiber nicht selbst ändern kann | offen, eigenes Thema | Abschnitt 3 |

**Zur Verschlüsselung, offen gesagt:** Sie würde einen Angreifer aufhalten,
der nur die Datenbank erreicht — nicht den, der die Umgebung erreicht, denn
dort läge der Schlüssel. Beim Vorfall am 21.10.2026 bei unserem Hoster sind
genau die Umgebungsvariablen abgeflossen. Sie wäre also eine Verbesserung und
keine Lösung, und sie gehört zusammen mit einem Schlüsselspeicher entschieden,
der nicht neben den übrigen Variablen liegt. Das ist ein eigener
Bauabschnitt, kein Nachtrag zu diesem hier.

---

## 6 · Offene Fragen an die Banken

1. Kann ein **Softwareanbieter als EBICS-Teilnehmer mit reiner
   Transportberechtigung** im Zugang eines Firmenkunden aufgenommen werden?
   Wie heißt diese Rolle bei Ihnen, und was darf sie?
2. Wie gibt der Kunde einen so eingelieferten Auftrag frei — in Ihrem
   Online-Banking, in einer App, nur in einem eigenen EBICS-Client? **Geht die
   Freigabe ohne zusätzliche Software beim Kunden?**
3. Welche **Auftragsarten** gelten bei Ihnen für SEPA-Überweisungen, und
   welche EBICS-Fassung setzen Sie voraus?
4. Wie erkennt Ihr Haus eine **Dublette** — über `MsgId`, über `PmtInfId`,
   über beides? Wie lange? *(Wir liefern inzwischen eine stabile, aus dem
   Inhalt gerechnete `MsgId` — siehe 2.1.)*
5. Welche **Rückmeldungen** stellen Sie bereit, in welchem Format, und wie
   lange sind sie abrufbar?
6. Welche Unterlagen braucht die Einrichtung (Teilnahmeerklärung, INI-Brief),
   und wie lange dauert die Freischaltung?
7. Fallen **Entgelte** an — je Zugang, je Teilnehmer, je Auftrag?
8. Gibt es eine **Testumgebung**?

---

## 7 · Offene Fragen an die Rechtsberatung

**Ausdrücklich ungeklärt: ob dieser Aufbau nach dem ZAG erlaubnisfrei ist.**
Die Vermutung stützt sich auf das BaFin-Merkblatt zum ZAG (Fassung Februar
2023) und die EBA-Auskunft 2021_6235, nach denen ein nur über EBICS genutztes
Konto nicht als online zugänglich gilt — und darauf, dass eine
Transportunterschrift keine Zahlungsautorisierung ist. **Beides ist gelesen,
nicht bestätigt.** Die BaFin stellt zugleich klar, dass eine Erlaubnispflicht
nicht dadurch entfällt, dass die Tätigkeit nur eine Nebenleistung ist.

1. Ist der Aufbau aus 4.1/4.4 (Weg A) ein **Zahlungsauslösedienst** im Sinne
   des ZAG — und wenn nein, woran genau hängt das?
2. Ändert sich die Bewertung, wenn OKUN den Zeitpunkt der Übertragung bestimmt
   oder der Auftrag ohne weiteres Zutun des Kunden erzeugt wird?
3. Was darf die Oberfläche anbieten, ohne dass daraus eine „Veranlassung"
   durch uns wird?
4. **Welche Gestaltung wäre eindeutig erlaubnispflichtig, damit wir sie
   ausschließen können?** (Wichtiger als Frage 1.)
5. Welche Pflichten träfen uns als **Auftragsverarbeiter** zusätzlich, wenn
   Kontoverbindungen über unsere Anlage an eine Bank übermittelt werden?
6. Empfiehlt sich eine **Anfrage an die BaFin** zur Erlaubnisfreiheit, oder
   reicht eine anwaltliche Einschätzung zu den Akten?

---

## 8 · Plan

| Stufe | Inhalt | Stand |
|---|---|---|
| **0** | Protokoll für Zahldatei und jede IBAN-Änderung | ✅ **erledigt (§217)** |
| **0b** | Standortbezug beim Export und beim Beleg; keine Zahlung aus Entwürfen | ✅ **erledigt (§217)** |
| **0c** | Stabile, aus dem Inhalt gerechnete Zahlungskennung | ✅ **erledigt (§217)** |
| **0d** | Ausführungsdatum mit Feiertagen, Wunschdatum wird geprüft statt verschoben | ✅ **erledigt (§218)** |
| **1** | **Zahllauf als Vorgang**: Tabelle, Zustände, gespeicherte Datei, `paid` wird gesetzt. Noch immer Download, kein EBICS | ✅ **erledigt (§218)** |
| **2** | Bankantworten auswerten (Abschnitt 6), Weg A oder B je Bank festlegen | wartet auf Dritte |
| **3** | Rechtliche Einschätzung einholen (Abschnitt 7) | läuft über `ANFRAGEN.md`, Abschnitt 5 |
| **4** | EBICS-Einrichtung je Mandant gegen eine **Testumgebung** | nach 2 und 3 |
| **5** | Übertragung eines freigegebenen Laufs, Kunde zeichnet bei seiner Bank | nach 4 |
| **6** | Rückmeldungen abholen, Zustände fortschreiben, Fehlerfälle | nach 5 |

---

## 9 · Was ausdrücklich nicht gebaut wird

* Kein Konto von OKUN, über das Geld läuft. In keiner Stufe.
* Keine Schlüssel, mit denen OKUN allein zeichnen könnte (Weg C).
* Keine automatische Übertragung ohne vorherige Freigabe durch einen Menschen.
* Kein Abruf von Kontoumsätzen.
