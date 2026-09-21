import { describe, it, expect } from 'vitest'
import {
  giltFuerPerson, naechsteFaelligkeit, plusMonate, lage, sperrtEinsatz,
  abgleichen, darfSehen, type Nachweisart, type Frist,
} from '../fristen'
import { VORLAGEN, vorlage } from '../nachweis-vorlagen'

/**
 * §146 An diesen Regeln hängt, ob jemand mit abgelaufener Belehrung am Essen
 * steht oder ob eine Befristung unbemerkt in ein unbefristetes
 * Arbeitsverhältnis läuft. Beides merkt man erst, wenn es zu spät ist —
 * deshalb wird hier jeder Ausgang einzeln nachgerechnet.
 */

const art = (a: Partial<Nachweisart> = {}): Nachweisart => ({
  id: 'a1', name: 'Erste Hilfe', gattung: 'nachweis',
  giltFuer: 'alle', giltFuerWerte: [],
  faelligkeit: 'wiederkehrend', abstandMonate: 24,
  vorwarnTage: 56, nachweisNoetig: true,
  sichtbarkeit: 'leitung', folge: 'warnen', grundlage: null, aktiv: true,
  ...a,
})

const frist = (f: Partial<Frist> = {}): Frist => ({
  id: 'f1', employeeId: 'e1', nachweisartId: 'a1',
  bezeichnung: 'Erste Hilfe', gattung: 'nachweis', ...f,
})

const TAG = 86_400_000
const heute = new Date('2026-09-21T12:00:00Z')
const inTagen = (n: number) => new Date(heute.getTime() + n * TAG)

describe('Für wen eine Frist gilt', () => {
  it('gilt für alle, wenn sie für alle gilt', () => {
    expect(giltFuerPerson(art(), { id: 'e1' })).toBe(true)
  })

  it('beschränkt sich auf Positionen', () => {
    const a = art({ giltFuer: 'positionen', giltFuerWerte: ['Küche'] })
    expect(giltFuerPerson(a, { id: 'e1', position: 'Küche' })).toBe(true)
    expect(giltFuerPerson(a, { id: 'e2', position: 'Pflege' })).toBe(false)
    expect(giltFuerPerson(a, { id: 'e3' })).toBe(false)
  })

  it('beschränkt sich auf Qualifikationen', () => {
    const a = art({ giltFuer: 'qualifikationen', giltFuerWerte: ['Pflegefachkraft'] })
    expect(giltFuerPerson(a, { id: 'e1', qualifications: ['Pflegefachkraft'] })).toBe(true)
    expect(giltFuerPerson(a, { id: 'e2', qualifications: ['Helfer'] })).toBe(false)
  })

  it('entsteht bei „einzeln" nie von selbst', () => {
    // Der Punkt aus dem Betrieb: Brandschutzhelfer braucht nicht jeder. Eine
    // Liste mit vierzig roten Einträgen liest niemand mehr.
    expect(giltFuerPerson(art({ giltFuer: 'einzeln' }), { id: 'e1' })).toBe(false)
  })

  it('gilt nicht für Ausgeschiedene und nicht für abgeschaltete Arten', () => {
    expect(giltFuerPerson(art(), { id: 'e1', active: false })).toBe(false)
    expect(giltFuerPerson(art({ aktiv: false }), { id: 'e1' })).toBe(false)
  })
})

describe('Wann es das nächste Mal fällig ist', () => {
  it('rechnet den Abstand ab der Erfüllung', () => {
    const d = naechsteFaelligkeit(art({ abstandMonate: 24 }), '2025-03-10')
    expect(d?.toISOString().slice(0, 10)).toBe('2027-03-10')
  })

  it('kippt am Monatsende nicht um', () => {
    // 31.01. plus einen Monat ist der 28.02., nicht der 03.03.
    expect(plusMonate(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10))
      .toBe('2026-02-28')
    expect(plusMonate(new Date('2024-01-31T00:00:00Z'), 1).toISOString().slice(0, 10))
      .toBe('2024-02-29')
  })

  it('läuft bei „einmalig" nie ab', () => {
    // Ein Masernnachweis gilt ein Leben lang — er muss nur einmal da sein.
    expect(naechsteFaelligkeit(art({ faelligkeit: 'einmalig' }), '2020-01-01')).toBeNull()
  })

  it('ist bei „zur Einstellung" mit der Erfüllung erledigt', () => {
    const a = art({ faelligkeit: 'einstellung', abstandMonate: null })
    expect(naechsteFaelligkeit(a, '2025-01-01', '2025-01-01')).toBeNull()
    expect(naechsteFaelligkeit(a, null, '2025-01-01')?.toISOString().slice(0, 10))
      .toBe('2025-01-01')
  })

  it('ist ab Tag eins überfällig, wenn es zur Einstellung UND wiederkehrend gilt', () => {
    // Genau das soll die Liste zeigen: Wer nie belehrt wurde, steht seit dem
    // ersten Tag offen — nicht erst in zwei Jahren.
    const a = art({ faelligkeit: 'einstellung_und_wiederkehrend', abstandMonate: 24 })
    expect(naechsteFaelligkeit(a, null, '2025-06-01')?.toISOString().slice(0, 10))
      .toBe('2025-06-01')
  })

  it('setzt bei rein wiederkehrend den ersten Termin nach einem Abstand an', () => {
    const a = art({ faelligkeit: 'wiederkehrend', abstandMonate: 24 })
    expect(naechsteFaelligkeit(a, null, '2025-06-01')?.toISOString().slice(0, 10))
      .toBe('2027-06-01')
  })

  it('gibt ohne Eintritt und ohne Erfüllung kein Datum vor', () => {
    expect(naechsteFaelligkeit(art(), null, null)).toBeNull()
  })
})

describe('Der Stand einer Frist', () => {
  it('ist gültig, solange die Vorwarnzeit nicht erreicht ist', () => {
    const l = lage(frist({ faelligAm: inTagen(200) }), art(), heute)
    expect(l.stand).toBe('gueltig')
  })

  it('warnt innerhalb der Vorwarnzeit', () => {
    const l = lage(frist({ faelligAm: inTagen(30) }), art({ vorwarnTage: 56 }), heute)
    expect(l.stand).toBe('laeuft_ab')
    expect(l.text).toMatch(/30 Tagen/)
  })

  it('warnt genau am Rand der Vorwarnzeit', () => {
    expect(lage(frist({ faelligAm: inTagen(56) }), art({ vorwarnTage: 56 }), heute).stand)
      .toBe('laeuft_ab')
    expect(lage(frist({ faelligAm: inTagen(57) }), art({ vorwarnTage: 56 }), heute).stand)
      .toBe('gueltig')
  })

  it('sagt, wie lange es schon abgelaufen ist', () => {
    const l = lage(frist({ faelligAm: inTagen(-10) }), art(), heute)
    expect(l.stand).toBe('abgelaufen')
    expect(l.text).toMatch(/10 Tagen abgelaufen/)
  })

  it('nennt etwas ohne Datum und ohne Erfüllung „fehlt"', () => {
    expect(lage(frist({}), art(), heute).stand).toBe('fehlt')
  })

  it('nennt etwas Erfülltes ohne Ablauf gültig', () => {
    const l = lage(frist({ erfuelltAm: '2020-01-01' }), art(), heute)
    expect(l.stand).toBe('gueltig')
    expect(l.text).toMatch(/ohne Ablauf/)
  })

  it('erkennt eine Befreiung und nennt ihren Grund', () => {
    // Wer befreit ist, braucht einen Grund — sonst ist es keine Befreiung,
    // sondern Vergessen.
    const l = lage(
      frist({ faelligAm: inTagen(-500), befreitAm: heute, befreitGrund: 'In Elternzeit' }),
      art(), heute,
    )
    expect(l.stand).toBe('befreit')
    expect(l.text).toMatch(/Elternzeit/)
  })

  it('lässt sich nachrechnen, ohne die Systemuhr zu stellen', () => {
    // Der Stand wird gerechnet und nicht gespeichert. Ein gespeicherter Status
    // wäre am nächsten Morgen falsch, ohne dass jemand etwas getan hat.
    const f = frist({ faelligAm: '2026-10-01' })
    expect(lage(f, art(), new Date('2026-09-01T00:00:00Z')).stand).toBe('laeuft_ab')
    expect(lage(f, art(), new Date('2026-10-02T00:00:00Z')).stand).toBe('abgelaufen')
  })
})

describe('Wann ein Einsatz gesperrt ist', () => {
  it('sperrt nur, wenn die Art es verlangt', () => {
    const abgelaufen = lage(frist({ faelligAm: inTagen(-1) }), art(), heute)
    expect(sperrtEinsatz(abgelaufen, { folge: 'warnen' })).toBe(false)
    expect(sperrtEinsatz(abgelaufen, { folge: 'sperren' })).toBe(true)
  })

  it('sperrt auch, wenn der Nachweis ganz fehlt', () => {
    const fehlt = lage(frist({}), art(), heute)
    expect(sperrtEinsatz(fehlt, { folge: 'sperren' })).toBe(true)
  })

  it('sperrt nicht, solange es nur bald abläuft', () => {
    // Sonst stünde jemand von einem Tag auf den anderen ohne Dienst da,
    // obwohl der Nachweis noch gilt.
    const laeuftAb = lage(frist({ faelligAm: inTagen(3) }), art(), heute)
    expect(sperrtEinsatz(laeuftAb, { folge: 'sperren' })).toBe(false)
  })

  it('sperrt eine Befreiung nicht', () => {
    const befreit = lage(frist({ befreitAm: heute, befreitGrund: 'x' }), art(), heute)
    expect(sperrtEinsatz(befreit, { folge: 'sperren' })).toBe(false)
  })
})

describe('Abgleich mit dem Katalog', () => {
  const arten = [
    art({ id: 'a1', giltFuer: 'alle' }),
    art({ id: 'a2', giltFuer: 'positionen', giltFuerWerte: ['Küche'] }),
  ]

  it('nennt, was einer Person noch fehlt', () => {
    const a = abgleichen(arten, { id: 'e1', position: 'Küche' }, [])
    expect(a.anzulegen.map(x => x.id)).toEqual(['a1', 'a2'])
  })

  it('legt nichts doppelt an', () => {
    const a = abgleichen(arten, { id: 'e1', position: 'Küche' },
      [frist({ nachweisartId: 'a1' })])
    expect(a.anzulegen.map(x => x.id)).toEqual(['a2'])
  })

  it('nennt, was nach einem Positionswechsel nicht mehr gilt', () => {
    const a = abgleichen(arten, { id: 'e1', position: 'Pflege' },
      [frist({ id: 'f2', nachweisartId: 'a2' })])
    expect(a.ueberfluessig.map(x => x.id)).toEqual(['f2'])
  })

  it('räumt von Hand angelegte Fristen nie weg', () => {
    // In einer abgelaufenen Frist steckt ein Dokument und eine Vorgeschichte.
    // Wegwerfen ist eine Entscheidung, die ein Mensch trifft.
    const a = abgleichen(arten, { id: 'e1' },
      [frist({ id: 'f9', nachweisartId: null, bezeichnung: 'Sonderfall' })])
    expect(a.ueberfluessig).toEqual([])
  })
})

describe('Wer was sehen darf', () => {
  it('lässt die Unternehmensebene alles sehen', () => {
    expect(darfSehen({ sichtbarkeit: 'unternehmen' }, 'company')).toBe(true)
    expect(darfSehen({ sichtbarkeit: 'leitung' }, 'company')).toBe(true)
  })

  it('zeigt der Standortleitung nur, was für sie freigegeben ist', () => {
    expect(darfSehen({ sichtbarkeit: 'leitung' }, 'admin')).toBe(true)
    expect(darfSehen({ sichtbarkeit: 'unternehmen' }, 'admin')).toBe(false)
  })

  it('zeigt einem Mitarbeiter nichts über andere', () => {
    expect(darfSehen({ sichtbarkeit: 'leitung' }, 'employee')).toBe(false)
  })
})

describe('Die Vorlagen', () => {
  it('bringt für jede Betriebsform etwas mit', () => {
    expect(VORLAGEN.length).toBeGreaterThanOrEqual(4)
    for (const v of VORLAGEN) expect(v.eintraege.length).toBeGreaterThan(0)
  })

  it('belegt jeden Eintrag mit seiner Grundlage', () => {
    // Wer einen Abstand ändert, soll sehen, woran er rüttelt.
    for (const v of VORLAGEN) {
      for (const e of v.eintraege) {
        expect(e.grundlage && e.grundlage.length > 15).toBe(true)
      }
    }
  })

  it('setzt bei jedem wiederkehrenden Eintrag einen Abstand', () => {
    for (const v of VORLAGEN) {
      for (const e of v.eintraege) {
        if (e.faelligkeit === 'wiederkehrend'
          || e.faelligkeit === 'einstellung_und_wiederkehrend') {
          expect(e.abstandMonate).toBeGreaterThan(0)
        }
      }
    }
  })

  it('sperrt nur dort, wo das Fehlen wirklich den Einsatz verbietet', () => {
    const sperrend = vorlage('kita')!.eintraege.filter(e => e.folge === 'sperren')
    expect(sperrend.map(e => e.name).some(n => /Führungszeugnis/.test(n))).toBe(true)
    expect(vorlage('allgemein')!.eintraege.every(e => e.folge === 'warnen')).toBe(true)
  })

  it('hält Führungszeugnis und Vertragsfristen von der Standortleitung fern', () => {
    const kita = vorlage('kita')!.eintraege
    expect(kita.find(e => /Führungszeugnis/.test(e.name))?.sichtbarkeit)
      .toBe('unternehmen')
    for (const e of kita.filter(e => e.gattung === 'vertrag')) {
      expect(e.sichtbarkeit).toBe('unternehmen')
    }
  })

  it('gibt jede Vorlage unter ihrem Schlüssel heraus', () => {
    for (const v of VORLAGEN) expect(vorlage(v.schluessel)?.name).toBe(v.name)
    expect(vorlage('gibtesnicht')).toBeUndefined()
  })
})
