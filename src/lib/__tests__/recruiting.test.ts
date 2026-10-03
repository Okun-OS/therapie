import { describe, it, expect } from 'vitest'
import {
  slugMachen, freierSlug, fehltZumVeroeffentlichen, fehltZurKarriereseite,
  naechsteStaende, standErlaubt, loeschenAb, loeschreif, pruefeBewerbung,
  jobPostingLd, anzeigeText, verguetungText, UMFANG_SCHEMA, MAX_NACHRICHT,
} from '../recruiting'

/**
 * §148 Was hier geprüft wird, ist das, was man am System nicht sieht:
 * ob eine Adresse eindeutig wird, ob eine unfertige Anzeige online darf,
 * wann Bewerberdaten verschwinden müssen und ob ein Automat durchkommt.
 */

describe('Adressen für die Karriereseite', () => {
  it('schreibt Umlaute aus, statt sie wegzuwerfen', () => {
    expect(slugMachen('Pflegefachkraft für Frühdienst'))
      .toBe('pflegefachkraft-fuer-fruehdienst')
    expect(slugMachen('Erzieher:in (m/w/d) – Krippe')).toBe('erzieher-in-m-w-d-krippe')
    expect(slugMachen('Straßenfeger')).toBe('strassenfeger')
  })

  it('liefert nie eine leere Adresse', () => {
    expect(slugMachen('///')).toBe('stelle')
    expect(slugMachen('')).toBe('stelle')
  })

  it('endet nie auf einem Bindestrich, auch nicht nach dem Kürzen', () => {
    const lang = slugMachen('a'.repeat(68) + ' bc')
    expect(lang.endsWith('-')).toBe(false)
  })

  it('macht die zweite gleichnamige Anzeige eindeutig', () => {
    expect(freierSlug('Erzieherin', [])).toBe('erzieherin')
    expect(freierSlug('Erzieherin', ['erzieherin'])).toBe('erzieherin-2')
    expect(freierSlug('Erzieherin', ['erzieherin', 'erzieherin-2'])).toBe('erzieherin-3')
  })
})

describe('Was fehlt, bevor eine Anzeige online darf', () => {
  const voll = {
    titel: 'Erzieherin', ort: 'Köln', umfang: 'teilzeit',
    beschreibung: 'Wir suchen eine Erzieherin für unsere Krippengruppe mit '
      + 'fünfzehn Kindern und einem eingespielten Team.',
    aufgaben: [], profil: [],
  }

  it('lässt eine vollständige Anzeige durch', () => {
    expect(fehltZumVeroeffentlichen(voll)).toEqual([])
  })

  it('nennt jeden fehlenden Punkt einzeln', () => {
    const leer = fehltZumVeroeffentlichen({ titel: '', ort: '', beschreibung: '' })
    expect(leer.length).toBe(3)
    expect(leer.join(' ')).toMatch(/Titel/)
    expect(leer.join(' ')).toMatch(/Ort/)
  })

  it('nimmt drei Stichpunkte statt eines Fließtexts an', () => {
    const stichpunkte = fehltZumVeroeffentlichen({
      ...voll, beschreibung: 'Krippe.',
      aufgaben: ['Begleitung', 'Elternarbeit'], profil: ['Ausbildung'],
    })
    expect(stichpunkte).toEqual([])
  })

  it('nimmt zwei Stichpunkte ohne Text nicht an', () => {
    const zuwenig = fehltZumVeroeffentlichen({
      ...voll, beschreibung: 'Krippe.', aufgaben: ['Begleitung'], profil: ['Ausbildung'],
    })
    expect(zuwenig.length).toBe(1)
  })

  it('weist einen erfundenen Umfang zurück', () => {
    expect(fehltZumVeroeffentlichen({ ...voll, umfang: 'gelegentlich' }).length).toBe(1)
  })
})

describe('Die Karriereseite selbst', () => {
  it('geht ohne Impressum nicht online', () => {
    const fehlt = fehltZurKarriereseite({ karriereSlug: 'kita-sonnenschein' })
    expect(fehlt.length).toBe(1)
    expect(fehlt[0]).toMatch(/Impressum/)
    expect(fehlt[0]).toMatch(/§5 DDG/)
  })

  it('geht ohne Adresse nicht online', () => {
    expect(fehltZurKarriereseite({ karriereImpressum: 'Träger e.V., Musterweg 1' }).length)
      .toBe(1)
  })

  it('ist mit beidem vollständig', () => {
    expect(fehltZurKarriereseite({
      karriereSlug: 'kita', karriereImpressum: 'Träger e.V.',
    })).toEqual([])
  })
})

describe('Die Pipeline', () => {
  it('erlaubt die Absage aus jedem Stand', () => {
    for (const von of ['neu', 'gesichtet', 'gespraech', 'zusage']) {
      expect(standErlaubt(von, 'absage'), von).toBe(true)
    }
  })

  it('erlaubt den Rückweg — Bewerber springen ab und kommen wieder', () => {
    expect(standErlaubt('zusage', 'gespraech')).toBe(true)
    expect(standErlaubt('absage', 'gespraech')).toBe(true)
  })

  it('führt von einer Einstellung nirgendwohin zurück', () => {
    expect(naechsteStaende('eingestellt')).toEqual([])
    expect(standErlaubt('eingestellt', 'absage')).toBe(false)
  })

  it('setzt den Stand nicht auf sich selbst', () => {
    expect(standErlaubt('neu', 'neu')).toBe(false)
  })

  it('macht aus einer Bewerbung nicht per Statuswechsel eine Einstellung', () => {
    // Die Übernahme legt einen Mitarbeiter an — das ist ein eigener Weg und
    // kein Eintrag in einer Auswahlliste.
    expect(standErlaubt('zusage', 'eingestellt')).toBe(false)
  })
})

describe('§128 Wann Bewerberdaten verschwinden', () => {
  it('rechnet sechs Monate ab dem Ende des Verfahrens', () => {
    expect(loeschenAb(new Date('2026-03-15T00:00:00Z')).toISOString().slice(0, 10))
      .toBe('2026-09-15')
  })

  it('springt nicht über das Monatsende hinaus', () => {
    expect(loeschenAb(new Date('2026-08-31T00:00:00Z')).toISOString().slice(0, 10))
      .toBe('2027-02-28')
  })

  it('löscht nicht, solange die Frist läuft', () => {
    expect(loeschreif(
      { status: 'absage', loeschenAb: new Date('2026-09-22T00:00:00Z') },
      new Date('2026-09-21T00:00:00Z'),
    )).toBe(false)
  })

  it('löscht, sobald die Frist um ist', () => {
    expect(loeschreif(
      { status: 'absage', loeschenAb: new Date('2026-09-21T00:00:00Z') },
      new Date('2026-09-21T00:00:00Z'),
    )).toBe(true)
  })

  it('löscht nie, wer eingestellt wurde', () => {
    expect(loeschreif(
      { status: 'eingestellt', loeschenAb: new Date('2020-01-01T00:00:00Z') },
      new Date('2026-09-21T00:00:00Z'),
    )).toBe(false)
    expect(loeschreif(
      { status: 'absage', employeeId: 'emp1', loeschenAb: new Date('2020-01-01T00:00:00Z') },
      new Date('2026-09-21T00:00:00Z'),
    )).toBe(false)
  })

  it('hält eine Einwilligung in den Bewerberpool zurück', () => {
    expect(loeschreif(
      {
        status: 'absage',
        loeschenAb: new Date('2026-01-01T00:00:00Z'),
        poolBis: new Date('2027-01-01T00:00:00Z'),
      },
      new Date('2026-09-21T00:00:00Z'),
    )).toBe(false)
  })

  it('löscht, sobald auch die Einwilligung abgelaufen ist', () => {
    expect(loeschreif(
      {
        status: 'absage',
        loeschenAb: new Date('2026-01-01T00:00:00Z'),
        poolBis: new Date('2026-06-01T00:00:00Z'),
      },
      new Date('2026-09-21T00:00:00Z'),
    )).toBe(true)
  })

  it('löscht nichts ohne gesetzte Frist — ein laufendes Verfahren bleibt', () => {
    expect(loeschreif({ status: 'gespraech' }, new Date('2030-01-01T00:00:00Z')))
      .toBe(false)
  })
})

describe('Was durch das öffentliche Formular kommt', () => {
  const gut = { name: 'Anna Beispiel', email: 'anna@example.de' }

  it('nimmt eine vollständige Bewerbung an', () => {
    const p = pruefeBewerbung(gut)
    expect(p.ok).toBe(true)
    expect(p.werte?.email).toBe('anna@example.de')
  })

  it('senkt die E-Mail-Adresse auf Kleinschreibung', () => {
    expect(pruefeBewerbung({ ...gut, email: 'Anna@Example.DE' }).werte?.email)
      .toBe('anna@example.de')
  })

  it('verwirft den Automaten wortlos', () => {
    const p = pruefeBewerbung({ ...gut, webseite: 'http://spam.example' })
    expect(p.ok).toBe(false)
    expect(p.stillVerwerfen).toBe(true)
    expect(p.fehler).toBeUndefined()
  })

  it('verlangt einen Namen', () => {
    expect(pruefeBewerbung({ ...gut, name: 'A' }).ok).toBe(false)
    expect(pruefeBewerbung({ ...gut, name: '   ' }).ok).toBe(false)
  })

  it('verlangt eine plausible E-Mail-Adresse', () => {
    expect(pruefeBewerbung({ ...gut, email: 'anna@example' }).ok).toBe(false)
    expect(pruefeBewerbung({ ...gut, email: 'anna' }).ok).toBe(false)
  })

  it('lässt niemanden die Datenbank volllaufen', () => {
    const p = pruefeBewerbung({ ...gut, nachricht: 'x'.repeat(MAX_NACHRICHT + 1) })
    expect(p.ok).toBe(false)
    expect(p.stillVerwerfen).toBeUndefined()
  })

  it('macht aus einem leeren Feld null und nicht einen leeren Text', () => {
    expect(pruefeBewerbung({ ...gut, telefon: '  ' }).werte?.telefon).toBeNull()
  })
})

describe('Was Google for Jobs zu lesen bekommt', () => {
  const stelle = {
    titel: 'Erzieherin (m/w/d)', slug: 'erzieherin', ort: 'Köln', plz: '50667',
    umfang: 'teilzeit', beschreibung: 'Krippengruppe mit fünfzehn Kindern.',
    aufgaben: ['Begleitung der Kinder'], profil: ['Staatliche Anerkennung'],
    wirBieten: ['Unbefristet'], stundenProWoche: 30,
    befristung: 'unbefristet', verguetungVon: 3200, verguetungBis: 3800,
    verguetungZeit: 'monat', veroeffentlichtAm: new Date('2026-09-01T10:00:00Z'),
  }
  const betrieb = { name: 'Träger e.V.' }
  const adresse = { strasse: 'Musterweg 1', plz: '50667', ort: 'Köln' }

  it('enthält die Felder, ohne die Google die Anzeige verwirft', () => {
    const ld = jobPostingLd(stelle, betrieb, adresse)
    expect(ld['@type']).toBe('JobPosting')
    expect(ld.title).toBe('Erzieherin (m/w/d)')
    expect(ld.datePosted).toBe('2026-09-01')
    expect(ld.hiringOrganization).toMatchObject({ name: 'Träger e.V.' })
    expect(ld.jobLocation).toBeTruthy()
  })

  it('übersetzt den Umfang in die Sprache von schema.org', () => {
    expect(UMFANG_SCHEMA.teilzeit).toBe('PART_TIME')
    expect(UMFANG_SCHEMA.vollzeit).toBe('FULL_TIME')
    expect(jobPostingLd(stelle, betrieb, adresse).employmentType).toBe('PART_TIME')
  })

  it('gibt eine Spanne als Spanne an', () => {
    const ld = jobPostingLd(stelle, betrieb, adresse) as {
      baseSalary: { value: Record<string, unknown> }
    }
    expect(ld.baseSalary.value.minValue).toBe(3200)
    expect(ld.baseSalary.value.maxValue).toBe(3800)
    expect(ld.baseSalary.value.unitText).toBe('MONTH')
  })

  it('lässt die Vergütung weg, wenn keine angegeben ist', () => {
    const ohne = jobPostingLd({ ...stelle, verguetungVon: null }, betrieb, adresse)
    expect(ohne.baseSalary).toBeUndefined()
  })

  it('setzt datePosted auch bei einer unveröffentlichten Anzeige', () => {
    const ld = jobPostingLd({ ...stelle, veroeffentlichtAm: null }, betrieb, adresse)
    expect(String(ld.datePosted)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('trägt eine Befristung als validThrough ein', () => {
    const ld = jobPostingLd(
      { ...stelle, befristung: 'befristet', befristetBis: '2027-08-31' },
      betrieb, adresse,
    )
    expect(String(ld.validThrough)).toMatch(/^2027-08-31/)
  })
})

describe('Die Anzeige als Text', () => {
  it('setzt die Stichpunkte unter ihre Überschriften', () => {
    const text = anzeigeText({
      titel: 'x', slug: 'x', umfang: 'vollzeit', beschreibung: 'Einleitung.',
      aufgaben: ['A'], profil: ['B'], wirBieten: ['C'],
      befristung: 'unbefristet', verguetungZeit: 'monat',
    })
    expect(text).toContain('Einleitung.')
    expect(text).toContain('Deine Aufgaben:\n• A')
    expect(text).toContain('Das bringst du mit:\n• B')
    expect(text).toContain('Das bieten wir:\n• C')
  })

  it('schreibt die Vergütung so hin, wie sie ein Mensch liest', () => {
    expect(verguetungText({ verguetungVon: 3200, verguetungBis: 3800, verguetungZeit: 'monat' }))
      .toBe('3.200 – 3.800 € pro Monat')
    expect(verguetungText({ verguetungVon: 15, verguetungZeit: 'stunde' }))
      .toBe('ab 15 € pro Stunde')
    expect(verguetungText({ verguetungZeit: 'monat' })).toBeNull()
  })
})
