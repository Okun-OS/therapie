# Die Texte für die Store-Einträge

Zum Kopieren. Die Zeichengrenzen stehen dabei — beide Stores schneiden
gnadenlos ab, und abgeschnitten liest sich ein Satz dümmer, als er gemeint
war.

Was hier NICHT steht: Datenschutzangaben, Prüfernotiz und Alterseinstufung.
Die stehen in `APP-STORES.md`, Teil D, und gehören dort auch hin — sie sind
eine rechtliche Aussage und keine Werbung.

Stand: 29.10.2026

---

## Google Play

### App-Name (max. 30 Zeichen)

```
OKUN Workforce
```
*(14 Zeichen)*

### Kurzbeschreibung (max. 80 Zeichen)

```
Dienstplan, Zeiterfassung und Lohnabrechnung für Pflege und Therapie.
```
*(69 Zeichen)*

> Die Kurzbeschreibung steht in der Trefferliste unter dem Namen. Sie ist die
> einzige Zeile, die fast jeder liest — deshalb drei Substantive und die
> Branche, keine Adjektive.

### Vollständige Beschreibung (max. 4000 Zeichen)

```
Der Dienstplan in der Tasche — und alles, was daran hängt.

OKUN Workforce ist das Werkzeug für Beschäftigte in Pflege, Therapie und
sozialen Einrichtungen. Dienstplan, Zeiterfassung, Krankmeldung, Urlaub und
Lohnabrechnung liegen an einer Stelle, und sie hängen zusammen: Der Dienst
wird geplant, die Zeit wird gestempelt, der Lohn entsteht aus genau dieser
Zeit. Niemand überträgt etwas von Hand.

WAS DU DAMIT MACHST

• Deinen Dienstplan sehen — Tag, Woche, Monat, auch für die nächsten Wochen
• Ein- und ausstempeln, direkt vom Telefon
• Dich krankmelden und den Krankenschein abfotografieren
• Urlaub beantragen und den Stand verfolgen
• Dienste tauschen und Wünsche hinterlegen
• Deine Lohnabrechnung ansehen und sichern
• Mit Kolleginnen und der Leitung schreiben

AUCH OHNE NETZ

Im Keller, im Aufzug, im Zug: Stempeln, Krankmeldung und Anträge werden auf
dem Gerät gemerkt und übertragen, sobald wieder Empfang da ist. Nichts geht
verloren, und niemand muss daran denken.

DEINE DATEN

Lohn- und Personaldaten lassen sich hinter Face ID oder Fingerabdruck legen —
ein Telefon wandert im Dienstzimmer schneller durch die Hände, als einem lieb
ist. Unterlagen liegen in Rechenzentren in der Europäischen Union.

Das Löschen deiner Daten kannst du in der App beantragen (Ich → Meine Daten).
Sofort gelöscht wird nicht, und das hat einen Grund: Für Lohnunterlagen gelten
in Deutschland Aufbewahrungsfristen (§147 AO, §257 HGB, §28f SGB IV). Der
Antrag geht an deinen Arbeitgeber, und du siehst in der App, wie er steht.

FÜR WEN

Für Beschäftigte, deren Arbeitgeber OKUN Workforce einsetzt. Den Zugang legt
der Betrieb an — eine Anmeldung von sich aus gibt es nicht.

Du bist Arbeitgeber und suchst eine Lösung für deinen Betrieb?
okun-workforce.com
```
*(rund 1750 Zeichen)*

---

## Apple App Store

### Name (max. 30 Zeichen)

```
OKUN Workforce
```

### Untertitel (max. 30 Zeichen)

```
Dienstplan & Zeiterfassung
```
*(26 Zeichen)*

> Der Untertitel steht direkt unter dem Namen. „Dienstplan" muss darin
> vorkommen: Danach wird gesucht.

### Schlüsselwörter (max. 100 Zeichen, mit Komma getrennt, KEINE Leerzeichen danach)

```
Dienstplan,Schichtplan,Zeiterfassung,Stempeluhr,Pflege,Lohnabrechnung,Urlaub,Krankmeldung,Personal
```
*(99 Zeichen)*

> Drei Regeln, die Apple nicht hinschreibt und trotzdem anwendet: Der
> App-Name selbst gehört nicht in die Schlüsselwörter (er zählt ohnehin),
> Mehrzahlformen auch nicht (Apple findet sie von selbst), und Leerzeichen
> nach dem Komma verschenken Zeichen.

### Werbetext (max. 170 Zeichen, jederzeit änderbar ohne neue Version)

```
Neu: Krankenschein abfotografieren und einreichen, ohne die App zu verlassen. Dienstplan, Stempeluhr und Lohnabrechnung bleiben, wo sie sind — in deiner Tasche.
```
*(160 Zeichen)*

### Beschreibung (max. 4000 Zeichen)

Dieselbe wie bei Google Play (siehe oben). Zwei Unterschiede:

- Apple erlaubt keine Verweise auf andere Plattformen. Die letzte Zeile
  („Du bist Arbeitgeber …") bleibt, die Adresse `okun-workforce.com` gehört
  stattdessen in das Feld **Marketing-URL**.
- Aufzählungen mit `•` sind erlaubt und werden korrekt dargestellt.

### Die Felder mit Adressen

| Feld | Wert |
|---|---|
| Support-URL | `https://okun-workforce.com/kontakt` |
| Marketing-URL | `https://okun-workforce.com` |
| Datenschutz-URL | `https://okun-workforce.com/datenschutz` |

> **Vor dem Einreichen alle drei im Browser öffnen.** Eine nicht erreichbare
> Datenschutz-URL ist der häufigste Grund, aus dem gar nicht erst geprüft
> wird — und sie wird wirklich angeklickt.

### Was ist neu (bei jeder Fassung)

Für die erste Veröffentlichung:

```
Die erste Fassung. Dienstplan, Stempeluhr, Krankmeldung, Urlaub,
Lohnabrechnung und Nachrichten — für Beschäftigte in Pflege, Therapie und
sozialen Einrichtungen.
```

---

## Die Bildschirmfotos

Liegen unter `store/`, erzeugt mit `node scripts/store-bilder.mjs` aus der
laufenden Anwendung mit den Daten des Beispielbetriebs.

| Ordner | Maß | Wofür |
|---|---|---|
| `store/ios/6.9-zoll/` | 1320×2868 | iPhone, große Geräte |
| `store/ios/mittel/` | 1206×2622 | iPhone, mittlere Geräte |
| `store/ios/ipad-13-zoll/` | 2064×2752 | iPad — **Pflicht**, weil die Hülle iPad unterstützt |
| `store/android/telefon/` | 1080×2400 | Play Store |
| `store/android/titelbild-1024x500.png` | 1024×500 | Play Store, **Pflichtfeld** |

> **Welches Maß App Store Connect genau verlangt, wechselt.** Die Quellen
> dazu widersprechen sich, deshalb liegen zwei iPhone-Maße bereit. Was die
> Oberfläche beim Hochladen fordert, zählt — nicht, was irgendwo steht.

> **Wenn sich die Oberfläche ändert, neu erzeugen.** Ein Bildschirmfoto, das
> eine Ansicht zeigt, die es nicht mehr gibt, ist bei beiden Stores ein
> Ablehnungsgrund — und beim Kunden eine Enttäuschung in der ersten Minute.

### Das iPad-Maß ist kein Versehen

`ios/App/App.xcodeproj` trägt `TARGETED_DEVICE_FAMILY = "1,2"` — die App gilt
damit als iPhone- UND iPad-App, und Apple verlangt dann iPad-Aufnahmen. Das
ist richtig so: In einem Dienstzimmer steht ein Tablet, und der Dienstplan
darauf ist genau der Fall, für den sich das lohnt.

Wer das nicht will, setzt die Familie auf `"1"` — dann entfallen die
iPad-Bilder, aber auch das iPad.
