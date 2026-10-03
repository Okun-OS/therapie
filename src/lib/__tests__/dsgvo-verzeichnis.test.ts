import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DATENARTEN } from '../dsgvo-katalog'
import {
  MASSNAHMEN, RUBRIKEN, offenePunkte, zusammenfassung, nachRubrik,
} from '../dsgvo-tom'
import {
  verzeichnisAlsAuftragsverarbeiter, verzeichnisFuerKunden,
  taetigkeitenOhneZweck, UNTERAUFTRAEGE, offeneVertraege, fehltAmAnbieter,
} from '../dsgvo-verzeichnis'

/**
 * §152 Der Sinn dieser Tests: Ein Verarbeitungsverzeichnis und eine TOM-Liste
 * veralten still. Sie stehen irgendwo, niemand liest sie, und bei der Prüfung
 * stellt sich heraus, dass sie den Stand von vorgestern beschreiben — was
 * schlimmer ist als gar kein Dokument, weil es Sorgfalt behauptet.
 *
 * Deshalb wird hier geprüft, was sich prüfen lässt: dass jede Maßnahme auf
 * eine Datei zeigt, die es wirklich gibt, dass jede Datenart einen Zweck und
 * eine Rechtsgrundlage hat, und dass eine Lücke als Lücke dasteht.
 */

describe('Die TOM beschreiben die Wirklichkeit', () => {
  it('zeigt mit jedem Beleg auf eine Datei, die es gibt', () => {
    const fehlend = MASSNAHMEN
      .filter(m => m.beleg)
      .filter(m => !existsSync(join(process.cwd(), m.beleg!)))
      .map(m => `${m.id} → ${m.beleg}`)

    expect(fehlend,
      'Diese Maßnahmen berufen sich auf Dateien, die es nicht (mehr) gibt.\n'
      + 'Entweder wurde die Maßnahme entfernt und der Eintrag vergessen, oder\n'
      + 'der Pfad stimmt nicht. Beides macht das Dokument unbrauchbar:\n  '
      + fehlend.join('\n  '),
    ).toEqual([])
  })

  it('belegt jede umgesetzte Maßnahme', () => {
    // „Umgesetzt" ohne Fundstelle ist eine Behauptung.
    const ohne = MASSNAHMEN.filter(m => m.stand === 'umgesetzt' && !m.beleg)
    expect(ohne.map(m => m.id)).toEqual([])
  })

  it('benennt zu jeder nicht umgesetzten Maßnahme die Lücke', () => {
    const stumm = MASSNAHMEN
      .filter(m => m.stand !== 'umgesetzt' && !m.luecke)
      .map(m => m.id)
    expect(stumm,
      'Wer „teilweise" oder „offen" schreibt, muss sagen, was fehlt — sonst '
      + 'ist der Eintrag für einen Prüfer wertlos.',
    ).toEqual([])
  })

  it('kennt jede Rubrik, die es benutzt', () => {
    for (const m of MASSNAHMEN) {
      expect(RUBRIKEN[m.rubrik], `${m.id}: unbekannte Rubrik`).toBeTruthy()
    }
  })

  it('füllt jede Rubrik mit mindestens einer Maßnahme', () => {
    const leer = (Object.keys(RUBRIKEN) as (keyof typeof RUBRIKEN)[])
      .filter(r => nachRubrik(r).length === 0)
    expect(leer,
      'Eine leere Rubrik fällt bei jeder Prüfung auf. Entweder gehört eine '
      + 'Maßnahme hinein oder die Rubrik heraus.',
    ).toEqual([])
  })

  it('erklärt jede Maßnahme in Sätzen, nicht in Stichworten', () => {
    for (const m of MASSNAHMEN) {
      expect(m.beschreibung.length, `${m.id}: zu knapp`).toBeGreaterThan(60)
      expect(m.bezeichnung.length, `${m.id}: keine Bezeichnung`).toBeGreaterThan(5)
    }
  })

  it('hat eindeutige Kennungen', () => {
    const ids = MASSNAHMEN.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('zählt richtig zusammen', () => {
    const z = zusammenfassung()
    expect(z.umgesetzt + z.betreiber + z.teilweise + z.offen)
      .toBe(MASSNAHMEN.length)
    expect(offenePunkte().length).toBe(MASSNAHMEN.length - z.umgesetzt)
  })

  it('behauptet nicht, alles sei erledigt', () => {
    // Eine TOM-Liste ohne offene Punkte glaubt niemand — zu Recht. Sie sagt
    // nur, dass niemand genau hingesehen hat.
    expect(offenePunkte().length).toBeGreaterThan(0)
  })
})

describe('Art. 30 Abs. 2 — OKUN als Auftragsverarbeiter', () => {
  const v = verzeichnisAlsAuftragsverarbeiter(new Date('2026-09-22T00:00:00Z'))

  it('trägt einen Stand', () => {
    expect(v.stand).toBe('2026-09-22')
  })

  it('nennt die Kategorien der Verarbeitungen (lit. b)', () => {
    expect(v.kategorien.length).toBeGreaterThan(3)
    for (const k of v.kategorien) {
      expect(k.beschreibung.length).toBeGreaterThan(30)
    }
  })

  it('führt jeden Unterauftragsverarbeiter mit Zweck und Ort', () => {
    expect(UNTERAUFTRAEGE.length).toBeGreaterThan(0)
    for (const u of UNTERAUFTRAEGE) {
      expect(u.zweck.length, `${u.name}: kein Zweck`).toBeGreaterThan(10)
      expect(u.ort.length, `${u.name}: kein Ort`).toBeGreaterThan(2)
      expect(u.daten.length, `${u.name}: keine Datenkategorien`).toBeGreaterThan(15)
    }
  })

  it('nennt zu jeder Drittlandübermittlung eine Grundlage (lit. c)', () => {
    for (const u of UNTERAUFTRAEGE.filter(x => x.drittland)) {
      expect(u.drittland!.length, `${u.name}`).toBeGreaterThan(20)
    }
    // Und die Liste im Verzeichnis stimmt mit den Dienstleistern überein.
    expect(v.drittlaender.length)
      .toBe(UNTERAUFTRAEGE.filter(u => u.drittland).length)
  })

  it('verweist auf die TOM (lit. d)', () => {
    expect(v.massnahmen.length).toBe(MASSNAHMEN.length)
  })

  it('sagt offen, was noch fehlt', () => {
    // Die offenen Dienstleisterverträge stehen drin, solange sie offen sind.
    expect(v.offen.length).toBeGreaterThan(0)
    for (const u of offeneVertraege()) {
      expect(v.offen.some(o => o.includes(u.name)), u.name).toBe(true)
    }
  })

  it('meldet fehlende Angaben zum Anbieter, statt sie zu verschweigen', () => {
    // In der Entwicklungsumgebung sind die Umgebungswerte nicht gesetzt —
    // genau dann muss das Verzeichnis es sagen.
    const fehlt = fehltAmAnbieter({
      name: 'X', anschrift: null, vertreten: null, kontakt: null,
      datenschutzbeauftragter: null,
    })
    expect(fehlt.length).toBe(3)
    expect(fehlt.join(' ')).toMatch(/OKUN_ANSCHRIFT/)
  })
})

describe('Art. 30 Abs. 1 — das Verzeichnis für den Kunden', () => {
  const v = verzeichnisFuerKunden(
    { name: 'Kita Sonnenschein', anschrift: 'Musterweg 1' },
    new Date('2026-09-22T00:00:00Z'),
  )

  it('führt jede Datenart aus dem Katalog als Tätigkeit', () => {
    expect(v.taetigkeiten.length).toBe(DATENARTEN.length)
  })

  it('gibt jeder Tätigkeit Zweck und Rechtsgrundlage', () => {
    const ohne = taetigkeitenOhneZweck()
    expect(ohne,
      'Diese Datenarten stehen im Katalog, haben aber keinen Zweck und keine '
      + 'Rechtsgrundlage in dsgvo-verzeichnis.ts. Art. 30 Abs. 1 lit. b '
      + 'verlangt beides — ohne sie ist das Verzeichnis unvollständig.',
    ).toEqual([])
    for (const t of v.taetigkeiten) {
      expect(t.zweck, t.id).not.toBe('—')
      expect(t.rechtsgrundlage, t.id).not.toBe('—')
    }
  })

  it('nennt zu jeder Rechtsgrundlage eine Vorschrift', () => {
    for (const t of v.taetigkeiten) {
      expect(t.rechtsgrundlage, `${t.id}: keine Fundstelle`)
        .toMatch(/Art\.|§/)
    }
  })

  it('nennt die Löschung samt Frist', () => {
    const lohn = v.taetigkeiten.find(t => t.id === 'lohnkonto')!
    expect(lohn.loeschung).toMatch(/6 Jahre/)
    expect(lohn.loeschung).toMatch(/EStG/)
  })

  it('unterscheidet Bewerber von Beschäftigten', () => {
    expect(v.taetigkeiten.find(t => t.id === 'bewerbungen')!.betroffene)
      .toMatch(/Bewerber/)
    expect(v.taetigkeiten.find(t => t.id === 'lohnkonto')!.betroffene)
      .toMatch(/Beschäftigte/)
  })

  it('behandelt Gesundheitsdaten mit eigener Grundlage', () => {
    const bem = v.taetigkeiten.find(t => t.id === 'bem')!
    expect(bem.rechtsgrundlage).toMatch(/Art\. 9/)
    expect(bem.rechtsgrundlage).toMatch(/SGB IX/)
  })

  it('gibt sich nicht für vollständig aus', () => {
    // Der Betrieb verarbeitet auch außerhalb dieses Programms. Ein erzeugtes
    // Verzeichnis, das das verschweigt, ist gefährlich.
    expect(v.ergaenzen.length).toBeGreaterThan(2)
    expect(v.ergaenzen.join(' ')).toMatch(/außerhalb dieses Programms/)
  })

  it('merkt an, was der Kunde selbst nicht mitgegeben hat', () => {
    const ohne = verzeichnisFuerKunden({ name: 'X' })
    expect(ohne.ergaenzen.join(' ')).toMatch(/Anschrift/)
    expect(ohne.ergaenzen.join(' ')).toMatch(/Kontaktadresse/)
  })
})
