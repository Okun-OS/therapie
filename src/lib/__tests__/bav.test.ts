import { describe, it, expect } from 'vitest'
import {
  grenzen, teileAuf, zuschuss, rechne, anspruchJahr, runde,
  STEUERFREI_ANTEIL, SVFREI_ANTEIL, PFLICHTZUSCHUSS, WEGE,
} from '../bav'
import { lohnjahrOderFehler } from '../lohnjahre'

/**
 * §156 Der Fehler, den fast jede selbstgebaute Abrechnung macht: „acht Prozent
 * sind frei". Das ist zur Hälfte richtig — steuerfrei bis 8 %, beitragsfrei
 * nur bis 4 %. Wer mit einer Grenze rechnet, zieht im Bereich dazwischen zu
 * wenig Sozialversicherung ab, und das fällt erst bei der Betriebsprüfung auf.
 *
 * Genau dieser Bereich wird hier am ausführlichsten geprüft.
 */

const j2026 = lohnjahrOderFehler(2026)
const g = grenzen(j2026)

describe('Die zwei Grenzen', () => {
  it('rechnet beide aus der Beitragsbemessungsgrenze', () => {
    expect(g.bbgJahr).toBe(j2026.bbgRvAvMonat * 12)
    expect(g.steuerfreiJahr).toBe(runde(g.bbgJahr * STEUERFREI_ANTEIL))
    expect(g.svfreiJahr).toBe(runde(g.bbgJahr * SVFREI_ANTEIL))
  })

  it('macht die Steuergrenze doppelt so hoch wie die Beitragsgrenze', () => {
    // Das ist der ganze Punkt: 8 % gegen 4 %.
    expect(g.steuerfreiJahr).toBeCloseTo(g.svfreiJahr * 2, 2)
  })

  it('nennt auch Monatswerte', () => {
    expect(g.steuerfreiMonat).toBeCloseTo(g.steuerfreiJahr / 12, 2)
    expect(g.svfreiMonat).toBeCloseTo(g.svfreiJahr / 12, 2)
  })

  it('folgt der BBG, wenn sie sich ändert', () => {
    const g2025 = grenzen(lohnjahrOderFehler(2025))
    expect(g2025.steuerfreiJahr).not.toBe(g.steuerfreiJahr)
  })
})

describe('Der Anspruch aus §1a BetrAVG', () => {
  it('reicht bis zur Beitragsgrenze, nicht bis zur Steuergrenze', () => {
    // Verlangen kann man 4 % — mehr ist Verhandlungssache.
    expect(anspruchJahr(j2026)).toBe(g.svfreiJahr)
  })
})

describe('Die Aufteilung — der Bereich zwischen 4 % und 8 %', () => {
  it('lässt einen kleinen Beitrag ganz frei', () => {
    const a = teileAuf({ monatsbetrag: 100, weg: 'direktversicherung' }, j2026)
    expect(a.freiBeides).toBe(100)
    expect(a.nurSteuerfrei).toBe(0)
    expect(a.pflichtig).toBe(0)
    expect(a.minderungSteuer).toBe(100)
    expect(a.minderungSv).toBe(100)
  })

  it('teilt genau an der Beitragsgrenze', () => {
    // Ein Jahresbeitrag in einem Zug: beitragsfrei bleibt trotzdem nur der
    // Monatsrahmen, steuerfrei dagegen der ganze Jahresrahmen.
    const a = teileAuf(
      { monatsbetrag: g.steuerfreiJahr, weg: 'direktversicherung' }, j2026)
    expect(a.freiBeides).toBeCloseTo(g.svfreiMonat, 2)
    expect(a.nurSteuerfrei).toBeCloseTo(g.steuerfreiJahr - g.svfreiMonat, 2)
    expect(a.pflichtig).toBe(0)
  })

  it('mindert Steuer- und Beitragsbrutto UNTERSCHIEDLICH', () => {
    // Das ist der Kern: Wer nur eine Zahl führt, rechnet falsch.
    const a = teileAuf(
      { monatsbetrag: g.steuerfreiJahr, weg: 'pensionskasse' }, j2026)
    expect(a.minderungSteuer).toBeGreaterThan(a.minderungSv)
    expect(a.minderungSteuer).toBeCloseTo(g.steuerfreiJahr, 2)
    expect(a.minderungSv).toBeCloseTo(g.svfreiMonat, 2)
  })

  it('deckelt die Beitragsfreiheit am MONATSrahmen, nicht am Jahresrahmen', () => {
    // Der zweite Teil desselben Fehlers: Wer die 4 % als Jahresbetrag führt,
    // lässt im Januar das Zwölffache beitragsfrei durchlaufen.
    const a = teileAuf({ monatsbetrag: 1000, weg: 'direktversicherung' }, j2026)
    expect(a.minderungSv).toBeCloseTo(g.svfreiMonat, 2)
    expect(a.minderungSv).toBeLessThan(g.svfreiJahr)
  })

  it('erbt nichts vom Vormonat: der Monatsrahmen verfällt', () => {
    // Elf Monate ohne Umwandlung geben dem zwölften keinen größeren Rahmen.
    const a = teileAuf(
      {
        monatsbetrag: 1000, weg: 'direktversicherung',
        steuerfreiBisherImJahr: 0, svfreiBisherImMonat: 0,
      },
      j2026,
    )
    expect(a.minderungSv).toBeCloseTo(g.svfreiMonat, 2)
  })

  it('teilt den Monatsrahmen zwischen zwei Verträgen', () => {
    // Zwei Verträge, ein Rahmen. Der zweite findet ihn schon halb verbraucht.
    const erster = teileAuf(
      { monatsbetrag: 200, weg: 'direktversicherung' }, j2026)
    const zweiter = teileAuf(
      {
        monatsbetrag: 300, weg: 'pensionskasse',
        steuerfreiBisherImJahr: erster.minderungSteuer,
        svfreiBisherImMonat: erster.minderungSv,
      },
      j2026,
    )
    expect(runde(erster.minderungSv + zweiter.minderungSv))
      .toBeCloseTo(g.svfreiMonat, 2)
  })

  it('sagt es, wenn ein Teil nur steuerfrei ist', () => {
    const a = teileAuf(
      { monatsbetrag: g.steuerfreiJahr, weg: 'direktversicherung' }, j2026)
    expect(a.hinweise.join(' ')).toMatch(/steuerfrei, aber/)
    expect(a.hinweise.join(' ')).toMatch(/SvEV/)
  })

  it('macht alles über 8 % voll pflichtig', () => {
    const zuviel = g.steuerfreiJahr + 1000
    const a = teileAuf({ monatsbetrag: zuviel, weg: 'pensionsfonds' }, j2026)
    expect(a.pflichtig).toBeCloseTo(1000, 2)
    expect(a.minderungSteuer).toBeCloseTo(g.steuerfreiJahr, 2)
    expect(a.hinweise.join(' ')).toMatch(/§3 Nr\. 63 EStG/)
  })

  it('zählt an, was der Jahresrahmen der Steuer schon hergegeben hat', () => {
    // Die Steuergrenze ist eine JAHRESgrenze. Wer sie monatlich zwölftelt,
    // rechnet bei einer Sonderzahlung im Dezember falsch.
    const a = teileAuf(
      {
        monatsbetrag: 500,
        weg: 'direktversicherung',
        steuerfreiBisherImJahr: g.steuerfreiJahr - 200,
      },
      j2026,
    )
    expect(a.minderungSteuer).toBe(200)
    expect(a.pflichtig).toBe(300)
  })

  it('macht alles pflichtig, wenn der Jahresrahmen ausgeschöpft ist', () => {
    const a = teileAuf(
      {
        monatsbetrag: 300, weg: 'direktversicherung',
        steuerfreiBisherImJahr: g.steuerfreiJahr,
      },
      j2026,
    )
    expect(a.pflichtig).toBe(300)
    expect(a.minderungSteuer).toBe(0)
    // Beitragsfrei kann nur sein, was steuerfrei ist — auch wenn der
    // Monatsrahmen der Beiträge noch offen wäre.
    expect(a.minderungSv).toBe(0)
  })

  it('summiert immer auf den vollen Betrag', () => {
    for (const betrag of [50, 400, 4000, 9000, 12000]) {
      const a = teileAuf({ monatsbetrag: betrag, weg: 'pensionskasse' }, j2026)
      expect(runde(a.freiBeides + a.nurSteuerfrei + a.pflichtig), `${betrag}`)
        .toBeCloseTo(betrag, 2)
    }
  })

  it('kommt mit null zurecht', () => {
    const a = teileAuf({ monatsbetrag: 0, weg: 'direktversicherung' }, j2026)
    expect(a.umgewandelt).toBe(0)
    expect(a.minderungSteuer).toBe(0)
  })
})

describe('Altverträge nach §40b EStG werden nicht geraten', () => {
  const a = teileAuf({ monatsbetrag: 150, weg: 'altvertrag_40b' }, j2026)

  it('rechnet keine Freistellung', () => {
    expect(a.minderungSteuer).toBe(0)
    expect(a.minderungSv).toBe(0)
  })

  it('sagt ausdrücklich, dass von Hand zu erfassen ist', () => {
    expect(a.hinweise.join(' ')).toMatch(/§40b/)
    expect(a.hinweise.join(' ')).toMatch(/von Hand/)
  })

  it('kennt den Weg trotzdem beim Namen', () => {
    expect(WEGE.altvertrag_40b).toMatch(/§40b/)
  })
})

describe('Der Zuschuss nach §1a Abs. 1a BetrAVG', () => {
  it('schuldet 15 % — aber nur auf den beitragsfreien Teil', () => {
    const a = teileAuf({ monatsbetrag: 200, weg: 'direktversicherung' }, j2026)
    const z = zuschuss(a)
    expect(z.pflicht).toBe(30)
    expect(z.gezahlt).toBe(30)
  })

  it('schuldet oberhalb der Beitragsgrenze nichts mehr', () => {
    // Dort spart der Betrieb keine Beiträge, also schuldet er auch nichts.
    const a = teileAuf(
      {
        monatsbetrag: 500, weg: 'direktversicherung',
        svfreiBisherImMonat: g.svfreiMonat,
      },
      j2026,
    )
    const z = zuschuss(a)
    expect(z.pflicht).toBe(0)
    expect(z.hinweise.join(' ')).toMatch(/keine Zuschusspflicht/)
  })

  it('erlaubt einen freiwillig höheren Zuschuss auf den ganzen Betrag', () => {
    const a = teileAuf(
      {
        monatsbetrag: 500, weg: 'direktversicherung',
        svfreiBisherImMonat: g.svfreiMonat,
      },
      j2026,
    )
    const z = zuschuss(a, PFLICHTZUSCHUSS, true)
    expect(z.gezahlt).toBe(75)
    expect(z.pflicht).toBe(0)
  })

  it('meldet einen zu niedrigen Zuschuss', () => {
    const a = teileAuf({ monatsbetrag: 200, weg: 'direktversicherung' }, j2026)
    const z = zuschuss(a, 0.05)
    expect(z.gezahlt).toBe(10)
    expect(z.hinweise.join(' ')).toMatch(/unter der Pflicht/)
    expect(z.hinweise.join(' ')).toMatch(/1\. Januar 2022/)
  })

  it('meldet nichts, wenn mehr gezahlt wird als geschuldet', () => {
    const a = teileAuf({ monatsbetrag: 200, weg: 'direktversicherung' }, j2026)
    const z = zuschuss(a, 0.20)
    expect(z.gezahlt).toBe(40)
    expect(z.hinweise.join(' ')).not.toMatch(/unter der Pflicht/)
  })
})

describe('Der ganze Weg', () => {
  it('mindert das Entgelt um die Umwandlung, nicht um den Zuschuss', () => {
    // Der Zuschuss kommt obendrauf: Er erhöht den Beitrag an die Versorgung,
    // mindert aber nicht das Entgelt des Beschäftigten.
    const e = rechne({ monatsbetrag: 200, weg: 'direktversicherung' }, j2026)
    expect(e.entgeltminderung).toBe(200)
    expect(e.anDieVersorgung).toBe(230)
  })

  it('sammelt alle Hinweise an einer Stelle', () => {
    const e = rechne(
      { monatsbetrag: g.steuerfreiJahr + 500, weg: 'direktversicherung' },
      j2026, 0.05,
    )
    expect(e.hinweise.length).toBeGreaterThan(1)
    expect(e.hinweise.join(' ')).toMatch(/SvEV/)
    expect(e.hinweise.join(' ')).toMatch(/unter der Pflicht/)
  })

  it('bleibt bei einem Altvertrag ohne Minderung', () => {
    const e = rechne({ monatsbetrag: 150, weg: 'altvertrag_40b' }, j2026)
    expect(e.aufteilung.minderungSteuer).toBe(0)
    expect(e.entgeltminderung).toBe(150)
  })
})
