# Nachweise am laufenden System

Diese Prüfungen sprechen mit dem laufenden System über dieselben Schnittstellen
wie der Browser — echte Anmeldung, echte Datenbank, mehrere Mandanten.

**Sie sind keine Modultests.** Die stehen in `src/lib/__tests__/` und prüfen
Rechenwege. Hier wird geprüft, ob das Zusammenspiel stimmt: ob eine fremde
Leitung an fremde Daten kommt, ob ein freigegebener Monat wirklich gesperrt ist,
ob die SEPA-Datei den Betrag überweist, der auf dem Beleg steht.

## Warum es diesen Ordner gibt

Bis zum 10.09.2026 lagen über 280 dieser Prüfungen nur im Arbeitsverzeichnis
einer Sitzung. Der wurde einmal komplett gelöscht — und damit war der einzige
Beweis weg, dass die Lohnabrechnung stimmt. Für ein Programm, das Gehälter
rechnet und bei jedem Push automatisch ausgerollt wird, ist das untragbar.

## Ausführen

```bash
npm run dev          # in einem anderen Fenster
npm run pruefen      # alles
npm run pruefen -- d # nur die Lohn-Prüfungen
npm run pruefen -- d9 d10   # einzelne
npm run pruefen:alles       # Modultests und Nachweise zusammen
```

Voraussetzungen: Datenbank läuft, `npm run seed` ist gelaufen, `npm run dev`
läuft. Fehlt eine davon, sagt der Läufer das im Klartext, statt mit
unverständlichen Fehlern abzubrechen.

Gegen eine andere Adresse prüfen:

```bash
PRUEF_BASIS=https://beispiel.example npm run pruefen
```

> **Niemals gegen ein System mit echten Kundendaten laufen lassen.** Die
> Prüfungen legen an, ändern und löschen — sie sind für Testdaten gebaut.

## Was wo geprüft wird

| Datei | Bereich |
|---|---|
| `a-mitarbeiter.mjs` | Stammdaten, Rollen, Einladungen, Kollegensicht |
| `b-zeit.mjs` | Zeiterfassung, Überstunden, Monatsabschluss |
| `c-abwesenheit.mjs` | Urlaub, Krankheit, Schließzeiten |
| `d-lohn.mjs` | Beleg, Zustellung, DATEV, SEPA |
| `d8-elstam.mjs` | ELStAM-Stand, Warnung, Import der Änderungsliste |
| `d9-aufrollung.mjs` | Rückwirkende Änderungen, Korrekturen, `/api/payroll` |
| `d10-einmalzahlung.mjs` | Weihnachtsgeld, Prämie, Abfindung |
| `d11-minijob.mjs` | Minijob, kurzfristig, Übergangsbereich |
| `d12-lohnrechnung.mts` | Lohnberechnung gegen echte Zeiterfassung |
| `d13-teilmonat.mjs` | Ein- und Austritte innerhalb des Monats |
| `d14-beleg-vollstaendig.mjs` | Beleg mit Minijob, Teilmonat, Arbeitgeberanteilen |
| `d15-jahresabschluss.mjs` | Jahreswerte, Übersicht für den Mitarbeiter |
| `e-kommunikation.mjs` | Benachrichtigungen, Einspringen, Push |
| `e5-chat.mjs` | Nachrichten, Gruppen, wer nicht mitlesen darf |
| `f-dienstplan.mjs` | Rechenkern, Dienstwünsche, Schichttausch |
| `f5-regelpakete.mjs` | Regelpakete je Kunde, Freischaltung der Dienstplanung |
| `g1-dsgvo.mjs` | Auskunft, Löschkonzept, Sperre statt Löschung |

## Eine neue Prüfung schreiben

```js
import { pruefer, login, hole, sende, zuruecksetzen, pruefMonate } from './helfer.mjs'

const { check, bilanz } = pruefer()
const gf = await login('gf@rheinblick-reha.de')

// Ausgangszustand herstellen — sonst besteht die Prüfung nur einzeln
await zuruecksetzen(gf, pruefMonate(jahr, monat))

check('Was geprüft wird, in einem Satz', bedingung, 'Zusatzinfo bei Fehlschlag')

process.exit(bilanz() ? 1 : 0)
```

**Drei Regeln, die aus Fehlern entstanden sind:**

1. **Jede Prüfung stellt ihren Ausgangszustand selbst her.** Beim ersten Lauf
   aller Nachweise hintereinander sind drei von zwölf fehlgeschlagen — nicht
   weil das Programm falsch war, sondern weil sie sich gegenseitig Zustand
   hinterlassen haben. Eine Prüfung, die nur einzeln besteht, ist kein
   Sicherheitsnetz.

2. **Nichts wird gezählt, was gedeckelt sein kann.** Eine Prüfung verglich die
   Zahl der Nachrichten im Postfach vorher und nachher — das Postfach zeigt aber
   nur die letzten 30. Verglichen wird jetzt die neueste Kennung.

3. **Zu jeder Fähigkeit gehört die Gegenprobe.** Wer etwas darf, ist die Hälfte.
   Die andere Hälfte ist: kann eine fremde Leitung das auch? Kann ein
   Mitarbeiter das für einen Kollegen?
