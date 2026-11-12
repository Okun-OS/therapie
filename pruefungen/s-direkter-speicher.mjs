// Nachweis §260–§261: Der direkte Weg in den Objektspeicher.
//
//     node pruefungen/s-direkter-speicher.mjs
//
// WAS HIER GEPRÜFT WIRD UND WARUM AN DIESER STELLE
//
// Bis §260 ging jede Datei durch die Anwendung. Jetzt lädt das Telefon direkt
// zum Speicher, und die Anwendung erfährt hinterher, wo die Datei liegt. Diese
// Meldung ist eine BEHAUPTUNG — und damit ist eine neue Tür entstanden.
//
// Zwei Riegel halten sie zu:
//
//   der Ordner        Der Schlüssel muss zu DIESEM Gespräch oder DIESER Akte
//                     gehören. Hält fremde Akten draußen.
//   die Unterschrift  §261. Hält darüber hinaus alles draußen, was wir nicht
//                     selbst ausgegeben haben — auch einen Schlüssel aus
//                     demselben Ordner.
//
// Der zweite ist der wichtigere, und das ist nicht offensichtlich: In der
// EIGENEN Akte liegen Unterlagen, die dem Mitarbeiter nicht freigegeben sind.
// Was er selbst eingereicht hat, darf er ansehen. Könnte er also eine fremd
// hochgeladene Datei aus seinem eigenen Ordner als selbst eingereichte
// Bescheinigung eintragen, sähe er sie.
//
// `objekt-nachweis.test.ts` prüft die Unterschrift als Rechnung. Hier wird
// geprüft, dass die Türen sie auch WIRKLICH VERLANGEN — das ist etwas anderes,
// und genau diese Lücke ist in §253 schon einmal aufgefallen: ein Riegel, der
// gebaut, aber nicht eingehängt war.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'
import { createHmac } from 'node:crypto'
import 'dotenv/config'

/**
 * §261 Die Unterschrift hier NOCH EINMAL — absichtlich.
 *
 * Normalerweise ist eine zweite Abschrift derselben Vorschrift der Fehler, der
 * in §229, §232 und §235 je einmal aufgefallen ist. Hier ist sie der Sinn der
 * Sache: Eine Prüfung, die dieselbe Funktion aufruft wie das Programm, prüft
 * nur, dass die Funktion sich selbst gleicht. Eine zweite, unabhängige
 * Niederschrift prüft, dass das Verfahren stimmt.
 *
 * Damit lässt sich ein gültiger Platz auch dort nachstellen, wo kein
 * Objektspeicher eingerichtet ist — und das ist genau die Umgebung, in der
 * geprüft wird.
 */
function nachweisAusstellen(schluessel, zweck, gueltigSekunden = 1800) {
  const geheimnis = process.env.SESSION_SECRET
    ?? 'dev-insecure-session-secret-do-not-use-in-production'
  const ablauf = Math.floor(Date.now() / 1000) + gueltigSekunden
  const sig = createHmac('sha256', geheimnis)
    .update(['objekt-nachweis', schluessel, zweck, String(ablauf)].join('\n'))
    .digest('base64url')
  return `${ablauf}.${sig}`
}

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const anna = await login('anna.fischer@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const meAnna = (await hole(anna, '/api/auth/me')).body.user
const annaId = meAnna.employeeId

// Eine zweite Person im selben Betrieb — für „fremde Akte".
const fremd = await prisma.employee.findFirst({
  where: { id: { not: annaId }, customerId: meAnna.customerId ?? undefined },
  select: { id: true, name: true },
})
if (!fremd) throw new Error('Kein zweiter Beschäftigter im Betrieb — Prüfung nicht aussagekräftig.')

// ── §261 Die Adressausgabe für die Akte ───────────────────────────────────
console.log('=== §261 Wer darf wohin laden? ===')

const platzFragen = (keks, daten) => sende(keks, '/api/files/adresse', 'POST', daten)

const eigenerKrankenschein = await platzFragen(anna, {
  ownerType: 'employee', ownerId: annaId, kategorie: 'krankenschein',
  dateiname: 'Schein.jpg', mimeType: 'image/jpeg', groesse: 240_000,
})
check('Die eigene Krankmeldung darf hochgeladen werden',
  eigenerKrankenschein.status === 200,
  `HTTP ${eigenerKrankenschein.status} ${JSON.stringify(eigenerKrankenschein.body).slice(0, 160)}`)

/*
 * Ohne diese Gegenprobe wäre die Zeile darüber nichts wert: Wenn JEDE Anfrage
 * eine Adresse bekommt, ist die Prüfung keine.
 */
const fremdeAkte = await platzFragen(anna, {
  ownerType: 'employee', ownerId: fremd.id, kategorie: 'krankenschein',
  dateiname: 'Schein.jpg', mimeType: 'image/jpeg', groesse: 240_000,
})
check('In eine FREMDE Akte bekommt niemand einen Platz',
  fremdeAkte.status === 403 || fremdeAkte.status === 404,
  `HTTP ${fremdeAkte.status}`)

const eigeneAbrechnung = await platzFragen(anna, {
  ownerType: 'employee', ownerId: annaId, kategorie: 'lohnabrechnung',
  dateiname: 'Abrechnung.pdf', mimeType: 'application/pdf', groesse: 90_000,
})
check('Und auch in die eigene Akte nicht für jede Art — keine Lohnabrechnung',
  eigeneAbrechnung.status === 403, `HTTP ${eigeneAbrechnung.status}`)

const unbekannteArt = await platzFragen(leitung, {
  ownerType: 'employee', ownerId: annaId, kategorie: 'erfunden',
  dateiname: 'x.pdf', mimeType: 'application/pdf', groesse: 1000,
})
check('Eine erfundene Kategorie wird abgewiesen',
  unbekannteArt.status === 400, `HTTP ${unbekannteArt.status}`)

const ohneAkte = await platzFragen(leitung, {
  ownerType: 'employee', kategorie: 'bescheinigung',
  dateiname: 'x.pdf', mimeType: 'application/pdf', groesse: 1000,
})
check('Ohne Akte gibt es keinen Platz', ohneAkte.status === 400, `HTTP ${ohneAkte.status}`)

const ausfuehrbar = await platzFragen(leitung, {
  ownerType: 'employee', ownerId: annaId, kategorie: 'sonstiges',
  dateiname: 'setup.exe', mimeType: 'application/x-msdownload', groesse: 1000,
})
check('Und für eine ausführbare Datei auch nicht — schon vor dem Hochladen',
  ausfuehrbar.status === 400, `HTTP ${ausfuehrbar.status}`)

// ── §261 Der Vermerk ohne Unterschrift ────────────────────────────────────
console.log('\n=== §261 Ein Schlüssel ohne Unterschrift gilt nicht ===')

const heute = new Date().toISOString().slice(0, 10)
const eigenerOrdner = `akte/employee/${annaId}/${heute}/erfunden0123456789abcdef.jpg`

const ohneNachweis = await sende(anna, '/api/files', 'POST', {
  ownerType: 'employee', ownerId: annaId, kategorie: 'krankenschein',
  objektSchluessel: eigenerOrdner,
  dateiname: 'Schein.jpg', mimeType: 'image/jpeg',
})
check('Ein Schlüssel aus dem EIGENEN Ordner, aber ohne Unterschrift: abgewiesen',
  ohneNachweis.status === 403, `HTTP ${ohneNachweis.status} ${ohneNachweis.body.error ?? ''}`)

const erfundenerNachweis = await sende(anna, '/api/files', 'POST', {
  ownerType: 'employee', ownerId: annaId, kategorie: 'krankenschein',
  objektSchluessel: eigenerOrdner,
  nachweis: `${Math.floor(Date.now() / 1000) + 9999}.selbstAusgedacht`,
  dateiname: 'Schein.jpg', mimeType: 'image/jpeg',
})
check('Eine selbst ausgedachte Unterschrift auch',
  erfundenerNachweis.status === 403, `HTTP ${erfundenerNachweis.status}`)

const fremderOrdner = await sende(anna, '/api/files', 'POST', {
  ownerType: 'employee', ownerId: annaId, kategorie: 'krankenschein',
  objektSchluessel: `akte/employee/${fremd.id}/${heute}/abc.jpg`,
  nachweis: `${Math.floor(Date.now() / 1000) + 9999}.selbstAusgedacht`,
  dateiname: 'Schein.jpg', mimeType: 'image/jpeg',
})
check('Und ein Schlüssel aus einer FREMDEN Akte erst recht',
  fremderOrdner.status === 403, `HTTP ${fremderOrdner.status}`)

/*
 * Die Reihenfolge der Türen ist selbst eine Aussage: Die Zugriffsprüfung läuft
 * VOR dem Schlüssel. Sonst verriete die Antwort, ob es einen solchen Platz
 * gibt — bei fremden Akten wäre das schon eine Auskunft.
 */
const fremdeAkteVermerk = await sende(anna, '/api/files', 'POST', {
  ownerType: 'employee', ownerId: fremd.id, kategorie: 'krankenschein',
  objektSchluessel: `akte/employee/${fremd.id}/${heute}/abc.jpg`,
  dateiname: 'Schein.jpg', mimeType: 'image/jpeg',
})
check('In eine fremde Akte wird auch nichts vermerkt',
  fremdeAkteVermerk.status === 403 || fremdeAkteVermerk.status === 404,
  `HTTP ${fremdeAkteVermerk.status}`)

/*
 * Die Gegenprobe zu den vier Zeilen darüber: Eine GÜLTIGE Unterschrift kommt
 * durch die Riegel — und scheitert erst am Speicher, weil dort nichts liegt.
 *
 * Ohne diese Zeile wäre nicht gezeigt, dass die Tür überhaupt aufgeht. Eine
 * Tür, die alles abweist, besteht jede Sicherheitsprüfung und ist trotzdem
 * kaputt; genau diese Verwechslung ist in §253 schon einmal passiert.
 *
 * Erwartet wird 409 „nicht angekommen" — nicht 500. Dass die Anwendung einen
 * fehlenden Gegenstand im Speicher sauber beantwortet statt zu stolpern, ist
 * der zweite Teil dieser Prüfung.
 */
const mitEchterUnterschrift = await sende(anna, '/api/files', 'POST', {
  ownerType: 'employee', ownerId: annaId, kategorie: 'krankenschein',
  objektSchluessel: eigenerOrdner,
  nachweis: nachweisAusstellen(eigenerOrdner, `akte:employee:${annaId}:krankenschein`),
  dateiname: 'Schein.jpg', mimeType: 'image/jpeg',
})
check('Mit gültiger Unterschrift geht die Tür auf — und scheitert erst am Speicher',
  mitEchterUnterschrift.status === 409,
  `HTTP ${mitEchterUnterschrift.status} ${mitEchterUnterschrift.body.error ?? ''}`)

/*
 * Und die Verschiebung: dieselbe Unterschrift, andere Kategorie. Ein Platz für
 * eine Bescheinigung darf nicht zur Lohnabrechnung werden — sonst legte sich
 * jemand eine Datei in eine Kategorie, die er nicht einreichen darf.
 */
const verschoben = await sende(leitung, '/api/files', 'POST', {
  ownerType: 'employee', ownerId: annaId, kategorie: 'lohnabrechnung',
  objektSchluessel: eigenerOrdner,
  nachweis: nachweisAusstellen(eigenerOrdner, `akte:employee:${annaId}:krankenschein`),
  dateiname: 'Schein.jpg', mimeType: 'image/jpeg',
})
check('Dieselbe Unterschrift gilt NICHT für eine andere Kategorie',
  verschoben.status === 403, `HTTP ${verschoben.status}`)

// ── §260 Dasselbe für den Chat-Anhang ─────────────────────────────────────
console.log('\n=== §260 Der Anhang im Gespräch ===')

const raeume = (await hole(anna, '/api/chat')).body.raeume ?? []
const meinRaum = raeume.find(r => r.art === 'direkt' || r.art === 'gruppe') ?? raeume[0]
if (!meinRaum) throw new Error('Kein Gespräch vorhanden — Prüfung nicht aussagekräftig.')

/*
 * Ein Gespräch, in dem Anna NICHT ist. Ohne das wäre „fremdes Gespräch" nicht
 * geprüft, sondern nur behauptet.
 */
const fremderRaum = await prisma.chatRaum.findFirst({
  where: { mitglieder: { none: { userId: meAnna.id } } },
  select: { id: true },
})

const chatOhneNachweis = await sende(anna, `/api/chat/${meinRaum.id}/datei`, 'POST', {
  objektSchluessel: `chat/${meinRaum.id}/${heute}/erfunden.jpg`,
  dateiname: 'Foto.jpg', mimeType: 'image/jpeg',
})
check('Ein Anhang ohne Unterschrift wird nicht vermerkt',
  chatOhneNachweis.status === 403,
  `HTTP ${chatOhneNachweis.status} ${chatOhneNachweis.body.error ?? ''}`)

if (fremderRaum) {
  const quer = await sende(anna, `/api/chat/${meinRaum.id}/datei`, 'POST', {
    objektSchluessel: `chat/${fremderRaum.id}/${heute}/erfunden.jpg`,
    nachweis: `${Math.floor(Date.now() / 1000) + 9999}.selbstAusgedacht`,
    dateiname: 'Foto.jpg', mimeType: 'image/jpeg',
  })
  check('Ein Schlüssel aus einem FREMDEN Gespräch wird abgewiesen',
    quer.status === 403, `HTTP ${quer.status}`)
} else {
  check('Ein Schlüssel aus einem FREMDEN Gespräch wird abgewiesen',
    false, 'Kein fremdes Gespräch in den Daten — nicht geprüft.')
}

const chatEigenerPlatz = `chat/${meinRaum.id}/${heute}/erfunden0123456789abcdef.jpg`
const chatMitUnterschrift = await sende(anna, `/api/chat/${meinRaum.id}/datei`, 'POST', {
  objektSchluessel: chatEigenerPlatz,
  nachweis: nachweisAusstellen(chatEigenerPlatz, `chat:${meinRaum.id}`),
  dateiname: 'Foto.jpg', mimeType: 'image/jpeg',
})
check('Mit gültiger Unterschrift geht die Tür auf — und scheitert erst am Speicher',
  chatMitUnterschrift.status === 409,
  `HTTP ${chatMitUnterschrift.status} ${chatMitUnterschrift.body.error ?? ''}`)

const chatOhneSchluessel = await sende(anna, `/api/chat/${meinRaum.id}/datei`, 'POST', {
  dateiname: 'Foto.jpg', mimeType: 'image/jpeg',
})
check('Ohne Schlüssel kommt eine Angabe-Meldung, keine 500',
  chatOhneSchluessel.status === 400, `HTTP ${chatOhneSchluessel.status}`)

// ── Der ganze Weg, wenn ein Speicher eingerichtet ist ─────────────────────
console.log('\n=== §260 Der vollständige Weg ===')

const chatPlatz = await sende(anna, `/api/chat/${meinRaum.id}/datei/adresse`, 'POST', {
  dateiname: 'Nachweis260.png', mimeType: 'image/png', groesse: 70,
})

if (chatPlatz.status === 200 && chatPlatz.body.speicher === 'an') {
  // Ein echtes, kleinstes PNG — die Typerkennung sieht sich die ersten Bytes
  // an, ein Textschnipsel würde zu Recht abgewiesen.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  )

  const put = await fetch(chatPlatz.body.adresse, {
    method: 'PUT',
    headers: { 'content-type': chatPlatz.body.typ },
    body: png,
  })
  check('Die Datei lässt sich direkt im Speicher ablegen', put.ok,
    `HTTP ${put.status}`)

  const vermerkt = await sende(anna, `/api/chat/${meinRaum.id}/datei`, 'POST', {
    objektSchluessel: chatPlatz.body.schluessel,
    nachweis: chatPlatz.body.nachweis,
    dateiname: chatPlatz.body.dateiname,
    mimeType: chatPlatz.body.typ,
    text: 'Nachweis §260',
  })
  check('Und mit der eigenen Unterschrift wird sie vermerkt',
    vermerkt.status === 200, `HTTP ${vermerkt.status} ${vermerkt.body.error ?? ''}`)

  const dateiId = vermerkt.body?.nachricht?.datei?.id
  check('Die wahre Größe kommt aus dem Speicher, nicht aus der Meldung',
    vermerkt.body?.nachricht?.datei?.groesse === png.length,
    `gemeldet 70, im Speicher ${png.length}, eingetragen ${vermerkt.body?.nachricht?.datei?.groesse}`)

  if (dateiId) {
    const abruf = await fetch(`${BASIS}/api/chat/${meinRaum.id}/datei?id=${dateiId}`, {
      headers: { cookie: anna }, redirect: 'manual',
    })
    check('Der Abruf leitet in den Speicher um statt durchzureichen',
      abruf.status === 302, `HTTP ${abruf.status}`)
    const ziel = abruf.headers.get('location') ?? ''
    check('Und die Umleitung trägt den richtigen Namen mit',
      decodeURIComponent(ziel).includes('Nachweis260.png'),
      ziel.slice(0, 120))

    // §260 Die Unterschrift darf sich nicht ein zweites Mal einlösen lassen,
    // sonst hinge an einem Platz beliebig viele Einträge.
    const zweimal = await sende(anna, `/api/chat/${meinRaum.id}/datei`, 'POST', {
      objektSchluessel: chatPlatz.body.schluessel,
      nachweis: chatPlatz.body.nachweis,
      dateiname: chatPlatz.body.dateiname,
      mimeType: chatPlatz.body.typ,
    })
    check('Ein Platz lässt sich nicht zweimal einlösen',
      zweimal.status === 409, `HTTP ${zweimal.status}`)

    // Aufräumen: Was diese Prüfung angelegt hat, räumt sie weg.
    await prisma.chatNachricht.deleteMany({ where: { dateiId } })
    await prisma.storedFile.deleteMany({ where: { id: dateiId } })
  }
} else {
  console.log('  ⊘ ÜBERSPRUNGEN  Kein Objektspeicher in dieser Umgebung eingerichtet.')
  console.log('                  Die Riegel oben sind davon unabhängig und wurden geprüft.')
  console.log('                  Der vollständige Weg lässt sich nur dort nachweisen, wo')
  console.log('                  R2_DATEIEN_* gesetzt ist — im Betrieb über /okun/speicher.')
}

const fails = bilanz()
await prisma.$disconnect()
process.exit(fails > 0 ? 1 : 0)
