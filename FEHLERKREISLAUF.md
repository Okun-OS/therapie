# Vorschlag: Funde erfassen, täglich auswerten, automatisch beheben

Stand: 12.09.2026 · **Stufe 1 und 2 gebaut** · Stufe 3 offen

---

## Worum es geht

Heute läuft es so: Du testest, trägst Gefundenes in ein Google Sheet ein, und ich
arbeite es später von Hand ab. Das funktioniert — aber es hat drei Schwächen:

1. **Der Umweg.** Du bist in der App, findest etwas, wechselst ins Sheet, tippst
   ab, wo du warst. Die Hälfte der Kleinigkeiten meldet man dann gar nicht.
2. **Die Meldung ist so gut wie der Tag, an dem sie entstand.** „Gruppen gehen
   nicht" ist in zwei Wochen wertlos — niemand weiß mehr, welche Rolle, welcher
   Standort, welche Version.
3. **Du bekommst keine Rückmeldung.** Was ist erledigt? Was wartet auf dich?

## Die gute Nachricht: die Hälfte steht schon

Es gibt bereits einen **Melde-Knopf auf jeder Seite** (unten links, der Käfer)
und dahinter eine Tabelle `BugReport`. Jede Meldung nimmt heute schon automatisch
mit: wer gemeldet hat, in welcher Rolle, bei welchem Kunden, **auf welcher
Seite**, mit welchem Browser, welche Fehlermeldungen in der Konsole standen und
**die letzten zehn Klicks**. Unter `/okun/bugs` gibt es die Liste mit Status.

Das ist die Grundlage. Es fehlen drei Dinge: bessere Fragen beim Erfassen, der
tägliche Lauf, und die Regeln, wann ich selbst handeln darf.

---

## Stufe 1 und 2 sind gebaut (12.09.)

**Stufe 1 — Erfassen.** Unter **Funde** gibt es zwei Wege zum Melden: den Käfer
für unterwegs und ein ausführliches Formular für die Tester. Beide mit denselben
Pflichtangaben, beide mit der Ampel, die sagt, ob die Meldung reicht.
Verbesserungsvorschläge sind eine eigene Art und warten auf Freigabe.

**Stufe 2 — Der Lauf.** Ein eigener, schmaler Zugang (`/api/okun/funde`), ein
Zeitplan, der stündlich eine Sitzung weckt, und ein Bericht auf der Fundeseite,
der zeigt, was beim nächsten Lauf ansteht. Der Lauf **ändert noch keinen Code** —
er liest, beurteilt und schreibt Vorschläge und Rückfragen zurück.

Nachgewiesen mit 55 Prüfungen am laufenden System und 26 Modultests.

### Was noch fehlt, damit der Lauf etwas tut

Der Zeitplan läuft, findet aber nichts, solange **zwei Umgebungsvariablen**
fehlen. Beide gehören in die Sitzungsumgebung (nicht nach Railway — der Lauf
ruft von außen an):

| Variable | Wert |
|---|---|
| `FUNDE_URL` | `https://therapie-production.up.railway.app` |
| `FUNDE_TOKEN` | ein selbst gewürfelter Schlüssel, mindestens 24 Zeichen |

Derselbe `FUNDE_TOKEN` muss zusätzlich **in den Railway-Variablen** stehen —
sonst weiß das laufende System nicht, wen es hereinlassen soll. Einen Schlüssel
erzeugen zum Beispiel mit `openssl rand -base64 32`.

**Ohne hinterlegten Schlüssel ist der Zugang zu** — nicht offen, nicht „erstmal
erlaubt". Ein Zugang, der ohne Einrichtung funktioniert, ist irgendwann ein
Zugang, den niemand eingerichtet hat.

## Teil 1 — Besser fragen (das ist die eigentliche Arbeit)

**Die wichtigste Einsicht vorweg:** Wie gut eine automatische Behebung wird,
hängt fast ausschließlich davon ab, wie gut die Meldung ist. Nicht von der
Automatik. Ein Formular, das die richtigen Fragen stellt, ist deshalb mehr wert
als jede Klugheit danach.

Heute fragt der Melde-Knopf nach Titel, Beschreibung und Schwere. Das reicht
nicht. Dazu kommen soll:

| Feld | Warum |
|---|---|
| **Art** — Fehler · Verbesserung · Frage · Wunsch | Ein Wunsch ist kein Fehler. Heute landet beides im selben Topf und wird gleich dringend behandelt. |
| **Betrifft** — Dienstplan · Zeit · Urlaub · Lohn · Nachrichten · Akte · Datenschutz · Einrichtung | Damit sich Meldungen bündeln lassen: fünf Meldungen zum selben Bereich sind ein Muster, nicht fünf Einzelfälle. |
| **Was hast du getan?** | Ohne die Schritte lässt sich ein Fehler nicht nachstellen. Die letzten zehn Klicks kommen automatisch dazu — das Feld ist der Satz drumherum. |
| **Was ist passiert?** | Der Befund. |
| **Was hättest du erwartet?** | **Das wichtigste Feld.** Ohne es lässt sich nicht entscheiden, ob etwas kaputt ist oder nur anders, als du dachtest. Genau hier liegt der Unterschied zwischen Fehler und Verbesserung. |
| **Tritt es immer auf?** — immer · manchmal · einmal | „Manchmal" heißt fast immer: es hängt an Daten. Das ändert die Suche komplett. |
| **Geht dabei Geld oder Recht verloren?** | Lohn, Arbeitszeiten, Löschfristen, Zugriffsrechte. Setzt die Dringlichkeit automatisch hoch — und sperrt zugleich die automatische Behebung (siehe Teil 3). |

Automatisch mitgeschickt wird zusätzlich zu heute noch die **Version** (die
Build-Nummer steht schon unten auf der Einrichtungsseite). Ohne sie ist nach dem
nächsten Ausrollen unklar, ob ein Fehler noch existiert.

### Die Ampel beim Absenden
Das Formular sagt selbst, ob die Meldung reicht:

> 🟢 *„Damit kann ich arbeiten."*
> 🟡 *„Was hättest du stattdessen erwartet? Ohne das weiß ich nicht, ob es ein Fehler ist."*

Eine gelbe Meldung wird **trotzdem angenommen** — eine abgelehnte Meldung ist
eine verlorene Meldung. Sie wird nur markiert, und der tägliche Lauf stellt dann
genau die eine fehlende Frage zurück.

---

## Teil 2 — Der Lauf

**Wie das Auslösen wirklich funktioniert.** Ich kann mich nicht selbst aus der
App heraus wecken — die App kann mir nichts zurufen. Es gibt zwei Wege:

1. **Ein Zeitplan**, der von sich aus eine Sitzung startet. Den kann ich
   einrichten, du musst nichts installieren. Kleinste Taktung: **stündlich**.
2. **Du schreibst mir eine Zeile.** Dann sofort.

Für „sofort nach der Freigabe" heißt das: Du drückst *Freigeben*, und beim
nächsten Lauf wird es abgearbeitet — bei stündlichem Takt im Schnitt eine halbe
Stunde. Brennt es, schreibst du mir, dann ist es sofort.

**Empfehlung: stündlich statt täglich.** Ein Lauf ohne offene Funde kostet fast
nichts, und die Wartezeit auf eine Freigabe fällt von einem Tag auf Minuten.

**Was du dafür einmal tun musst:** einen Zugangsschlüssel anlegen — eine Zeile
in den Railway-Variablen und dieselbe in der Sitzungsumgebung. Kein Programm,
keine Installation. Damit darf die Sitzung die offenen Funde aus dem laufenden
System lesen und den Status zurückschreiben.

Bei jedem Lauf lese ich alle neuen Meldungen und sortiere sie in drei Töpfe:

### Topf 1 — selbst erledigt
Kleinigkeiten mit eindeutigem Befund und ohne Verhaltensänderung:
- Texte, Rechtschreibung, unklare Formulierungen
- fehlende Hinweise („Knopf tut nichts und sagt nicht warum")
- tote Menüpunkte und Links
- fehlende Ladeanzeigen, abgeschnittene Darstellung
- offensichtliche Lücken mit klarem Muster (eine Liste ohne Mandantenfilter)

**Bedingung:** Es entsteht eine neue Prüfung dafür, und danach laufen **alle**
Prüfungen durch. Rot heißt: nicht ausgerollt, landet in Topf 2.

### Topf 2 — Vorschlag, du bestätigst
Alles, was Verhalten ändert. Du bekommst je Fund fünf Sätze:

> **Was passiert ist** · **Warum** · **Was ich ändern würde** · **Was dabei
> schiefgehen kann** · **Welche Prüfung es danach absichert**

Ein Klick „Machen" — dann läuft es wie Topf 1.

### Topf 3 — Rückfrage
Die Meldung reicht nicht. Es kommt **eine** konkrete Frage zurück, nicht ein
Fragebogen. Die Antwort gibst du direkt in der Meldung.

### Was du morgens siehst
Eine Seite „Gestern gemeldet":

```
7 neue Meldungen
  4 erledigt        → mit einem Satz, was geändert wurde
  2 warten auf dich → mit dem Vorschlag zum Bestätigen
  1 Rückfrage       → "Bei welcher Rolle war das?"
```

---

## Teil 3 — Die Leitplanken

Ohne diese Regeln ist automatische Behebung gefährlicher als hilfreich.

1. **Nie ohne neue Prüfung.** Jede Behebung bringt einen Nachweis mit. Sonst
   kommt derselbe Fehler in vier Wochen zurück und keiner merkt es.
2. **Niemals automatisch bei:** Lohnrechnung · Löschkonzept und Fristen ·
   Zugriffsrechte und Rollen · jeder Änderung an bestehenden Daten. Hier gibt es
   **immer** einen Vorschlag zum Bestätigen, egal wie klein er aussieht. Das ist
   dieselbe Grenze, die heute schon für Migrationen gilt.
3. **Höchstens fünf automatische Änderungen am Tag.** Wenn mehr anfällt, ist
   etwas Größeres im Argen — das gehört besprochen, nicht abgearbeitet.
4. **Alles über die volle Prüfstrecke.** Die 600 Nachweise laufen vor jedem
   Ausrollen. Eine einzige rote Prüfung stoppt alles.
5. **Jede Änderung einzeln zurückdrehbar** und in einem Satz begründet.
6. **Ein Schalter je Bereich.** Du kannst die Automatik für „Texte" einschalten
   und für „Dienstplan" aus lassen. Startzustand: alles aus.

---

## Warum nicht einfach das Google Sheet auslesen?

Das ginge — einmal am Tag das Sheet lesen, verstehen, abarbeiten. Aber:

- **Ein zusätzlicher Zugang.** Das System bräuchte Google-Zugangsdaten. Ein Weg
  mehr nach draußen, der abgesichert und erneuert werden will.
- **Freitext ohne Bezug.** Im Sheet steht, was jemand tippt. In der App weiß ich
  ohne Nachfrage, wer in welcher Rolle bei welchem Kunden auf welcher Seite mit
  welcher Version war — und was er davor geklickt hat.
- **Keine Rückmeldung.** Ein Sheet kann nicht nachfragen und nicht melden, dass
  etwas erledigt ist.
- **Nur du kannst melden.** Später sollen auch Standortleitungen und Mitarbeiter
  melden können. Ins Sheet lässt du sie nicht.

**Empfehlung:** In der App. Das Sheet kann parallel weiterlaufen, bis Teil 1 und
2 stehen — und danach übernimmt die App die Vorlage einmalig.

---

## Aufwand und Reihenfolge

| Stufe | Was | Aufwand | Nutzen |
|---|---|---|---|
| **1** | Erfassung erweitern (Teil 1), Liste mit Status, Rückfragen | ~1 Tag | Ersetzt das Sheet sofort |
| **2** | Täglicher Lauf mit Bericht und Vorschlägen — **ohne** Automatik | ~1 Tag | Du siehst jeden Morgen, was los ist, und entscheidest mit einem Klick |
| **3** | Automatische Behebung für Topf 1, je Bereich einschaltbar | ~1–2 Tage | Kleinigkeiten verschwinden von selbst |

**Vorschlag zur Reihenfolge:** Stufe 1 und 2 bringen zusammen rund achtzig
Prozent des Nutzens und haben **kein Risiko** — es wird nichts von allein
geändert. Stufe 3 würde ich erst einschalten, wenn der Bericht ein paar Wochen
gezeigt hat, dass meine Einschätzung („das kann ich selbst") auch stimmt. Diese
Reihenfolge kostet nichts und macht den Unterschied zwischen einem Werkzeug, dem
man traut, und einem, das man nach dem ersten Schreck wieder abschaltet.

---

## Was du entscheiden musst

1. In der App oder weiter über das Sheet?
2. Stufen 1 und 2 zuerst, oder gleich alles?
3. Sollen auch Standortleitungen und Mitarbeiter melden können — oder erst mal
   nur OKUN?
