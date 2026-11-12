import { describe, it, expect } from 'vitest'
import {
  impressum, fehltAmImpressum, hinweiseZumImpressum, datenschutzerklaerung,
} from '../rechtstexte'
import { DATENARTEN } from '../dsgvo-katalog'
import { UNTERAUFTRAEGE } from '../dsgvo-verzeichnis'

/**
 * §153 Eine Datenschutzerklärung veraltet leise. Sie wird einmal geschrieben,
 * nie wieder gelesen, und ein Jahr später stimmt die Liste der Dienstleister
 * nicht mehr — was schlimmer ist als eine knappe Erklärung, weil sie
 * Vollständigkeit behauptet.
 *
 * Deshalb wird hier geprüft, dass die Teile, die aus Daten wachsen, auch
 * wirklich aus ihnen wachsen — und dass Pflichtangaben als fehlend gemeldet
 * werden, statt als Leerzeile durchzugehen.
 */

const leererAnbieter = {
  name: 'OKUN Workforce',
  anschrift: null, vertreten: null, kontakt: null,
  datenschutzbeauftragter: null,
}

describe('Das Impressum kennt seine Pflichtangaben', () => {
  it('meldet die drei Angaben aus §5 Abs. 1 DDG, wenn sie fehlen', () => {
    const fehlt = fehltAmImpressum({
      anbieter: leererAnbieter, register: null, umsatzsteuerId: null,
      inhaltlichVerantwortlich: null, streitbeilegung: '',
    })
    expect(fehlt.length).toBe(3)
    expect(fehlt.join(' ')).toMatch(/Anschrift/)
    expect(fehlt.join(' ')).toMatch(/Vertretungsberechtigte/)
    expect(fehlt.join(' ')).toMatch(/E-Mail/)
  })

  it('nennt zu jeder Lücke die Vorschrift', () => {
    for (const f of fehltAmImpressum({
      anbieter: leererAnbieter, register: null, umsatzsteuerId: null,
      inhaltlichVerantwortlich: null, streitbeilegung: '',
    })) {
      expect(f, f).toMatch(/§5/)
    }
  })

  it('behandelt Register und Steuernummer als Hinweis, nicht als Fehler', () => {
    // Beide sind nur Pflicht, soweit vorhanden — eine Einzelunternehmung hat
    // kein Registergericht, und das ist kein Mangel.
    const voll = {
      anbieter: { ...leererAnbieter, anschrift: 'A', vertreten: 'B', kontakt: 'c@d.de' },
      register: null, umsatzsteuerId: null,
      inhaltlichVerantwortlich: 'B', streitbeilegung: 'x',
    }
    expect(fehltAmImpressum(voll)).toEqual([])
    expect(hinweiseZumImpressum(voll).length).toBe(2)
  })

  it('sagt zur Streitbeilegung etwas, statt zu schweigen', () => {
    expect(impressum().streitbeilegung).toMatch(/§36 VSBG/)
  })
})

describe('Die Datenschutzerklärung erfüllt Art. 13', () => {
  const d = datenschutzerklaerung(new Date('2026-09-25T00:00:00Z'))
  const alles = d.abschnitte
    .flatMap(a => [a.ueberschrift, ...a.absaetze, ...(a.punkte ?? [])])
    .join(' ')

  it('trägt einen Stand', () => {
    expect(d.stand).toBe('2026-09-25')
  })

  it('nennt zu jedem Abschnitt eine Grundlage', () => {
    for (const a of d.abschnitte) {
      expect(a.grundlage, `${a.id}: keine Grundlage`).toBeTruthy()
      expect(a.grundlage!, a.id).toMatch(/Art\.|§/)
    }
  })

  it('schreibt jeden Abschnitt in Sätzen', () => {
    for (const a of d.abschnitte) {
      expect(a.absaetze.length, `${a.id}: leer`).toBeGreaterThan(0)
      for (const p of a.absaetze.filter(Boolean)) {
        expect(p.length, `${a.id}: zu knapp`).toBeGreaterThan(40)
      }
    }
  })

  it('erklärt die Betroffenenrechte einzeln', () => {
    const rechte = d.abschnitte.find(a => a.id === 'rechte')!
    const text = rechte.absaetze.join(' ')
    for (const artikel of ['15', '16', '17', '18', '20', '21', '77']) {
      expect(text, `Art. ${artikel} fehlt`).toMatch(new RegExp(`Art\\. ${artikel}`))
    }
  })

  it('nennt das Beschwerderecht bei der Aufsichtsbehörde', () => {
    expect(alles).toMatch(/Aufsichtsbehörde/)
  })

  it('trennt die eigene Verantwortung von der des Arbeitgebers', () => {
    const auftrag = d.abschnitte.find(a => a.id === 'auftrag')!
    expect(auftrag.absaetze.join(' ')).toMatch(/ER der Verantwortliche/)
    expect(auftrag.grundlage).toMatch(/Art\. 28/)
  })
})

describe('Art. 22 — der Abschnitt, den die meisten auslassen', () => {
  const a = datenschutzerklaerung().abschnitte.find(x => x.id === 'automatik')!

  it('gibt es überhaupt', () => {
    expect(a).toBeTruthy()
    expect(a.grundlage).toMatch(/Art\. 22/)
  })

  it('behauptet nicht einfach, es fände nichts statt', () => {
    // Das Programm rechnet Dienstpläne. Ein pauschales „findet nicht statt"
    // wäre bequem und falsch.
    const text = a.absaetze.join(' ')
    expect(text).toMatch(/rechnet Dienstpläne aus/)
  })

  it('nennt den Grund, warum Art. 22 Abs. 1 nicht greift', () => {
    const text = a.absaetze.join(' ')
    expect(text).toMatch(/Mensch/)
    expect(text).toMatch(/veröffentlicht/)
  })

  it('erwähnt den Punktestand und den Assistenten', () => {
    const text = a.absaetze.join(' ')
    expect(text).toMatch(/Workforce Score/)
    expect(text).toMatch(/Sprachmodell/)
  })

  it('sagt, dass der Assistent keine Betriebsdaten sieht', () => {
    expect(a.absaetze.join(' ')).toMatch(/keinen Zugriff auf Ihre Betriebsdaten/)
  })
})

describe('Die Teile, die aus Daten wachsen', () => {
  const d = datenschutzerklaerung()

  it('führt jeden Dienstleister auf', () => {
    const punkte = d.abschnitte.find(a => a.id === 'empfaenger')!.punkte!
    expect(punkte.length).toBe(UNTERAUFTRAEGE.length)
    for (const u of UNTERAUFTRAEGE) {
      expect(punkte.some(p => p.includes(u.name)), u.name).toBe(true)
    }
  })

  it('sagt etwas zur Drittlandübermittlung, sobald es eine gibt', () => {
    const text = d.abschnitte.find(a => a.id === 'empfaenger')!.absaetze.join(' ')
    if (UNTERAUFTRAEGE.some(u => u.drittland)) {
      expect(text).toMatch(/außerhalb der Europäischen Union/)
      expect(text).toMatch(/Standardvertragsklauseln/)
    } else {
      expect(text).toMatch(/innerhalb der Europäischen Union/)
    }
  })

  it('führt jede gesetzliche Aufbewahrungsfrist auf', () => {
    const punkte = d.abschnitte.find(a => a.id === 'dauer')!.punkte!
    const mitFrist = DATENARTEN.filter(x => x.fristJahre > 0)
    expect(punkte.length).toBe(mitFrist.length)
    for (const m of mitFrist) {
      expect(punkte.some(p => p.startsWith(m.bezeichnung)), m.id).toBe(true)
    }
  })

  it('nennt zu jeder Frist die Vorschrift', () => {
    for (const p of d.abschnitte.find(a => a.id === 'dauer')!.punkte!) {
      expect(p, p).toMatch(/\(.*(§|Art\.).*\)/)
    }
  })

  it('erklärt die Sperre statt Löschung', () => {
    expect(d.abschnitte.find(a => a.id === 'dauer')!.absaetze.join(' '))
      .toMatch(/Art\. 18/)
  })

  it('nennt die Löschfrist für Bewerbungen', () => {
    expect(d.abschnitte.find(a => a.id === 'dauer')!.absaetze.join(' '))
      .toMatch(/sechs Monate/)
  })
})

describe('Was beim Aufruf der Seite selbst passiert', () => {
  const a = datenschutzerklaerung().abschnitte.find(x => x.id === 'eigene')!

  it('sagt, dass kein Werbe-Tracking stattfindet', () => {
    expect(a.absaetze.join(' ')).toMatch(/Tracking zu Werbezwecken findet nicht statt/)
  })

  it('erklärt die Anmeldebremse samt Löschfrist des Kürzels', () => {
    const text = a.absaetze.join(' ')
    expect(text).toMatch(/Kürzel/)
    expect(text).toMatch(/vierundzwanzig Stunden/)
  })

  it('nennt das berechtigte Interesse, wenn es sich darauf stützt', () => {
    expect(a.grundlage).toMatch(/lit\. f/)
    expect(a.absaetze.join(' ')).toMatch(/berechtigte Interesse/)
  })
})
