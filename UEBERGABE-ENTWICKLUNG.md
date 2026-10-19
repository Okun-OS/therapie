# Übergabe: Hauptentwicklung

Zum Kopieren in einen neuen Chat. Das ist die Fortsetzung der laufenden
Entwicklungsarbeit.

---

Du arbeitest an **OKUN Workforce** — HR-Software (Recruiting, Personalakte,
Dienstplanung, Zeiterfassung, Lohnabrechnung) der **OKUN Systems UG
(haftungsbeschränkt)**, Potsdamer Platz 1, 10785 Berlin, vertreten durch Felix
Okun, kontakt@okun-systems.com, Amtsgericht Charlottenburg HRB 292175 B. Live
unter https://okun-workforce.com, Betrieb bei Railway (jeder Push auf den
Zweig löst eine Auslieferung samt `prisma migrate deploy` aus).

## Unverrückbare Regeln

* **Nur auf `claude/scheduling-saas-app-vntbc` pushen.**
* **Nie force-pushen, nie Hooks überspringen.**
* **`.env` nie committen.**
* **Erst committen, wenn es fertig UND geprüft ist.**
* **`therapie_dev` ist nicht die Produktionsdatenbank.** Alles, was gemeinsame
  oder Produktionsdaten berührt, vorher ausdrücklich freigeben lassen.
* Jeder Commit endet mit:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PxQGoP43xoemJvGn3u9zby
  ```

## Wie hier gearbeitet wird — das ist der Kern

* **Kommentare auf Deutsch, und sie erklären das Warum.** Durchnummeriert mit
  `§`; Stand **§198**, nächste Nummer §199. Wo ein Fehler behoben wird, steht
  dabei, was vorher dastand und warum es falsch war — damit niemand es
  zurückbaut.
* **Nichts behaupten, was nicht gemessen ist.** Zahlen, Preise, Fristen,
  Fremdanbieter-Regeln: nachsehen, nicht erinnern. In diesem Projekt waren
  schon mehrere aus dem Gedächtnis genannte Zahlen falsch (Schriftähnlichkeit,
  Zertifikatspreise, Twilio-Nummernkosten, EV-SmartScreen, D-U-N-S nur für
  Apple). Jedes Mal hat es Zeit gekostet.
* **Was nicht prüfbar war, wird gesagt.** Nicht stillschweigend übergehen.
* **Drei Regeln für Prüfungen:** Jede stellt ihren Ausgangszustand **selbst**
  her; nie etwas zählen, das gedeckelt sein kann; jede Fähigkeit braucht ihre
  **Gegenprobe** (ohne die Gegenprobe beweist eine grüne Prüfung nichts — das
  ist hier zweimal passiert).
* **Eigene Fehler sofort beheben und offen benennen**, nicht ans Ende hängen.
* Der Eigentümer ist kein Entwickler. Erklär in seiner Sprache, ohne zu
  vereinfachen, und sag, wenn du etwas anders gemacht hast als beauftragt.

## System starten

```bash
service postgresql start
cd solver-service && /usr/bin/python3 -m uvicorn main:app --host 127.0.0.1 --port 8080 &
cd .. && npm run dev
```

**Stolperfallen, die hier schon Zeit gekostet haben:**

* `/usr/bin/python3`, nicht `python3` — nur dort liegen uvicorn und ortools.
* Der Rechendienst läuft auf **8080** (so steht es in `.env`), nicht 8000.
* `.env` fehlt in frischen Behältern (zu Recht gitignoriert) — aus
  `.env.example` neu bauen, dann `npx prisma migrate deploy`, `npm run seed`,
  `npm run seed:kita`, `npm run seed:schaufenster`.
* Nach `npm run build` ist `.next` für den Entwicklungsserver kaputt:
  `rm -rf .next` und neu starten.
* `pkill -f "next dev"` **killt die eigene Shell** (das Muster steht in der
  eigenen Befehlszeile). Prozesse über `ps -eo pid,args | grep "[n]ext"`
  einsammeln.
* Beim Warten auf den Server auf **HTTP 200** prüfen, nicht nur darauf, dass
  curl antwortet — 404 heißt auch „antwortet".

## Prüfen — vollständig, vor jedem Commit

```bash
npx tsc --noEmit
npm run test                                        # 1055 Modultests
npm run pruefen                                     # 1653 Checks, 45 Prüfungen
cd solver-service && /usr/bin/python3 -m pytest -q  # 154
npm run build
node pruefungen/browser/marke.mjs                   # dazu lohnverwaltung,
node --env-file=.env pruefungen/browser/massnahmen.mjs   # massnahmen, schaufenster
npm run desktop:pruefen                             # 46, braucht Electron
```

Browserprüfungen brauchen Playwright von
`/opt/node22/lib/node_modules/playwright/index.mjs` (keine Projektabhängigkeit).
Manche sprechen Prisma direkt an und brauchen `node --env-file=.env`.

## Wo das Projekt steht

**Fertig und live:** Website (Schrift Manrope, drei Hintergrundbilder),
Impressum und Datenschutz vollständig, Desktop-Hülle mit vorbereiteter
Windows-Signatur, zweiter Faktor per E-Mail/SMS/Authenticator-App, zwei
Kundenregelpakete (Kita mit zwei Etagen, Wohngruppe).

**Beim Eigentümer offen** (steht in `DEINE-LISTE.md`, dort nachführen):
Code-Signing-Zertifikat (Azure Artifact Signing, North Europe, Identitäts­
prüfung läuft), D-U-N-S (beantragt — schließt **beide** Stores auf),
Steuerberater-Gegenzeichnung (Brief liegt fertig in `ANFRAGEN.md`, blockiert
den ersten echten Kunden), AVVs (Railway ✓, Anthropic ✓ automatisch, Twilio
nicht nötig solange aus, offen: Resend und Google), Firebase, USt-IdNr.

**Twilio:** Konto steht, Absendername `OKUN` eingerichtet, aber der Versand
scheitert an **Fehler 20003 — „Primary compliance profile is not approved"**.
Das ist die Firmenprüfung in Twilios Trust Hub; sie läuft noch. Nicht am
Absendernamen liegt es (Deutschland erlaubt Absendernamen ohne Voranmeldung).
Der E-Mail-Faktor läuft unabhängig davon.

## Offene Aufgaben

1. **Regelpaket-Zuweisung umziehen.** Heute auf `/okun/dienstplanung`, einer
   eigenen Seite mit allen Standorten aller Kunden untereinander. Der
   Eigentümer will sie unter **Kunden → Kunde → Standort**, und zwar **je
   Standort** — ein Kunde kann zehn Standorte mit zehn Paketen haben. Die
   Technik kann es bereits (`PATCH /api/okun/dienstplanung` nimmt eine
   `locationId`), es fehlt die Bedienung an der richtigen Stelle.
2. **Lohnabrechnung besser schützen.** Der Eigentümer möchte eine zusätzliche
   Stufe, bevor jemand seine Lohnabrechnung öffnet. Vorschlag, dem er noch
   nicht zugestimmt hat: **kein zweites Passwort** (das vergisst man, es
   braucht einen Rücksetzweg und landet auf einem Zettel), sondern erneute
   Eingabe des eigenen Passworts oder des 2FA-Codes, danach 15 Minuten Ruhe.
   Schützt den Fall, der wirklich vorkommt: ein offen stehender Rechner.
3. **Dienstzeiten der Kita „Krümelkiste" anlegen.** Dort ist ein Regelpaket
   zugeordnet, aber es gibt keine Dienstzeiten — deshalb kein Plan. Die legt
   OKUN an, nicht der Kunde.
4. **Keine Ersatzcodes für den zweiten Faktor.** Wer SMS oder E-Mail aktiv hat
   und den Zugang verliert, kommt ohne fremde Hilfe nicht mehr hinein. Bekannt,
   bewusst offen, noch nicht entschieden.
5. **Authenticator-App ist eingeklappt, nicht gelöscht** (§196). Der Eigentümer
   wollte sie heraus; sie steht jetzt hinter „für Fortgeschrittene", weil sie
   die einzige Methode ohne fremden Dienstleister ist. Wenn er sie ganz
   entfernt haben will, ist das sein Recht — dann wirklich entfernen.

---

# Momentaufnahme: die Listen im Text

**Stand 19.10.2026.** Dieser Abschnitt ist eine **Momentaufnahme**, damit ein
frisches Gespräch sofort Bescheid weiß, ohne erst Dateien zu öffnen.

> **Maßgeblich sind die Dateien, nicht dieser Abschnitt.** Sobald sich etwas
> ändert, wird `DEINE-LISTE.md` nachgeführt — nicht dieser Text. Weicht etwas
> ab, gilt die Datei. Wer hier etwas ändert, ohne die Datei nachzuführen,
> erzeugt genau den Fehler, der in diesem Projekt schon mehrfach zu
> berichtigen war.

## Was der Eigentümer tun muss (aus `DEINE-LISTE.md`)

### 🔴 Dringend — blockiert anderes

| | Was | Blockiert | Stand |
|---|---|---|---|
| **Code-Signing-Zertifikat** | Azure Artifact Signing, Region **North Europe**, Stufe Basic (9,99 $/Monat) | Auslieferung des Windows-Programms, Download-Seite | Identitätsprüfung läuft, **1–20 Werktage** |
| **Steuerberater gegenzeichnen** | Prüferische Durchsicht einer echten Abrechnung, **schriftlich** | **Den ersten echten Kunden** | Brief liegt fertig in `ANFRAGEN.md` |
| **AVVs** | 5 Dienstleister | DSGVO-konformen Betrieb beim Kunden | Railway ✓, Anthropic ✓ (gilt automatisch), Twilio ⚪ nicht nötig solange aus, **offen: Resend, Google** |
| **ELStAM-Änderungsliste** | Echte oder anonymisierte Beispieldatei | Nachweis, dass der Import das Format trifft | Entsteht nur im laufenden Arbeitgeberverhältnis — beim Steuerberater mitfragen |
| **Google-Play-Konto** | 25 $, **als Organisation** | Play Store | Wartet auf D-U-N-S. **Kein privates Konto** — die müssten 12 Tester über 14 Tage stellen |
| **Benachrichtigungen** | VAPID-Schlüssel für Browser-Push | nichts — geht sofort, 5 Minuten | `npm run push:schluessel`, drei Variablen bei Railway |
| **Wohngruppe: 10 E-Mail-Adressen** | der Beschäftigten | Einladungen an die Belegschaft | — |

### 🟡 Bald

* **D-U-N-S-Nummer** — beantragt, bis 30 Tage. Schließt **beide** Stores auf, nicht nur Apple.
* **Apple Developer Program** (99 $/Jahr) — wartet auf D-U-N-S.
* **Vermögensschadenhaftpflicht** — wer Gehälter rechnet, haftet.
* **Aufbewahrungsfristen gegenzeichnen** — vier Stück, eine Seite. Steuerberater oder Datenschutzbeauftragter.
* **USt-IdNr. nachtragen** — im Impressum steht „wird nachgereicht".
* **Wohngruppe:** zwei geschätzte Angaben bestätigen (Tage/Woche je Person; die festen Zeiten der 25-%-Kraft), Fixtermine der Leitung eintragen.
* **Das `.dmg` beglaubigen**, Prüfer-Zugang anlegen, in die Stores einreichen, Download-Seite bauen.

### 🟢 Später, bewusst nach hinten

ITSG- und ELSTER-Anfrage (Briefe liegen fertig), Lizenzierung anschreiben,
Umlagekatalog jährlich im Dezember nachführen
(`recherche-auftrag-umlagen.md` → `npm run umlagen:import`).

### ✅ Erledigt

Domain, Firmenangaben und Impressum (HRB 292175 B), Website, Railway-AVV,
Anthropic-AVV.

### Offene Entscheidungen, die nur er treffen kann

* **Darf ein Kunde namentlich auf die Website?** Braucht seine schriftliche
  Zustimmung. Alternative ohne Namen: „eine Kita mit acht Gruppen in
  Brandenburg".
* **Logo als freigestellte SVG** und wie die Schrift heißt (mit Weblizenz?).
* **Soll die Authenticator-App ganz verschwinden?** Sie ist seit §196
  eingeklappt, nicht gelöscht.

## Die Briefe (aus `ANFRAGEN.md`)

Drei fertige Texte zum Kopieren und Abschicken. Nicht umformulieren —
sie sind auf die Sache zugeschnitten.

1. **Steuerberater** — der wichtigste. Bittet um eine *prüferische Durchsicht*
   eines echten Abrechnungsmonats mit **schriftlicher** Bestätigung. Das ist
   ein normales Mandat nach Zeit, nichts Ungewöhnliches. Zwei Fragen sind
   gleich mit drin, die sonst je einen eigenen Brief gekostet hätten: die
   anonymisierte ELStAM-Beispieldatei und die Aufbewahrungsfristen.
2. **ITSG** — Kosten, Dauer und Auflagen der Systemuntersuchung für
   Entgeltabrechnungsprogramme.
3. **ELSTER-Entwicklerbetreuung** — ERiC für ELStAM, Lohnsteueranmeldung und
   Lohnsteuerbescheinigung.

Kommen Antworten, gehören die Zahlen in `LOHN-ZERTIFIZIERUNG.md`.

## Die Lizenzierungsfrage (aus `LOHN-ZERTIFIZIERUNG.md`)

**Die Frage:** Macht OKUN das Meldewesen selbst (ITSG-Systemuntersuchung für
die Sozialversicherung, ERiC für die Steuer) — oder läuft es weiter über den
Steuerberater des Kunden?

**Sie hängt nicht an der Gebühr**, sondern an zwei Dingen:

1. **Wie viele Kunden?** Der Monatsschritt bei ELStAM kostet je Kunde ein paar
   Minuten. Bei drei Kunden ist das nichts, bei dreißig ist es eine Stelle.
2. **Ist Lohnabrechnung ein Produkt oder Beiwerk?** Beiwerk zur Dienstplanung
   verträgt keine jährliche Systemprüfung. Ein eigenes Produkt schon.

**Solange die Antwort auf 2 „Beiwerk" lautet, ist der heutige Weg über den
Steuerberater der richtige** — und die Anfragen an ITSG und ELSTER sind reine
Vorbereitung. Der lange Weg zur Eigenlösung steht in
`FAHRPLAN-KOMPLETTLOESUNG.md`, die Schritte bis zum ersten Kunden in
`ABLAUFPLAN.md`.

## Alle Unterlagen

Der Abschnitt oben fasst das Wichtigste aus `DEINE-LISTE.md`, `ANFRAGEN.md`
und `LOHN-ZERTIFIZIERUNG.md` zusammen — als **Momentaufnahme mit Datum**,
damit ein frisches Gespräch sofort arbeiten kann.

Alles andere steht **nur** in den Dateien, und zwar mit Absicht: Zwei
Fassungen derselben Liste laufen auseinander, und dann weiß niemand mehr,
welche gilt. Nachgeführt wird immer die Datei.

### Was der Eigentümer tun muss
| Datei | Was drinsteht |
|---|---|
| `DEINE-LISTE.md` | **Die Hauptliste.** Alles, was ein Konto, eine Unterschrift oder einen Kauf braucht — nach Dringlichkeit, mit dem, was es jeweils blockiert. Hier wird nachgeführt. |
| `ANFRAGEN.md` | **Fertige Briefe zum Abschicken:** Steuerberater (prüferische Durchsicht einer Abrechnung + anonymisierte ELStAM-Datei + Aufbewahrungsfristen), ITSG, ELSTER-Entwicklerbetreuung. |
| `impressum-angaben.md` | Vorlage für die Firmenangaben. Erledigt — die Angaben stehen bei Railway. |
| `recherche-auftrag-umlagen.md` | Rechercheauftrag für die U1/U2-Sätze. **Jährlich im Dezember fällig**, dann `npm run umlagen:import`. |
| `website-texte.md` | Vorlage, über die der Eigentümer Website-Texte ändert. |

### Lohn, Meldewesen, Zertifizierung
| Datei | Was drinsteht |
|---|---|
| `LOHN-ZERTIFIZIERUNG.md` | Die Entscheidung: Meldewesen selbst machen (ITSG-Systemuntersuchung, ERiC) oder über den Steuerberater. Mit dem, wovon sie wirklich abhängt. |
| `FAHRPLAN-KOMPLETTLOESUNG.md` | Der lange Weg dorthin: OKUN rechnet, meldet und bescheinigt selbst. |
| `ABLAUFPLAN.md` | Die Schritte bis zum ersten echten Kunden. Punkt 1 ist die Gegenzeichnung durch den Steuerberater. |

### Ausliefern
| Datei | Was drinsteht |
|---|---|
| `APP-STORES.md` | Weg in Play Store und App Store. Reihenfolge, D-U-N-S für **beide** Stores, und die ungeklärte Mac-Frage für iOS. |
| `FIREBASE.md` | Benachrichtigungen. **Zwei Wege:** Browser-Push (VAPID, braucht kein Google-Konto) und nativ über Firebase. |
| `DESKTOP.md` | Das Windows-Programm und die Signatur (Azure Artifact Signing, North Europe). |
| `DOMAIN.md` | Wie die Domain mit Railway verbunden wurde. Erledigt, bleibt zum Nachsehen. |

### Produkt und Technik
| Datei | Was drinsteht |
|---|---|
| `STAND.md` | Was fertig ist. |
| `FEATURES.md` | Das Gedächtnis: jede Funktion und wie sie nachgewiesen wurde (~3.300 Zeilen). |
| `FEHLERKREISLAUF.md` | Funde erfassen, täglich auswerten, automatisch beheben — gebaut. |
| `PRODUKT-NOTIZEN.md` | Ältere Bestandsaufnahme. |
| `briefing-texter.md` | Briefing für jemanden, der Werbetexte schreibt. |
| `AGENTS.md` / `CLAUDE.md` | Hinweis zur Next.js-Fassung. `CLAUDE.md` verweist nur auf `AGENTS.md`; den Block schreibt `next dev` selbst. |

## Wo der Code liegt

| Ort | Inhalt |
|---|---|
| `pruefungen/` | die Nachweise gegen das laufende System |
| `pruefungen/browser/` | die, die einen echten Browser brauchen |
| `pruefungen/desktop/` | die Hülle für den Rechner |
| `solver-service/` | Rechenkern (CP-SAT) und Regelpakete |
| `solver-service/rulepacks/bausteine.py` | die gemeinsamen Bausteine — nur erweitern, nie umbauen |
| `solver-service/rulepacks/kunden/` | die Pakete je Kunde |
| `scripts/` | Einrichtung und Messwerkzeuge (`kunde-wohngruppe.mjs`, `schrift-messen.mjs`, `hintergrund-aufbereiten.mjs`) |
| `prisma/` | Schema, Migrationen, Testdaten |
