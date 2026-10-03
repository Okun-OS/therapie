# OKUN Workforce — Stand und Vorhaben

Notiert am 17.08.2026. Grundlage: Bestandsaufnahme im Code, nicht Erinnerung.
Zweck: Am nächsten Arbeitstag ohne Anlauf weitermachen können.

---

## Die Leitentscheidung

**Das Produkt ist fertig — bis auf die Dienstplanung.**

Alles rund um Personal läuft für jeden Kunden gleich und wird als Standard
fertiggebaut. Nur die Dienstplanung ist in jedem Betrieb anders und wird
deshalb **pro Kunde von Hand programmiert**.

Ablauf beim Kunden:

1. Kunde kauft OKUN Workforce → alle Standardfunktionen sofort nutzbar
2. Gespräch: wie funktioniert dieser Betrieb wirklich?
3. Wir programmieren seine Dienstplanung
4. Abnahme, dann Freischaltung

Preis: **einmalige Einrichtungsgebühr + monatliche Betreuung**, in der
Änderungen enthalten sind. Der Kunde kommt bei jeder Änderung zu uns — das ist
ausdrücklich gewollt und über die Betreuung abgegolten.

### Warum kein eigenes System pro Kunde

Eine Codebasis, ein Deployment. Kundenspezifische Dienstplanlogik liegt als
eigenes Modul je Kunde im selben Repo — volle Programmierfreiheit, für jede
Branche, aber technisch voneinander getrennt.

Grund: Der Fehler vom 17.08. steckte in *einer* Datei. Bei fünfzehn getrennten
Systemen wären es fünfzehn Deployments gewesen, zwei davon vergessen, und ein
Jahr später läuft Kunde 7 auf einem alten Stand mit einem längst behobenen
Fehler. Ein eigener Host kommt nur in Frage, wenn ein Kunde ihn aus
Datenschutzgründen fordert — dann dieselbe Codebasis ein zweites Mal ausrollen.

Entwurf dafür liegt bereits inaktiv unter `solver-service/rulepacks/`
(Commit 35e0385): Laden je Standort, Kontext mit Sucherfunktionen, die bei
Nichtfinden abbrechen statt still nichts zu tun.

---

## Was heute schon trägt

Im Code geprüft, nicht angenommen:

| Bereich | Stand |
|---|---|
| Lohnberechnung | Echt. 315 Zeilen, §32a EStG, Beitragsbemessungsgrenzen, Steuerklassen 1–6, GKV/PKV, Kirchensteuer, Soli |
| Zeiterfassung | Erfassung, Protokolle, Freigabe, Monatsabschluss |
| Urlaub | Anträge, Jahresplanung, Präferenzen, Regelwerk |
| Abwesenheiten | Modell, Schließzeiten |
| Überstunden | Antrag und Genehmigung |
| Zuschläge | Regelwerke, Lohnkonfiguration |
| Vertretung / Einspringen | Anfragen mit Kandidatensuche |
| Push-Benachrichtigungen | Eingerichtet (web-push, VAPID) |
| Mitarbeiterverwaltung | Anlegen, Profile, Einladungen |
| Kalender | ICS-Abo für Mitarbeiter |
| Support | Tickets, Zugriffsfreigaben, Prüfprotokolle |
| Dienstplanung | Rechenkern läuft; Regeln je Kunde noch offen |

## Was komplett fehlt

Kein Datenmodell, nicht angefangen:

1. **Personalakte** — Zeugnisse, Verträge, Krankenscheine haben keinen Ort.
   Es gibt überhaupt keine Dateiablage im System.
2. **Lohnabrechnung erreicht den Mitarbeiter nicht** — sie wird berechnet und
   gespeichert, im Mitarbeiterbereich existiert dazu keine Seite.
3. **Mitarbeiter-Chat** — nur Support-Tickets vorhanden, kein Chat zwischen
   Kollegen oder im Team.
4. **DATEV-Export** — kein Format, keine Schnittstelle.
5. **DSGVO** — kein Auskunfts-, Lösch- oder Exportweg. Bei Personalakten mit
   Krankenscheinen nicht verhandelbar.
6. **Automatische Prüfung vor dem Ausrollen** — `.github/workflows` ist leer.
   Trägt das Versprechen „für Sie richtig programmiert“ nicht ohne.

---

## Vorhaben (Ideensammlung des Inhabers)

Anspruch: alles, was mit Personal zu tun hat, in einem System.

**Lohn**
- Richtige Lohnabrechnung, nicht nur Vorbereitung
- Abrechnungen im eigenen System an Mitarbeiter übermitteln
- Mitarbeiter sieht seine Abrechnungen; Erstellung läuft ebenfalls darüber
- Anbindung per Schnittstelle, DATEV
- Eigenes Bankkonto verknüpfen, „Auszahlen“ auslösen

**Personalakte**
- Zeugnisse, Arbeitsvertrag, Krankenscheine pflegen
- Abwesenheiten darüber prüfen (Krankenschein ↔ Fehlzeit)

**Kommunikation**
- Mitarbeiter-Chat
- Einspringen: „wer kann übernehmen?“ → Push an alle Infrage­kommenden

**Weiteres**
- DSGVO durchgängig
- Zeiterfassungsprotokolle (vorhanden, Feinschliff offen)

---

## Zwei Punkte, die vor der Umsetzung geklärt sein müssen

**„Auszahlen“ auslösen.** Geld für andere zu bewegen ist in Deutschland
erlaubnispflichtig (Zahlungsdiensteaufsichtsgesetz). Gangbarer Weg: Wir
erzeugen eine SEPA-Datei, der Kunde lädt sie bei seiner Bank hoch und gibt sie
frei. Für ihn ein Klick mehr, für uns der Unterschied zwischen Software und
BaFin-Aufsicht.

**Lohnabrechnung als führendes System.** Die Berechnung ist da. Aber
Sozialversicherungsmeldungen und Lohnsteueranmeldung brauchen zertifizierte
Übermittlungswege (ITSG bzw. ELSTER). Realistisch und trotzdem gut verkaufbar:
Wir rechnen, dokumentieren und stellen zu — die Meldungen laufen über DATEV
oder den Steuerberater. Genau dafür der Export.

---

## Vorschlag für den Start

**Personalakte und Lohnzustellung gemeinsam.** Beide brauchen dasselbe
Fundament: eine sichere Dateiablage je Mitarbeiter mit Zugriffsschutz. Einmal
gebaut, fallen beide Funktionen daraus ab. Sofort sichtbarer Nutzen, kein
Aufsichtsrecht im Weg.

Offene Entscheidung dafür: **wo Dateien liegen.** Auf Railway direkt sind sie
nach einem Neustart weg — für Arbeitsverträge untauglich. Vorschlag:
S3-kompatibler Speicher, etwa Cloudflare R2 (bei dieser Größe nahezu
kostenlos, keine Ausgangsgebühren).

Danach in dieser Reihenfolge: Chat und Einspringen-Push, DATEV-Export,
DSGVO-Wege, automatische Prüfung vor dem Ausrollen.

---

## Was am 17.08. an der Dienstplanung repariert wurde

Zur Einordnung, falls etwas davon wieder auffällt:

- Erfundene Dienstzeiten abgeschafft — Dienste behalten ihre Zeiten, Abweichung
  zum Vertrag wird offen ausgewiesen statt kaschiert
- Leitung ohne Gruppenzuteilung planbar („wer arbeitet, steht in genau einer
  Gruppe“ war zu streng)
- Gescheiterte Regeln erscheinen im Plan statt nur im Log
- Bewertung prüft jetzt auch die eigenen Regeln des Unternehmens
- Versionsabgleich App ↔ Rechendienst (ein nicht mitausgerollter Solver ließ
  Regeln wirkungslos werden, ohne dass es auffiel)
- Regel-Code wird vor dem Speichern und Aktivieren wirklich ausgeführt
- Dienstplan nach Etagen sortiert, Dienstfarben unterscheidbar

**Erkenntnis daraus:** Keiner dieser Fehler entstand durch falsche Bedienung
des Kunden. Alle lagen in der Umsetzung. Die Schwachstelle war der Schritt
„Freitext → KI schreibt Rechencode“ — der ist naturgemäß nicht hundertprozentig
verlässlich und fällt im handprogrammierten Modell weg.
