/**
 * §152 Schutz der Anmeldung gegen Durchprobieren.
 *
 * WAS VORHER WAR
 * Nichts. Die Anmeldung nahm beliebig viele Passwortversuche entgegen, und ein
 * Fehlversuch hinterließ keine Spur — obwohl der Protokolltyp `login_failed`
 * seit Langem existierte und nie geschrieben wurde. Für ein Programm, in dem
 * Lohndaten und Gesundheitsdaten nach Art. 9 DSGVO liegen, ist das die Lücke,
 * die man zuerst zumacht: Art. 32 Abs. 1 DSGVO verlangt Maßnahmen, die dem
 * Risiko angemessen sind, und ein unbegrenzter Rateversuch ist keine.
 *
 * ZWEI ZÄHLER, NICHT EINER
 * Je Konto UND je Absenderadresse. Ein Zähler allein reicht bei keinem der
 * beiden Angriffe:
 *
 *   Nur je Konto: Wer zehn Versuche auf vierhundert Konten verteilt, bleibt
 *   unter jeder Kontogrenze und hat trotzdem viertausend Versuche frei. Das
 *   ist der übliche Angriff („password spraying"), und ein Kontozähler sieht
 *   ihn nie.
 *
 *   Nur je Adresse: Wer aus einem Botnetz kommt, hat für jeden Versuch eine
 *   neue Adresse. Dann greift nur der Kontozähler.
 *
 * WARUM DIE SPERRE ABLÄUFT UND NICHT BLEIBT
 * Eine dauerhafte Kontosperre ist eine Waffe: Wer die E-Mail-Adresse einer
 * Standortleitung kennt, sperrt sie mit zehn falschen Versuchen aus dem
 * System aus — dauerhaft und ohne eigenes Risiko. Deshalb läuft die Sperre
 * nach einer Viertelstunde von selbst ab. Das kostet einen Angreifer real
 * sehr viel Zeit (vierzig Versuche pro Stunde) und einen Menschen, der sich
 * vertippt hat, höchstens eine Kaffeepause.
 *
 * WARUM DIE MELDUNG DIE WARTEZEIT NENNT
 * Wer „zu viele Versuche" liest und nicht weiß, ob das eine Minute oder für
 * immer ist, ruft an. Die Wartezeit steht deshalb in der Meldung — sie verrät
 * einem Angreifer nichts, was er nicht ohnehin durch Warten erführe.
 */

/** Innerhalb welchen Zeitraums gezählt wird. */
export const FENSTER_MINUTEN = 15

/** So lange bleibt gesperrt, wer die Grenze reißt. */
export const SPERRE_MINUTEN = 15

/**
 * Fehlversuche je Konto im Fenster.
 *
 * Zehn ist bewusst nicht drei: Ein Mensch mit zwei Passwörtern im Kopf und
 * einer Feststelltaste braucht durchaus fünf Versuche, und wer bei jedem
 * dritten Vertipper gesperrt wird, hasst das Programm zu Recht.
 */
export const MAX_JE_KONTO = 10

/**
 * Fehlversuche je Absenderadresse im Fenster.
 *
 * Großzügiger, weil hinter einer Adresse ein ganzes Haus sitzen kann: In einer
 * Einrichtung teilen sich alle denselben Anschluss, und am Montagmorgen
 * vertippen sich mehrere gleichzeitig.
 */
export const MAX_JE_ADRESSE = 40

export interface Versuchszahlen {
  /** Fehlversuche auf dieses Konto im Fenster */
  konto: number
  /** Fehlversuche von dieser Adresse im Fenster */
  adresse: number
  /** Wann der älteste gezählte Versuch war — daraus folgt das Ende der Sperre */
  aeltester?: Date | null
}

export interface Sperrlage {
  gesperrt: boolean
  /** Bis wann; nur gesetzt, wenn gesperrt */
  bis?: Date
  /** Was dem Anwender gesagt wird */
  meldung?: string
}

/**
 * Ist gerade gesperrt — und bis wann?
 *
 * Gerechnet, nicht gespeichert: Ein gespeicherter Sperrzustand müsste wieder
 * aufgehoben werden, und genau das vergisst ein Programm. Aus den Versuchen
 * im Fenster folgt die Sperre von selbst und endet von selbst.
 */
export function sperrlage(
  z: Versuchszahlen,
  jetzt = new Date(),
): Sperrlage {
  const kontoVoll = z.konto >= MAX_JE_KONTO
  const adresseVoll = z.adresse >= MAX_JE_ADRESSE
  if (!kontoVoll && !adresseVoll) return { gesperrt: false }

  // Ab dem ältesten gezählten Versuch, sonst ab jetzt. So rutscht die Sperre
  // mit dem Fenster weiter und hängt nicht fest.
  const ab = z.aeltester ? new Date(z.aeltester) : jetzt
  const bis = new Date(ab.getTime() + SPERRE_MINUTEN * 60_000)
  const dauer = Math.max(1, Math.ceil((bis.getTime() - jetzt.getTime()) / 60_000))

  return {
    gesperrt: true,
    bis,
    meldung: kontoVoll
      ? `Zu viele Fehlversuche. Dieser Zugang ist für ${dauer} `
        + `${dauer === 1 ? 'Minute' : 'Minuten'} gesperrt. Wenn du dein Passwort `
        + 'nicht mehr weißt, setz es über „Passwort vergessen" zurück.'
      : `Von dieser Verbindung kamen zu viele Fehlversuche. Bitte in ${dauer} `
        + `${dauer === 1 ? 'Minute' : 'Minuten'} noch einmal versuchen.`,
  }
}

/** Der Beginn des Zählfensters. */
export function fensterBeginn(jetzt = new Date()): Date {
  return new Date(jetzt.getTime() - FENSTER_MINUTEN * 60_000)
}

/**
 * Die Absenderadresse hinter einem Vermittler.
 *
 * Railway setzt `x-forwarded-for`; der erste Eintrag ist der ursprüngliche
 * Absender. Fehlt der Kopf, wird ein fester Ersatzwert benutzt — dann zählt
 * alles auf denselben Topf, was im Zweifel zu streng, aber nie zu lax ist.
 */
export function absenderadresse(kopf: {
  get(name: string): string | null
}): string {
  return kopf.get('x-forwarded-for')?.split(',')[0]?.trim()
    || kopf.get('x-real-ip')
    || 'unbekannt'
}

/**
 * §152 Die Adresse wird nicht im Klartext abgelegt, sondern als Kürzel.
 *
 * Eine IP-Adresse ist ein Personenbezug. Gebraucht wird hier aber nur die
 * Frage „ist das dieselbe wie eben?" — dafür genügt ein Fingerabdruck. Er
 * macht die Zählung möglich, ohne eine Liste zu erzeugen, aus der sich
 * nachher ablesen ließe, wer sich von wo angemeldet hat.
 *
 * Mit einem Geheimnis gesalzen, damit der Fingerabdruck nicht einfach
 * zurückgerechnet werden kann — der Raum der IPv4-Adressen ist klein genug,
 * dass ein ungesalzener Hash nichts verbirgt.
 */
export function adresskuerzel(
  adresse: string,
  geheimnis: string,
  hash: (text: string) => string,
): string {
  return hash(`${geheimnis}|${adresse}`).slice(0, 32)
}
