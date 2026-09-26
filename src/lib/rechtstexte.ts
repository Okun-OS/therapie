import { DATENARTEN } from './dsgvo-katalog'
import { UNTERAUFTRAEGE, anbieter, type Anbieter } from './dsgvo-verzeichnis'

/**
 * §153 Impressum und Datenschutzerklärung für das Produkt selbst.
 *
 * WARUM ES BEIDES BRAUCHT, OBWOHL DER KUNDE VERANTWORTLICHER IST
 * Zwei Ebenen, die gern verwechselt werden:
 *
 *   Für die Daten SEINER MITARBEITER ist der Kunde Verantwortlicher. Er
 *   informiert sie nach Art. 13 DSGVO, nicht wir. Was wir dabei tun, steht in
 *   seinem Verarbeitungsverzeichnis (§152) und im Vertrag zur
 *   Auftragsverarbeitung.
 *
 *   Für DIESE WEBSEITE ist OKUN Verantwortlicher — für den Abruf der
 *   Anmeldeseite, für die öffentlichen Karriereseiten, für die Protokolle, die
 *   dabei entstehen. Dafür braucht es ein Impressum nach §5 DDG und eine
 *   eigene Erklärung. Ohne sie ist das Angebot abmahnfähig, unabhängig davon,
 *   wie sauber die Verarbeitung im Innern ist.
 *
 * WARUM DER TEXT AUS DATEN WÄCHST
 * Der Teil, der am schnellsten veraltet, ist die Liste der Dienstleister und
 * die der Speicherfristen. Beides steht schon an einer Stelle (§128, §152).
 * Ein von Hand geschriebener Absatz daneben wäre nach dem nächsten Umbau
 * falsch — und eine falsche Datenschutzerklärung ist schlechter als eine
 * knappe.
 *
 * WAS DIESE DATEI NICHT IST
 * Sie ist keine Rechtsberatung. Die Angaben sind sorgfältig hergeleitet und
 * mit Fundstellen belegt; die Freigabe durch einen Anwalt oder
 * Datenschutzbeauftragten ersetzt das nicht. An den Stellen, wo Auslegung im
 * Spiel ist, steht das ausdrücklich dabei.
 */

// ── Impressum ──────────────────────────────────────────────────────────────

export interface Impressum {
  anbieter: Anbieter
  /** §5 Abs. 1 Nr. 4 DDG — Registergericht und Nummer */
  register: string | null
  /** §5 Abs. 1 Nr. 6 DDG — Umsatzsteuer-Identifikationsnummer */
  umsatzsteuerId: string | null
  /** §18 Abs. 2 MStV — inhaltlich Verantwortlicher für journalistische Inhalte */
  inhaltlichVerantwortlich: string | null
  /** §36 VSBG — Teilnahme an Streitbeilegung */
  streitbeilegung: string
}

export function impressum(): Impressum {
  const wert = (n: string) => process.env[n]?.trim() || null
  return {
    anbieter: anbieter(),
    register: wert('OKUN_REGISTER'),
    umsatzsteuerId: wert('OKUN_USTID'),
    inhaltlichVerantwortlich: wert('OKUN_VERTRETEN'),
    streitbeilegung:
      'Zur Teilnahme an einem Streitbeilegungsverfahren vor einer '
      + 'Verbraucherschlichtungsstelle sind wir nicht verpflichtet und nicht '
      + 'bereit (§36 VSBG). OKUN Workforce richtet sich an Unternehmen und '
      + 'nicht an Verbraucher.',
  }
}

/**
 * Was dem Impressum noch fehlt, damit es der Pflicht genügt.
 *
 * §5 DDG verlangt Name, Anschrift, Vertretungsberechtigten und eine schnelle
 * elektronische Kontaktmöglichkeit. Register und Umsatzsteuer-Kennung nur,
 * soweit vorhanden — deshalb sind sie hier keine Fehlmeldung, sondern ein
 * Hinweis.
 */
export function fehltAmImpressum(i = impressum()): string[] {
  const fehlt: string[] = []
  if (!i.anbieter.anschrift) {
    fehlt.push('Ladungsfähige Anschrift (OKUN_ANSCHRIFT) — §5 Abs. 1 Nr. 1 DDG')
  }
  if (!i.anbieter.vertreten) {
    fehlt.push('Vertretungsberechtigte Person (OKUN_VERTRETEN) — §5 Abs. 1 Nr. 1 DDG')
  }
  if (!i.anbieter.kontakt) {
    fehlt.push('E-Mail-Adresse (OKUN_KONTAKT) — §5 Abs. 1 Nr. 2 DDG')
  }
  return fehlt
}

export function hinweiseZumImpressum(i = impressum()): string[] {
  const h: string[] = []
  if (!i.register) {
    h.push(
      'Registergericht und Registernummer (OKUN_REGISTER) — Pflicht nach '
      + '§5 Abs. 1 Nr. 4 DDG, sobald die Gesellschaft im Handelsregister steht.')
  }
  if (!i.umsatzsteuerId) {
    h.push(
      'Umsatzsteuer-Identifikationsnummer (OKUN_USTID) — Pflicht nach '
      + '§5 Abs. 1 Nr. 6 DDG, sobald eine vorhanden ist.')
  }
  return h
}

// ── Datenschutzerklärung ───────────────────────────────────────────────────

export interface Abschnitt {
  id: string
  ueberschrift: string
  /** Absätze; jeder steht für sich */
  absaetze: string[]
  /** Aufzählung darunter, wenn es eine gibt */
  punkte?: string[]
  /** Die Vorschrift, auf die sich der Abschnitt stützt */
  grundlage?: string
}

/**
 * Wer diese Seite abruft, hinterlässt Spuren — auch ohne Anmeldung.
 *
 * Das sind die Verarbeitungen, für die OKUN selbst Verantwortlicher ist. Sie
 * sind klein, aber sie sind da, und eine Erklärung, die sie verschweigt, ist
 * unvollständig.
 */
function abschnittEigene(): Abschnitt {
  return {
    id: 'eigene',
    ueberschrift: 'Wenn Sie diese Seiten aufrufen',
    grundlage: 'Art. 6 Abs. 1 lit. f DSGVO',
    absaetze: [
      'Beim Aufruf entstehen technisch notwendige Daten: die IP-Adresse, der '
      + 'Zeitpunkt, die aufgerufene Adresse und die Angaben, die Ihr Browser '
      + 'von sich aus mitsendet. Ohne sie lässt sich keine Seite ausliefern.',
      'Wir verwenden sie, um den Betrieb sicherzustellen und Angriffe zu '
      + 'erkennen. Bei fehlgeschlagenen Anmeldungen wird die Herkunft zusätzlich '
      + 'gezählt, um das Durchprobieren von Passwörtern zu bremsen — dabei wird '
      + 'die Adresse nicht im Klartext gespeichert, sondern nur als '
      + 'unumkehrbares Kürzel, und dieses Kürzel wird nach spätestens '
      + 'vierundzwanzig Stunden gelöscht.',
      'Das berechtigte Interesse liegt im sicheren und störungsfreien Betrieb. '
      + 'Ein Tracking zu Werbezwecken findet nicht statt; es werden keine '
      + 'Cookies gesetzt, die nicht für den Betrieb nötig sind.',
    ],
  }
}

function abschnittAnmeldung(): Abschnitt {
  return {
    id: 'anmeldung',
    ueberschrift: 'Wenn Sie sich anmelden',
    grundlage: 'Art. 6 Abs. 1 lit. b DSGVO, Art. 32 DSGVO',
    absaetze: [
      'Zur Anmeldung setzen wir ein Cookie, das Ihre Sitzung ausweist. Es ist '
      + 'für den Betrieb notwendig und bedarf deshalb keiner Einwilligung '
      + '(§25 Abs. 2 Nr. 2 TDDDG).',
      'Haben Sie einen zweiten Faktor eingeschaltet, verarbeiten wir zusätzlich '
      + 'den von Ihrer Authenticator-App erzeugten Code oder — wenn Sie den '
      + 'SMS-Weg gewählt haben — Ihre Mobilfunknummer. Der Code gilt zehn '
      + 'Minuten und wird danach gelöscht.',
    ],
  }
}

function abschnittImAuftrag(): Abschnitt {
  return {
    id: 'auftrag',
    ueberschrift: 'Daten, die wir für Ihren Arbeitgeber verarbeiten',
    grundlage: 'Art. 28 DSGVO',
    absaetze: [
      'Alles, was Sie im angemeldeten Bereich sehen — Dienstpläne, '
      + 'Arbeitszeiten, Abwesenheiten, Lohnabrechnungen, Nachweise —, '
      + 'verarbeiten wir im Auftrag Ihres Arbeitgebers. Für diese Daten ist '
      + 'ER der Verantwortliche im Sinne der Datenschutz-Grundverordnung, '
      + 'nicht wir.',
      'Das ist kein Formalismus: Ihre Rechte auf Auskunft, Berichtigung und '
      + 'Löschung richten Sie an Ihren Arbeitgeber. Er entscheidet darüber, '
      + 'und wir setzen es um. In der App finden Sie unter „Meine Daten" einen '
      + 'Weg, beides anzustoßen.',
      'Wir verwenden diese Daten ausschließlich, um das Programm für Ihren '
      + 'Arbeitgeber zu betreiben. Es findet keine Auswertung über mehrere '
      + 'Betriebe hinweg statt, keine Weitergabe an Dritte zu eigenen Zwecken '
      + 'und kein Training von Sprachmodellen mit Ihren Daten.',
    ],
  }
}

/**
 * Art. 22 DSGVO — der Abschnitt, den die meisten Erklärungen auslassen.
 *
 * Wir rechnen Dienstpläne aus und vergeben Punkte. Beides mit einem Satz
 * „automatisierte Entscheidungen finden nicht statt" abzutun, wäre bequem und
 * falsch. Richtig ist die genaue Unterscheidung: Der Plan wird gerechnet, aber
 * ein Mensch gibt ihn frei — und genau das ist der Unterschied, auf den
 * Art. 22 Abs. 1 abstellt.
 */
function abschnittAutomatik(): Abschnitt {
  return {
    id: 'automatik',
    ueberschrift: 'Automatisch Berechnetes — und wer entscheidet',
    grundlage: 'Art. 13 Abs. 2 lit. f, Art. 22 DSGVO',
    absaetze: [
      'Das Programm rechnet Dienstpläne aus. Es schlägt vor, wer wann '
      + 'eingeteilt wird, und berücksichtigt dabei Arbeitszeitgesetz, '
      + 'Ruhezeiten, Qualifikationen, Wünsche und die Regeln Ihres Betriebs.',
      'Dieser Vorschlag ist KEINE Entscheidung. Er wird der Leitung angezeigt, '
      + 'kann geändert werden und wird erst wirksam, wenn ein Mensch ihn '
      + 'veröffentlicht. Eine ausschließlich automatisierte Entscheidung im '
      + 'Sinne des Art. 22 Abs. 1 DSGVO findet damit nicht statt.',
      'Der Workforce Score vergibt Punkte für Dinge wie das Einspringen bei '
      + 'Ausfällen. Er ist freiwillig, hat keine Auswirkung auf Ihr Entgelt '
      + 'und wird nicht für Entscheidungen über Ihr Arbeitsverhältnis '
      + 'verwendet.',
      'Der Hilfe-Assistent beantwortet Fragen zum Programm über ein '
      + 'Sprachmodell. Er hat keinen Zugriff auf Ihre Betriebsdaten — er '
      + 'erklärt die Bedienung und liest keine Datenbank. Übermittelt wird nur '
      + 'der Text Ihrer Frage.',
    ],
  }
}

function abschnittEmpfaenger(): Abschnitt {
  return {
    id: 'empfaenger',
    ueberschrift: 'Wer die Daten außer uns zu sehen bekommt',
    grundlage: 'Art. 13 Abs. 1 lit. e und f DSGVO',
    absaetze: [
      'Wir setzen Dienstleister ein, die uns beim Betrieb unterstützen. Sie '
      + 'handeln ausschließlich nach unserer Weisung und sind vertraglich zur '
      + 'Vertraulichkeit verpflichtet.',
      UNTERAUFTRAEGE.some(u => u.drittland)
        ? 'Einige davon sitzen außerhalb der Europäischen Union. Für diese '
          + 'Übermittlungen stützen wir uns auf das EU-US Data Privacy '
          + 'Framework, soweit der Empfänger zertifiziert ist, sonst auf '
          + 'Standardvertragsklauseln der EU-Kommission.'
        : 'Alle Dienstleister verarbeiten innerhalb der Europäischen Union.',
    ],
    punkte: UNTERAUFTRAEGE.map(u =>
      `${u.name} — ${u.zweck} (${u.ort})`),
  }
}

function abschnittDauer(): Abschnitt {
  // Aus dem Katalog erzeugt, damit die Angabe nicht neben der Wirklichkeit
  // steht. Genannt werden nur die Arten mit gesetzlicher Frist — die übrigen
  // zusammengefasst, sonst liest es niemand.
  const mitFrist = DATENARTEN
    .filter(d => d.fristJahre > 0)
    .sort((a, b) => b.fristJahre - a.fristJahre)
  return {
    id: 'dauer',
    ueberschrift: 'Wie lange wir speichern',
    grundlage: 'Art. 13 Abs. 2 lit. a DSGVO',
    absaetze: [
      'Was keiner Aufbewahrungspflicht unterliegt, wird gelöscht, sobald der '
      + 'Zweck entfällt — bei Beschäftigtendaten also mit dem Ausscheiden.',
      'Für einen Teil der Daten verbietet das Gesetz die Löschung. Sie werden '
      + 'dann nicht gelöscht, sondern nach Art. 18 DSGVO gesperrt: Sie bleiben '
      + 'unverändert liegen und werden nur noch für den Zweck verwendet, für '
      + 'den das Gesetz sie verlangt.',
      'Bewerbungen löschen wir sechs Monate nach Abschluss des Verfahrens, '
      + 'soweit keine Einstellung erfolgt und Sie nicht in eine längere '
      + 'Aufbewahrung eingewilligt haben.',
    ],
    punkte: mitFrist.map(d =>
      `${d.bezeichnung}: ${d.fristJahre} Jahre${d.grundlage ? ` (${d.grundlage})` : ''}`),
  }
}

function abschnittRechte(anschrift: string | null): Abschnitt {
  return {
    id: 'rechte',
    ueberschrift: 'Ihre Rechte',
    grundlage: 'Art. 15 bis 21, Art. 77 DSGVO',
    absaetze: [
      'Sie haben das Recht auf Auskunft über die Sie betreffenden Daten '
      + '(Art. 15), auf Berichtigung unrichtiger Daten (Art. 16), auf Löschung '
      + '(Art. 17), auf Einschränkung der Verarbeitung (Art. 18), auf '
      + 'Datenübertragbarkeit (Art. 20) und auf Widerspruch gegen '
      + 'Verarbeitungen, die auf einem berechtigten Interesse beruhen '
      + '(Art. 21).',
      'Haben Sie in etwas eingewilligt, können Sie die Einwilligung jederzeit '
      + 'für die Zukunft widerrufen. Die Rechtmäßigkeit der bis dahin '
      + 'erfolgten Verarbeitung bleibt davon unberührt.',
      'Für Daten, die wir im Auftrag Ihres Arbeitgebers verarbeiten, wenden Sie '
      + 'sich bitte an ihn — er ist dafür der Verantwortliche. In der App '
      + 'finden Sie unter „Meine Daten" einen Weg, Auskunft und Löschung '
      + 'anzustoßen.',
      'Unabhängig davon können Sie sich bei einer Datenschutz-Aufsichtsbehörde '
      + 'beschweren (Art. 77 DSGVO). Zuständig ist die Behörde Ihres '
      + 'Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen '
      + 'Verstoßes.'
      + (anschrift ? '' : ''),
    ],
  }
}

export interface Datenschutzerklaerung {
  stand: string
  anbieter: Anbieter
  abschnitte: Abschnitt[]
  /** Was noch fehlt, damit sie vollständig ist */
  fehlt: string[]
}

export function datenschutzerklaerung(heute = new Date()): Datenschutzerklaerung {
  const a = anbieter()
  const fehlt: string[] = [...fehltAmImpressum()]
  if (!a.datenschutzbeauftragter) {
    fehlt.push(
      'Kontaktdaten des Datenschutzbeauftragten (OKUN_DSB) — Pflicht nach '
      + 'Art. 13 Abs. 1 lit. b DSGVO, sobald einer benannt ist (§38 BDSG: in '
      + 'der Regel ab zwanzig Personen mit ständiger automatisierter '
      + 'Verarbeitung).')
  }
  return {
    stand: heute.toISOString().slice(0, 10),
    anbieter: a,
    abschnitte: [
      abschnittEigene(),
      abschnittAnmeldung(),
      abschnittImAuftrag(),
      abschnittAutomatik(),
      abschnittEmpfaenger(),
      abschnittDauer(),
      abschnittRechte(a.anschrift),
    ],
    fehlt,
  }
}
