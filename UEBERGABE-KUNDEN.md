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
  Durchnummeriert mit `§` — der Stand ist **§210**, die nächste Nummer ist
  §211.
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

**Seit §202 bringt das Regelpaket die Einrichtung mit.** Der Kunde richtet
nichts mehr selbst ein — keine Dienste, keine Gruppen, keine Regeln. Die
Reihenfolge:

1. **Kunde und Standort**
2. **Das Paket bauen — mit `EINRICHTUNG`**: Arbeitstage, Dienstzeiten (aus dem
   Regelwerk des Kunden), Etagen und Gruppen, Basiswerte. Ohne Dienstzeiten
   kein Plan; ein Paket ohne `EINRICHTUNG` (wie die Vorlage) legt nichts an.
   Vorlage für das Format: `solver-service/rulepacks/__init__.py`, Beispiele
   in `kita_zwei_etagen.py` und `wohngruppe_fuenf.py`.
3. **Regelpaket zuordnen und Dienstplanung freischalten** — unter Kunden →
   Kunde → Standort. Das legt an, was am Standort fehlt; Bestehendes bleibt.
   Am Standort steht danach, wie viele Dienstzeiten und Gruppen da sind.
4. *(technisch: `PATCH /api/okun/dienstplanung`)*
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
npm run test                 # 1069 Modultests
npm run pruefen              # 1750 Checks in 47 Prüfungen
cd solver-service && /usr/bin/python3 -m pytest -q   # 158
npm run build
```

Alles grün, sonst wird nicht eingecheckt.

## Erledigt in §200: Regelpakete je Standort

Die Zuweisung sitzt jetzt dort, wo der Eigentümer arbeitet:

> Kunden → Kunde aufklappen → Standort aufklappen → **Regelpaket zuweisen,
> freischalten, Hinweis für den Kunden, Belegschaft einspielen.**

Je Standort, nicht je Kunde. Schon die zugeklappte Standortzeile zeigt Paket
und Stand und warnt, wenn ein Standort ohne Paket freigeschaltet ist. Die alte
Seite `/okun/dienstplanung` leitet dorthin um; die Schnittstelle
`/api/okun/dienstplanung` ist unverändert.

Nachweis: `node --env-file=.env pruefungen/browser/dienstplanung-am-standort.mjs`.

**§202:** Seit das Paket die Einrichtung mitbringt, zeigt der Standort hier
auch, wie viele Dienstzeiten und Gruppen er hat — und bietet „Einrichtung aus
dem Paket anlegen" an, wo das Paket schon vorher zugewiesen war.

**Neu für den Kunden:** Die E-Mail-Adressen der Belegschaft (beim Einspielen
Platzhalter, §183) trägt der Betrieb jetzt selbst ein — Mitarbeiter öffnen →
„Zugang zur App" → „Adresse eintragen". Die Einladung geht im selben Zug raus.

## Alle Unterlagen — nichts davon ist in diese Übergabe kopiert

**Absichtlich nicht kopiert.** Zwei Fassungen derselben Liste laufen immer
auseinander, und dann weiß niemand mehr, welche gilt. Die Dateien liegen im
Verzeichnis; dieser Abschnitt sagt nur, welche es gibt und wozu.

### Was der Eigentümer tun muss
| Datei | Was drinsteht |
|---|---|
| `DEINE-LISTE.md` | **Die Hauptliste.** Alles, was ein Konto, eine Unterschrift oder einen Kauf braucht — nach Dringlichkeit, mit dem, was es jeweils blockiert. Hier wird nachgeführt. |
| `SUCHAUFTRAEGE.md` | **Wen anschreiben.** Suchaufträge für ChatGPT: einen Steuerberater mit Lohn-Schwerpunkt finden, und die Lage bei ITSG/ELSTER recherchieren. Mit der Warnung, dass erfundene Kanzleien plausibel aussehen. |
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
