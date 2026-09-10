import { describe, it, expect } from 'vitest'
import { lohnsteuerBerechnen, pflegeMerkmale, istSachsen } from '../lohnsteuer-pap'
import { lohnjahr, lohnjahrOderFehler, BEKANNTE_LOHNJAHRE } from '../lohnjahre'

/**
 * §116 Prüfung der Lohnsteuer gegen den amtlichen Programmablaufplan.
 *
 * Die Werte in `REFERENZ` stammen aus dem Ablaufplan selbst. Einer davon ist
 * unabhängig von Hand nachgerechnet und hier dokumentiert — er ist der Anker,
 * an dem sich prüfen lässt, ob die Vorlage überhaupt die richtige ist. Die
 * übrigen halten fest, was heute herauskommt, damit eine spätere Änderung
 * auffällt statt still das Gehalt zu verschieben.
 *
 * Wenn eine dieser Zahlen bricht, ist das kein Testproblem: entweder wurde ein
 * Jahr gewechselt, oder jemand hat an der Steuer geschraubt.
 */

const gkv = {
  versicherung: 'GKV' as const,
  kirchensteuer: false,
}

describe('Lohnsteuer nach dem amtlichen Ablaufplan', () => {
  it('trifft den von Hand nachgerechneten Referenzfall', () => {
    // 2026, 5.000 € im Monat, Steuerklasse I, Zusatzbeitrag 2,5 %, kinderlos.
    // Von Hand aus den Konstanten des Ablaufplans:
    //   Vorsorgepauschale = 60.000 · 9,3 %            = 5.580,00
    //                     + 60.000 · (7 % + 1,25 %)   = 4.950,00
    //                     + 60.000 · (1,8 % + 0,6 %)  = 1.440,00  → 11.970
    //   zvE = 60.000 − 1.230 − 36 − 11.970            = 46.764
    //   Tarif 2026: Y = (46.764 − 17.799)/10.000      = 2,8965
    //               (173,1 · Y + 2397) · Y + 1.034,87 = 9.430
    //   9.430 / 12                                    = 785,83 €
    const r = lohnsteuerBerechnen({
      jahr: 2026, steuerBruttoMonat: 5000, steuerklasse: 1,
      kinderfreibetraege: 0, zusatzbeitragProzent: 2.5, ...gkv,
    })
    expect(r.lohnsteuer).toBe(785.83)
  })

  const REFERENZ: [string, Parameters<typeof lohnsteuerBerechnen>[0], number][] = [
    ['2026 · 3.400 € · StKl 1 · kinderlos',
      { jahr: 2026, steuerBruttoMonat: 3400, steuerklasse: 1, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, ...gkv }, 388.33],
    ['2026 · 3.400 € · StKl 3 · 1 Kind',
      { jahr: 2026, steuerBruttoMonat: 3400, steuerklasse: 3, kinderfreibetraege: 1, zusatzbeitragProzent: 1.7, hatKinder: true, kinderUnter25: 1, ...gkv }, 102],
    ['2026 · 3.400 € · StKl 5 · kinderlos',
      { jahr: 2026, steuerBruttoMonat: 3400, steuerklasse: 5, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, ...gkv }, 755.5],
    ['2026 · 12.000 € · StKl 1 · kinderlos',
      { jahr: 2026, steuerBruttoMonat: 12000, steuerklasse: 1, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, ...gkv }, 3487.41],
    ['2025 · 3.400 € · StKl 1 · kinderlos',
      { jahr: 2025, steuerBruttoMonat: 3400, steuerklasse: 1, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, ...gkv }, 395.83],
  ]

  for (const [name, eingabe, erwartet] of REFERENZ) {
    it(`${name} → ${erwartet.toFixed(2)} €`, () => {
      expect(lohnsteuerBerechnen(eingabe).lohnsteuer).toBe(erwartet)
    })
  }

  it('unterscheidet die Jahre — 2026 besteuert denselben Lohn milder als 2025', () => {
    const gleich = { steuerBruttoMonat: 3400, steuerklasse: 1 as const, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, ...gkv }
    const a = lohnsteuerBerechnen({ ...gleich, jahr: 2025 }).lohnsteuer
    const b = lohnsteuerBerechnen({ ...gleich, jahr: 2026 }).lohnsteuer
    expect(b).toBeLessThan(a)   // höherer Grundfreibetrag 2026
  })

  it('erhebt den Soli erst über der Freigrenze', () => {
    const klein = lohnsteuerBerechnen({ jahr: 2026, steuerBruttoMonat: 3400, steuerklasse: 1, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, ...gkv })
    const gross = lohnsteuerBerechnen({ jahr: 2026, steuerBruttoMonat: 12000, steuerklasse: 1, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, ...gkv })
    expect(klein.soli).toBe(0)
    expect(gross.soli).toBeGreaterThan(0)
    expect(gross.soli).toBeLessThanOrEqual(gross.lohnsteuer * 0.055 + 0.01)
  })

  it('liefert die Kirchensteuer-Bemessung nur bei Kirchenzugehörigkeit', () => {
    const ohne = lohnsteuerBerechnen({ jahr: 2026, steuerBruttoMonat: 3400, steuerklasse: 1, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, versicherung: 'GKV', kirchensteuer: false })
    const mit = lohnsteuerBerechnen({ jahr: 2026, steuerBruttoMonat: 3400, steuerklasse: 1, kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, versicherung: 'GKV', kirchensteuer: true })
    expect(ohne.kirchensteuerBasis).toBe(0)
    expect(mit.kirchensteuerBasis).toBeGreaterThan(0)
  })

  it('mindert mit dem Kinderfreibetrag die Kirchensteuer, nicht die Lohnsteuer (§51a EStG)', () => {
    const gleich = { jahr: 2026, steuerBruttoMonat: 4000, steuerklasse: 4 as const, zusatzbeitragProzent: 2.9, versicherung: 'GKV' as const, kirchensteuer: true, hatKinder: true, kinderUnter25: 2 }
    const ohneFreibetrag = lohnsteuerBerechnen({ ...gleich, kinderfreibetraege: 0 })
    const mitFreibetrag = lohnsteuerBerechnen({ ...gleich, kinderfreibetraege: 2 })
    expect(mitFreibetrag.lohnsteuer).toBe(ohneFreibetrag.lohnsteuer)
    expect(mitFreibetrag.kirchensteuerBasis).toBeLessThan(ohneFreibetrag.kirchensteuerBasis)
  })

  it('rechnet für ein unbekanntes Jahr NICHT, sondern bricht ab', () => {
    expect(() => lohnsteuerBerechnen({
      jahr: 2019, steuerBruttoMonat: 3400, steuerklasse: 1,
      kinderfreibetraege: 0, zusatzbeitragProzent: 1.7, ...gkv,
    })).toThrow(/2019/)
  })
})

describe('Merkmale der Pflegeversicherung', () => {
  it('erkennt Sachsen in beiden Schreibweisen', () => {
    expect(istSachsen('Sachsen')).toBe(true)
    expect(istSachsen('SN')).toBe(true)
    expect(istSachsen('Sachsen-Anhalt')).toBe(false)
    expect(istSachsen(null)).toBe(false)
  })

  it('erhebt den Zuschlag nur bei Kinderlosen', () => {
    expect(pflegeMerkmale({ hatKinder: false }).pvz).toBe(1)
    expect(pflegeMerkmale({ hatKinder: true }).pvz).toBe(0)
  })

  it('lässt den Zuschlag auch bei erwachsenen Kindern entfallen', () => {
    // Kinder vorhanden, aber keins mehr unter 25: kein Zuschlag UND kein Abschlag
    const m = pflegeMerkmale({ hatKinder: true, kinderUnter25: 0 })
    expect(m.pvz).toBe(0)
    expect(m.pva).toBe(0)
  })

  it('gibt Abschläge erst ab dem zweiten Kind und höchstens vier', () => {
    expect(pflegeMerkmale({ hatKinder: true, kinderUnter25: 1 }).pva).toBe(0)
    expect(pflegeMerkmale({ hatKinder: true, kinderUnter25: 3 }).pva).toBe(2)
    expect(pflegeMerkmale({ hatKinder: true, kinderUnter25: 9 }).pva).toBe(4)
  })
})

describe('Rechengrößen je Jahr', () => {
  it('kennt 2025 und 2026', () => {
    expect(BEKANNTE_LOHNJAHRE).toContain(2025)
    expect(BEKANNTE_LOHNJAHRE).toContain(2026)
  })

  it('hält die Beitragsbemessungsgrenzen des jeweiligen Jahres', () => {
    expect(lohnjahr(2025)!.bbgRvAvMonat).toBe(8050)
    expect(lohnjahr(2026)!.bbgRvAvMonat).toBe(8450)
    expect(lohnjahr(2025)!.bbgKvPvMonat).toBe(5512.5)
    expect(lohnjahr(2026)!.bbgKvPvMonat).toBe(5812.5)
  })

  it('nennt zu jedem Jahr Quelle und Prüfvermerk', () => {
    for (const j of BEKANNTE_LOHNJAHRE) {
      expect(lohnjahr(j)!.quelle).toMatch(/Programmablaufplan/)
      expect(lohnjahr(j)!.geprueft).toMatch(/\d{4}-\d{2}-\d{2}/)
    }
  })

  it('schätzt für ein unbekanntes Jahr nicht, sondern sagt was zu tun ist', () => {
    expect(lohnjahr(2030)).toBeNull()
    expect(() => lohnjahrOderFehler(2030)).toThrow(/lohnjahre\.ts/)
  })
})
