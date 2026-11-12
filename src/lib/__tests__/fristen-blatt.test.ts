import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DATENARTEN } from '../dsgvo-katalog'

/**
 * §213 Hält das Blatt zum Gegenzeichnen noch mit dem Katalog Schritt?
 *
 * WARUM DAS EINE PRÜFUNG BRAUCHT
 * `AUFBEWAHRUNGSFRISTEN.md` wird erzeugt (`npm run fristen:blatt`) und dann
 * abgeschickt. Es ist das einzige Dokument hier, das ein Fremder mit
 * Berufshaftpflicht unterschreibt. Kommt eine Datenart in den Katalog und
 * niemand erzeugt das Blatt neu, dann bestätigt die Unterschrift etwas, das
 * nicht mehr vollständig ist — und niemand merkt es, weil ein Markdown-Text
 * nicht abstürzt.
 *
 * Darum hier: Jede Frist und jede Fundstelle aus dem Katalog muss auf dem
 * Blatt zu finden sein, Zeichen für Zeichen. Weicht eine Jahreszahl ab, ist
 * das Blatt veraltet, und diese Prüfung wird rot.
 */

const BLATT = readFileSync(
  join(process.cwd(), 'AUFBEWAHRUNGSFRISTEN.md'),
  'utf8',
)

const mitFrist = DATENARTEN.filter(d => d.fristJahre > 0)
const ohneFrist = DATENARTEN.filter(d => d.fristJahre === 0)

describe('§213 Das Blatt zum Gegenzeichnen', () => {
  it('nennt jede Datenart mit Frist samt Jahreszahl', () => {
    for (const d of mitFrist) {
      // Genau die Zeile, die der Steuerberater abhakt. Eine geänderte
      // Jahreszahl im Katalog macht diese Zeichenkette unauffindbar.
      expect(BLATT, `Zeile für „${d.bezeichnung}" fehlt oder hat eine andere Frist`)
        .toContain(`| **${d.bezeichnung}** | ${d.fristJahre} Jahre |`)
    }
  })

  it('nennt zu jeder Frist die Fundstelle im Gesetz', () => {
    // Ohne Fundstelle ist die Bestätigung wertlos: Niemand kann prüfen, woran
    // er gemessen hat.
    for (const d of mitFrist) {
      expect(d.grundlage, `„${d.bezeichnung}" hat keine Fundstelle`).toBeTruthy()
      expect(BLATT, `Fundstelle für „${d.bezeichnung}" fehlt auf dem Blatt`)
        .toContain(d.grundlage!)
    }
  })

  it('nennt auch die Datenarten, bei denen gelöscht wird', () => {
    // Zu früh zu löschen ist der teurere Fehler. Ein Blatt, das nur die
    // Aufbewahrung bestätigt, holt eine halbe Unterschrift ein.
    for (const d of ohneFrist) {
      expect(BLATT, `Gelöschte Datenart „${d.bezeichnung}" fehlt auf dem Blatt`)
        .toContain(`| **${d.bezeichnung}** |`)
    }
  })

  it('zählt im Kopf so viele Datenarten, wie der Katalog hat', () => {
    expect(BLATT).toContain(`${DATENARTEN.length} Datenarten`)
    expect(BLATT).toContain(
      `davon ${mitFrist.length} mit Aufbewahrungsfrist und ${ohneFrist.length} ohne`,
    )
  })

  it('trennt, wer welche Unterschrift leisten kann', () => {
    // Der eigentliche Zweck der Aufteilung: Ein Steuerberater steht für §41
    // EStG ein, nicht für Art. 5 Abs. 2 DSGVO. Eine Unterschrift unter alles
    // trüge für den zweiten Teil nicht.
    expect(BLATT).toContain('Block A — Steuer- und Sozialversicherungsrecht')
    expect(BLATT).toContain('Block B — Datenschutz- und Arbeitsrecht')
    expect(BLATT).toContain('§41 Abs.1 EStG')
    expect(BLATT).toContain('Art.5 Abs.2 DSGVO')
  })

  it('verlangt ein Fassungsdatum neben der Unterschrift', () => {
    // Eine Bestätigung ohne Fassungsdatum ließe in zwei Jahren nicht mehr
    // erkennen, was geprüft wurde.
    expect(BLATT).toContain('Geprüfte Fassung dieses Blattes')
    expect(BLATT).toMatch(/vom \d{2}\.\d{2}\.\d{4}/)
  })

  it('bittet NICHT um eine Prüfung der Rechenergebnisse', () => {
    // Zwei verschiedene Anliegen. Wer beides in einen Brief packt, bekommt
    // für das eine ein Honorarangebot und für das andere keine Antwort.
    expect(BLATT).toContain('Nicht gebeten wird um')
  })
})
