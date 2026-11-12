import { describe, it, expect } from 'vitest'
import { fehltagAm, fehltagKurz } from '../fehltag'

/**
 * §287 Was an einem Tag anstelle des Dienstes gilt.
 *
 * GEMELDET: Eine Krankmeldung vom 11. bis 15. erschien NUR an den beiden
 * Tagen, an denen ohnehin nichts geplant war (Sa/So) — und an den drei
 * Tagen mit Dienst stand weiter der Dienst.
 *
 * Diese Prüfungen halten die Antwort selbst fest. Dass sie auch auf dem
 * Bildschirm ankommt, prüft `pruefungen/browser/krank-schlaegt-dienst.mjs`:
 * Genau dieser Unterschied — richtig gerechnet, falsch angezeigt — war der
 * Fehler.
 */

const KRANK = {
  type: 'krankheit',
  startDate: '2026-11-11',
  endDate: '2026-11-15',
  verificationStatus: 'offen',
}

describe('§287 fehltagAm — eine Krankmeldung', () => {
  it('gilt am ersten Tag', () => {
    expect(fehltagAm('2026-11-11', { fehlzeiten: [KRANK] })?.art).toBe('krank')
  })

  it('und am letzten', () => {
    expect(fehltagAm('2026-11-15', { fehlzeiten: [KRANK] })?.art).toBe('krank')
  })

  it('und an jedem Tag dazwischen — auch an denen mit Dienst', () => {
    for (const tag of ['2026-11-12', '2026-11-13', '2026-11-14']) {
      expect(fehltagAm(tag, { fehlzeiten: [KRANK] })?.text, tag).toBe('Krankgemeldet')
    }
  })

  /*
   * Die Gegenprobe: Davor und danach gilt sie NICHT. Ohne sie wäre „sie gilt"
   * auch dann grün, wenn sie an jedem Tag des Jahres gälte.
   */
  it('davor und danach nicht', () => {
    expect(fehltagAm('2026-11-10', { fehlzeiten: [KRANK] })).toBeNull()
    expect(fehltagAm('2026-11-16', { fehlzeiten: [KRANK] })).toBeNull()
  })

  it('eine abgelehnte Krankmeldung ist keine', () => {
    const abgelehnt = { ...KRANK, verificationStatus: 'abgelehnt' }
    expect(fehltagAm('2026-11-12', { fehlzeiten: [abgelehnt] })).toBeNull()
  })

  /*
   * „offen" zählt. Wer sich morgens um sechs krankmeldet, ist krank — und
   * nicht erst, wenn die Leitung den Haken gesetzt hat.
   */
  it('eine offene oder bestätigte sehr wohl', () => {
    for (const stand of ['offen', 'bestaetigt', '', undefined, null]) {
      const f = { ...KRANK, verificationStatus: stand as string | null | undefined }
      expect(fehltagAm('2026-11-12', { fehlzeiten: [f] })?.art, String(stand)).toBe('krank')
    }
  })

  it('ohne Fehlzeiten steht nichts da', () => {
    expect(fehltagAm('2026-11-12', {})).toBeNull()
    expect(fehltagAm('2026-11-12', { fehlzeiten: [], urlaube: [] })).toBeNull()
  })

  /*
   * Der Zeitraum kommt mit: „Krankgemeldet" allein beantwortet nicht die
   * Frage, die jemand morgens hat — bis wann denn?
   */
  it('nennt den Zeitraum, aus dem der Tag stammt', () => {
    expect(fehltagAm('2026-11-12', { fehlzeiten: [KRANK] }))
      .toMatchObject({ von: '2026-11-11', bis: '2026-11-15' })
  })

  /*
   * Bei zwei sich überschneidenden Meldungen zählt die, die den Tag deckt —
   * nicht irgendeine. Eine Folgebescheinigung reicht oft einen Tag zurück.
   */
  it('nimmt bei zwei Meldungen die, die den Tag wirklich deckt', () => {
    const erste = { type: 'krankheit', startDate: '2026-11-02', endDate: '2026-11-06' }
    const folge = { type: 'krankheit', startDate: '2026-11-06', endDate: '2026-11-13' }
    expect(fehltagAm('2026-11-12', { fehlzeiten: [erste, folge] }))
      .toMatchObject({ bis: '2026-11-13' })
    expect(fehltagAm('2026-11-03', { fehlzeiten: [erste, folge] }))
      .toMatchObject({ bis: '2026-11-06' })
  })
})

describe('§287 fehltagAm — die Arten', () => {
  const am = (type: string) => fehltagAm('2026-11-12', {
    fehlzeiten: [{ type, startDate: '2026-11-11', endDate: '2026-11-15' }],
  })

  it('kennt die drei Schreibweisen für Krankheit', () => {
    // Ältere Datensätze tragen „krank" oder „sick", die Oberfläche schreibt
    // „krankheit". Eine eigene Liste hier wäre eine zweite Gelegenheit, eine
    // davon zu vergessen — deshalb kommt sie aus `bem.ts`.
    for (const t of ['krankheit', 'krank', 'sick', 'KRANKHEIT']) {
      expect(am(t)?.art, t).toBe('krank')
    }
  })

  it('nennt eine Fortbildung beim Namen', () => {
    expect(am('fortbildung')).toMatchObject({ art: 'abwesend', text: 'Fortbildung' })
  })

  it('und schreibt kein Datenbankwort in den Plan', () => {
    expect(am('unentschuldigt')?.text).toBe('Fehlt')
    expect(am('sonstige')?.text).toBe('Abwesend')
    // Eine Art, die niemand kennt, wird nicht roh angezeigt.
    expect(am('xyz')?.text).toBe('Abwesend')
  })
})

describe('§287 fehltagAm — Urlaub', () => {
  const URLAUB = { status: 'approved', startDate: '2026-12-21', endDate: '2026-12-31' }

  it('ein genehmigter Urlaub gilt', () => {
    expect(fehltagAm('2026-12-24', { urlaube: [URLAUB] }))
      .toMatchObject({ art: 'urlaub', text: 'Urlaub' })
  })

  /* Ein beantragter Urlaub ist noch keiner — sonst stünde er im Plan, bevor
   * ihn jemand bewilligt hat. */
  it('ein beantragter nicht', () => {
    expect(fehltagAm('2026-12-24', { urlaube: [{ ...URLAUB, status: 'pending' }] }))
      .toBeNull()
    expect(fehltagAm('2026-12-24', { urlaube: [{ ...URLAUB, status: 'rejected' }] }))
      .toBeNull()
  })

  /*
   * § 9 BUrlG: Krankheitstage im Urlaub werden nicht auf den Urlaub
   * angerechnet. Steht für einen Tag beides, ist die Krankmeldung maßgeblich.
   */
  it('wer im Urlaub krank wird, ist krank', () => {
    const krankImUrlaub = {
      type: 'krankheit', startDate: '2026-12-23', endDate: '2026-12-27',
    }
    expect(fehltagAm('2026-12-24', { fehlzeiten: [krankImUrlaub], urlaube: [URLAUB] }))
      .toMatchObject({ art: 'krank', quelle: 'fehlzeit' })
    // Und der Tag daneben bleibt Urlaub.
    expect(fehltagAm('2026-12-29', { fehlzeiten: [krankImUrlaub], urlaube: [URLAUB] }))
      .toMatchObject({ art: 'urlaub' })
  })
})

describe('§287 fehltagKurz', () => {
  it('kürzt für enge Stellen', () => {
    const krank = fehltagAm('2026-11-12', { fehlzeiten: [KRANK] })!
    expect(fehltagKurz(krank)).toBe('Krank')
    const urlaub = fehltagAm('2026-12-24', {
      urlaube: [{ status: 'approved', startDate: '2026-12-21', endDate: '2026-12-31' }],
    })!
    expect(fehltagKurz(urlaub)).toBe('Urlaub')
  })

  it('und erfindet auch kurz nichts', () => {
    const unbekannt = fehltagAm('2026-11-12', {
      fehlzeiten: [{ type: 'xyz', startDate: '2026-11-11', endDate: '2026-11-15' }],
    })!
    expect(fehltagKurz(unbekannt)).toBe('Abw.')
  })
})
