import { describe, it, expect } from 'vitest'
import { wunschSchicht, istWunschFrei, wunschText } from '../wunsch-zuordnung'

/**
 * §281 Der Dienstwunsch, der nie ankam.
 *
 * Die Mitarbeiter-App reicht `early` ein, der Planer suchte nach
 * „Frühdienst" oder „sf-frueh". Kein Treffer, kein Wunsch, keine Meldung.
 * Diese Prüfungen halten genau diesen Fall fest.
 */

const SCHICHTEN = [
  { id: 'sf-frueh', name: 'Frühdienst', typ: 'frueh' },
  { id: 'sf-tag', name: 'Tagdienst', typ: 'mittel' },
  { id: 'sf-spaet', name: 'Spätdienst', typ: 'spaet' },
  { id: 'sf-nacht', name: 'Nachtdienst', typ: 'nacht' },
]

describe('§281 wunschSchicht — was die App wirklich einreicht', () => {
  /*
   * Der Fall, an dem alles hing. `early` ist weder ein Name noch eine
   * Kennung — und genau das reicht die Mitarbeiter-App ein.
   */
  it('findet den Frühdienst zu „early"', () => {
    expect(wunschSchicht('early', SCHICHTEN)?.id).toBe('sf-frueh')
  })

  it('und die übrigen Arten ebenso', () => {
    expect(wunschSchicht('late', SCHICHTEN)?.id).toBe('sf-spaet')
    expect(wunschSchicht('mid', SCHICHTEN)?.id).toBe('sf-tag')
    expect(wunschSchicht('night', SCHICHTEN)?.id).toBe('sf-nacht')
  })

  it('auch wenn die Art schon deutsch eingereicht wird', () => {
    expect(wunschSchicht('frueh', SCHICHTEN)?.id).toBe('sf-frueh')
    expect(wunschSchicht('spaet', SCHICHTEN)?.id).toBe('sf-spaet')
  })

  it('Groß- und Kleinschreibung stört nicht', () => {
    expect(wunschSchicht('EARLY', SCHICHTEN)?.id).toBe('sf-frueh')
    expect(wunschSchicht('  Late  ', SCHICHTEN)?.id).toBe('sf-spaet')
  })
})

describe('§281 Dieselbe Frage, zwei Schreibweisen', () => {
  /*
   * Die Planung führt die Art als `typ` („frueh"), die Oberfläche als
   * `type` („early"). Beide stellen dieselbe Frage — und müssen dieselbe
   * Antwort bekommen, sonst zeigt der Bildschirm etwas anderes an, als
   * geplant wird.
   */
  const WIE_IM_BILDSCHIRM = [
    { id: 'a', name: 'Frühdienst', type: 'early' },
    { id: 'b', name: 'Spätdienst', type: 'late' },
    { id: 'c', name: 'Tagdienst', type: 'mid' },
  ]

  it('findet den Dienst auch über `type`', () => {
    expect(wunschSchicht('early', WIE_IM_BILDSCHIRM)?.id).toBe('a')
    expect(wunschSchicht('late', WIE_IM_BILDSCHIRM)?.id).toBe('b')
    expect(wunschSchicht('mid', WIE_IM_BILDSCHIRM)?.id).toBe('c')
  })

  it('und liefert beiderseits dasselbe Urteil', () => {
    for (const art of ['early', 'late', 'mid']) {
      const imPlaner = wunschSchicht(art, SCHICHTEN)?.name
      const imBildschirm = wunschSchicht(art, WIE_IM_BILDSCHIRM)?.name
      expect(imBildschirm, art).toBe(imPlaner)
    }
  })
})

describe('§281 Die anderen Wege, einen Dienst zu benennen', () => {
  it('eine Kennung trifft weiterhin', () => {
    expect(wunschSchicht('sf-spaet', SCHICHTEN)?.id).toBe('sf-spaet')
  })

  it('und ein Name auch', () => {
    expect(wunschSchicht('Nachtdienst', SCHICHTEN)?.id).toBe('sf-nacht')
  })

  /*
   * Die Gegenprobe zur Reihenfolge: Hieße ein Dienst „early", dürfte die ART
   * trotzdem gewinnen — sonst bekäme jemand, der den Frühdienst wünscht,
   * einen Dienst, der nur zufällig so heißt.
   */
  it('die Art schlägt einen gleichnamigen Dienst', () => {
    const verwirrend = [
      { id: 'x', name: 'early', typ: 'nacht' },
      ...SCHICHTEN,
    ]
    expect(wunschSchicht('early', verwirrend)?.id).toBe('sf-frueh')
  })
})

describe('§281 Wenn es nichts zu treffen gibt', () => {
  it('ein Wunsch nach einem freien Tag ist kein Dienst', () => {
    expect(wunschSchicht('frei', SCHICHTEN)).toBeNull()
    expect(istWunschFrei('frei')).toBe(true)
    expect(istWunschFrei('early')).toBe(false)
  })

  /*
   * Der Standort hat keinen Nachtdienst, jemand wünscht sich einen. Das ist
   * eine Antwort — `null` — und kein Fehler. Verschluckt werden darf sie
   * nicht: Genau daran ist der ganze Vorgang gescheitert.
   */
  it('gibt null zurück, wenn es den Dienst hier nicht gibt', () => {
    const ohneNacht = SCHICHTEN.filter(s => s.typ !== 'nacht')
    expect(wunschSchicht('night', ohneNacht)).toBeNull()
  })

  it('und bei Unsinn ebenfalls', () => {
    expect(wunschSchicht('', SCHICHTEN)).toBeNull()
    expect(wunschSchicht(null, SCHICHTEN)).toBeNull()
    expect(wunschSchicht(undefined, SCHICHTEN)).toBeNull()
    expect(wunschSchicht('feierabend', SCHICHTEN)).toBeNull()
  })

  it('ohne Dienste am Standort gibt es nichts zu treffen', () => {
    expect(wunschSchicht('early', [])).toBeNull()
  })
})

describe('§281 wunschText — was die Leitung liest', () => {
  it('nennt den Dienst beim Namen des Betriebs', () => {
    expect(wunschText('early', SCHICHTEN)).toBe('Frühdienst')
    expect(wunschText('mid', SCHICHTEN)).toBe('Tagdienst')
  })

  it('und einen freien Tag beim Namen', () => {
    expect(wunschText('frei', SCHICHTEN)).toBe('Freier Tag')
  })

  /*
   * Auch wenn es den Dienst hier nicht gibt, steht auf dem Bildschirm kein
   * `night`. Die Leitung liest Deutsch, nicht die Sprache der Datenbank.
   */
  it('auch dann, wenn der Standort ihn gar nicht führt', () => {
    expect(wunschText('night', [])).toBe('Nachtdienst')
  })

  it('und bei etwas völlig Unbekanntem wird nichts erfunden', () => {
    expect(wunschText('feierabend', SCHICHTEN)).toBe('feierabend')
    expect(wunschText('', SCHICHTEN)).toBe('unbekannter Wunsch')
  })
})
