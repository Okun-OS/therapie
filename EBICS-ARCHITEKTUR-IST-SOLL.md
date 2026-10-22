# EBICS-Anbindung — Ist-Stand, Befunde und Architekturvorschlag

> **Stand: 22.10.2026.** Untersuchung und Dokumentation. **Es wurde nichts
> eingerichtet, nichts angebunden und keine Zahlung ausgelöst.** Es wurde auch
> kein Code für EBICS geschrieben.

> **Keine Rechtsauskunft.** Dieses Papier behauptet **nicht**, dass der
> vorgeschlagene Aufbau nach dem Zahlungsdiensteaufsichtsgesetz erlaubnisfrei
> ist. Es sagt, welche Gestaltung dafür sprechen *könnte*, und welche Fragen
> dafür beantwortet sein müssen — von einer Bank und von einem Anwalt, nicht
> von uns.

**Ziel, auf das hingearbeitet wird:** Ein Arbeitgeber soll die Gehaltszahlung
aus OKUN Workforce an seine Bank übermitteln und sie **selbst autorisieren**
können. Nicht Ziel: dass OKUN Zahlungen auslöst, freigibt oder Geld bewegt.

---

## 1 · Wie geprüft wurde

Gelesen wurden `LOHN-ZERTIFIZIERUNG.md` (Abschnitt 7, „Tür C"),
`AGENTENAUFTRAEGE.md` (Auftrag 2, Teil 3), `DEINE-LISTE.md` sowie der Code,
der heute Zahlungsdateien erzeugt. Jede Aussage über den Ist-Stand unten
nennt die Datei, aus der sie stammt.

**Dreiteilung, die dieses Papier durchhält:**

| | Bedeutung |
|---|---|
| **IST** | steht im Code, mit Dateipfad belegt |
| **PLAN** | steht in unserer Dokumentation, ist aber nicht gebaut |
| **OFFEN** | ist weder gebaut noch entschieden |

---

## 2 · IST — was heute wirklich da ist

### 2.1 Die SEPA-Datei

**Gebaut.** `src/lib/lohn-export.ts`, Funktion `sepaXml()`.

* Format **pain.001.001.03**, eine `PmtInf` je Lauf, `PmtMtd` `TRF`,
  `BtchBookg true`, `SvcLvl` `SEPA`, `ChrgBr` `SLEV`.
* Kopf mit `MsgId`, `CreDtTm`, `NbOfTxs`, `CtrlSum`, `InitgPty`.
* Je Zahlung `EndToEndId`, Betrag in EUR, Empfängername, IBAN, optional BIC,
  Verwendungszweck.
* **IBAN-Prüfung** mit Prüfsumme nach ISO 7064 (Modulo 97) —
  `ibanGueltig()`, gilt für Arbeitgeber und Beschäftigte.
* **Zeichenersetzung** für den SEPA-Zeichensatz (`sepaZeichen()`), damit
  Umlaute die Datei nicht scheitern lassen.
* Geprüft durch Modultests in `src/lib/__tests__/lohn-export.test.ts`.

**Ausgeliefert** wird sie über `src/app/api/payroll/export/route.ts`
(`GET /api/payroll/export?art=sepa&year=&month=[&locationId=][&datum=]`) als
Download mit `Cache-Control: private, no-store`.

**Ausführungsdatum:** ohne Angabe der übernächste Tag, Samstag und Sonntag
übersprungen. **Feiertage werden nicht berücksichtigt** (`route.ts`, Z. 141 ff.).

**Nicht gespeichert.** Die Datei entsteht bei der Anfrage und wird
ausgeliefert; sie wird **nirgends abgelegt** — kein `StoredFile`, keine
Tabelle, kein Eintrag. Dasselbe gilt für die Tatsache, dass sie erzeugt wurde.

### 2.2 Bankverbindungen

**Gebaut**, als einfache Textspalten:

* Arbeitgeber: `OrgSettings.iban`, `.bic`, `.kontoinhaber`
  (`prisma/schema.prisma`, Z. 848 ff.)
* Beschäftigte: `EmployeePayrollProfile.iban`, `.bic`, `.kontoinhaber`
  (`prisma/schema.prisma`, Z. 1951 ff., Kommentar dort: „Grundlage fuer die
  spaetere SEPA-Datei")

**Keine Verschlüsselung auf Anwendungsebene.** Die Werte stehen im Klartext in
der Datenbank. Wer die Datenbank lesen kann, liest alle Kontoverbindungen.

### 2.3 EBICS-Bestandteile

**Keine.** Eine Suche über das gesamte Projekt nach „ebics" findet
ausschließlich **Dokumentation** (`LOHN-ZERTIFIZIERUNG.md`,
`AGENTENAUFTRAEGE.md`, `DEINE-LISTE.md`). Es gibt:

* keine EBICS-Bibliothek in den Abhängigkeiten,
* keinen Schlüsselspeicher, keine Schlüsselerzeugung, keinen INI-Brief,
* keine Bankparameter je Mandant (Host-ID, Partner-ID, Benutzer-ID, URL),
* keinen Übertragungsweg, keine Auftragsarten, keine Statusabfrage.

**Der Ist-Stand der Auszahlung ist vollständig beschrieben mit einem Satz:
Die Anlage erzeugt eine Datei, und ein Mensch lädt sie bei seiner Bank hoch.**

### 2.4 Trennung von Übermittlung und Autorisierung

**Heute strukturell gegeben — weil es keine Übermittlung gibt.** Der Kunde
lädt hoch und zeichnet in seinem Bankzugang. OKUN hat keinen Bankzugang,
keinen Schlüssel und keine Möglichkeit, eine Zahlung auszulösen.

Die Absicht ist im Code festgehalten (`src/lib/lohn-export.ts`, Kopf):
Zahlungsverkehr für andere sei erlaubnispflichtig, deshalb erzeuge man eine
Datei, „die der Kunde bei SEINER Bank hochlädt und dort freigibt".

### 2.5 Mandantentrennung, Berechtigungen, Protokoll

* **Mandantentrennung:** über `resolveCustomerId(session)`; jede Abfrage ist
  auf `customerId` eingeschränkt. Keine Auffälligkeit gefunden.
* **Rollen:** `requireRole(req, ['admin', 'company', 'okun'])` — dabei ist
  `admin` die **Standortleitung** (`src/lib/session.ts`, Z. 8 und 130).
* **Protokollierung:** **keine.** Weder der Export (`payroll/export/route.ts`)
  noch das Ändern der Bankverbindung des Unternehmens
  (`api/org-settings/route.ts`) noch das Ändern der Kontoverbindung eines
  Beschäftigten (`api/employees/[id]/payroll-profile/route.ts`) schreibt einen
  Eintrag über `logAudit` — in allen drei Dateien kommt `logAudit` **null
  Mal** vor.

### 2.6 Schutz gegen doppelte Zahlung, Zahlungsstatus

* **Kein Schutz.** Die `MsgId` wird als `OKUN-${Date.now()}` gebildet
  (`lohn-export.ts`). Zwei Abrufe desselben Monats ergeben **zwei Dateien mit
  verschiedenen Kennungen** — für die Bank sind das zwei verschiedene
  Aufträge, und sie würde beide annehmen.
* **Kein Status.** `PayrollEntry.status` kennt `draft`, `approved`, `paid`
  (`src/app/api/payroll/route.ts`, Z. 220). Der Export **liest ihn nicht** und
  **setzt ihn nicht**. Eine Abrechnung bleibt nach der Zahlung auf demselben
  Stand wie davor.
* **Keine Rückmeldung.** Ob die Bank den Auftrag angenommen, abgelehnt oder
  ausgeführt hat, erfährt die Anlage nicht und speichert sie nicht.

---

## 3 · Befunde

Vier Punkte, in der Reihenfolge, in der sie wehtun. Alle vier sind **heute**
schon da und werden mit EBICS **größer**, weil dann ein Auftrag die Anlage
verlässt, statt auf einem Bildschirm zu landen.

### Befund 1 — Die Standortleitung kann die Zahldatei des ganzen Unternehmens abrufen

`payroll/export/route.ts` prüft den Standortbezug **nur, wenn `locationId`
mitgegeben wird** (Z. 43–46). Ohne diesen Parameter lautet die Abfrage
`{ customerId, year, month }` — also **alle Standorte**.

Zum Vergleich: `payroll/aufrollen`, `payroll/einmalzahlung`,
`payroll/jahresabschluss`, `payroll/vorbereiten`, `payroll/elstam` und
`payroll` selbst rufen alle `allowedLocationScope(session)` auf und
schränken damit ein. Der Export ist die Ausnahme — das spricht für ein
Versehen, nicht für eine Entscheidung.

**Wirkung:** Eine Standortleitung kann eine Datei herunterladen, die
**Name, IBAN und Auszahlungsbetrag jeder beschäftigten Person des gesamten
Trägers** enthält.

**Status: offen. Bewusst nicht ohne Freigabe geändert**, weil es die
Berechtigungen der Lohnabrechnung verschiebt.

### Befund 2 — Es gibt keinen Schutz gegen die doppelte Zahlung

Zweimal auf „SEPA-Datei" geklickt, zweimal hochgeladen, zweimal gezahlt. Der
einzige Mechanismus, der das bankseitig verhindern könnte — eine über die
Zeit stabile `MsgId` je Monat und Mandant —, ist nicht vorhanden.

Mit EBICS wird daraus der Unterschied zwischen einem Fehlklick und einer
doppelt ausgeführten Gehaltszahlung.

### Befund 3 — Entwürfe sind auszahlbar

Der Export filtert nicht auf `status`. Eine Abrechnung im Stand `draft` landet
in der Zahldatei wie eine freigegebene. Die Regel „kein Lohn ohne
freigegebenen Monat" (`src/lib/monatsfreigabe.ts`, §136) greift bei der
Berechnung, **nicht beim Auszahlen**.

### Befund 4 — Weder Zahldatei noch Bankverbindung hinterlassen eine Spur

Kein Protokolleintrag beim Export, keiner beim Ändern einer IBAN. Für eine
Datei mit allen Kontoverbindungen eines Betriebs ist das zu wenig — und für
den Fall, dass eine Kontonummer stillschweigend getauscht wurde (der
klassische Gehaltsbetrug), fehlt damit genau der Nachweis, der ihn
aufdeckt.

---

## 4 · Was OKUN als Betreiber heute technisch könnte

Unbequem, aber es gehört in dieses Papier.

**OKUN kann heute keine Zahlung autorisieren und keine auslösen.** Es gibt
keinen Bankzugang, keinen Schlüssel, keinen Übertragungsweg. Das ist keine
Zusage, sondern eine Eigenschaft des Aufbaus: Was nicht da ist, kann nicht
missbraucht werden.

**Was OKUN mit Datenbankzugang sehr wohl könnte:**

* **Kontoverbindungen lesen** — alle, im Klartext, von Arbeitgebern und
  Beschäftigten.
* **Kontoverbindungen ändern**, bevor eine Zahldatei erzeugt wird. Die Datei
  wäre dann formal korrekt, von der richtigen Person freigegeben, und das
  Geld ginge an ein fremdes Konto. **Ohne Protokoll (Befund 4) bliebe das
  unsichtbar.**
* **Beträge ändern**, mit derselben Folge.

**Das heißt:** Die Trennung „der Kunde autorisiert" schützt heute davor, dass
OKUN *eine Zahlung anstößt* — nicht davor, dass OKUN beeinflusst, *was* in der
Zahlung steht. Mit EBICS ändert sich daran nichts; der Unterschied ist nur,
dass der Weg kürzer wird. **Wer das ernst nimmt, löst Befund 4, bevor er EBICS
baut.**

---

## 5 · SOLL — Architekturvorschlag

### 5.1 Der Grundsatz, aus dem alles folgt

> **OKUN überträgt, der Kunde zeichnet.**
> Es darf keinen technischen Weg geben, auf dem OKUN allein einen Auftrag
> bankfachlich autorisiert. Nicht „wir tun es nicht" — **„wir können es
> nicht."**

Praktisch heißt das: OKUN tritt gegenüber der Bank allenfalls als Teilnehmer
mit **Transportberechtigung** auf. Die bankfachliche Unterschrift (Einzel-
oder Kollektivunterschrift) leistet der Kunde — im Zugang seiner Bank, in
deren App oder in seinem eigenen EBICS-Client. Ob und wie eine Bank das
einrichtet, ist Frage 1 in Abschnitt 6.

### 5.2 Bausteine

| Baustein | Aufgabe | Anmerkung |
|---|---|---|
| **Zahllauf** (neue Tabelle) | Ein Auftrag je Mandant, Monat und Standortauswahl: Inhalt, Summe, Anzahl, Zustand | Das fehlende Stück. Heute existiert ein Zahllauf nur als Datei im Download-Ordner. |
| **Zahldatei** | das erzeugte pain.001 | unverändert gespeichert, weil nachher niemand mehr rekonstruieren kann, was unterschrieben wurde |
| **Bankzugang je Mandant** | Host-ID, Partner-ID, Benutzer-ID, Bank-URL, Zustand der Einrichtung | keine Geheimnisse in dieser Tabelle außer dem, was unten steht |
| **Schlüsselmaterial** | die drei Schlüsselpaare des Teilnehmers | siehe 5.4 — der heikelste Teil |
| **Übertragung** | EBICS-Client, Auftragsart für SEPA-Überweisung | eigene Bibliothek oder Dienst, siehe 6 |
| **Rückmeldung** | Abholen des Verarbeitungsstatus bei der Bank | sonst endet jeder Lauf im Ungewissen |

### 5.3 Zustände eines Zahllaufs

```
entwurf ─► freigegeben ─► übertragen ─► angenommen ─► ausgeführt
                │              │             └─► abgelehnt
                │              └─► Übertragung fehlgeschlagen
                └─► verworfen
```

Zwei Regeln, die daran hängen:

1. **Übertragen wird nur ein freigegebener Lauf** — und freigegeben wird nur,
   was aus Abrechnungen im Stand `approved` besteht (behebt Befund 3).
2. **Je Mandant, Monat und Auswahl kann es nur einen nicht verworfenen Lauf
   geben.** Das ist der Platz, an dem Befund 2 verschwindet: Die `MsgId` wird
   aus der Kennung des Laufs gebildet und ist damit stabil. Eine zweite
   Übertragung desselben Laufs trägt dieselbe Kennung, und die Bank erkennt
   sie als Dublette.

### 5.4 Schlüssel — die Stelle, an der es ernst wird

Drei Wege, und sie unterscheiden sich darin, was OKUN im Ernstfall könnte:

| Weg | Wo liegt der Unterschriftsschlüssel | Was OKUN könnte |
|---|---|---|
| **A — nur Transport** | Transportschlüssel bei OKUN, Unterschriftsschlüssel **ausschließlich beim Kunden** | übertragen, nicht zeichnen |
| **B — Kunde hat eigenen Client** | alles beim Kunden, OKUN erzeugt nur die Datei | nichts (= heutiger Zustand mit Komfort) |
| **C — alle Schlüssel bei OKUN** | alles bei OKUN | **alles.** Kommt nicht in Frage. |

**Vorschlag: Weg A**, mit zwei Auflagen. Erstens: Auch der Transportschlüssel
ist ein Geheimnis und gehört nicht in eine Umgebungsvariable neben die
übrigen — **der Vorfall vom 21.10.2026 bei unserem Hoster ist genau der
Grund.** Zweitens: Vor der ersten echten Übertragung muss schriftlich
feststehen, dass eine Transportunterschrift keine Zahlungsautorisierung ist
und welche Rolle unser Teilnehmer bei der konkreten Bank hat.

### 5.5 Was zuerst kommt, auch wenn es nichts mit EBICS zu tun hat

Vor der ersten Zeile EBICS-Code: **Befund 4 beheben.** Jede Änderung einer
IBAN — beim Unternehmen wie bei einer beschäftigten Person — gehört ins
Protokoll, mit Zeitpunkt, Person und Vorher-Nachher (die IBAN selbst dabei
gekürzt, nicht vollständig). Ebenso jede Erzeugung einer Zahldatei.

Begründung in einem Satz: Eine Zahlung, die niemand nachvollziehen kann, ist
im Streitfall dasselbe wie keine Zahlung — und der häufigste Betrug in diesem
Bereich ist nicht der gehackte Bankzugang, sondern die stillschweigend
getauschte Kontonummer.

---

## 6 · Offene Fragen an die Banken

Zu stellen an **zwei bis drei** Institute, möglichst die der ersten Kunden —
die Antworten unterscheiden sich von Haus zu Haus.

1. Kann ein **Softwareanbieter als EBICS-Teilnehmer mit reiner
   Transportberechtigung** im Zugang eines Firmenkunden aufgenommen werden?
   Wie heißt diese Rolle bei Ihnen, und was darf sie?
2. Wie gibt der Kunde einen so eingelieferten Auftrag frei — in Ihrem
   Online-Banking, in einer App, nur in einem eigenen EBICS-Client? **Geht
   die Freigabe ohne zusätzliche Software beim Kunden?**
3. Welche **Auftragsarten** gelten bei Ihnen für SEPA-Überweisungen, und
   welche EBICS-Fassung setzen Sie voraus?
4. Wie erkennt Ihr Haus eine **Dublette** — über `MsgId`, über `PmtInfId`,
   über beides? Wie lange?
5. Welche **Rückmeldungen** stellen Sie bereit, in welchem Format, und wie
   lange sind sie abrufbar?
6. Welche Unterlagen braucht die Einrichtung (Teilnahmeerklärung,
   INI-Brief), und wie lange dauert die Freischaltung?
7. Fallen **Entgelte** an — je Zugang, je Teilnehmer, je Auftrag?
8. Gibt es eine **Testumgebung**?

---

## 7 · Offene Fragen an die Rechtsberatung

**Ausdrücklich ungeklärt: ob dieser Aufbau nach dem ZAG erlaubnisfrei ist.**
Die Vermutung stützt sich auf das BaFin-Merkblatt zum ZAG in der Fassung vom
Februar 2023 und die EBA-Auskunft 2021_6235, nach denen ein nur über EBICS
genutztes Konto nicht als online zugänglich gilt — und auf den Umstand, dass
eine Transportunterschrift keine Zahlungsautorisierung ist. **Beides ist
gelesen, nicht bestätigt.** Die BaFin sagt zugleich ausdrücklich, dass eine
Erlaubnispflicht nicht dadurch entfällt, dass die Tätigkeit nur eine
Nebenleistung ist.

1. Ist der Aufbau aus 5.1/5.4 (Weg A) ein **Zahlungsauslösedienst** im Sinne
   des ZAG — und wenn nein, woran genau hängt das?
2. Ändert sich die Bewertung, wenn OKUN den Zeitpunkt der Übertragung
   bestimmt, oder wenn der Auftrag ohne weiteres Zutun des Kunden erzeugt
   wird?
3. Was darf die Oberfläche dem Kunden anzeigen und anbieten, ohne dass daraus
   eine „Veranlassung" durch uns wird?
4. Welche Gestaltung wäre eindeutig erlaubnispflichtig, damit wir sie
   ausschließen können? (Die Frage ist uns wichtiger als die erste.)
5. Welche Pflichten träfen uns als **Auftragsverarbeiter** zusätzlich, wenn
   Kontoverbindungen über unsere Anlage an eine Bank übermittelt werden?
6. Empfiehlt sich eine **Anfrage an die BaFin** zur Erlaubnisfreiheit, oder
   reicht eine anwaltliche Einschätzung zu den Akten?

---

## 8 · Schrittweiser Plan

| Stufe | Inhalt | Abhängig von | Zustand |
|---|---|---|---|
| **0** | Befund 4 beheben: Protokoll für Zahldatei und jede IBAN-Änderung | nichts | kann sofort |
| **0b** | Befund 1 und 3 beheben: Standortbezug beim Export, nur freigegebene Abrechnungen | Freigabe des Eigentümers (Berechtigungsfrage) | wartet |
| **1** | **Zahllauf als Vorgang** mit Zuständen und stabiler `MsgId`; Datei wird gespeichert statt nur ausgeliefert. **Noch immer Download, kein EBICS** — behebt Befund 2 und macht die Zahlung nachvollziehbar | Stufe 0 | nächster Bauabschnitt |
| **2** | Bankantworten auswerten (Abschnitt 6), Weg A oder B je Bank festlegen | Antworten | wartet auf Dritte |
| **3** | Rechtliche Einschätzung einholen (Abschnitt 7) | — | läuft über `ANFRAGEN.md`, Abschnitt 5 |
| **4** | EBICS-Einrichtung je Mandant: Zugangsdaten, Schlüsselerzeugung, INI-Brief, Zustandsanzeige — **gegen eine Testumgebung** | 2 und 3 | nicht vorher |
| **5** | Übertragung eines freigegebenen Laufs, Kunde zeichnet bei seiner Bank | 4 | — |
| **6** | Rückmeldungen abholen, Zustände fortschreiben, Fehlerfälle | 5 | — |

**Stufe 1 ist der Punkt, an dem der größte Nutzen bei kleinstem Risiko
entsteht**: Sie beseitigt die doppelte Zahlung und macht nachvollziehbar, was
gezahlt wurde — ohne eine einzige Bankverbindung und ohne eine einzige offene
Rechtsfrage.

---

## 9 · Was ausdrücklich nicht gebaut wird

* Kein Konto von OKUN, über das Geld läuft. In keiner Stufe.
* Keine Schlüssel, mit denen OKUN allein zeichnen könnte (Weg C).
* Keine automatische Übertragung ohne vorherige Freigabe durch einen Menschen.
* Kein Abruf von Kontoumsätzen. Für die Gehaltszahlung wird er nicht
  gebraucht, und er wäre ein zweiter Grund, über Erlaubnispflichten zu reden.
