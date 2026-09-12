/**
 * §117 ELStAM — die Lohnsteuerabzugsmerkmale des Finanzamts.
 *
 * Seit §116 rechnen wir die Lohnsteuer nach dem amtlichen Programmablaufplan,
 * also exakt. Exakt gerechnet mit einem veralteten Merkmal ist aber trotzdem
 * falsch: Wer heiratet und dessen Steuerklasse hier nicht nachgeführt wird,
 * bekommt bei 3.400 € brutto rund 286 € im Monat zu viel oder zu wenig Steuer
 * abgezogen. Für zu wenig einbehaltene Lohnsteuer haftet der Arbeitgeber
 * (§42d EStG) — nicht der Mitarbeiter und nicht wir.
 *
 * Abrufen dürfen wir die Merkmale nicht: das braucht einen zertifizierten
 * Zugang, den der Arbeitgeber hat und nicht die Software. Er oder sein
 * Steuerberater holt die monatliche Änderungsliste, hier wird sie eingelesen.
 *
 * Diese Datei kennt deshalb zwei Dinge:
 *   1. Wie alt ein Stand ist und ab wann davor gewarnt werden muss.
 *   2. Wie eine Änderungsliste gelesen und mit dem Bestand verglichen wird.
 *
 * Der Weg, auf dem die Liste hereinkommt, ist bewusst nur ein Parser. Käme
 * später ein zertifizierter Abruf dazu, bliebe alles Übrige unverändert.
 */

export type ElstamFeld =
  | 'steuerklasse' | 'kinderfreibetraege' | 'konfession'
  | 'freibetragMonat' | 'hinzurechnungMonat' | 'faktor'

/** Ein Merkmalssatz, wie er aus einer Änderungsliste kommt. */
export interface ElstamSatz {
  /** Steuerliche Identifikationsnummer — der verlässlichste Schlüssel */
  steuerId?: string | null
  personalnummer?: string | null
  name?: string | null
  steuerklasse?: number | null
  kinderfreibetraege?: number | null
  konfession?: string | null
  freibetragMonat?: number | null
  hinzurechnungMonat?: number | null
  faktor?: number | null
  gueltigAb?: string | null
}

export interface ElstamAenderung {
  feld: ElstamFeld
  bisher: string
  neu: string
}

export interface ElstamAbgleich {
  employeeId: string | null
  name: string
  /** Wie der Satz zugeordnet wurde — Zuordnung über den Namen ist die schwächste */
  zuordnung: 'steuerId' | 'personalnummer' | 'name' | 'keine'
  satz: ElstamSatz
  aenderungen: ElstamAenderung[]
  hinweis?: string
}

// ── Alter eines Standes ─────────────────────────────────────────────────────

/**
 * Ist der hinterlegte ELStAM-Stand für diesen Abrechnungsmonat noch tragbar?
 *
 * Maßstab ist der erste Tag des Abrechnungsmonats: ein Stand von davor kann die
 * Änderungen dieses Monats nicht enthalten. Wir sperren deswegen nicht — das
 * wäre bevormundend und manchmal gibt es schlicht keine Änderung. Aber es muss
 * jemandem auffallen, bevor gerechnet wird, nicht wenn das Finanzamt fragt.
 */
export function elstamStandBewerten(
  stand: string | null | undefined,
  jahr: number,
  monat: number,
): { aktuell: boolean; hinweis?: string } {
  const monatsBeginn = `${jahr}-${String(monat).padStart(2, '0')}-01`

  if (!stand) {
    return {
      aktuell: false,
      hinweis: 'Kein ELStAM-Stand hinterlegt — es ist nicht nachvollziehbar, '
        + 'wann Steuerklasse und Freibeträge zuletzt abgeglichen wurden.',
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stand)) {
    return { aktuell: false, hinweis: `ELStAM-Stand "${stand}" ist kein gültiges Datum.` }
  }
  if (stand < monatsBeginn) {
    return {
      aktuell: false,
      hinweis: `ELStAM-Stand ist vom ${datumDe(stand)} und damit älter als der `
        + `Abrechnungsmonat. Änderungen aus diesem Monat fehlen möglicherweise.`,
    }
  }
  return { aktuell: true }
}

function datumDe(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

// ── Änderungsliste lesen ────────────────────────────────────────────────────

/**
 * Trennzeichen einer CSV-Datei erkennen.
 *
 * ELSTER, DATEV und Excel liefern unterschiedlich getrennte Dateien. Der Kunde
 * soll das nicht wissen müssen, deshalb wird geraten — aber nachvollziehbar:
 * gewählt wird das Zeichen, das in der Kopfzeile am häufigsten vorkommt.
 */
export function trennzeichenErkennen(kopfzeile: string): string {
  const kandidaten = [';', '\t', ',', '|']
  let bestes = ';'
  let meiste = 0
  for (const k of kandidaten) {
    const n = kopfzeile.split(k).length - 1
    if (n > meiste) { meiste = n; bestes = k }
  }
  return bestes
}

/** Eine CSV-Zeile zerlegen, Anführungszeichen und verdoppelte Zeichen beachtet. */
function zeileZerlegen(zeile: string, trenn: string): string[] {
  const felder: string[] = []
  let aktuell = ''
  let inAnfuehrung = false
  for (let i = 0; i < zeile.length; i++) {
    const z = zeile[i]
    if (inAnfuehrung) {
      if (z === '"') {
        if (zeile[i + 1] === '"') { aktuell += '"'; i++ }
        else inAnfuehrung = false
      } else aktuell += z
    } else if (z === '"') {
      inAnfuehrung = true
    } else if (z === trenn) {
      felder.push(aktuell); aktuell = ''
    } else aktuell += z
  }
  felder.push(aktuell)
  return felder.map(f => f.trim())
}

/**
 * Spaltennamen auf unsere Felder abbilden.
 *
 * Absichtlich großzügig: die Listen heißen je nach Herkunft anders, und ein
 * Kunde soll nicht an einer Überschrift scheitern. Was hier nicht erkannt wird,
 * ordnet er in der Oberfläche selbst zu.
 */
const SPALTEN_MUSTER: [keyof ElstamSatz, RegExp][] = [
  ['steuerId', /(steuer.?id|idnr|identifikationsnummer|steuerliche.?id)/i],
  ['personalnummer', /(personal.?nr|personalnummer|pers.?nr)/i],
  ['name', /(name|nachname|arbeitnehmer|mitarbeiter)/i],
  ['steuerklasse', /(steuerklasse|st.?kl|lohnsteuerklasse)/i],
  ['kinderfreibetraege', /(kinderfreibet|zahl.?der.?kinder|kifb|zkf)/i],
  ['konfession', /(konfession|religion|kirchensteuer|kist)/i],
  ['freibetragMonat', /(freibetrag)/i],
  ['hinzurechnungMonat', /(hinzurechn)/i],
  ['faktor', /faktor/i],
  ['gueltigAb', /(g(ü|ue)ltig|ab.?dem|referenzdatum|stichtag)/i],
]

export function spaltenZuordnen(kopf: string[]): Record<number, keyof ElstamSatz> {
  const zuordnung: Record<number, keyof ElstamSatz> = {}
  const belegt = new Set<keyof ElstamSatz>()
  for (const [feld, muster] of SPALTEN_MUSTER) {
    for (let i = 0; i < kopf.length; i++) {
      if (zuordnung[i] || belegt.has(feld)) continue
      if (muster.test(kopf[i])) { zuordnung[i] = feld; belegt.add(feld); break }
    }
  }
  return zuordnung
}

/** Konfession aus der Liste auf unsere Schreibweise bringen. */
export function konfessionNormieren(roh: string | null | undefined): string | null {
  const w = (roh ?? '').trim().toLowerCase()
  if (!w) return null
  // "--" und "vd" stehen in ELStAM-Listen für keine Kirchensteuerpflicht
  if (['--', '-', 'keine', 'ohne', 'vd', '0', 'nein'].includes(w)) return 'keine'
  if (/^(ev|lt|rf|fa|fb|fg|fm|fs|ib|is|iw|jd|jh)/.test(w) || w.includes('evang')) return 'ev'
  if (/^(rk|ak)/.test(w) || w.includes('kath')) return 'rk'
  return 'sonstige'
}

/** Zahl aus deutscher oder englischer Schreibweise. */
export function zahlLesen(roh: string | null | undefined): number | null {
  const w = (roh ?? '').trim()
  if (!w) return null
  // "1.234,50" → "1234.50"; "1234.50" bleibt
  const bereinigt = w.includes(',')
    ? w.replace(/\./g, '').replace(',', '.')
    : w
  const n = Number(bereinigt.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Eine Änderungsliste in Merkmalssätze zerlegen. */
export function listeLesen(
  inhalt: string,
  spalten?: Record<number, keyof ElstamSatz>,
): { saetze: ElstamSatz[]; kopf: string[]; zuordnung: Record<number, keyof ElstamSatz> } {
  const text = inhalt.replace(/^﻿/, '')
  const zeilen = text.split(/\r?\n/).filter(z => z.trim().length > 0)
  if (zeilen.length === 0) return { saetze: [], kopf: [], zuordnung: {} }

  const trenn = trennzeichenErkennen(zeilen[0])
  const kopf = zeileZerlegen(zeilen[0], trenn)
  const zuordnung = spalten ?? spaltenZuordnen(kopf)

  const saetze: ElstamSatz[] = []
  for (const zeile of zeilen.slice(1)) {
    const felder = zeileZerlegen(zeile, trenn)
    const satz: ElstamSatz = {}
    let etwasGefunden = false
    for (const [indexText, feld] of Object.entries(zuordnung)) {
      const wert = felder[Number(indexText)]
      if (wert === undefined || wert === '') continue
      etwasGefunden = true
      switch (feld) {
        case 'steuerklasse':
          satz.steuerklasse = roemischOderZahl(wert); break
        case 'kinderfreibetraege':
        case 'freibetragMonat':
        case 'hinzurechnungMonat':
        case 'faktor':
          satz[feld] = zahlLesen(wert); break
        case 'konfession':
          satz.konfession = konfessionNormieren(wert); break
        case 'steuerId':
          satz.steuerId = wert.replace(/\s+/g, ''); break
        default:
          satz[feld] = wert
      }
    }
    if (etwasGefunden) saetze.push(satz)
  }
  return { saetze, kopf, zuordnung }
}

/** Steuerklassen stehen mal als "III", mal als "3" in der Liste. */
export function roemischOderZahl(roh: string): number | null {
  const w = roh.trim().toUpperCase()
  const roemisch: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }
  if (roemisch[w]) return roemisch[w]
  const n = Number(w.replace(/[^0-9]/g, ''))
  return n >= 1 && n <= 6 ? n : null
}

// ── Abgleich mit dem Bestand ────────────────────────────────────────────────

export interface BestandsProfil {
  employeeId: string
  name: string
  steuerId?: string | null
  personalnummer?: string | null
  steuerklasse?: number | null
  kinderfreibetraege?: number | null
  konfession?: string | null
  freibetragMonat?: number | null
  hinzurechnungMonat?: number | null
  faktor?: number | null
}

const ANZEIGE: Record<ElstamFeld, string> = {
  steuerklasse: 'Steuerklasse',
  kinderfreibetraege: 'Kinderfreibeträge',
  konfession: 'Konfession',
  freibetragMonat: 'Freibetrag',
  hinzurechnungMonat: 'Hinzurechnungsbetrag',
  faktor: 'Faktor',
}

export function feldName(feld: ElstamFeld): string {
  return ANZEIGE[feld]
}

const zeige = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : String(v)

/**
 * Merkmalssätze den Mitarbeitern zuordnen und die Unterschiede benennen.
 *
 * Zugeordnet wird bevorzugt über die Steuer-ID: sie ist eindeutig und ändert
 * sich nie. Personalnummer und Name sind Rückfallebenen und werden als solche
 * gekennzeichnet, damit niemand einer Namensgleichheit blind vertraut.
 */
export function abgleichen(
  saetze: ElstamSatz[],
  bestand: BestandsProfil[],
): ElstamAbgleich[] {
  /*
   * §134 Auch Steuer-ID und Personalnummer koennen doppelt vorkommen.
   *
   * Bisher gewann hier still der zuletzt geladene Datensatz: Sind zwei Profile
   * versehentlich mit derselben Steuer-ID angelegt, bekam einer von beiden die
   * Steuermerkmale des anderen — falsche Steuerklasse, falscher Freibetrag,
   * falscher Lohn. Beim Namen wurde die Mehrdeutigkeit laengst gemeldet; bei
   * den Kennzeichen, denen man am meisten vertraut, nicht.
   */
  const nachSteuerId = new Map<string, BestandsProfil[]>()
  const nachPersonalnummer = new Map<string, BestandsProfil[]>()
  const nachName = new Map<string, BestandsProfil[]>()
  const dazu = (m: Map<string, BestandsProfil[]>, k: string, p: BestandsProfil) =>
    m.set(k, [...(m.get(k) ?? []), p])
  for (const p of bestand) {
    if (p.steuerId) dazu(nachSteuerId, p.steuerId.replace(/\s+/g, ''), p)
    if (p.personalnummer) dazu(nachPersonalnummer, p.personalnummer.trim(), p)
    dazu(nachName, normName(p.name), p)
  }

  return saetze.map(satz => {
    let treffer: BestandsProfil | undefined
    let zuordnung: ElstamAbgleich['zuordnung'] = 'keine'
    let hinweis: string | undefined

    const perSteuerId = satz.steuerId ? nachSteuerId.get(satz.steuerId) ?? [] : []
    const perNummer = satz.personalnummer
      ? nachPersonalnummer.get(satz.personalnummer.trim()) ?? [] : []

    if (perSteuerId.length === 1) {
      treffer = perSteuerId[0]; zuordnung = 'steuerId'
    } else if (perSteuerId.length > 1) {
      hinweis = `${perSteuerId.length} Mitarbeiter haben die Steuer-ID `
        + `${satz.steuerId} hinterlegt. Eine Steuer-ID gehoert zu genau einem `
        + `Menschen — bitte zuerst den Fehler in den Stammdaten beheben.`
    } else if (perNummer.length === 1) {
      treffer = perNummer[0]; zuordnung = 'personalnummer'
    } else if (perNummer.length > 1) {
      hinweis = `${perNummer.length} Mitarbeiter haben die Personalnummer `
        + `${satz.personalnummer}. Bitte zuerst die Stammdaten bereinigen.`
    } else if (satz.name) {
      const kandidaten = nachName.get(normName(satz.name)) ?? []
      if (kandidaten.length === 1) {
        treffer = kandidaten[0]; zuordnung = 'name'
        hinweis = 'Über den Namen zugeordnet — bitte prüfen. Sicher wird die '
          + 'Zuordnung erst mit hinterlegter Steuer-ID.'
      } else if (kandidaten.length > 1) {
        hinweis = `${kandidaten.length} Mitarbeiter heißen so — bitte von Hand zuordnen.`
      }
    }

    if (!treffer) {
      return {
        employeeId: null,
        name: satz.name ?? satz.steuerId ?? satz.personalnummer ?? 'Unbekannt',
        zuordnung: 'keine', satz, aenderungen: [],
        hinweis: hinweis ?? 'Kein Mitarbeiter gefunden. Steuer-ID oder '
          + 'Personalnummer am Lohnprofil hinterlegen und erneut einlesen.',
      }
    }

    const aenderungen: ElstamAenderung[] = []
    const pruefe = (feld: ElstamFeld, neu: unknown, bisher: unknown) => {
      // Felder, die die Liste nicht nennt, bleiben unangetastet — eine fehlende
      // Spalte darf keinen Freibetrag löschen.
      if (neu === null || neu === undefined) return
      if (String(neu) === String(bisher ?? '')) return
      aenderungen.push({ feld, bisher: zeige(bisher), neu: zeige(neu) })
    }
    pruefe('steuerklasse', satz.steuerklasse, treffer.steuerklasse)
    pruefe('kinderfreibetraege', satz.kinderfreibetraege, treffer.kinderfreibetraege)
    pruefe('konfession', satz.konfession, treffer.konfession)
    pruefe('freibetragMonat', satz.freibetragMonat, treffer.freibetragMonat)
    pruefe('hinzurechnungMonat', satz.hinzurechnungMonat, treffer.hinzurechnungMonat)
    pruefe('faktor', satz.faktor, treffer.faktor)

    return { employeeId: treffer.employeeId, name: treffer.name, zuordnung, satz, aenderungen, hinweis }
  })
}

function normName(n: string): string {
  return n.toLowerCase().replace(/[^a-zäöüß]/g, '')
}
