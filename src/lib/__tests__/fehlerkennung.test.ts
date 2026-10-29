import { describe, it, expect, vi, afterEach } from 'vitest'
import { vorfall } from '../fehlerkennung'

/**
 * §252 Eine Kennung, mit der sich ein Fehler zurückverfolgen lässt.
 *
 * Gemeldet wurde „Die Datei ließ sich nicht senden (Fehler 500, 204 kB)". 500
 * heißt: Die Anwendung ist über etwas gestolpert — und niemand konnte sagen,
 * worüber. Genau das soll diese Datei beenden.
 */

afterEach(() => vi.restoreAllMocks())

/** Das Protokoll stumm schalten — sonst rauscht jeder Testlauf. */
function stumm() {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('vorfall', () => {
  it('gibt den Satz mit einer Kennung zurück', () => {
    stumm()
    const v = vorfall('chat/datei', new Error('irgendwas'), 'Ging nicht.')
    expect(v.text).toMatch(/^Ging nicht\. \(Kennung: [0-9a-f]{6}\)$/)
    expect(v.kennung).toMatch(/^[0-9a-f]{6}$/)
  })

  it('und dieselbe Kennung steht im Satz wie im Feld', () => {
    stumm()
    const v = vorfall('x', new Error('y'), 'Ging nicht.')
    expect(v.text).toContain(v.kennung)
  })

  it('zwei Vorfälle bekommen verschiedene Kennungen', () => {
    stumm()
    const a = vorfall('x', new Error('y'), 'Ging nicht.')
    const b = vorfall('x', new Error('y'), 'Ging nicht.')
    expect(a.kennung).not.toBe(b.kennung)
  })

  it('schreibt den vollen Fehler ins Protokoll — mit der Kennung davor', () => {
    const log = stumm()
    const fehler = new Error('Can not reach database server at db:5432')
    const v = vorfall('chat/datei', fehler, 'Ging nicht.')
    expect(log).toHaveBeenCalledOnce()
    expect(String(log.mock.calls[0][0])).toContain(v.kennung)
    expect(String(log.mock.calls[0][0])).toContain('chat/datei')
    expect(log.mock.calls[0][1]).toBe(fehler)
  })

  /*
   * §252 Die Art darf nach außen, wo sie eindeutig UND harmlos ist. Das
   * erspart im besten Fall die ganze Rückfrage.
   */
  it('nennt die Art, wo sie sich sicher sagen lässt', () => {
    stumm()
    const faelle: [string, string][] = [
      ["Can't reach database server at `db`:`5432`", 'Datenbank nicht erreichbar'],
      ['Timed out fetching a new connection from the connection pool', 'Datenbank überlastet'],
      ['The column `inhalt` does not exist in the current database.', 'Datenbankstand veraltet'],
      ['value too long for the column', 'Inhalt zu groß für die Ablage'],
      ['ENOSPC: no space left on device', 'Speicher voll'],
      ['JavaScript heap out of memory', 'Arbeitsspeicher erschöpft'],
    ]
    for (const [meldung, art] of faelle) {
      expect(vorfall('x', new Error(meldung), 'Ging nicht.').text).toContain(art)
    }
  })

  /*
   * Die Gegenprobe, ohne die „nennt die Art" nichts wert wäre: Was wir NICHT
   * sicher einordnen können, wird auch nicht eingeordnet — und vor allem
   * nicht wörtlich weitergereicht.
   */
  it('aber erfindet keine Art — und gibt nie den Fehlertext heraus', () => {
    stumm()
    const v = vorfall('x', new Error('TypeError: foo.bar is not a function'), 'Ging nicht.')
    expect(v.text).toBe(`Ging nicht. (Kennung: ${v.kennung})`)
    expect(v.text).not.toContain('TypeError')
    expect(v.text).not.toContain('foo.bar')
  })

  it('und erst recht keine Angaben über die Anlage', () => {
    // §234 hat den Grund aufgeschrieben: Wirtsname, Port, Tabellen- und
    // Spaltennamen gehören nicht in einen Screenshot.
    stumm()
    const v = vorfall('x',
      new Error("Can't reach database server at `postgres.internal`:`5432`"),
      'Ging nicht.')
    expect(v.text).not.toContain('postgres.internal')
    expect(v.text).not.toContain('5432')
    expect(v.text).toContain('Datenbank nicht erreichbar')
  })

  it('kommt auch mit etwas zurecht, das kein Fehlerobjekt ist', () => {
    stumm()
    expect(vorfall('x', 'nur ein Text', 'Ging nicht.').text).toContain('Kennung')
    expect(vorfall('x', undefined, 'Ging nicht.').text).toContain('Kennung')
  })
})
