import { describe, it, expect } from 'vitest'
import { benachrichtigungsziel } from '../benachrichtigungsziel'

/**
 * §239 Wohin eine Benachrichtigung führt.
 *
 * Gemeldet: „Dich hat jemand angefragt für einen Schichttausch, dann klicke ich
 * rauf und dann möchte ich, dass ich zu dieser Schichttauschanfrage hingeleitet
 * werde."
 */

describe('benachrichtigungsziel', () => {
  it('nimmt die gespeicherte Adresse', () => {
    expect(benachrichtigungsziel(
      { type: 'swap_request', url: '/employee/schedule?tab=swaps' }, 'employee',
    )).toBe('/employee/schedule?tab=swaps')
  })

  it('und zwar auch dann, wenn die Tabelle etwas anderes wüsste', () => {
    // Wer die Benachrichtigung erzeugt, weiß mehr als eine Tabelle über Arten.
    expect(benachrichtigungsziel(
      { type: 'swap_request', url: '/employee/nachrichten' }, 'employee',
    )).toBe('/employee/nachrichten')
  })

  /*
   * Der eigentliche Zweck der Tabelle: Alle Benachrichtigungen, die es HEUTE
   * schon gibt, haben keine gespeicherte Adresse. Ohne die Herleitung wäre die
   * Glocke für jeden, der jetzt hineinschaut, unverändert tot.
   */
  it('leitet sonst aus der Art her — der Fall aller bestehenden Zeilen', () => {
    expect(benachrichtigungsziel({ type: 'swap_request' }, 'employee'))
      .toBe('/employee/schedule?tab=swaps')
    expect(benachrichtigungsziel({ type: 'swap_request', url: null }, 'employee'))
      .toBe('/employee/schedule?tab=swaps')
  })

  /*
   * Die Rolle entscheidet mit. Ohne sie träfe dieselbe Art bei der Hälfte der
   * Leute daneben: Eine gemeldete Abwesenheit führt die Leitung dorthin, wo sie
   * sie bearbeitet — die betroffene Person zu ihrer eigenen Krankmeldung.
   */
  it('führt dieselbe Art je nach Rolle woandershin', () => {
    expect(benachrichtigungsziel({ type: 'absence_reported' }, 'employee'))
      .toBe('/employee/krank')
    expect(benachrichtigungsziel({ type: 'absence_reported' }, 'admin'))
      .toBe('/admin/time-tracking')
    expect(benachrichtigungsziel({ type: 'vacation_request_submitted' }, 'company'))
      .toBe('/admin/urlaub')
  })

  it('eine Frühwarnung hat für Mitarbeitende kein Ziel', () => {
    // Sie bekommen sie gar nicht; käme sie trotzdem an, führte sie auf eine
    // Seite, die ihnen verwehrt ist.
    expect(benachrichtigungsziel({ type: 'high-sickness-rate' }, 'employee')).toBeNull()
    expect(benachrichtigungsziel({ type: 'high-sickness-rate' }, 'admin'))
      .toBe('/admin/auswertungen')
  })

  it('eine unbekannte Art führt nirgendwohin', () => {
    // Lieber ein Text ohne Ziel als ein Sprung auf eine Seite, auf der man
    // nicht findet, wovon die Rede war.
    expect(benachrichtigungsziel({ type: 'gibt-es-nicht' }, 'employee')).toBeNull()
    expect(benachrichtigungsziel({}, 'employee')).toBeNull()
    expect(benachrichtigungsziel({ type: undefined }, 'admin')).toBeNull()
  })

  /*
   * §239 Die Sperre gegen fremde Adressen.
   *
   * Heute kommen alle Adressen aus dem eigenen Code. Das ist kein Grund, die
   * Prüfung wegzulassen: Ein `https://…` in einer Benachrichtigung wäre ein Weg,
   * jemanden aus der App heraus auf eine fremde Seite zu schicken — und die
   * Rundmeldung (`/api/notifications/broadcast`) nimmt eine Adresse von außen
   * entgegen.
   */
  it('niemals auf eine fremde Adresse', () => {
    for (const boese of [
      'https://beispiel.invalid/phish',
      'http://beispiel.invalid',
      '//beispiel.invalid/phish',
      'javascript:alert(1)',
    ]) {
      expect(benachrichtigungsziel({ type: 'swap_request', url: boese }, 'employee'))
        // Fällt auf die Herleitung zurück, statt der fremden Adresse zu folgen.
        .toBe('/employee/schedule?tab=swaps')
    }
  })

  it('und eine fremde Adresse ohne bekannte Art führt nirgendwohin', () => {
    expect(benachrichtigungsziel(
      { type: 'gibt-es-nicht', url: 'https://beispiel.invalid' }, 'employee',
    )).toBeNull()
  })

  it('Leerraum zählt nicht als Adresse', () => {
    expect(benachrichtigungsziel({ type: 'swap_request', url: '   ' }, 'employee'))
      .toBe('/employee/schedule?tab=swaps')
  })
})
