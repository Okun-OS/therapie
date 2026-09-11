// Nachweis G1/G2: Auskunft nach Art.15 DSGVO, Löschkonzept, Sperre nach Art.18.
//
// Warum diese Prüfung gegen das laufende System läuft und nicht gegen Attrappen:
// Beim Löschen ist der gefährliche Fehler nicht der, der auffällt. Er sieht so
// aus, dass ein Knopf gedrückt wird, eine Erfolgsmeldung erscheint — und in
// irgendeiner Tabelle bleiben die Daten liegen, weil niemand eine Abfrage dafür
// geschrieben hat. Das fällt nur auf, wenn man hinterher wirklich nachsieht.
//
// Die Prüfung legt deshalb eine eigene Person an, gibt ihr Daten in drei
// Kategorien — löschen, anonymisieren, sperren — und sieht anschließend nach,
// was tatsächlich passiert ist.

import { BASIS, pruefer, login, hole, sende, testMail } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const kollege = await login('anna.fischer@rheinblick-reha.de')

const meGf = (await hole(gf, '/api/auth/me')).body.user
const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId

// ── Die Person für den Nachweis ────────────────────────────────────────────
const mail = testMail('dsgvo')
const angelegt = await sende(gf, '/api/employees', 'POST', {
  name: 'Loeschkandidatin Nachweis', email: mail, position: 'Pflegefachkraft',
  weeklyHours: 20, workDaysPerWeek: 3, locationId,
})
const personId = angelegt.body.employee?.id
if (!personId) {
  console.log(`  ✗ FAIL  Testperson konnte nicht angelegt werden: ${angelegt.body.error}`)
  console.log('\n0/1 Checks bestanden')
  process.exit(1)
}
console.log(`Testperson ${personId.slice(0, 8)} · Standort ${locationId.slice(0, 8)}\n`)

// Daten in den drei Kategorien anlegen:
//   sperren       eine Fehlzeit (Aufbewahrung 6 Jahre)
//   anonymisieren ein Dienstplaneintrag
//   löschen       der Zugang (die Einladung entsteht beim Anlegen von selbst)
await sende(gf, '/api/absences', 'POST', {
  employeeId: personId, employeeName: 'Loeschkandidatin Nachweis', locationId,
  type: 'krank', startDate: '2026-03-02', endDate: '2026-03-04', days: 3,
})

// Eine Woche weit in der Zukunft — dort steht nichts, was andere Prüfungen brauchen.
const WOCHE = ['2029-07-02', '2029-07-03', '2029-07-04', '2029-07-05',
  '2029-07-06', '2029-07-07', '2029-07-08']
const dienste = (await hole(leitung, `/api/shifts?locationId=${locationId}`)).body.shifts ?? []
const dienstId = dienste[0]?.id
if (dienstId) {
  await sende(leitung, '/api/schedule-entries/save-week', 'POST', {
    locationId, weekDates: WOCHE,
    assignments: { [personId]: { '2029-07-03': { shiftId: dienstId } } },
    status: 'confirmed',
  })
}

// ── G1 Auskunft nach Art.15 ────────────────────────────────────────────────
console.log('=== G1 Auskunft nach Art.15 DSGVO ===')

const auskunft = await hole(gf, `/api/dsgvo/auskunft?employeeId=${personId}`)
check('Auskunft wird erstellt', auskunft.status === 200 && !!auskunft.body.person,
  auskunft.body.error ?? `${auskunft.body.bloecke?.length ?? 0} Bereiche`)

const bloecke = auskunft.body.bloecke ?? []
check('Enthält die Stammdaten', bloecke.some(b => b.id === 'stammdaten'))
check('Enthält die Fehlzeit', (bloecke.find(b => b.id === 'abwesenheiten')?.anzahl ?? 0) >= 1)
check('Nennt auch die Bereiche ohne Daten',
  Array.isArray(auskunft.body.ohneDaten) && auskunft.body.ohneDaten.length > 0,
  `${auskunft.body.ohneDaten?.length ?? 0} Bereiche ohne Daten`)

// Art.15 Abs.1 lit.d: die Aufbewahrungsdauer gehört ausdrücklich dazu.
// Ohne Austrittsdatum läuft keine Frist — das muss die Auskunft aushalten.
check('Ohne Austritt wird keine Frist behauptet',
  bloecke.every(b => b.aufbewahrungBis === null || b.aufbewahrungBis === undefined))

// Kein Passwort, kein Geräteschlüssel — auch nicht versteckt in einem Feld.
const alsText = JSON.stringify(auskunft.body)
check('Keine Passwörter oder Schlüssel in der Auskunft',
  !alsText.includes('passwordHash') && !alsText.includes('p256dh'))

const eigene = await hole(kollege, '/api/dsgvo/auskunft')
check('Jeder bekommt seine eigene Auskunft ohne Umweg',
  eigene.status === 200 && !!eigene.body.person, eigene.body.error ?? eigene.body.person?.name)

const fremde = await hole(kollege, `/api/dsgvo/auskunft?employeeId=${personId}`)
check('Ein Kollege bekommt keine fremde Auskunft', fremde.status === 403,
  `HTTP ${fremde.status}`)

const pdf = await fetch(`${BASIS}/api/dsgvo/auskunft?employeeId=${personId}&format=pdf`,
  { headers: { cookie: gf } })
const pdfBytes = Buffer.from(await pdf.arrayBuffer())
check('Auskunft gibt es auch als PDF',
  pdf.ok && pdfBytes.subarray(0, 4).toString() === '%PDF',
  `HTTP ${pdf.status} · ${pdfBytes.length} Bytes`)

// ── G2 Vorschau: was würde geschehen ───────────────────────────────────────
console.log('\n=== G2 Vorschau vor der Löschung ===')

const vorschau1 = await hole(gf, `/api/dsgvo/loeschung?employeeId=${personId}`)
check('Vorschau wird erstellt', vorschau1.status === 200 && Array.isArray(vorschau1.body.befunde))

// Zwei Bremsen, und beide müssen greifen: kein Austritt, noch aktiv.
check('Ohne Austrittsdatum wird gewarnt',
  (vorschau1.body.hindernisse ?? []).some(h => h.includes('Austrittsdatum')),
  (vorschau1.body.hindernisse ?? []).join(' | ').slice(0, 120))
check('Aktive Person wird nicht gelöscht',
  (vorschau1.body.hindernisse ?? []).some(h => h.includes('aktiv')))

const zuFrueh = await sende(gf, '/api/dsgvo/loeschung', 'POST', {
  employeeId: personId, bestaetigt: true,
})
check('Löschung wird abgelehnt, solange ein Hindernis besteht', zuFrueh.status === 409,
  `HTTP ${zuFrueh.status} · ${String(zuFrueh.body.error).slice(0, 90)}`)

// Austritt eintragen und inaktiv setzen — jetzt darf gelöscht werden.
await sende(gf, `/api/employees/${personId}/payroll-profile`, 'PUT', {
  austrittsdatum: '2026-06-30', personalnummer: 'P-DSGVO-1',
  iban: 'DE02120300000000202051', strasse: 'Teststr. 1', plz: '50667', ort: 'Köln',
})
await sende(gf, `/api/employees/${personId}`, 'PATCH', { active: false })

const vorschau = await hole(gf, `/api/dsgvo/loeschung?employeeId=${personId}`)
check('Nach Austritt und Inaktivierung steht der Löschung nichts entgegen',
  (vorschau.body.hindernisse ?? []).length === 0,
  (vorschau.body.hindernisse ?? []).join(' | '))

const befund = id => (vorschau.body.befunde ?? []).find(b => b.id === id)

// Der Kern des Ganzen: Lohn und Fehlzeiten dürfen NICHT gelöscht werden.
check('Fehlzeiten bleiben gesperrt statt gelöscht',
  befund('abwesenheiten')?.behandlung === 'sperren' && befund('abwesenheiten')?.frei === false)
check('Die Frist endet zum Jahresende, nicht am Austrittstag',
  befund('abwesenheiten')?.aufbewahrungBis === '2032-12-31',
  `${befund('abwesenheiten')?.aufbewahrungBis}`)
check('Das Lohnkonto ist mit sechs Jahren hinterlegt',
  befund('lohnkonto')?.fristJahre === 6 && befund('lohnkonto')?.grundlage?.includes('EStG'),
  befund('lohnkonto')?.grundlage)
check('Arbeitszeiten haben die kurze Frist von zwei Jahren',
  befund('zeiterfassung')?.aufbewahrungBis === '2028-12-31',
  `${befund('zeiterfassung')?.aufbewahrungBis}`)
check('Der Dienstplan wird anonymisiert, nicht gelöscht',
  befund('dienstplan')?.behandlung === 'anonymisieren')
check('Zugangsdaten werden gelöscht',
  befund('zugang')?.behandlung === 'loeschen' && befund('zugang')?.frei === true)
check('Vorschau sagt, ab wann restlos gelöscht werden kann',
  vorschau.body.restlosAb === '2036-12-31', `${vorschau.body.restlosAb}`)

const zugangVorher = befund('zugang')?.anzahl ?? 0
const planVorher = befund('dienstplan')?.anzahl ?? 0
check('Es gibt vor der Löschung überhaupt etwas zu löschen', zugangVorher > 0,
  `${zugangVorher} Zugangsdatensätze`)

// ── G2 Wer darf löschen ────────────────────────────────────────────────────
console.log('\n=== G2 Wer löschen darf ===')

const durchLeitung = await sende(leitung, '/api/dsgvo/loeschung', 'POST', {
  employeeId: personId, bestaetigt: true,
})
check('Die Standortleitung darf nicht löschen', durchLeitung.status === 403,
  `HTTP ${durchLeitung.status}`)

const durchMitarbeiter = await hole(kollege, `/api/dsgvo/loeschung?employeeId=${personId}`)
check('Ein Mitarbeiter sieht die Löschvorschau nicht', durchMitarbeiter.status === 403)

const ohneBestaetigung = await sende(gf, '/api/dsgvo/loeschung', 'POST', { employeeId: personId })
check('Ohne ausdrückliche Bestätigung wird nicht gelöscht', ohneBestaetigung.status === 400,
  `HTTP ${ohneBestaetigung.status}`)

// Noch ist nichts passiert — das ist der eigentliche Beweis der drei Checks oben.
const nochDa = await hole(gf, `/api/dsgvo/auskunft?employeeId=${personId}`)
check('Nach den abgewiesenen Versuchen sind die Daten unverändert da',
  nochDa.status === 200
  && (nochDa.body.bloecke ?? []).find(b => b.id === 'abwesenheiten')?.anzahl >= 1)

// ── G2 Die Löschung ────────────────────────────────────────────────────────
console.log('\n=== G2 Löschung ausführen ===')

const geloescht = await sende(gf, '/api/dsgvo/loeschung', 'POST', {
  employeeId: personId, bestaetigt: true,
})
check('Löschung läuft durch', geloescht.status === 200 && !!geloescht.body.bericht,
  geloescht.body.error)

const bericht = geloescht.body.bericht ?? {}
const zeile = id => (bericht.zeilen ?? []).find(z => z.id === id)

check('Der Bericht führt jede Datenart auf',
  (bericht.zeilen ?? []).length === (vorschau.body.befunde ?? []).length,
  `${bericht.zeilen?.length} Zeilen`)
check('Der Zugang wurde gelöscht',
  zeile('zugang')?.ergebnis === 'geloescht' && zeile('zugang')?.anzahl === zugangVorher,
  `${zeile('zugang')?.anzahl} von ${zugangVorher}`)
check('Die Fehlzeit wurde gesperrt, nicht gelöscht',
  zeile('abwesenheiten')?.ergebnis === 'gesperrt')
check('Der Bericht begründet die Sperre mit der Vorschrift',
  (zeile('abwesenheiten')?.begruendung ?? '').length > 30
  && zeile('abwesenheiten')?.aufbewahrungBis === '2032-12-31')
check('Die Person selbst bleibt gesperrt bestehen', bericht.person === 'gesperrt',
  bericht.person)

if (planVorher > 0) {
  check('Der Dienstplaneintrag wurde anonymisiert',
    zeile('dienstplan')?.ergebnis === 'anonymisiert' && zeile('dienstplan')?.anzahl === planVorher,
    `${zeile('dienstplan')?.anzahl} von ${planVorher}`)

  // Der harte Nachweis: der Eintrag ist noch da, gehört aber niemandem mehr.
  const plan = await hole(leitung,
    `/api/schedule-entries?locationId=${locationId}&dateFrom=2029-07-01&dateTo=2029-07-09`)
  // Genau eine Schicht war gesetzt. Die Datenart zählt mehr (Plan UND
  // Änderungsprotokoll) — hier geht es nur um den Plan selbst.
  const eintraege = plan.body.entries ?? []
  check('Die Schicht bleibt dem Betrieb erhalten', eintraege.length === 1,
    `${eintraege.length} Einträge`)
  check('Die Schicht gehört danach keiner Person mehr',
    eintraege.length > 0 && eintraege.every(e =>
      e.employeeId !== personId && String(e.employeeId).startsWith('anonym-')),
    eintraege.map(e => String(e.employeeId).slice(0, 14)).join(', '))
}

// ── G2 Was nach der Löschung noch abrufbar ist ─────────────────────────────
console.log('\n=== G2 Zustand nach der Löschung ===')

const danach = await hole(gf, `/api/dsgvo/auskunft?employeeId=${personId}`)
const danachBloecke = danach.body.bloecke ?? []
const anzahl = id => danachBloecke.find(b => b.id === id)?.anzahl ?? 0

check('Die Fehlzeit ist weiterhin vorhanden', anzahl('abwesenheiten') >= 1,
  `${anzahl('abwesenheiten')} Einträge`)
check('Der Zugang ist wirklich weg', anzahl('zugang') === 0)
check('Der Dienstplan hängt nicht mehr an der Person', anzahl('dienstplan') === 0)

// Die Bankverbindung ist für die Aufbewahrung nicht nötig — sie muss weg sein,
// obwohl die Lohnstammdaten selbst gesperrt bleiben.
const profil = await hole(gf, `/api/employees/${personId}/payroll-profile`)
check('Bankverbindung und Anschrift sind entfernt',
  !profil.body.profil?.iban && !profil.body.profil?.strasse,
  `IBAN ${profil.body.profil?.iban ?? '—'} · Straße ${profil.body.profil?.strasse ?? '—'}`)
check('Die Personalnummer bleibt — sie gehört zum Lohnkonto',
  profil.body.profil?.personalnummer === 'P-DSGVO-1',
  profil.body.profil?.personalnummer)

const vorschauDanach = await hole(gf, `/api/dsgvo/loeschung?employeeId=${personId}`)
check('Die Sperre ist vermerkt', !!vorschauDanach.body.gesperrtSeit,
  vorschauDanach.body.gesperrtSeit)
check('Der Löschvorgang ist protokolliert',
  (vorschauDanach.body.vorgaenge ?? []).length === 1,
  `${vorschauDanach.body.vorgaenge?.length} Vorgänge`)

const berichtPdf = await fetch(
  `${BASIS}/api/dsgvo/loeschung?employeeId=${personId}&format=pdf`, { headers: { cookie: gf } })
const berichtBytes = Buffer.from(await berichtPdf.arrayBuffer())
check('Der Löschbericht gibt es als PDF',
  berichtPdf.ok && berichtBytes.subarray(0, 4).toString() === '%PDF',
  `HTTP ${berichtPdf.status} · ${berichtBytes.length} Bytes`)

// Zweimal löschen darf nichts kaputtmachen — der zweite Lauf findet nur noch
// das, was ohnehin bleiben muss.
const nochmal = await sende(gf, '/api/dsgvo/loeschung', 'POST', {
  employeeId: personId, bestaetigt: true,
})
check('Ein zweiter Lauf ist gefahrlos', nochmal.status === 200
  && nochmal.body.bericht?.person === 'gesperrt', nochmal.body.error)
check('Er löscht nichts mehr, was schon weg ist',
  (nochmal.body.bericht?.zeilen ?? []).filter(z => z.ergebnis === 'geloescht').length === 0)

// ── G2 Wenn alle Fristen abgelaufen sind ───────────────────────────────────
//
// Aufbewahren ist eine Pflicht, keine Erlaubnis. Läuft die Frist ab, MUSS
// gelöscht werden — auch das Lohnkonto, auch der Personaldatensatz selbst.
// Eine zweite Person mit einem lange zurückliegenden Austritt zeigt, dass der
// Ablauf das auch wirklich tut, statt ewig zu sperren.
console.log('\n=== G2 Abgelaufene Fristen ===')

const altMail = testMail('dsgvo-alt')
const alt = await sende(gf, '/api/employees', 'POST', {
  name: 'Laengst Ausgeschieden', email: altMail, position: 'Pflegefachkraft',
  weeklyHours: 20, workDaysPerWeek: 3, locationId,
})
const altId = alt.body.employee?.id

if (altId) {
  await sende(gf, '/api/absences', 'POST', {
    employeeId: altId, employeeName: 'Laengst Ausgeschieden', locationId,
    type: 'krank', startDate: '2010-03-02', endDate: '2010-03-04', days: 3,
  })
  await sende(gf, `/api/employees/${altId}/payroll-profile`, 'PUT', {
    austrittsdatum: '2010-06-30', personalnummer: 'P-DSGVO-2',
  })
  await sende(gf, `/api/employees/${altId}`, 'PATCH', { active: false })

  const altVorschau = await hole(gf, `/api/dsgvo/loeschung?employeeId=${altId}`)
  check('Abgelaufene Fristen werden als frei erkannt',
    (altVorschau.body.befunde ?? []).every(b => b.frei === true))
  check('Es wird nichts mehr zur Sperre vorgemerkt',
    altVorschau.body.summe?.gesperrt === 0, `${altVorschau.body.summe?.gesperrt} gesperrt`)

  const altGeloescht = await sende(gf, '/api/dsgvo/loeschung', 'POST', {
    employeeId: altId, bestaetigt: true,
  })
  check('Auch die Fehlzeit von 2010 wird gelöscht',
    (altGeloescht.body.bericht?.zeilen ?? [])
      .find(z => z.id === 'abwesenheiten')?.ergebnis === 'geloescht')
  check('Der Personaldatensatz selbst verschwindet',
    altGeloescht.body.bericht?.person === 'geloescht', altGeloescht.body.bericht?.person)

  const weg = await hole(gf, `/api/dsgvo/auskunft?employeeId=${altId}`)
  check('Danach ist die Person nicht mehr auffindbar', weg.status === 404,
    `HTTP ${weg.status}`)

  // Der Nachweis der Löschung bleibt — sonst könnte niemand mehr belegen,
  // dass ordnungsgemäß gelöscht wurde. Weil es die Person nicht mehr gibt,
  // führt der Weg über die Liste, nicht über ihre Kennung.
  const liste = await hole(gf, '/api/dsgvo/loeschung')
  check('Der Nachweis der Löschung bleibt erhalten',
    (liste.body.vorgaenge ?? []).some(v => v.employeeId === altId),
    `${liste.body.vorgaenge?.length ?? 0} Vorgänge insgesamt`)
}

// ── G2 Jahreslauf ──────────────────────────────────────────────────────────
console.log('\n=== G2 Jahreslauf für abgelaufene Fristen ===')

const okun = await login('okun@okun.de')
const durchGf = await sende(gf, '/api/dsgvo/loeschung', 'POST', { aufraeumen: true })
check('Der Jahreslauf ist nicht für den Kunden', durchGf.status === 403,
  `HTTP ${durchGf.status}`)

const lauf = await sende(okun, '/api/dsgvo/loeschung', 'POST', { aufraeumen: true })
check('OKUN kann den Jahreslauf auslösen', lauf.status === 200,
  `${lauf.body.anzahl ?? 0} Personen geräumt`)

process.exit(bilanz() > 0 ? 1 : 0)
