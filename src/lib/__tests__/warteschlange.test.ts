import { describe, it, expect, beforeEach } from 'vitest'
import {
  einreihen, alle, entfernen, aktualisieren, leeren, beurteilen,
  zustandMitWarteschlange, schlangenText, MAX_VERSUCHE, type Vorgang,
} from '../warteschlange'

/**
 * §138 Diese Regeln entscheiden darüber, ob ein Stempel aus dem Funkloch
 * ankommt oder verschwindet. Beim Ankommen geht es um Arbeitszeit, und
 * Arbeitszeit ist Geld — deshalb wird hier jeder Ausgang einzeln nachgerechnet,
 * besonders die Fälle, in denen aufgegeben wird.
 */

// Ein einfacher Speicher, wie ihn der Browser hat.
class Speicher {
  private daten = new Map<string, string>()
  getItem(k: string) { return this.daten.get(k) ?? null }
  setItem(k: string, v: string) { this.daten.set(k, v) }
  removeItem(k: string) { this.daten.delete(k) }
  clear() { this.daten.clear() }
}

beforeEach(() => {
  // @ts-expect-error — im Test steht kein echtes Fenster zur Verfügung
  globalThis.window = { localStorage: new Speicher() }
  leeren()
})

describe('Vorgänge merken', () => {
  it('reiht einen Stempel ein', () => {
    const { ok, vorgang } = einreihen('stempeln', '/api/x', { aktion: 'kommen' })
    expect(ok).toBe(true)
    expect(alle()).toHaveLength(1)
    expect(vorgang!.erzeugtAm).toMatch(/^\d{4}-/)
  })

  it('behält die Reihenfolge — sonst käme „gehen" vor „kommen"', () => {
    einreihen('stempeln', '/api/x', { aktion: 'kommen' })
    einreihen('stempeln', '/api/x', { aktion: 'pause-start' })
    einreihen('stempeln', '/api/x', { aktion: 'gehen' })
    expect(alle().map(v => v.daten.aktion)).toEqual(['kommen', 'pause-start', 'gehen'])
  })

  it('entfernt gezielt', () => {
    const a = einreihen('stempeln', '/api/x', { aktion: 'kommen' }).vorgang!
    einreihen('urlaub', '/api/y', {})
    entfernen(a.id)
    expect(alle().map(v => v.art)).toEqual(['urlaub'])
  })

  it('zählt Versuche mit', () => {
    const a = einreihen('stempeln', '/api/x', {}).vorgang!
    aktualisieren(a.id, { versuche: 3, letzterFehler: 'kein Netz' })
    expect(alle()[0].versuche).toBe(3)
    expect(alle()[0].letzterFehler).toBe('kein Netz')
  })

  it('übersteht einen Speicher, der nicht will', () => {
    // Im privaten Fenster wirft der Speicher. Eine App, die daran abstürzt,
    // ist schlimmer als eine ohne Warteschlange.
    // @ts-expect-error — absichtlich kaputt
    globalThis.window = { localStorage: { getItem() { throw new Error('nope') },
      setItem() { throw new Error('nope') } } }
    expect(alle()).toEqual([])
    expect(einreihen('stempeln', '/api/x', {}).ok).toBe(false)
  })
})

describe('Was eine Antwort bedeutet', () => {
  it('erledigt einen Vorgang bei Erfolg', () => {
    expect(beurteilen(200).ausgang).toBe('erledigt')
    expect(beurteilen(201).ausgang).toBe('erledigt')
  })

  it('wiederholt, wenn gar keine Antwort kam', () => {
    expect(beurteilen(null).ausgang).toBe('wiederholen')
  })

  it('gibt irgendwann auf — eine Schlange, die sich nie leert, ist schlimmer als keine', () => {
    const b = beurteilen(null, undefined, MAX_VERSUCHE - 1)
    expect(b.ausgang).toBe('verworfen')
    expect(b.text).toContain('Standortleitung')
  })

  it('verwirft bei 409, aber nicht stillschweigend', () => {
    // Nach einem Funkloch der Normalfall: Der Stand hat sich geändert.
    const b = beurteilen(409, 'Du bist bereits eingestempelt.')
    expect(b.ausgang).toBe('verworfen')
    expect(b.text).toContain('bereits eingestempelt')
  })

  it('behält einen Vorgang bei abgelaufener Anmeldung', () => {
    // Nach dem nächsten Anmelden geht es — wegwerfen wäre Datenverlust.
    expect(beurteilen(401).ausgang).toBe('wiederholen')
  })

  it('verwirft, was der Server dauerhaft ablehnt', () => {
    expect(beurteilen(400, 'Erforderliche Felder fehlen').ausgang).toBe('verworfen')
    expect(beurteilen(403).ausgang).toBe('verworfen')
  })

  it('wiederholt bei einem Problem des Servers', () => {
    expect(beurteilen(500).ausgang).toBe('wiederholen')
    expect(beurteilen(503).ausgang).toBe('wiederholen')
  })

  it('nennt bei jedem Verwerfen einen Grund', () => {
    for (const b of [beurteilen(409), beurteilen(400), beurteilen(403),
      beurteilen(null, undefined, MAX_VERSUCHE)]) {
      expect(b.ausgang).toBe('verworfen')
      expect(b.text!.length).toBeGreaterThan(10)
    }
  })
})

describe('Was die Stempeluhr anzeigt, solange nichts übertragen ist', () => {
  const v = (aktion: string): Vorgang => ({
    id: aktion, art: 'stempeln', pfad: '/x', methode: 'POST',
    daten: { aktion }, erzeugtAm: '', versuche: 0,
  })
  const aus = { laeuft: false, pause: false }

  it('zeigt nach einem gemerkten „kommen" eingestempelt an', () => {
    // Sonst stünde „nicht eingestempelt", obwohl die Person längst arbeitet —
    // und sie würde ein zweites Mal drücken.
    expect(zustandMitWarteschlange(aus, [v('kommen')])).toEqual({ laeuft: true, pause: false })
  })

  it('rechnet eine ganze Kette nach', () => {
    expect(zustandMitWarteschlange(aus, [v('kommen'), v('pause-start')]))
      .toEqual({ laeuft: true, pause: true })
    expect(zustandMitWarteschlange(aus, [v('kommen'), v('pause-start'), v('pause-ende')]))
      .toEqual({ laeuft: true, pause: false })
    expect(zustandMitWarteschlange(aus, [v('kommen'), v('gehen')]))
      .toEqual({ laeuft: false, pause: false })
  })

  it('beginnt beim Stand des Servers', () => {
    expect(zustandMitWarteschlange({ laeuft: true, pause: false }, [v('gehen')]))
      .toEqual({ laeuft: false, pause: false })
  })

  it('lässt andere Vorgänge unberührt', () => {
    const urlaub: Vorgang = {
      id: 'u', art: 'urlaub', pfad: '/x', methode: 'POST',
      daten: {}, erzeugtAm: '', versuche: 0,
    }
    expect(zustandMitWarteschlange({ laeuft: true, pause: false }, [urlaub]))
      .toEqual({ laeuft: true, pause: false })
  })

  it('startet keine Pause ohne laufende Erfassung', () => {
    expect(zustandMitWarteschlange(aus, [v('pause-start')])).toEqual(aus)
  })
})

describe('Der Satz für die Leiste', () => {
  const bau = (art: Vorgang['art']): Vorgang => ({
    id: art, art, pfad: '/x', methode: 'POST', daten: {}, erzeugtAm: '', versuche: 0,
  })

  it('schweigt, wenn nichts wartet', () => {
    expect(schlangenText([])).toBe('')
  })

  it('nennt den einen Vorgang beim Namen', () => {
    expect(schlangenText([bau('stempeln')])).toContain('Stempel')
  })

  it('zählt und listet die Arten', () => {
    const t = schlangenText([bau('stempeln'), bau('krankmeldung')])
    expect(t).toContain('2 Einträge')
    expect(t).toContain('Krankmeldung')
  })
})
