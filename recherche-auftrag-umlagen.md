# Rechercheauftrag: U1- und U2-Umlagesätze je Krankenkasse

Diesen Text in einen anderen Chat kopieren (ChatGPT, Claude, Perplexity —
etwas mit Websuche). Das Ergebnis kannst du mir dann unverändert schicken.

> **Warum das nicht das Programm macht:** U1 und U2 legt jede Krankenkasse in
> ihrer **eigenen Satzung** fest. Sie stehen in keinem Gesetz und in keiner
> Tabelle, die man einmal einbaut — sie ändern sich jedes Jahr und je Kasse.
> Eine geratene Umlage wäre schlimmer als eine fehlende, weil sie niemandem
> auffällt. Deshalb werden sie eingetragen und nicht berechnet.

---

## Der Text zum Kopieren

---

Ich brauche eine belegte Übersicht der **Umlagesätze U1 und U2** deutscher
gesetzlicher Krankenkassen für das Jahr **2026**. Bitte recherchiere im Web
und nutze als Quelle ausschließlich die **Satzung oder die offizielle
Beitrags-/Umlagenübersicht der jeweiligen Krankenkasse** — keine Blogs, keine
Lohnsoftware-Vergleichsseiten, keine Foren.

**Worum es geht:** Nach dem Aufwendungsausgleichsgesetz (AAG) zahlt jeder
Arbeitgeber Umlagen an die Krankenkasse seiner Beschäftigten:

- **U1** (§1 Abs. 1 AAG) — Ausgleich für Entgeltfortzahlung im Krankheitsfall.
  Nur für Betriebe **bis 30 Arbeitnehmer**. Die meisten Kassen bieten
  **mehrere Erstattungsstufen zur Wahl** (z. B. 50 %, 60 %, 70 %, 80 %) mit
  jeweils **unterschiedlichem Umlagesatz** — je höher die Erstattung, desto
  höher der Satz.
- **U2** (§1 Abs. 2 AAG) — Ausgleich bei Mutterschaft. Für **alle**
  Arbeitgeber, ohne Größengrenze, **ein einziger Satz** je Kasse.

**Wichtige Abgrenzung — bitte nicht verwechseln:**
- Der **kassenindividuelle Zusatzbeitrag** ist etwas völlig anderes und wird
  hier **nicht** gebraucht.
- Der **allgemeine Beitragssatz** (14,6 %) ebenfalls nicht.
- Die **Insolvenzgeldumlage** ist bundeseinheitlich und ebenfalls nicht
  gefragt.
- Nur U1 und U2 nach dem AAG.

### Diese Kassen bitte abdecken

Die großen bundesweiten:
Techniker Krankenkasse (TK) · BARMER · DAK-Gesundheit · KKH · hkk · IKK
classic · SBK (Siemens-Betriebskrankenkasse) · Knappschaft · BIG direkt
gesund · Viactiv · mhplus · pronova BKK · Securvita

Die AOKs — **jede Region hat eigene Sätze**, bitte einzeln:
AOK Baden-Württemberg · AOK Bayern · AOK Bremen/Bremerhaven · AOK Hessen ·
AOK Niedersachsen · AOK Nordost · AOK NordWest · AOK PLUS ·
AOK Rheinland/Hamburg · AOK Rheinland-Pfalz/Saarland · AOK Sachsen-Anhalt

### So bitte ausgeben

Eine Zeile je Kasse und je U1-Erstattungsstufe, als **CSV mit genau diesen
Spalten**, Dezimaltrennzeichen als **Punkt**, Prozentwerte als Zahl ohne
Prozentzeichen:

```
kasse;u1_erstattung_prozent;u1_satz_prozent;u2_satz_prozent;gueltig_ab;quelle
Techniker Krankenkasse;50;1.60;0.65;2026-01-01;https://www.tk.de/…
Techniker Krankenkasse;80;2.90;0.65;2026-01-01;https://www.tk.de/…
```

- `kasse` — der offizielle Name, so wie die Kasse sich selbst nennt
- `u1_erstattung_prozent` — die Erstattungsstufe (50, 60, 70, 80 …)
- `u1_satz_prozent` — der Umlagesatz zu **genau dieser** Stufe
- `u2_satz_prozent` — der U2-Satz der Kasse (in jeder Zeile derselbe)
- `gueltig_ab` — ab wann der Satz gilt, als JJJJ-MM-TT
- `quelle` — die **direkte URL** zur Satzung oder Umlagenübersicht dieser
  Kasse, auf der die Zahl steht

### Drei Regeln, die mir wichtiger sind als Vollständigkeit

1. **Rate nichts.** Findest du für eine Kasse keinen belegten Wert, schreib
   die Zeile trotzdem und setze in die Zahlenspalten `?`, in `quelle` den
   Grund. Eine fehlende Zahl kann ich nachtragen, eine falsche merkt niemand.
2. **Keine Zahl ohne Quelle.** Wenn du eine URL nicht wirklich aufgerufen
   hast, schreib das dazu. Erfinde keine Links.
3. **Kein Vorjahr als Ersatz.** Ist der Satz für 2026 noch nicht
   veröffentlicht, schreib das hin (`?` und in `quelle`: „2026 noch nicht
   veröffentlicht, Stand 2025: X %"). Ein Vorjahreswert, der als aktuell
   ausgegeben wird, ist der gefährlichste Fall.

Zum Schluss bitte in zwei, drei Sätzen: Für welche Kassen war die Quellenlage
eindeutig, wo hast du etwas nicht sicher gefunden, und gab es Kassen, bei
denen sich die Sätze unterjährig ändern?

---

## Wenn die Liste da ist

Schick sie mir einfach so, wie sie kommt — auch mit den `?`-Zeilen. Ich
prüfe sie gegen das, was das Programm braucht, trage sie ein und sage dir,
welche Kassen deiner Belegschaft danach noch offen sind.

**Nur die Kassen, die deine Mitarbeiter wirklich haben, müssen am Ende
hinterlegt sein.** Welche das sind, zeigt die Maske selbst:
`/company/lohnverwaltung` → Umlagesätze — dort steht oben, für welche Kassen
noch nichts hinterlegt ist.

Und: **Die Erstattungsstufe wählst du**, nicht die Kasse. Deshalb sind in der
Liste alle Stufen — beim Eintragen nehmen wir die, für die dein Betrieb sich
bei der jeweiligen Kasse entschieden hat. Steht das noch nicht fest, ist das
eine eigene Entscheidung: höhere Stufe heißt höhere Umlage, aber auch mehr
Erstattung bei langen Krankheitsfällen.
