import { describe, it, expect } from 'vitest'
import { codeErzeugen, GUELTIG_MINUTEN, MAX_VERSUCHE, SPERRE_MINUTEN } from '../zweiter-faktor'

/**
 * §196 Die Zahlen hinter dem zweiten Faktor.
 *
 * Der Ablauf selbst — Code anlegen, prüfen, verbrauchen — braucht eine
 * Datenbank und steht deshalb in `pruefungen/l-zweiter-faktor.mjs`, wo gegen
 * das laufende System geprüft wird. Hier stehen die Entscheidungen, die man
 * ohne Datenbank nachrechnen kann, und die beim Ändern am leichtesten
 * verrutschen.
 */

describe('§196 Der Code', () => {
  it('ist sechsstellig und besteht nur aus Ziffern', () => {
    for (let i = 0; i < 300; i++) expect(codeErzeugen()).toMatch(/^[0-9]{6}$/)
  })

  it('fängt nie mit einer Null an — sonst wären es faktisch fünf Stellen', () => {
    // 100000 + Zufall unter 900000 heißt: immer zwischen 100000 und 999999.
    for (let i = 0; i < 300; i++) expect(codeErzeugen()[0]).not.toBe('0')
  })

  it('wiederholt sich nicht in Serie', () => {
    const gesehen = new Set(Array.from({ length: 300 }, () => codeErzeugen()))
    expect(gesehen.size).toBeGreaterThan(250)
  })
})

describe('§196 Die Grenzen', () => {
  it('lässt höchstens eine Handvoll Fehlversuche zu', () => {
    // Bei sechs Stellen gibt es 900.000 Möglichkeiten. Fünf Versuche heißen
    // eine Trefferchance von etwa 1 zu 180.000 — eine unbegrenzte Zahl von
    // Versuchen hieße: jeder kommt hinein, es dauert nur.
    expect(MAX_VERSUCHE).toBeGreaterThan(2)
    expect(MAX_VERSUCHE).toBeLessThanOrEqual(5)
  })

  it('lässt den Code nicht länger gelten als eine Viertelstunde', () => {
    // Lang genug, dass eine E-Mail ankommt; kurz genug, dass ein
    // mitgelesener Code wertlos wird, bevor ihn jemand benutzt.
    expect(GUELTIG_MINUTEN).toBeGreaterThanOrEqual(5)
    expect(GUELTIG_MINUTEN).toBeLessThanOrEqual(15)
  })

  it('bremst wiederholtes Anfordern', () => {
    // Ohne Sperre könnte jemand das Postfach oder das Telefon eines anderen
    // mit Codes überschütten — und nebenbei SMS-Kosten erzeugen.
    expect(SPERRE_MINUTEN).toBeGreaterThanOrEqual(1)
  })
})
