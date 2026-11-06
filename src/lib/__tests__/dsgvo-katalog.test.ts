import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DATENARTEN, datenart, erfassteModelle, aufbewahrungBis, BEHANDLUNG_TEXT,
} from '../dsgvo-katalog'

/**
 * §128 Der gefährlichste Fehler bei einem Löschkonzept ist eine Tabelle, die
 * niemand kennt. Dieser Test liest deshalb das Datenbankschema und hält es
 * gegen den Katalog: kommt ein neues Modell mit Personenbezug dazu und wird
 * nicht eingetragen, schlägt der Test fehl.
 *
 * Das ist der einzige Weg, ein Löschkonzept aktuell zu halten. Alles andere
 * veraltet beim nächsten Feature, ohne dass es jemandem auffällt.
 */

const SCHEMA = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')

/** Alle Modelle, die einen direkten Personenbezug über employeeId haben. */
function modelleMitPersonenbezug(): string[] {
  const zeilen = SCHEMA.split('\n')
  const gefunden: string[] = []
  let aktuell: string | null = null
  for (const zeile of zeilen) {
    const modell = zeile.match(/^model\s+(\w+)\s*\{/)
    if (modell) { aktuell = modell[1]; continue }
    if (zeile.startsWith('}')) { aktuell = null; continue }
    if (!aktuell) continue
    if (/^\s*employeeId\s/.test(zeile) && !gefunden.includes(aktuell)) {
      gefunden.push(aktuell)
    }
  }
  return gefunden.sort()
}

describe('Vollständigkeit des Katalogs', () => {
  it('erfasst jedes Modell mit einer employeeId', () => {
    const imSchema = modelleMitPersonenbezug()
    const imKatalog = new Set(erfassteModelle())
    const fehlend = imSchema.filter(m => !imKatalog.has(m))

    expect(fehlend,
      `Diese Modelle enthalten Personendaten, stehen aber nicht im Löschkonzept:\n`
      + `  ${fehlend.join('\n  ')}\n\n`
      + `Jedes neue Modell mit employeeId muss in src/lib/dsgvo-katalog.ts eingetragen `
      + `werden — mit Behandlung, Frist und Begründung. Sonst bleibt es bei einer `
      + `Auskunft unsichtbar und bei einer Löschung liegen.`,
    ).toEqual([])
  })

  it('nennt keine Modelle, die es gar nicht gibt', () => {
    const vorhanden = new Set(
      Array.from(SCHEMA.matchAll(/^model\s+(\w+)\s*\{/gm)).map(m => m[1]),
    )
    const erfunden = erfassteModelle().filter(m => !vorhanden.has(m))
    expect(erfunden, `Im Katalog stehen Modelle, die es im Schema nicht gibt: ${erfunden}`)
      .toEqual([])
  })
})

describe('Jede Datenart ist vollständig beschrieben', () => {
  it('hat eine eindeutige Kennung', () => {
    const ids = DATENARTEN.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('erklärt sich in einer Sprache, die ein Mitarbeiter versteht', () => {
    for (const d of DATENARTEN) {
      expect(d.bezeichnung.length, `${d.id}: Bezeichnung fehlt`).toBeGreaterThan(3)
      expect(d.beschreibung.length, `${d.id}: Beschreibung fehlt`).toBeGreaterThan(20)
      // Kein Tabellenname in der Beschreibung — der Betroffene kennt sie nicht
      for (const modell of d.modelle) {
        expect(d.beschreibung, `${d.id}: Tabellenname „${modell}" in der Beschreibung`)
          .not.toContain(modell)
      }
    }
  })

  it('begründet jede Behandlung', () => {
    for (const d of DATENARTEN) {
      expect(d.begruendung.length, `${d.id}: keine Begründung`).toBeGreaterThan(30)
    }
  })

  it('nennt zu jeder Aufbewahrungsfrist die Vorschrift', () => {
    // Eine Frist ohne Rechtsgrundlage ist geraten — und geraten wird hier nicht
    for (const d of DATENARTEN.filter(x => x.fristJahre > 0)) {
      expect(d.grundlage, `${d.id}: Frist von ${d.fristJahre} Jahren ohne Vorschrift`)
        .toBeTruthy()
      expect(d.grundlage!.length).toBeGreaterThan(5)
    }
  })

  it('gibt keiner Datenart ohne Frist eine Sperre', () => {
    // Sperren heißt aufbewahren — das braucht immer einen gesetzlichen Grund
    for (const d of DATENARTEN.filter(x => x.behandlung === 'sperren')) {
      expect(d.fristJahre, `${d.id}: gesperrt, aber ohne Frist`).toBeGreaterThan(0)
    }
  })

  it('gibt keiner Datenart mit Frist ein sofortiges Löschen', () => {
    for (const d of DATENARTEN.filter(x => x.behandlung === 'loeschen')) {
      expect(d.fristJahre, `${d.id}: wird gelöscht, hat aber eine Frist`).toBe(0)
    }
  })
})

describe('Die Lohndaten sind geschützt', () => {
  it('löscht das Lohnkonto nicht', () => {
    // Der teuerste Fehler überhaupt: auf Zuruf löschen, was das Steuerrecht verlangt
    const lohn = datenart('lohnkonto')!
    expect(lohn.behandlung).toBe('sperren')
    expect(lohn.fristJahre).toBe(6)
    expect(lohn.grundlage).toContain('EStG')
  })

  it('bewahrt Arbeitszeiten zwei Jahre auf', () => {
    const zeit = datenart('zeiterfassung')!
    expect(zeit.behandlung).toBe('sperren')
    expect(zeit.fristJahre).toBe(2)
    expect(zeit.grundlage).toMatch(/ArbZG|MiLoG/)
  })

  it('löscht Zugangsdaten sofort — das Konto muss weg können', () => {
    const zugang = datenart('zugang')!
    expect(zugang.behandlung).toBe('loeschen')
    expect(zugang.modelle).toContain('User')
  })

  it('löscht freiwillige Angaben vollständig', () => {
    const wuensche = datenart('wuensche')!
    expect(wuensche.behandlung).toBe('loeschen')
    expect(wuensche.fristJahre).toBe(0)
  })

  it('behält die Zugriffsprotokolle — sie beweisen den korrekten Umgang', () => {
    const protokolle = datenart('protokolle')!
    expect(protokolle.behandlung).toBe('sperren')
    expect(protokolle.begruendung).toMatch(/Nachweis/)
  })
})

describe('Ende der Aufbewahrung', () => {
  it('rechnet ab dem Ende des Kalenderjahres, nicht ab dem Austrittstag', () => {
    // Austritt am 3. Februar 2026, sechs Jahre → Ende 2032, nicht Februar 2032
    expect(aufbewahrungBis(new Date('2026-02-03'), 6)).toBe('2032-12-31')
  })

  it('rechnet auch am Jahresende richtig', () => {
    expect(aufbewahrungBis(new Date('2026-12-31'), 6)).toBe('2032-12-31')
  })

  it('liefert ohne Frist kein Datum', () => {
    expect(aufbewahrungBis(new Date('2026-02-03'), 0)).toBeNull()
  })

  it('rechnet die kurze Frist der Arbeitszeiten', () => {
    expect(aufbewahrungBis(new Date('2026-06-15'), 2)).toBe('2028-12-31')
  })
})

describe('Anzeigetexte', () => {
  it('hat für jede Behandlung einen Text', () => {
    for (const d of DATENARTEN) {
      expect(BEHANDLUNG_TEXT[d.behandlung]).toBeTruthy()
    }
  })
})
