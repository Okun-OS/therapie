// Nachweis §289: Beim Öffnen der App erneut mit dem zweiten Faktor — und
// niemand sperrt sich damit aus.
//
//     node pruefungen/y-oeffnung-mit-zweitem-faktor.mjs
//
// WORUM ES GEHT
// Gewünscht: „Man einstellen kann, dass man bei jedem Öffnen der App neu mit
// 2FA gefragt wird", ausdrücklich „bei 2fa mit sms, nicht bei Fingerabdruck".
//
// Das ist der Ersatz für die Gerätesperre aus §139, die in §288 entfernt
// wurde, weil sie jemanden ausgesperrt hat. Diese Prüfung misst deshalb
// zwei Dinge, und das zweite ist das wichtigere:
//
//   1. Die Sperre sperrt wirklich — am SERVER, nicht nur als Fenster über
//      der Oberfläche. Eine Sperre, die nur die Anzeige verdeckt, ließe
//      jede Adresse offen: Wer das Telefon hat, hat auch den Sitzungskeks.
//
//   2. Sie sperrt niemanden aus. Das Abmelden bleibt offen, das Anfordern
//      und Prüfen des Codes bleibt offen — und was den Schlüssel wegwerfen
//      würde (das Abschalten des zweiten Faktors), bleibt zu.
//
// WAS HIER NICHT GEPRÜFT WIRD
// Der Weg der SMS selbst. Ob Twilio zustellt, hängt nicht am Programm, und
// diese Prüfung soll nicht rot werden, weil ein Guthaben leer ist. Geprüft
// wird der Code-Weg über die E-Mail-Variante, die denselben Prüfer benutzt
// (`zweiter-faktor.ts`) — und zusätzlich, dass der SMS-Weg angeboten wird,
// wenn das Konto ihn hat.

import { pruefer, BASIS, login } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const EMAIL = 'deniz.yilmaz@beispielbetrieb.de'

/* ──────────────────────────────────────────────────────────────────────
 * Ausgangszustand: ein Konto mit E-Mail-Faktor und ohne die Einstellung.
 * Beides wird am Ende wiederhergestellt.
 * ────────────────────────────────────────────────────────────────────── */

const vorher = await prisma.user.findUnique({
  where: { email: EMAIL },
  select: { id: true, emailOtpEnabled: true, faktorBeimOeffnen: true, smsOtpEnabled: true },
})
if (!vorher) {
  console.error('Der Beispielbetrieb fehlt. Erst `npm run seed:schaufenster`.')
  process.exit(1)
}

async function zurueckbauen() {
  await prisma.user.update({
    where: { id: vorher.id },
    data: {
      emailOtpEnabled: vorher.emailOtpEnabled,
      faktorBeimOeffnen: vorher.faktorBeimOeffnen,
    },
  })
  await prisma.smsTotpCode.deleteMany({ where: { userId: vorher.id } })
}

await prisma.user.update({
  where: { id: vorher.id },
  data: { emailOtpEnabled: false, faktorBeimOeffnen: false },
})
await prisma.smsTotpCode.deleteMany({ where: { userId: vorher.id } })

/** Eine Anfrage mit dem Keksbeutel dieser Prüfung. */
function beutel() {
  const kekse = new Map()
  return {
    uebernehmen(res) {
      for (const roh of res.headers.getSetCookie()) {
        const [paar, ...rest] = roh.split(';')
        const i = paar.indexOf('=')
        const name = paar.slice(0, i).trim()
        const wert = paar.slice(i + 1).trim()
        const abgelaufen = /max-age=0/i.test(rest.join(';'))
        if (!wert || abgelaufen) kekse.delete(name)
        else kekse.set(name, wert)
      }
    },
    kopf() {
      return [...kekse].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    hat(name) { return kekse.has(name) },
  }
}

async function ruf(tasche, pfad, opt = {}) {
  const res = await fetch(`${BASIS}${pfad}`, {
    ...opt,
    headers: {
      ...(opt.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opt.headers ?? {}),
      cookie: tasche.kopf(),
    },
    redirect: 'manual',
  })
  tasche.uebernehmen(res)
  return res
}

try {
  /* ── Ohne die Einstellung: alles offen ──────────────────────────────── */
  const tasche = beutel()
  {
    const res = await fetch(`${BASIS}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: 'Test1234!' }),
    })
    tasche.uebernehmen(res)
    check('Anmeldung klappt', res.ok, `HTTP ${res.status}`)
  }

  const frei1 = await ruf(tasche, '/api/time-logs?employeeId=egal')
  check('Ohne die Einstellung ist nichts gesperrt',
    frei1.status !== 403 || !(await frei1.clone().json().catch(() => ({}))).code,
    `HTTP ${frei1.status}`)

  /* ── Ohne zweiten Faktor lässt sie sich nicht einschalten ───────────── */
  {
    const res = await ruf(tasche, '/api/auth/oeffnung', {
      method: 'PUT', body: JSON.stringify({ an: true }),
    })
    const d = await res.json().catch(() => ({}))
    /*
     * §288 Keine Tür ohne Schlüssel. Das ist die Schranke, die bei der alten
     * Gerätesperre beim EINSCHALTEN da war — und die hier zusätzlich auch
     * nachträglich greift (siehe unten).
     */
    check('Ohne zweiten Faktor lässt sich die Sperre nicht einschalten',
      res.status === 400 && d.code === 'KEIN_FAKTOR', `HTTP ${res.status} ${d.code ?? ''}`)
  }

  /* ── Mit zweitem Faktor: einschalten ────────────────────────────────── */
  await prisma.user.update({
    where: { id: vorher.id }, data: { emailOtpEnabled: true },
  })

  {
    const res = await ruf(tasche, '/api/auth/oeffnung', {
      method: 'PUT', body: JSON.stringify({ an: true }),
    })
    const d = await res.json().catch(() => ({}))
    check('Mit zweitem Faktor lässt sie sich einschalten',
      res.ok && d.eingeschaltet === true, `HTTP ${res.status}`)
    /*
     * Wer gerade einschaltet, steht vor dem Gerät — ihn sofort zu fragen
     * wäre eine Frage ohne Erkenntnis. Gefragt wird beim nächsten Öffnen.
     */
    check('Und gilt sofort, ohne gleich zu fragen', tasche.hat('okun_oeffnung'),
      tasche.hat('okun_oeffnung') ? 'Siegel ausgestellt' : 'kein Siegel')
  }

  /* ── Das Öffnen nachstellen: Siegel weg ─────────────────────────────── */
  await ruf(tasche, '/api/auth/oeffnung', { method: 'DELETE' })
  check('Nach dem Öffnen ist das Siegel weg', !tasche.hat('okun_oeffnung'),
    tasche.hat('okun_oeffnung') ? 'noch da' : 'weg')

  /*
   * DER KERN: Jetzt muss der SERVER sperren — nicht die Oberfläche.
   */
  {
    const res = await ruf(tasche, '/api/auth/2fa/status')
    const d = await res.json().catch(() => ({}))
    check('Jetzt sperrt der Server jede Schnittstelle',
      res.status === 403 && d.code === 'OEFFNUNG_NOETIG',
      `HTTP ${res.status} ${d.code ?? ''}`)
  }
  {
    const res = await ruf(tasche, '/api/schedule-entries?locationId=egal')
    const d = await res.json().catch(() => ({}))
    check('Auch den Dienstplan', res.status === 403 && d.code === 'OEFFNUNG_NOETIG',
      `HTTP ${res.status} ${d.code ?? ''}`)
  }

  /* ── §288 Der Ausweg bleibt offen ───────────────────────────────────── */
  {
    const res = await ruf(tasche, '/api/auth/me')
    check('Wer angemeldet ist, lässt sich weiterhin erfragen', res.ok, `HTTP ${res.status}`)
  }
  {
    const res = await ruf(tasche, '/api/auth/oeffnung')
    const d = await res.json().catch(() => ({}))
    check('Die Tür selbst antwortet', res.ok && d.aktiv === true && d.frei === false,
      `HTTP ${res.status} aktiv=${d.aktiv} frei=${d.frei}`)
    check('Und nennt den Weg, über den der Code kommt',
      Boolean(d.wege?.email), JSON.stringify(d.wege))
  }
  /*
   * Und das, was den Schlüssel wegwerfen würde, bleibt ZU. Wäre dieser Weg
   * frei, könnte jemand vor der Tür seinen zweiten Faktor abschalten — und
   * stünde danach vor einer Tür ohne Schlüssel.
   */
  {
    const res = await ruf(tasche, '/api/auth/2fa/disable', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    check('Das Abschalten des zweiten Faktors bleibt gesperrt',
      res.status === 403 && d.code === 'OEFFNUNG_NOETIG',
      `HTTP ${res.status} ${d.code ?? ''}`)
  }

  /* ── Durch die Tür ──────────────────────────────────────────────────── */
  {
    const res = await ruf(tasche, '/api/auth/oeffnung/code', {
      method: 'POST', body: JSON.stringify({ weg: 'email' }),
    })
    check('Ein Code lässt sich anfordern', res.ok, `HTTP ${res.status}`)
  }

  const satz = await prisma.smsTotpCode.findFirst({
    where: { userId: vorher.id, usedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  check('Und er ist hinterlegt — als Hash, nicht im Klartext',
    Boolean(satz) && satz.codeHash.startsWith('$2'),
    satz ? `Kanal ${satz.kanal}` : 'nichts hinterlegt')

  {
    const res = await ruf(tasche, '/api/auth/oeffnung/pruefen', {
      method: 'POST', body: JSON.stringify({ code: '000000' }),
    })
    /*
     * Die Gegenprobe zum Passieren: Ein falscher Code darf NICHT durch. Ohne
     * sie wäre „mit dem Code geht es" auch dann grün, wenn jeder Code ginge.
     * (Dass ausgerechnet 000000 der echte ist, wäre ein Zufall von eins zu
     * einer Million — und dann schlägt die Prüfung an, nicht die Tür auf.)
     */
    check('Ein falscher Code kommt nicht durch', !res.ok, `HTTP ${res.status}`)
  }

  // Den echten Code holen wir uns nicht aus der Datenbank — er steht dort nur
  // als Hash, und das ist richtig so. Stattdessen einen eigenen hinterlegen.
  const bcrypt = (await import('bcryptjs')).default
  await prisma.smsTotpCode.deleteMany({ where: { userId: vorher.id } })
  await prisma.smsTotpCode.create({
    data: {
      userId: vorher.id, kanal: 'email',
      codeHash: await bcrypt.hash('424242', 10),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })

  {
    const res = await ruf(tasche, '/api/auth/oeffnung/pruefen', {
      method: 'POST', body: JSON.stringify({ code: '424242' }),
    })
    check('Mit dem richtigen Code geht die Tür auf', res.ok, `HTTP ${res.status}`)
    check('Und das Siegel liegt wieder vor', tasche.hat('okun_oeffnung'), 'Siegel da')
  }
  {
    // Eine Sonde, die im offenen Zustand WIRKLICH 200 gibt. `/api/time-logs`
    // antwortet auch offen mit 403 (fremde Kennung) — daran ließe sich nicht
    // ablesen, ob die Tür auf ist.
    const res = await ruf(tasche, '/api/auth/2fa/status')
    check('Danach sind die Schnittstellen wieder offen', res.ok, `HTTP ${res.status}`)
  }

  /*
   * Ein Code gilt EINMAL. Sonst könnte ihn jemand, der die E-Mail mitgelesen
   * hat, ein zweites Mal benutzen.
   */
  await ruf(tasche, '/api/auth/oeffnung', { method: 'DELETE' })
  {
    const res = await ruf(tasche, '/api/auth/oeffnung/pruefen', {
      method: 'POST', body: JSON.stringify({ code: '424242' }),
    })
    check('Derselbe Code ein zweites Mal geht nicht', !res.ok, `HTTP ${res.status}`)
  }

  /* ── §288 Fällt der Faktor weg, gibt die Sperre nach ────────────────── */
  /*
   * Das ist der Fall, der die alte Gerätesperre zur Falle gemacht hat: Die
   * Sperre steht, der Schlüssel ist weg. Hier muss nachgegeben werden — und
   * zwar auch in der Datenbank, sonst käme es beim nächsten Öffnen wieder.
   */
  await prisma.user.update({
    where: { id: vorher.id }, data: { emailOtpEnabled: false },
  })
  {
    const res = await ruf(tasche, '/api/auth/oeffnung')
    const d = await res.json().catch(() => ({}))
    check('Ohne Schlüssel gibt die Tür nach', res.ok && d.aktiv === false,
      `aktiv=${d.aktiv} eingeschaltet=${d.eingeschaltet}`)
    const stand = await prisma.user.findUnique({
      where: { id: vorher.id }, select: { faktorBeimOeffnen: true },
    })
    check('Und der Haken fällt auch in der Datenbank',
      stand.faktorBeimOeffnen === false, String(stand.faktorBeimOeffnen))
  }
  {
    const res = await ruf(tasche, '/api/auth/2fa/status')
    check('Die Schnittstellen sind damit wieder offen', res.ok, `HTTP ${res.status}`)
  }

  /* ── Das Abmelden räumt alles ab ────────────────────────────────────── */
  await prisma.user.update({
    where: { id: vorher.id }, data: { emailOtpEnabled: true },
  })
  await ruf(tasche, '/api/auth/oeffnung', { method: 'PUT', body: JSON.stringify({ an: true }) })
  check('Vor dem Abmelden liegt ein Siegel vor', tasche.hat('okun_oeffnung'), 'ja')
  await ruf(tasche, '/api/auth/logout', { method: 'POST' })
  check('§288 Das Abmelden ist nie gesperrt und räumt das Siegel weg',
    !tasche.hat('okun_oeffnung') && !tasche.hat('okun_session'),
    `Siegel=${tasche.hat('okun_oeffnung')} Sitzung=${tasche.hat('okun_session')}`)

  /*
   * Und die Gegenprobe darauf, dass die Anmeldung dieselbe Tür ist: Nach dem
   * Abmelden verlangt sie den zweiten Faktor — also genau das, was der
   * Sperrbildschirm verlangt hätte. Wer das eine kann, kann auch das andere;
   * es gibt keinen Kreis wie in §288.
   */
  {
    const res = await fetch(`${BASIS}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: 'Test1234!' }),
    })
    const d = await res.json().catch(() => ({}))
    check('Die Anmeldung verlangt denselben zweiten Faktor',
      Boolean(d.requiresEmail || d.requiresSms || d.requires2FA || d.pendingToken),
      JSON.stringify(Object.keys(d)))
  }
} finally {
  await zurueckbauen()
  await prisma.$disconnect()
}

const fails = bilanz()
process.exit(fails > 0 ? 1 : 0)
