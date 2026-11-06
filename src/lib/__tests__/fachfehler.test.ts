import { describe, it, expect, vi, afterEach } from 'vitest'
import { Fachfehler, nutzerText, nutzerStatus } from '../fachfehler'

/**
 * §234 An dieser Unterscheidung hängt, was ein Mensch im Fehlerfall liest.
 *
 * Zu streng heißt: Der eigene Satz des Programms kommt nicht an, und die
 * Person liest „hat nicht geklappt", wo „Bitte zuerst ausstempeln" gestanden
 * hätte. Zu lose heißt: Beim nächsten Datenbankausfall steht die Adresse des
 * Servers auf dem Bildschirm einer Pflegekraft. Deshalb wird beides geprüft.
 */

afterEach(() => vi.restoreAllMocks())

describe('Was der Mensch liest', () => {
  it('bei einem eigenen Satz: diesen Satz', () => {
    const err = new Fachfehler('Es läuft bereits eine Zeiterfassung.')
    expect(nutzerText(err, 'Standard')).toBe('Es läuft bereits eine Zeiterfassung.')
  })

  it('bei allem anderen: den Standardsatz', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const err = new Error("Can't reach database server at 127.0.0.1:5432")
    expect(nutzerText(err, 'Das Einstempeln hat nicht geklappt.'))
      .toBe('Das Einstempeln hat nicht geklappt.')
  })

  it('und die technische Nachricht verlässt das Haus NICHT', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const geheim = 'Can\'t reach database server at 127.0.0.1:5432'
    const text = nutzerText(new Error(geheim), 'Hat nicht geklappt.')
    expect(text).not.toContain('127.0.0.1')
    expect(text).not.toContain('database')
  })

  it('bei etwas, das gar kein Fehler ist, auch den Standardsatz', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(nutzerText('kaputt', 'Standard')).toBe('Standard')
    expect(nutzerText(undefined, 'Standard')).toBe('Standard')
    expect(nutzerText({ message: 'Tabelle "Shift" fehlt' }, 'Standard')).toBe('Standard')
  })

  /*
   * Der echte Fehler darf nicht verloren gehen, nur weil er nicht nach außen
   * geht. Ohne diese Prüfung wäre die Verbesserung eine Verschlechterung:
   * Die Person liest einen freundlichen Satz, und niemand erfährt je, was war.
   */
  it('wird aber protokolliert, damit ihn jemand findet', () => {
    const protokoll = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const err = new Error('Prisma P2002 unique constraint')
    nutzerText(err, 'Standard')
    expect(protokoll).toHaveBeenCalledOnce()
    expect(protokoll.mock.calls[0]).toContain(err)
  })

  it('und ein eigener Satz braucht kein Protokoll', () => {
    const protokoll = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    nutzerText(new Fachfehler('Dieser Dienst ist bereits besetzt'), 'Standard')
    expect(protokoll).not.toHaveBeenCalled()
  })
})

describe('Mit welchem Status geantwortet wird', () => {
  it('ein eigener Fehler bringt seinen Status mit', () => {
    expect(nutzerStatus(new Fachfehler('nicht gefunden', 404))).toBe(404)
    expect(nutzerStatus(new Fachfehler('Konflikt', 409))).toBe(409)
  })

  it('ohne Angabe ist es 400 — eine Eingabe, die so nicht geht', () => {
    expect(nutzerStatus(new Fachfehler('geht nicht'))).toBe(400)
  })

  it('alles Unerwartete bekommt den übergebenen Status', () => {
    expect(nutzerStatus(new Error('irgendwas'))).toBe(400)
    expect(nutzerStatus(new Error('irgendwas'), 500)).toBe(500)
  })

  it('ein Fachfehler ist ein Error — bestehende Fänger greifen weiter', () => {
    // Sonst würde ein `catch (err) { if (err instanceof Error) … }` an einer
    // Stelle, die noch nichts von der Klasse weiß, stillschweigend durchfallen.
    expect(new Fachfehler('x')).toBeInstanceOf(Error)
    expect(new Fachfehler('x').message).toBe('x')
  })
})
