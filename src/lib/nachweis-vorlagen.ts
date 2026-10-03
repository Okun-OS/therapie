import type { Nachweisart } from './fristen'

/**
 * §146 Vorlagen — damit kein Kunde vor einem leeren Katalog sitzt.
 *
 * WARUM VORLAGEN UND TROTZDEM FREI KONFIGURIERBAR
 * Beides, nicht eines von beiden. Wer beim Onboarding eine Vorlage anklickt,
 * hat in einer Minute einen brauchbaren Stand — und ändert danach alles, was
 * nicht passt: Abstände, Vorwarnzeiten, für wen es gilt, ob gesperrt wird.
 * Nichts davon ist einprogrammiert; die Vorlage schreibt nur die ersten Zeilen
 * in einen Katalog, der dem Kunden gehört.
 *
 * ACHTUNG BEI DEN ANGABEN
 * Die Rhythmen unten sind nach bestem Wissen eingetragen und mit der
 * Vorschrift belegt, aus der sie stammen. Sie sind NICHT von einem Anwalt
 * geprüft, und sie hängen an Dingen, die wir nicht kennen — Tätigkeit,
 * Gefährdungsbeurteilung, Träger, Tarifvertrag. Deshalb steht bei jedem
 * Eintrag die Grundlage dabei: Wer sie ändert, soll sehen, woran er rüttelt.
 *
 * Ein Beispiel dafür, warum das kein Automatismus sein darf: Die
 * arbeitsmedizinische Vorsorge nach ArbMedVV ist je nach Tätigkeit Pflicht-,
 * Angebots- oder Wunschvorsorge, und die Abstände stehen in der
 * Gefährdungsbeurteilung des Betriebs — nicht in unserem Programm.
 */

export type VorlagenEintrag = Omit<Nachweisart, 'id' | 'aktiv'>

export interface Vorlage {
  schluessel: string
  name: string
  beschreibung: string
  eintraege: VorlagenEintrag[]
}

const J = (jahre: number) => jahre * 12

/** Fristen, die in fast jedem Betrieb gelten — die Grundlage jeder Vorlage. */
const ALLGEMEIN: VorlagenEintrag[] = [
  {
    name: 'Jährliche Unterweisung Arbeitsschutz',
    gattung: 'nachweis', giltFuer: 'alle', giltFuerWerte: [],
    faelligkeit: 'einstellung_und_wiederkehrend', abstandMonate: J(1),
    vorwarnTage: 42, nachweisNoetig: true, sichtbarkeit: 'leitung', folge: 'warnen',
    grundlage: '§12 ArbSchG — vor Aufnahme der Tätigkeit und danach mindestens jährlich',
  },
  {
    name: 'Erste Hilfe',
    gattung: 'nachweis', giltFuer: 'alle', giltFuerWerte: [],
    faelligkeit: 'wiederkehrend', abstandMonate: J(2),
    vorwarnTage: 56, nachweisNoetig: true, sichtbarkeit: 'leitung', folge: 'warnen',
    grundlage: 'DGUV Vorschrift 1 §26 — Fortbildung alle zwei Jahre',
  },
  {
    name: 'Brandschutzhelfer',
    gattung: 'nachweis', giltFuer: 'einzeln', giltFuerWerte: [],
    faelligkeit: 'wiederkehrend', abstandMonate: J(3),
    vorwarnTage: 56, nachweisNoetig: true, sichtbarkeit: 'leitung', folge: 'warnen',
    grundlage: 'ASR A2.2 — Auffrischung etwa alle drei bis fünf Jahre. '
      + 'Nicht jeder braucht sie: in der Regel 5 % der Beschäftigten.',
  },
  {
    name: 'Probezeit endet',
    gattung: 'vertrag', giltFuer: 'einzeln', giltFuerWerte: [],
    faelligkeit: 'einmalig', abstandMonate: null,
    vorwarnTage: 28, nachweisNoetig: false, sichtbarkeit: 'unternehmen', folge: 'warnen',
    grundlage: '§622 Abs.3 BGB — wer die Frist verpasst, hat entfristet zugestimmt',
  },
  {
    name: 'Befristung endet',
    gattung: 'vertrag', giltFuer: 'einzeln', giltFuerWerte: [],
    faelligkeit: 'einmalig', abstandMonate: null,
    vorwarnTage: 84, nachweisNoetig: false, sichtbarkeit: 'unternehmen', folge: 'warnen',
    grundlage: '§15 TzBfG — wer weiterarbeiten lässt, hat ein unbefristetes '
      + 'Arbeitsverhältnis',
  },
  {
    name: 'Rückkehr aus Elternzeit',
    gattung: 'vertrag', giltFuer: 'einzeln', giltFuerWerte: [],
    faelligkeit: 'einmalig', abstandMonate: null,
    vorwarnTage: 56, nachweisNoetig: false, sichtbarkeit: 'unternehmen', folge: 'warnen',
    grundlage: 'Damit der Dienstplan die Person rechtzeitig wieder einplant',
  },
]

const HYGIENE: VorlagenEintrag = {
  name: 'Belehrung Infektionsschutz (§43 IfSG)',
  gattung: 'nachweis', giltFuer: 'alle', giltFuerWerte: [],
  faelligkeit: 'einstellung_und_wiederkehrend', abstandMonate: J(2),
  vorwarnTage: 56, nachweisNoetig: true, sichtbarkeit: 'leitung', folge: 'sperren',
  grundlage: '§43 IfSG — vor erstmaliger Tätigkeit durch das Gesundheitsamt, '
    + 'danach alle zwei Jahre durch den Arbeitgeber',
}

const MASERN: VorlagenEintrag = {
  name: 'Masernschutz',
  gattung: 'nachweis', giltFuer: 'alle', giltFuerWerte: [],
  faelligkeit: 'einstellung', abstandMonate: null,
  vorwarnTage: 28, nachweisNoetig: true, sichtbarkeit: 'leitung', folge: 'sperren',
  grundlage: '§20 Abs.8 IfSG — Nachweis vor Beginn der Tätigkeit, gilt dauerhaft',
}

const FUEHRUNGSZEUGNIS_KJH: VorlagenEintrag = {
  name: 'Erweitertes Führungszeugnis',
  gattung: 'nachweis', giltFuer: 'alle', giltFuerWerte: [],
  faelligkeit: 'einstellung_und_wiederkehrend', abstandMonate: J(5),
  vorwarnTage: 84, nachweisNoetig: true, sichtbarkeit: 'unternehmen', folge: 'sperren',
  grundlage: '§72a SGB VIII in Verbindung mit §30a BZRG — vor Aufnahme und in '
    + 'regelmäßigen Abständen; der Abstand steht in der Vereinbarung mit dem '
    + 'Jugendamt (meist fünf Jahre)',
}

const ARBEITSMEDIZIN: VorlagenEintrag = {
  name: 'Arbeitsmedizinische Vorsorge',
  gattung: 'nachweis', giltFuer: 'einzeln', giltFuerWerte: [],
  faelligkeit: 'wiederkehrend', abstandMonate: J(3),
  vorwarnTage: 56, nachweisNoetig: true, sichtbarkeit: 'unternehmen', folge: 'warnen',
  grundlage: 'ArbMedVV — je nach Tätigkeit Pflicht-, Angebots- oder '
    + 'Wunschvorsorge. Die Abstände stehen in der Gefährdungsbeurteilung des '
    + 'Betriebs, nicht im Gesetz.',
}

export const VORLAGEN: Vorlage[] = [
  {
    schluessel: 'allgemein',
    name: 'Allgemeiner Betrieb',
    beschreibung: 'Arbeitsschutz, Erste Hilfe, Brandschutz und die '
      + 'Vertragsfristen. Passt überall und ist der richtige Anfang, wenn '
      + 'nichts Besonderes gilt.',
    eintraege: ALLGEMEIN,
  },
  {
    schluessel: 'pflege',
    name: 'Pflege und Betreuung',
    beschreibung: 'Zusätzlich Infektionsschutz, Masernnachweis und '
      + 'arbeitsmedizinische Vorsorge. Infektionsschutz und Masernschutz '
      + 'sperren den Einsatz, solange sie fehlen.',
    eintraege: [
      ...ALLGEMEIN,
      HYGIENE,
      MASERN,
      ARBEITSMEDIZIN,
      {
        name: 'Pflegefachkraft-Urkunde',
        gattung: 'nachweis', giltFuer: 'qualifikationen',
        giltFuerWerte: ['Pflegefachkraft', 'Gesundheits- und Krankenpflege', 'Altenpflege'],
        faelligkeit: 'einstellung', abstandMonate: null,
        vorwarnTage: 28, nachweisNoetig: true, sichtbarkeit: 'leitung', folge: 'sperren',
        grundlage: 'Grundlage der Fachkraftquote — ohne Urkunde zählt die '
          + 'Person im Dienstplan nicht als Fachkraft',
      },
    ],
  },
  {
    schluessel: 'kita',
    name: 'Kita und Kinderbetreuung',
    beschreibung: 'Zusätzlich erweitertes Führungszeugnis, Infektionsschutz '
      + 'und Masernnachweis. Alle drei sperren den Einsatz, solange sie fehlen.',
    eintraege: [
      ...ALLGEMEIN,
      FUEHRUNGSZEUGNIS_KJH,
      HYGIENE,
      MASERN,
    ],
  },
  {
    schluessel: 'eingliederung',
    name: 'Eingliederungshilfe und Behindertenhilfe',
    beschreibung: 'Zusätzlich erweitertes Führungszeugnis, Masernnachweis und '
      + 'arbeitsmedizinische Vorsorge.',
    eintraege: [
      ...ALLGEMEIN,
      FUEHRUNGSZEUGNIS_KJH,
      MASERN,
      ARBEITSMEDIZIN,
    ],
  },
]

export function vorlage(schluessel: string): Vorlage | undefined {
  return VORLAGEN.find(v => v.schluessel === schluessel)
}
