import { describe, it, expect } from 'vitest'
import { beurteileAntwort } from '../push-geraet'

/**
 * §139 Die eine Entscheidung, die hier wirklich zählt: Wann wird eine
 * Gerätekennung gelöscht?
 *
 * Zu früh gelöscht heißt, dass jemand keine Benachrichtigung mehr bekommt und
 * es nie erfährt — der stillste denkbare Ausfall in einem Werkzeug, dessen
 * Zweck es ist, morgens um sechs jemanden zu erreichen. Zu spät gelöscht heißt
 * nur, dass wir eine Weile gegen tote Kennungen senden. Die Richtung ist also
 * klar: im Zweifel behalten.
 */

describe('Was Google mit seiner Antwort sagt', () => {
  it('nimmt einen Erfolg als Erfolg', () => {
    expect(beurteileAntwort(200)).toBe('zugestellt')
    expect(beurteileAntwort(204)).toBe('zugestellt')
  })

  it('entfernt ein Gerät, das es nicht mehr gibt', () => {
    // 404 UNREGISTERED: App deinstalliert oder Kennung abgelaufen.
    expect(beurteileAntwort(404, 'UNREGISTERED')).toBe('entfernen')
  })

  it('entfernt eine Kennung, die der Server als unbrauchbar meldet', () => {
    expect(beurteileAntwort(400,
      '{"error":{"details":[{"fieldViolations":[{"field":"message.token"}]}]}}'))
      .toBe('entfernen')
  })

  it('behält das Gerät, wenn UNSER Aufruf falsch war', () => {
    // Ein ungültiges Feld ist unser Fehler und darf kein Gerät kosten —
    // sonst räumt ein Tippfehler im Versand die halbe Belegschaft ab.
    expect(beurteileAntwort(400, 'Invalid value at "message.android.priority"'))
      .toBe('spaeter')
  })

  it('behält das Gerät bei einem Rechteproblem', () => {
    // 403 heißt meistens: unser Dienstkonto ist falsch eingerichtet.
    // Daran ist das Telefon unschuldig.
    expect(beurteileAntwort(403, 'PERMISSION_DENIED')).toBe('spaeter')
  })

  it('behält das Gerät, wenn Google gerade nicht kann', () => {
    expect(beurteileAntwort(429)).toBe('spaeter')
    expect(beurteileAntwort(500)).toBe('spaeter')
    expect(beurteileAntwort(503)).toBe('spaeter')
  })
})
