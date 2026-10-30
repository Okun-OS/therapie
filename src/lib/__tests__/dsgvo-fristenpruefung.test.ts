import { describe, it, expect } from 'vitest'
import { DATENARTEN, datenart } from '../dsgvo-katalog'
import {
  PRUEFUNGEN, pruefungZu, offeneFragen, befunde, ungeprueft, SICHERHEIT_TEXT,
} from '../dsgvo-fristenpruefung'

/**
 * §154 Diese Tests halten die Prüfung an den Katalog. Eine neue Datenart ohne
 * geprüfte Frist ist genau der Fall, der bei einer Aufsichtsprüfung auffällt:
 * Man hat ein Löschkonzept, aber für eine Tabelle weiß niemand, woher die Zahl
 * kommt.
 */

describe('Jede Datenart ist geprüft', () => {
  it('lässt keine ungeprüft', () => {
    expect(ungeprueft(),
      'Diese Datenarten stehen im Katalog, wurden aber nie gegen ihre\n'
      + 'Vorschrift geprüft. Eine Frist ohne Herleitung ist geraten:\n  '
      + ungeprueft().join('\n  '),
    ).toEqual([])
  })

  it('prüft nichts, was es nicht gibt', () => {
    const erfunden = PRUEFUNGEN
      .filter(p => !datenart(p.id))
      .map(p => p.id)
    expect(erfunden).toEqual([])
  })

  it('hat zu jeder Datenart genau eine Prüfung', () => {
    const ids = PRUEFUNGEN.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(DATENARTEN.length)
  })
})

describe('Jede Prüfung sagt etwas', () => {
  it('leitet die Frist in Sätzen her', () => {
    for (const p of PRUEFUNGEN) {
      expect(p.herleitung.length, `${p.id}: zu knapp`).toBeGreaterThan(80)
    }
  })

  it('nennt in der Herleitung eine Fundstelle', () => {
    for (const p of PRUEFUNGEN) {
      expect(p.herleitung, `${p.id}: keine Vorschrift genannt`)
        .toMatch(/§|Art\.|Erwägungsgrund/)
    }
  })

  it('stellt zu jedem „klaeren" auch wirklich eine Frage', () => {
    for (const p of PRUEFUNGEN.filter(x => x.sicherheit === 'klaeren')) {
      expect(p.frage, `${p.id}: als zu klären markiert, aber ohne Frage`)
        .toBeTruthy()
      expect(p.frage!.length).toBeGreaterThan(50)
      // Eine Frage, die man so stellen kann — also mit Adressat.
      expect(p.frage!, `${p.id}: ohne Adressat`)
        .toMatch(/Steuerberater|Datenschutzbeauftragten|Anwalt/)
    }
  })

  it('kennt nur die drei vereinbarten Stufen', () => {
    for (const p of PRUEFUNGEN) {
      expect(SICHERHEIT_TEXT[p.sicherheit], `${p.id}`).toBeTruthy()
    }
  })

  it('findet eine Prüfung über ihre Kennung', () => {
    expect(pruefungZu('lohnkonto')?.sicherheit).toBe('klaeren')
    expect(pruefungZu('gibt-es-nicht')).toBeUndefined()
  })
})

describe('Was die Prüfung gefunden hat', () => {
  it('hat offene Fragen — eine Prüfung ganz ohne wäre verdächtig', () => {
    expect(offeneFragen().length).toBeGreaterThan(0)
  })

  it('merkt an, dass die Zeiterfassung zu kurz sein könnte', () => {
    const z = pruefungZu('zeiterfassung')!
    expect(z.befund).toMatch(/ZU KURZ/)
    expect(z.befund).toMatch(/§147/)
  })

  it('merkt die Verkürzung für Buchungsbelege an', () => {
    const u = pruefungZu('unterlagen')!
    expect(u.befund).toMatch(/ACHT/)
    expect(u.befund).toMatch(/Bürokratieentlastungsgesetz/)
  })

  it('merkt an, dass die Personalakte zu grob behandelt wird', () => {
    expect(pruefungZu('unterlagen')!.befund).toMatch(/Art\. 5 Abs\. 1 lit\. e/)
  })

  it('führt jeden Befund einzeln auf', () => {
    expect(befunde().length).toBeGreaterThan(3)
    for (const b of befunde()) {
      expect(b.befund!.length, `${b.id}`).toBeGreaterThan(80)
    }
  })
})

describe('Der Nachweis der Belehrung wird nicht mehr sofort gelöscht', () => {
  const d = datenart('belehrungsnachweis')

  it('ist eine eigene Datenart', () => {
    expect(d).toBeTruthy()
    expect(d!.modelle).toEqual(['BelehrungBestaetigung'])
  })

  it('wird gesperrt statt gelöscht', () => {
    // Er ist der Nachweis des Betriebs. Ihn mit dem Austritt zu löschen hieße,
    // genau den Beleg wegzuwerfen, für den das Modul gebaut wurde.
    expect(d!.behandlung).toBe('sperren')
    expect(d!.fristJahre).toBe(3)
  })

  it('stützt sich auf die Ausnahme in Art. 17', () => {
    expect(d!.grundlage).toMatch(/Art\. 17 Abs\. 3 lit\. e/)
    expect(d!.grundlage).toMatch(/§195 BGB/)
  })

  it('erklärt in der Begründung, warum das kein Horten ist', () => {
    expect(d!.begruendung).toMatch(/§12 ArbSchG|§43 IfSG/)
    expect(d!.begruendung).toMatch(/nie unterwiesen/)
  })

  it('steht nicht mehr bei den Nachweisen', () => {
    expect(datenart('nachweise')!.modelle).not.toContain('BelehrungBestaetigung')
  })
})
