import { createHmac, timingSafeEqual } from 'crypto'

/**
 * §261 Der Nachweis, dass wir diesen Platz selbst ausgegeben haben.
 *
 * DAS LOCH, DAS DAMIT ZUGEHT
 * Beim direkten Weg (§260) sagt die Oberfläche der Anwendung hinterher: „Die
 * Datei liegt unter diesem Schlüssel." Das ist eine BEHAUPTUNG — und ohne
 * Gegenprobe könnte jemand einen FREMDEN Schlüssel nennen und die Datei
 * dahinter als die eigene eintragen. Danach läge sie in seiner Akte oder in
 * seinem Gespräch, und er dürfte sie ansehen.
 *
 * §260 hat das über den Ordner abgefangen: Der Schlüssel muss mit
 * `chat/<diesem Raum>/` beginnen. Das hält fremde Gespräche und fremde Akten
 * draußen, aber nicht alles. Innerhalb der eigenen Personalakte liegen
 * Unterlagen, die dem Mitarbeiter NICHT freigegeben sind — eine Abrechnung,
 * die noch nicht gelesen werden soll. Nennt er deren Schlüssel und trägt sie
 * als selbst eingereichte Bescheinigung ein, sieht er sie: Was man selbst
 * hochgeladen hat, darf man ansehen.
 *
 * Dass dazu 32 zufällige Hexzeichen zu erraten wären und kein Weg im Programm
 * den Schlüssel herausgibt, macht es unwahrscheinlich. Es macht es nicht
 * unmöglich, und die Unterlagen hier sind Gesundheitsdaten nach Art. 9 DSGVO.
 *
 * WIE ES FUNKTIONIERT
 * Wer einen Platz bekommt, bekommt zusätzlich einen kurzen Nachweis: eine
 * Unterschrift über Schlüssel, Verwendung und Ablaufzeit. Beim Vermerken wird
 * sie geprüft. Ein Schlüssel ohne passenden Nachweis wird abgewiesen — ganz
 * gleich, in welchem Ordner er liegt.
 *
 * WAS „VERWENDUNG" HEISST UND WARUM SIE MITUNTERSCHRIEBEN WIRD
 * Ein Nachweis für `chat:abc` gilt nicht für `akte:employee:xyz`. Ohne das
 * ließe sich ein redlich erworbener Platz an anderer Stelle einlösen — und
 * genau solche Verschiebungen sind der Fehler, der bei signierten Angaben am
 * häufigsten übrig bleibt.
 */

function geheimnis(): string {
  const s = process.env.SESSION_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET ist nicht gesetzt')
    }
    return 'dev-insecure-session-secret-do-not-use-in-production'
  }
  return s
}

/**
 * Die eigentliche Unterschrift.
 *
 * `objekt-nachweis` steht als erstes Feld darin, und das ist nicht Zierde: Es
 * trennt diese Unterschriften von den Sitzungsmarken, die aus demselben
 * Geheimnis entstehen. Ohne diese Trennung könnte eine von beiden als die
 * andere durchgehen, sobald irgendwann einmal ihre Felder zusammenfallen.
 */
function zeichen(schluessel: string, zweck: string, ablauf: number): string {
  return createHmac('sha256', geheimnis())
    .update(['objekt-nachweis', schluessel, zweck, String(ablauf)].join('\n'))
    .digest('base64url')
}

/**
 * Einen Nachweis ausstellen.
 *
 * Eine halbe Stunde. Die Adresse zum Hochladen gilt nur fünf Minuten, das
 * Hochladen ist also ohnehin vorher vorbei; die weitere Zeit deckt ein
 * Telefon ab, das zwischen Ablegen und Melden in den Ruhezustand geht.
 */
export function nachweisAusstellen(
  schluessel: string,
  zweck: string,
  gueltigSekunden = 1800,
  jetzt: Date = new Date(),
): string {
  const ablauf = Math.floor(jetzt.getTime() / 1000) + gueltigSekunden
  return `${ablauf}.${zeichen(schluessel, zweck, ablauf)}`
}

/** Einen Nachweis prüfen. Alles, was nicht eindeutig gültig ist, ist ungültig. */
export function nachweisGueltig(
  schluessel: string,
  zweck: string,
  nachweis: string | undefined | null,
  jetzt: Date = new Date(),
): boolean {
  if (!nachweis) return false
  const trenner = nachweis.indexOf('.')
  if (trenner < 1) return false

  const ablauf = Number(nachweis.slice(0, trenner))
  const unterschrift = nachweis.slice(trenner + 1)
  if (!Number.isSafeInteger(ablauf) || ablauf <= 0 || !unterschrift) return false
  if (ablauf * 1000 < jetzt.getTime()) return false

  const soll = Buffer.from(zeichen(schluessel, zweck, ablauf))
  const ist = Buffer.from(unterschrift)
  /*
   * Gleiche Länge zuerst, dann der zeitgleiche Vergleich. `timingSafeEqual`
   * wirft bei verschiedener Länge, und ein `===` hier würde über die
   * Vergleichsdauer verraten, wie viele Zeichen schon stimmen.
   */
  return soll.length === ist.length && timingSafeEqual(soll, ist)
}
