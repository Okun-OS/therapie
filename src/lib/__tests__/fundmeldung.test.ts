import { describe, it, expect } from 'vitest'
import {
  meldetext, brauchtZwischenmeldung, ZWISCHENMELDUNG_AB_MINUTEN,
  type Meldeanlass,
} from '../fundmeldung'

/**
 * §143 Diese Texte liest jemand, der gerade einen Fehler gemeldet hat — oft
 * genervt, oft unterwegs, fast nie technisch. Was hier schiefgeht, merkt man
 * nicht an einer roten Prüfung, sondern daran, dass beim nächsten Mal niemand
 * mehr etwas meldet.
 */

const fund = { kennung: 'F-ABC-1234', titel: 'Knopf „Speichern" tut nichts' }
const ALLE: Meldeanlass[] = ['eingegangen', 'dran', 'behoben', 'nicht_umgesetzt']

describe('Die Texte an den Melder', () => {
  it('nennt in jedem Text die Nummer oder den Titel', () => {
    for (const anlass of ALLE) {
      const m = meldetext(anlass, fund)
      expect(m.text.includes(fund.kennung) || m.text.includes(fund.titel)).toBe(true)
    }
  })

  it('hat für jeden Anlass einen Betreff — sonst geht keine E-Mail raus', () => {
    for (const anlass of ALLE) {
      expect(meldetext(anlass, fund).betreff?.length ?? 0).toBeGreaterThan(5)
    }
  })

  it('bedankt sich beim Eingang und verspricht eine Rückmeldung', () => {
    const m = meldetext('eingegangen', fund)
    expect(m.text).toMatch(/Danke/)
    expect(m.text).toMatch(/melden uns/)
  })

  it('sagt beim Abschluss, dass es jetzt gehen sollte', () => {
    const m = meldetext('behoben', fund)
    expect(m.text).toMatch(/behoben/)
    expect(m.text).toMatch(/funktionieren/)
  })

  it('lädt beim Abschluss zum Widerspruch ein', () => {
    // Wer „behoben" liest und es geht immer noch nicht, muss das loswerden
    // können, ohne eine zweite Meldung zu schreiben.
    expect(meldetext('behoben', fund).text).toMatch(/schreib/i)
  })

  it('bleibt auch bei einer Ablehnung freundlich und begründbar', () => {
    const m = meldetext('nicht_umgesetzt', fund)
    expect(m.text).toMatch(/nicht verloren|richtig/)
    expect(m.text).toMatch(/schreib/i)
  })

  it('kürzt einen endlos langen Titel, statt die Nachricht zu sprengen', () => {
    const lang = 'A'.repeat(400)
    const m = meldetext('behoben', { kennung: 'F-1', titel: lang })
    expect(m.text.length).toBeLessThan(400)
    expect(m.text).toMatch(/…/)
  })

  it('kommt ohne Fachbegriffe aus', () => {
    // Der Melder ist eine Pflegekraft, keine Entwicklerin. Was technisch
    // passiert ist, steht auf der Fundeseite.
    for (const anlass of ALLE) {
      const t = meldetext(anlass, fund).text.toLowerCase()
      for (const wort of ['commit', 'branch', 'deploy', 'api', 'null', 'exception']) {
        expect(t).not.toContain(wort)
      }
    }
  })
})

describe('Wann eine Zwischenmeldung sinnvoll ist', () => {
  const vorMinuten = (m: number) => new Date(Date.now() - m * 60000)

  it('schweigt, wenn es gerade erst gemeldet wurde', () => {
    // Zwei Nachrichten in derselben Minute sind kein Service, sondern Lärm.
    expect(brauchtZwischenmeldung(vorMinuten(1))).toBe(false)
  })

  it('meldet sich, wenn es sich hinzieht', () => {
    expect(brauchtZwischenmeldung(vorMinuten(ZWISCHENMELDUNG_AB_MINUTEN + 1))).toBe(true)
  })

  it('nimmt die Grenze selbst noch mit', () => {
    expect(brauchtZwischenmeldung(vorMinuten(ZWISCHENMELDUNG_AB_MINUTEN))).toBe(true)
  })
})
