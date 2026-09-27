# Angaben für Impressum und Datenschutzerklärung

Ausfüllen und mir schicken — dann trage ich sie ein. Oder direkt bei Railway
unter *Variables* hinterlegen, dann ist es sofort da.

> **Warum das nicht im Code stehen kann:** Firmenangaben ändern sich
> (Umzug, neuer Geschäftsführer, Handelsregistereintrag), und sie stehen in
> jedem Beleg, jeder E-Mail und jeder Auskunft nach Art. 15 DSGVO. Als
> Umgebungsvariable sind sie an einer Stelle änderbar, ohne dass jemand
> die Anwendung neu ausrollen muss.
>
> **Solange sie fehlen, steht im Impressum, dass sie fehlen** — mit
> Paragraphen. Das ist Absicht: Ein Impressum, das eine Pflichtangabe
> stillschweigend auslässt, ist abmahnbar; eines, das sie benennt, ist
> wenigstens ehrlich.

---

## Pflicht nach §5 DDG — ohne diese vier geht das Impressum nicht

| Variable | Was hinein gehört | Dein Wert |
|---|---|---|
| `OKUN_FIRMA` | Der **vollständige** Firmenname mit Rechtsform, wie er im Register steht. Nicht „OKUN", sondern z. B. „OKUN Software GmbH" | |
| `OKUN_ANSCHRIFT` | **Ladungsfähige** Anschrift: Straße, Hausnummer, PLZ, Ort. Kein Postfach — ein Gericht muss dort zustellen können | |
| `OKUN_VERTRETEN` | Die vertretungsberechtigte Person mit Vor- und Nachname. Bei einer GmbH der Geschäftsführer, bei einem Einzelunternehmen du selbst | |
| `OKUN_KONTAKT` | Eine E-Mail-Adresse, die **schnell** erreichbar ist. §5 Abs. 1 Nr. 2 DDG verlangt „unmittelbare Kommunikation" — eine Adresse, die niemand liest, genügt nicht | |

---

## Pflicht, sobald vorhanden

| Variable | Was hinein gehört | Dein Wert |
|---|---|---|
| `OKUN_REGISTER` | Registergericht **und** Registernummer, z. B. „Amtsgericht Köln, HRB 123456". Pflicht nach §5 Abs. 1 Nr. 4 DDG, sobald die Gesellschaft eingetragen ist. Als Einzelunternehmen ohne Eintragung: leer lassen | |
| `OKUN_USTID` | Umsatzsteuer-Identifikationsnummer, z. B. „DE123456789". Pflicht nach §5 Abs. 1 Nr. 6 DDG, sobald eine vorhanden ist. **Nicht** die Steuernummer vom Finanzamt — das ist etwas anderes | |

---

## Für die Datenschutzerklärung

| Variable | Was hinein gehört | Dein Wert |
|---|---|---|
| `OKUN_DSB` | Name und Kontakt des Datenschutzbeauftragten. **Nicht immer Pflicht:** §38 BDSG verlangt ihn erst, wenn mindestens 20 Personen ständig mit automatisierter Verarbeitung beschäftigt sind. Bei einer kleinen Firma also oft leer — die Anwendung meldet das dann auch nicht als Fehler | |
| `OKUN_SUPPORT_EMAIL` | Die Adresse, an die Rückmeldungen aus dem Programm gehen (Fehlermeldungen, Fragen der Kunden). Kann dieselbe wie `OKUN_KONTAKT` sein | |

---

## Das sind alle

**Acht Variablen, nicht mehr.** Falls in einer älteren Fassung dieser Liste
`OKUN_ABSENDER`, `OKUN_NAME` oder `OKUN_ART` standen: Die sind Konstanten im
Code und keine Umgebungsvariablen — sie zu setzen hätte keine Wirkung gehabt.

## Wie du prüfst, ob es angekommen ist

Nach dem Setzen bei Railway:

- **`/impressum` aufrufen.** Fehlt etwas Pflichtiges, steht es dort im
  Klartext samt Paragraph. Steht nichts davon da, ist alles beisammen.
- **`/datenschutz` aufrufen.** Dasselbe für die Angaben des Verantwortlichen.
- Beide Seiten sind ohne Anmeldung erreichbar — das müssen sie sein.

Die Prüfungen dazu laufen in `pruefungen/g2-dsgvo-dokumente.mjs`: Sie
verlangen, dass eine fehlende Pflichtangabe **benannt** wird statt leer zu
bleiben.
