# Übergabe: Kunden aufsetzen

Zum Kopieren in einen neuen Chat. Dieser Chat macht **nur** eines: einen neuen
Kunden betriebsbereit machen. Keine Produktentwicklung.

---

Du arbeitest an **OKUN Workforce** — HR-Software (Recruiting, Personalakte,
Dienstplanung, Zeiterfassung, Lohnabrechnung) der **OKUN Systems UG
(haftungsbeschränkt)**, Potsdamer Platz 1, 10785 Berlin, vertreten durch Felix
Okun, kontakt@okun-systems.com, Amtsgericht Charlottenburg HRB 292175 B. Live
unter https://okun-workforce.com.

**Deine einzige Aufgabe in diesem Chat:** einen neuen Kunden einrichten —
Kunde, Standorte, Dienstzeiten, Bereiche, Regelpaket, Mitarbeiterkonten. Für
Produktänderungen gibt es einen zweiten Chat; verweise dorthin, statt hier
Features zu bauen.

## Unverrückbare Regeln

* **Nur auf `claude/scheduling-saas-app-vntbc` pushen.** Nie woanders hin.
* **Nie force-pushen, nie Hooks überspringen.**
* **`.env` nie committen.** Sie steht in `.gitignore` und existiert in frischen
  Behältern nicht — neu anlegen aus `.env.example`.
* **Erst committen, wenn es wirklich fertig und geprüft ist** (tsc, Tests,
  `npm run pruefen`).
* **`therapie_dev` ist NICHT die Produktionsdatenbank bei Railway.** Nie
  verwechseln. Alles, was Produktionsdaten berührt, vorher ausdrücklich
  freigeben lassen.
* Jeder Commit endet mit:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PxQGoP43xoemJvGn3u9zby
  ```

## Wie hier gearbeitet wird

* Kommentare auf **Deutsch**, und sie erklären das **Warum**, nicht das Was.
  Durchnummeriert mit `§` — der Stand ist **§198**, die nächste Nummer ist
  §199.
* Jede Behauptung wird **nachgemessen**, nicht geschätzt. Wenn etwas nicht
  prüfbar ist, wird das gesagt — nicht übersprungen.
* Drei Regeln für Prüfungen (`pruefungen/README`): Jede Prüfung stellt ihren
  **Ausgangszustand selbst her**; nie etwas zählen, das gedeckelt sein kann;
  jede Fähigkeit braucht ihre **Gegenprobe**.
* Wenn dir ein Fehler auffällt — auch ein eigener, auch ein alter —: **sofort
  beheben und offen sagen**, nicht hinten anhängen.

## System starten

```bash
service postgresql start
cd solver-service && /usr/bin/python3 -m uvicorn main:app --host 127.0.0.1 --port 8080 &
cd .. && npm run dev          # Port 3000
```

`/usr/bin/python3`, nicht `python3` — nur dort liegen uvicorn und ortools.
Fehlt `.env`, aus `.env.example` neu bauen; `DATABASE_URL` zeigt auf
`postgresql://postgres:postgres@127.0.0.1:5432/therapie_dev`. Danach
`npx prisma migrate deploy`, `npm run seed`, `npm run seed:kita`.

Nach einem `npm run build` ist `.next` für den Entwicklungsserver unbrauchbar:
`rm -rf .next` und neu starten.

## Der Weg: einen Kunden betriebsbereit machen

**Die Vorlage ist `scripts/kunde-wohngruppe.mjs`** (§185). Sie zeigt die
Reihenfolge, und die ist nicht beliebig — jeder Schritt baut auf dem vorigen:

1. **Kunde und Standort**
2. **Dienstzeiten** — aus dem Regelwerk des Kunden. Ohne sie kann kein Plan
   entstehen; ein Regelpaket ersetzt sie **nicht**. Es sagt, *wie* Dienste
   besetzt werden, nicht *welche* es gibt.
3. **Bereiche** — bei einer Wohngruppe einer, bei einer Kita je Gruppe.
4. **Regelpaket zuordnen und Dienstplanung freischalten**
   (`PATCH /api/okun/dienstplanung` mit `locationId`, `rulePackId`,
   `dienstplanungFrei`). Ein Paket, das der Rechendienst nicht kennt, wird
   abgelehnt — absichtlich.
5. **Belegschaft über `POST /api/okun/belegschaft`**, NICHT über Prisma.
   Dort sitzt die Prüfung, die einen Betrieb davor bewahrt, ohne Dienstplan
   dazustehen (§181/§183): Tagesmuster und Stundenzahl müssen zusammenpassen,
   die Gruppe muss existieren, ein fester freier Tag muss in die Betriebswoche
   passen. Ein Skript, das direkt schreibt, geht daran vorbei — und der Fehler
   fällt erst beim ersten Plan auf.

### Das Regelpaket

Liegt in `solver-service/rulepacks/kunden/<kunde>.py`. Gebaut wird es aus
**Bausteinen** (`solver-service/rulepacks/bausteine.py`) — die sind
allgemein und **werden nur erweitert, nie umgebaut**: An ihnen hängen die
bestehenden Kunden.

Jedes Paket braucht Tests (`solver-service/test_*.py`) mit **anonymer
Belegschaft** („Leitung", „FaBe 1") — das beweist, dass es namensfrei
funktioniert. Ein Paket, das nur mit den echten Namen rechnet, bricht beim
ersten Personalwechsel.

```bash
cd solver-service && /usr/bin/python3 -m pytest -q
```

### Zu Personendaten

Echte Namen aus einem Kundenregelwerk gehören ins Einrichtungsskript, damit es
nachvollziehbar bleibt — **nicht** in Demo-Daten, nicht in Prüfungen, nicht
auf die Website. Dafür gibt es den Beispielbetrieb (§184,
`prisma/seed-schaufenster.ts`).

## Vor jedem Commit

```bash
npx tsc --noEmit
npm run test                 # 1055 Modultests
npm run pruefen              # 1653 Checks in 45 Prüfungen
cd solver-service && /usr/bin/python3 -m pytest -q   # 154
npm run build
```

Alles grün, sonst wird nicht eingecheckt.

## Offene Aufgabe in diesem Bereich

**Die Regelpaket-Zuweisung sitzt an der falschen Stelle.** Sie liegt heute auf
einer eigenen Seite (`/okun/dienstplanung`), die alle Standorte aller Kunden
untereinander listet. Der Eigentümer will sie dort, wo er ohnehin arbeitet:

> Kunden → Kunde öffnen → seine Standorte → **je Standort** das Regelpaket
> zuweisen und die Dienstplanung freischalten.

**Je Standort, nicht je Kunde** — ein Kunde kann zehn Standorte mit zehn
verschiedenen Regelpaketen haben.

Die Technik kann das schon: `PATCH /api/okun/dienstplanung` nimmt eine
`locationId`, und `/okun/customers` klappt Kunden bereits zu ihren Standorten
auf. Es fehlt nur die Bedienung an der richtigen Stelle.

## Wo was steht

| Datei | Inhalt |
|---|---|
| `scripts/kunde-wohngruppe.mjs` | die Vorlage für einen neuen Kunden |
| `solver-service/rulepacks/bausteine.py` | die gemeinsamen Bausteine |
| `solver-service/rulepacks/kunden/` | die Kundenpakete |
| `DEINE-LISTE.md` | alles, was der Eigentümer selbst tun muss |
| `STAND.md` | was fertig ist |
| `AGENTS.md` | Hinweis zur Next.js-Fassung |
