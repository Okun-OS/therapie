import { describe, it, expect } from 'vitest'
import {
  pruefeDatei, sichererDateiname, mitarbeiterDarfSehen,
  MAX_DATEI_BYTES, MITARBEITER_DARF_HOCHLADEN, IMMER_SICHTBAR,
} from '../file-storage'

// §100 Dateiablage. Der wichtigste Teil sind die Zugriffsregeln: Ein
// Krankenschein, den der falsche Mensch sieht, ist ein Datenschutzvorfall.

describe('Dateiprüfung', () => {
  it('nimmt einen normalen Vertrag an', () => {
    expect(pruefeDatei('Arbeitsvertrag.pdf', 'application/pdf', 240_000).ok).toBe(true)
  })

  it('lehnt leere Dateien ab', () => {
    const r = pruefeDatei('leer.pdf', 'application/pdf', 0)
    expect(r.ok).toBe(false)
    expect(r.fehler).toContain('leer')
  })

  it('lehnt zu große Dateien ab und nennt die Grenze', () => {
    const r = pruefeDatei('scan.pdf', 'application/pdf', MAX_DATEI_BYTES + 1)
    expect(r.ok).toBe(false)
    expect(r.fehler).toContain('10 MB')
  })

  it('lehnt ausführbare Dateien ab', () => {
    for (const typ of ['application/x-msdownload', 'text/html', 'application/javascript']) {
      expect(pruefeDatei('boese', typ, 100).ok).toBe(false)
    }
  })

  it('erlaubt PDF und die üblichen Bildformate', () => {
    for (const typ of ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']) {
      expect(pruefeDatei('datei', typ, 5000).ok).toBe(true)
    }
  })
})

describe('Dateinamen entschärfen', () => {
  it('entfernt Pfadanteile', () => {
    expect(sichererDateiname('../../etc/passwd')).toBe('passwd')
    expect(sichererDateiname('C:\\Users\\x\\vertrag.pdf')).toBe('vertrag.pdf')
  })

  it('entfernt Zeilenumbrüche und Anführungszeichen (Header-Einschleusung)', () => {
    const name = sichererDateiname('datei"\r\nX-Böse: 1.pdf')
    expect(name).not.toContain('"')
    expect(name).not.toContain('\n')
    expect(name).not.toContain('\r')
  })

  it('behält Umlaute', () => {
    expect(sichererDateiname('Änderungsvertrag_Müller.pdf')).toBe('Änderungsvertrag_Müller.pdf')
  })

  it('liefert nie einen leeren Namen', () => {
    expect(sichererDateiname('   ')).toBe('datei')
    expect(sichererDateiname('/')).toBe('datei')
  })
})

describe('Was der Mitarbeiter sehen darf', () => {
  const basis = {
    ownerType: 'employee',
    ownerId: 'anna',
    sichtbarFuerMitarbeiter: false,
    kategorie: 'sonstiges',
    hochgeladenVon: 'leitung',
  }

  it('sieht seinen eigenen Vertrag immer', () => {
    expect(mitarbeiterDarfSehen({ ...basis, kategorie: 'vertrag' }, 'anna')).toBe(true)
  })

  it('sieht seine eigene Lohnabrechnung immer', () => {
    expect(mitarbeiterDarfSehen({ ...basis, kategorie: 'lohnabrechnung' }, 'anna')).toBe(true)
  })

  it('sieht einen internen Vermerk der Leitung NICHT', () => {
    expect(mitarbeiterDarfSehen(basis, 'anna')).toBe(false)
  })

  it('sieht einen internen Vermerk, sobald die Leitung ihn freigibt', () => {
    expect(mitarbeiterDarfSehen({ ...basis, sichtbarFuerMitarbeiter: true }, 'anna')).toBe(true)
  })

  it('sieht wieder, was er selbst eingereicht hat', () => {
    const eigenerKrankenschein = { ...basis, kategorie: 'krankenschein', hochgeladenVon: 'anna' }
    expect(mitarbeiterDarfSehen(eigenerKrankenschein, 'anna')).toBe(true)
  })

  it('sieht NIEMALS die Akte einer Kollegin — auch nicht deren Vertrag', () => {
    const fremd = { ...basis, ownerId: 'bernd', kategorie: 'vertrag' }
    expect(mitarbeiterDarfSehen(fremd, 'anna')).toBe(false)
  })

  it('sieht keine Standort-Dateien', () => {
    const standortdatei = { ...basis, ownerType: 'location', ownerId: 'anna', sichtbarFuerMitarbeiter: true }
    expect(mitarbeiterDarfSehen(standortdatei, 'anna')).toBe(false)
  })
})

describe('Was der Mitarbeiter hochladen darf', () => {
  it('darf seine Krankmeldung einreichen', () => {
    expect(MITARBEITER_DARF_HOCHLADEN).toContain('krankenschein')
  })

  it('darf sich KEINEN Arbeitsvertrag und KEINE Lohnabrechnung in die Akte legen', () => {
    expect(MITARBEITER_DARF_HOCHLADEN).not.toContain('vertrag')
    expect(MITARBEITER_DARF_HOCHLADEN).not.toContain('lohnabrechnung')
    expect(MITARBEITER_DARF_HOCHLADEN).not.toContain('zeugnis')
  })

  it('bekommt Vertrag und Abrechnung aber automatisch zu sehen', () => {
    expect(IMMER_SICHTBAR).toContain('vertrag')
    expect(IMMER_SICHTBAR).toContain('lohnabrechnung')
  })
})
