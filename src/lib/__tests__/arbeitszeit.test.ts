import { describe, it, expect } from 'vitest'
import {
  nettoMinuten, nettoSumme, anwesenheitsMinuten, zuSpeicherndeMinuten,
} from '../arbeitszeit'

/**
 * §206 Was `totalMinutes` bedeutet.
 *
 * WARUM DAS EIN TEST IST
 * Weil die Spalte zwei Bedeutungen hatte und beide Zahlen für sich plausibel
 * aussahen. Der Eigentümer hat es nur gemerkt, weil zwei Anzeigen
 * nebeneinander standen: ein Eintrag mit 3 h 32 min und darüber eine Kachel
 * mit 0 h 44 min für denselben Tag.
 *
 * 212 − 168 = 44. Genau die Pause, ein zweites Mal abgezogen.
 */

/** Der Tag aus dem Bildschirmfoto: 6 h 20 anwesend, 2 h 48 Pause. */
const DER_TAG = { totalMinutes: 212, breakMinutes: 168 }

describe('§206 Die gearbeitete Zeit', () => {
  it('zieht die Pause NICHT noch einmal ab', () => {
    expect(nettoMinuten(DER_TAG)).toBe(212)
  })

  it('rechnet den gemeldeten Fall richtig', () => {
    // Vorher stand hier 44 — und genau das stand auf der Kachel.
    expect(nettoMinuten(DER_TAG)).not.toBe(44)
  })

  it('summiert eine Woche ohne Doppelabzug', () => {
    const woche = [DER_TAG, { totalMinutes: 50, breakMinutes: 0 }, { totalMinutes: 0 }]
    // Auf dem Bildschirmfoto stand 94 (1 h 34). Richtig sind 262 (4 h 22).
    expect(nettoSumme(woche)).toBe(262)
  })

  it('kommt mit fehlenden Angaben zurecht', () => {
    expect(nettoMinuten({})).toBe(0)
    expect(nettoMinuten({ totalMinutes: null, breakMinutes: null })).toBe(0)
    expect(nettoSumme([])).toBe(0)
  })

  it('gibt nie eine negative Zeit zurück', () => {
    // Eine negative Arbeitszeit gibt es nicht — aus einem kaputten Eintrag
    // darf kein Abzug vom Monat werden.
    expect(nettoMinuten({ totalMinutes: -30 })).toBe(0)
  })
})

describe('§206 Die Anwesenheit', () => {
  it('ist die gearbeitete Zeit PLUS Pause', () => {
    // Das ist die Zahl für den Nachweis nach §16 ArbZG: wann jemand da war.
    expect(anwesenheitsMinuten(DER_TAG)).toBe(380) // 6 h 20
  })

  it('ist nicht dasselbe wie das, was bezahlt wird', () => {
    expect(anwesenheitsMinuten(DER_TAG)).not.toBe(nettoMinuten(DER_TAG))
  })
})

describe('§206 Was gespeichert wird — beide Wege müssen dasselbe meinen', () => {
  /*
   * DER EIGENTLICHE FEHLER
   * Die Stempeluhr schrieb `totalMinutes` netto, die Korrektur der Leitung
   * brutto. Dieselbe Spalte, zwei Bedeutungen — und die Lohnabrechnung nimmt
   * den Wert unverändert als bezahlte Zeit. Eine korrigierte Buchung wurde
   * damit um die ganze Pause zu hoch bezahlt.
   */
  it('zieht die Pause genau einmal ab', () => {
    expect(zuSpeicherndeMinuten(380, 168)).toBe(212)
  })

  it('liefert für denselben Tag dasselbe wie die Stempeluhr', () => {
    // Die Stempeluhr rechnet: Anwesenheit minus Pause. Die Korrektur muss
    // zur selben Zahl kommen, sonst springt der Monat beim Korrigieren.
    const gestempelt = 380 - 168
    expect(zuSpeicherndeMinuten(380, 168)).toBe(gestempelt)
  })

  it('macht aus einer längeren Pause als Anwesenheit keine Minuszeit', () => {
    expect(zuSpeicherndeMinuten(60, 90)).toBe(0)
  })

  it('verrechnet eine unsinnige negative Pause nicht als Zuschlag', () => {
    expect(zuSpeicherndeMinuten(300, -60)).toBe(300)
  })
})
