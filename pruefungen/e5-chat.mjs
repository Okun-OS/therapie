// Nachweis E5: Nachrichten zwischen Mitarbeitern, Gruppen der Standortleitung.
//
// Der gefährliche Teil eines Chats ist nicht das Senden, sondern das Lesen.
// Geprüft wird deshalb vor allem, wer NICHT hineinkommt: der Kollege, der nicht
// im Gespräch ist; die Leitung, die ein Gespräch zu zweit sehen will; der
// andere Mandant; OKUN.

import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const anna = await login('anna.fischer@rheinblick-reha.de')
const thomas = await login('thomas.weber@rheinblick-reha.de')
const maria = await login('maria.schneider@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const susi = await login('susi.sonnenschein@kita-sonnenschein.de')
const okun = await login('okun@okun.de')

const ich = async c => (await hole(c, '/api/auth/me')).body.user
const [mAnna, mThomas, mMaria, mLeitung, mSusi] = await Promise.all(
  [anna, thomas, maria, leitung, susi].map(ich))

console.log(`Anna ${String(mAnna.employeeId).slice(0, 8)} · `
  + `Thomas ${String(mThomas.employeeId).slice(0, 8)} · `
  + `Leitung ${String(mLeitung.employeeId).slice(0, 8)}\n`)

// ── E5 Wen man überhaupt erreicht ──────────────────────────────────────────
console.log('=== E5 Wen man erreicht ===')

const partnerAnna = (await hole(anna, '/api/chat/partner')).body.partner ?? []
check('Kollegen des eigenen Standorts stehen zur Auswahl',
  partnerAnna.some(p => p.id === mThomas.employeeId),
  `${partnerAnna.length} Personen`)
check('Man selbst steht nicht in der eigenen Liste',
  !partnerAnna.some(p => p.id === mAnna.employeeId))
check('Der andere Mandant taucht nicht auf',
  !partnerAnna.some(p => p.id === mSusi.employeeId))
check('Die Standortleitung ist erreichbar — sie ist selbst Mitarbeiterin',
  partnerAnna.some(p => p.id === mLeitung.employeeId))

const partnerOkun = (await hole(okun, '/api/chat/partner')).body.partner ?? []
check('OKUN hat niemanden zum Anschreiben', partnerOkun.length === 0,
  `${partnerOkun.length} Personen`)

const okunVersuch = await sende(okun, '/api/chat', 'POST', {
  art: 'direkt', employeeId: mAnna.employeeId,
})
check('OKUN kann kein Gespräch beginnen', okunVersuch.status === 403,
  `HTTP ${okunVersuch.status}`)

// ── E5 Gespräch zu zweit ───────────────────────────────────────────────────
console.log('\n=== E5 Gespräch zu zweit ===')

const eroeffnet = await sende(anna, '/api/chat', 'POST', {
  art: 'direkt', employeeId: mThomas.employeeId,
})
check('Anna beginnt ein Gespräch mit Thomas', eroeffnet.status === 200 && !!eroeffnet.body.raum,
  eroeffnet.body.error)
const raumId = eroeffnet.body.raum?.id

// Beide gleichzeitig: ohne eindeutigen Schluessel gaebe es zwei Raeume und
// jeder saehe nur seine Haelfte des Gespraechs.
const nochmal = await sende(anna, '/api/chat', 'POST', {
  art: 'direkt', employeeId: mThomas.employeeId,
})
check('Ein zweiter Versuch öffnet dasselbe Gespräch',
  nochmal.body.raum?.id === raumId && nochmal.body.neu === false)

const andersherum = await sende(thomas, '/api/chat', 'POST', {
  art: 'direkt', employeeId: mAnna.employeeId,
})
check('Auch von der anderen Seite ist es dasselbe Gespräch',
  andersherum.body.raum?.id === raumId, `${andersherum.body.raum?.id?.slice(0, 8)}`)

const leer = await sende(anna, `/api/chat/${raumId}`, 'POST', { text: '   ' })
check('Eine leere Nachricht wird abgewiesen', leer.status === 400)

const zuLang = await sende(anna, `/api/chat/${raumId}`, 'POST', { text: 'x'.repeat(5000) })
check('Eine übermäßig lange Nachricht wird abgewiesen', zuLang.status === 400)

const gesendet = await sende(anna, `/api/chat/${raumId}`, 'POST', {
  text: 'Hallo Thomas, kannst du Freitag den Spätdienst übernehmen?',
})
check('Die Nachricht geht raus', gesendet.status === 200 && gesendet.body.nachricht?.vonMir === true)

const beiThomas = await hole(thomas, `/api/chat/${raumId}`)
check('Thomas sieht die Nachricht',
  (beiThomas.body.nachrichten ?? []).some(n => n.text.startsWith('Hallo Thomas')))
check('Bei ihm ist sie nicht als eigene markiert',
  (beiThomas.body.nachrichten ?? [])[0]?.vonMir === false)

// ── E5 Wer nicht hineinkommt ───────────────────────────────────────────────
console.log('\n=== E5 Wer nicht hineinkommt ===')

const durchMaria = await hole(maria, `/api/chat/${raumId}`)
check('Eine unbeteiligte Kollegin kommt nicht hinein', durchMaria.status === 404,
  `HTTP ${durchMaria.status}`)

const durchLeitung = await hole(leitung, `/api/chat/${raumId}`)
check('Auch die Standortleitung kommt nicht hinein', durchLeitung.status === 404,
  `HTTP ${durchLeitung.status}`)

const leitungBeitritt = await sende(leitung, `/api/chat/${raumId}`, 'PATCH', { beitreten: true })
check('Die Leitung kann sich nicht in ein Gespräch zu zweit einfügen',
  leitungBeitritt.status === 404, `HTTP ${leitungBeitritt.status}`)

const durchOkun = await hole(okun, `/api/chat/${raumId}`)
check('OKUN kommt nicht hinein', durchOkun.status === 404)

const fremdesSenden = await sende(maria, `/api/chat/${raumId}`, 'POST', { text: 'Hallo?' })
check('Wer nicht dabei ist, kann auch nicht hineinschreiben', fremdesSenden.status === 404)

const anFremden = await sende(anna, '/api/chat', 'POST', {
  art: 'direkt', employeeId: mSusi.employeeId,
})
check('Dem anderen Mandanten lässt sich nicht schreiben', anFremden.status === 403,
  `HTTP ${anFremden.status}`)

// ── E5 Ungelesen ───────────────────────────────────────────────────────────
console.log('\n=== E5 Ungelesene Nachrichten ===')

// Thomas hat den Raum oben abgerufen; das setzt seinen Lesestand.
const neu = await sende(anna, `/api/chat/${raumId}`, 'POST', { text: 'Und am Samstag?' })
check('Zweite Nachricht geht raus', neu.status === 200)

const zaehler = await hole(thomas, '/api/chat/ungelesen')
check('Thomas hat eine ungelesene Nachricht', zaehler.body.ungelesen >= 1,
  `${zaehler.body.ungelesen}`)

const listeThomas = (await hole(thomas, '/api/chat')).body.raeume ?? []
check('Sie steht am richtigen Gespräch',
  listeThomas.find(r => r.id === raumId)?.ungelesen >= 1)
check('Die Vorschau zeigt den letzten Satz',
  listeThomas.find(r => r.id === raumId)?.letzteNachricht?.text === 'Und am Samstag?')

const eigeneZaehlenNicht = await hole(anna, '/api/chat/ungelesen')
check('Die eigene Nachricht zählt für einen selbst nicht als ungelesen',
  (eigeneZaehlenNicht.body.ungelesen ?? 0) === 0, `${eigeneZaehlenNicht.body.ungelesen}`)

await sende(thomas, `/api/chat/${raumId}`, 'PATCH', { gelesen: true })
const danach = await hole(thomas, '/api/chat/ungelesen')
check('Nach dem Lesen ist der Zähler zurück', danach.body.ungelesen === 0,
  `${danach.body.ungelesen}`)

// ── E5 Gruppen ─────────────────────────────────────────────────────────────
console.log('\n=== E5 Gruppen der Standortleitung ===')

const durchMitarbeiter = await sende(anna, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Heimliche Runde', mitglieder: [mThomas.employeeId],
})
check('Ein Mitarbeiter eröffnet keine Gruppe', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const gruppe = await sende(leitung, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Frühdienst Station 1',
  beschreibung: 'Absprachen zum Frühdienst',
  mitglieder: [mAnna.employeeId, mThomas.employeeId],
})
check('Die Leitung eröffnet eine Gruppe', gruppe.status === 200 && !!gruppe.body.raum,
  gruppe.body.error)
const gruppenId = gruppe.body.raum?.id

const mitFremdem = await sende(leitung, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Quer durchs Haus', mitglieder: [mSusi.employeeId],
})
check('In eine Gruppe kommt niemand aus einem fremden Standort',
  mitFremdem.status === 403, `HTTP ${mitFremdem.status}`)

const beiAnna = await hole(anna, `/api/chat/${gruppenId}`)
check('Anna ist drin und sieht die Gruppe', beiAnna.status === 200
  && beiAnna.body.raum?.titel === 'Frühdienst Station 1')
check('Der Verlauf beginnt mit einem Hinweis, wer sie eröffnet hat',
  (beiAnna.body.nachrichten ?? [])[0]?.art === 'system')
check('Alle drei sind Mitglied', (beiAnna.body.mitglieder ?? []).length === 3,
  `${beiAnna.body.mitglieder?.length}`)
check('Anna darf die Gruppe nicht verwalten', beiAnna.body.raum?.darfVerwalten === false)

const nichtMitglied = await hole(maria, `/api/chat/${gruppenId}`)
check('Wer nicht in der Gruppe ist, sieht sie nicht', nichtMitglied.status === 404)

const gruppenNachricht = await sende(anna, `/api/chat/${gruppenId}`, 'POST', {
  text: 'Ich bin Freitag da.',
})
check('In der Gruppe darf jedes Mitglied schreiben', gruppenNachricht.status === 200)

const beiThomasGruppe = await hole(thomas, `/api/chat/${gruppenId}`)
check('Thomas sieht Annas Beitrag mit ihrem Namen',
  (beiThomasGruppe.body.nachrichten ?? [])
    .some(n => n.text === 'Ich bin Freitag da.' && n.absenderName.includes('Anna')))

// ── E5 Verwalten ───────────────────────────────────────────────────────────
console.log('\n=== E5 Gruppe verwalten ===')

const durchAnna = await sende(anna, `/api/chat/${gruppenId}`, 'PATCH', {
  hinzufuegen: [mMaria.employeeId],
})
check('Ein Mitglied kann niemanden hinzufügen', durchAnna.status === 403,
  `HTTP ${durchAnna.status}`)

const dazu = await sende(leitung, `/api/chat/${gruppenId}`, 'PATCH', {
  hinzufuegen: [mMaria.employeeId],
})
check('Die Leitung fügt jemanden hinzu', dazu.status === 200, dazu.body.error)

const jetztDrin = await hole(maria, `/api/chat/${gruppenId}`)
check('Maria ist jetzt drin und sieht den bisherigen Verlauf',
  jetztDrin.status === 200
  && (jetztDrin.body.nachrichten ?? []).some(n => n.text === 'Ich bin Freitag da.'))
check('Der Beitritt steht sichtbar im Verlauf',
  (jetztDrin.body.nachrichten ?? []).some(n => n.art === 'system' && n.text.includes('hinzugefügt')))

const umbenannt = await sende(leitung, `/api/chat/${gruppenId}`, 'PATCH', {
  name: 'Frühdienst Station 1 und 2',
})
check('Die Leitung benennt die Gruppe um', umbenannt.status === 200)
const nachUmbenennen = await hole(anna, `/api/chat/${gruppenId}`)
check('Der neue Name kommt an',
  nachUmbenennen.body.raum?.titel === 'Frühdienst Station 1 und 2')

const raus = await sende(leitung, `/api/chat/${gruppenId}`, 'PATCH', {
  entfernen: mMaria.employeeId,
})
check('Die Leitung entfernt jemanden', raus.status === 200)
const wiederDraussen = await hole(maria, `/api/chat/${gruppenId}`)
check('Danach kommt Maria nicht mehr hinein', wiederDraussen.status === 404)

const verlassen = await sende(thomas, `/api/chat/${gruppenId}`, 'PATCH', { verlassen: true })
check('Ein Mitglied kann die Gruppe selbst verlassen', verlassen.status === 200)
check('Danach ist es draußen',
  (await hole(thomas, `/api/chat/${gruppenId}`)).status === 404)

const direktVerlassen = await sende(anna, `/api/chat/${raumId}`, 'PATCH', { verlassen: true })
check('Ein Gespräch zu zweit lässt sich nicht verlassen', direktVerlassen.status === 400,
  `HTTP ${direktVerlassen.status}`)

// ── E5 Schließen ───────────────────────────────────────────────────────────
console.log('\n=== E5 Gruppe schließen ===')

const geschlossen = await sende(leitung, `/api/chat/${gruppenId}`, 'PATCH', { archivieren: true })
check('Die Leitung schließt die Gruppe', geschlossen.status === 200)

const schreibenDanach = await sende(anna, `/api/chat/${gruppenId}`, 'POST', { text: 'Noch was?' })
check('In eine geschlossene Gruppe wird nicht mehr geschrieben',
  schreibenDanach.status === 409, `HTTP ${schreibenDanach.status}`)

const lesenDanach = await hole(anna, `/api/chat/${gruppenId}`)
check('Der Verlauf bleibt aber lesbar', lesenDanach.status === 200
  && lesenDanach.body.raum?.archiviert === true
  && (lesenDanach.body.nachrichten ?? []).some(n => n.text === 'Ich bin Freitag da.'))

const geoeffnet = await sende(leitung, `/api/chat/${gruppenId}`, 'PATCH', { archivieren: false })
check('Sie lässt sich wieder öffnen', geoeffnet.status === 200)
check('Danach geht das Schreiben wieder',
  (await sende(anna, `/api/chat/${gruppenId}`, 'POST', { text: 'Doch noch.' })).status === 200)

// ── E5 Verwaltungssicht und Beitritt ───────────────────────────────────────
console.log('\n=== E5 Mitlesen ist nicht verwalten ===')

// Eine Gruppe, in der die Leitung selbst nicht ist: sie richtet sie fuer das
// Team ein und zieht sich dann heraus — der uebliche Fall, wenn das Team etwas
// unter sich besprechen soll.
const ohneLeitung = await sende(leitung, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Nur das Team', mitglieder: [mAnna.employeeId, mThomas.employeeId],
})
const ohneId = ohneLeitung.body.raum?.id
check('Die Leitung richtet eine Gruppe für das Team ein', ohneLeitung.status === 200,
  ohneLeitung.body.error)
check('Und zieht sich wieder heraus',
  (await sende(leitung, `/api/chat/${ohneId}`, 'PATCH', { verlassen: true })).status === 200)

const nichtDrin = await hole(leitung, `/api/chat/${ohneId}`)
check('Die Leitung liest nicht mit, nur weil sie Leitung ist', nichtDrin.status === 404,
  `HTTP ${nichtDrin.status}`)

const verwaltungssicht = (await hole(leitung, '/api/chat/gruppen')).body.gruppen ?? []
const eintrag = verwaltungssicht.find(g => g.id === ohneId)
check('In der Verwaltungssicht steht die Gruppe trotzdem', !!eintrag,
  `${verwaltungssicht.length} Gruppen`)
check('Dort steht, dass sie nicht Mitglied ist', eintrag?.binMitglied === false)
check('Und wie viele darin sind', eintrag?.mitgliederAnzahl === 2,
  `${eintrag?.mitgliederAnzahl}`)

// §129 Ein Zugang ohne eigenen Mitarbeiterdatensatz — etwa eine
// Geschaeftsfuehrung, die an keinem Standort arbeitet — kann den Chat nicht
// nutzen. Das ist keine Panne, sondern die Folge davon, dass Nachrichten an
// Menschen am Standort gehen und nicht an Zugaenge.
const gf = await login('gf@rheinblick-reha.de')
const gfListe = await hole(gf, '/api/chat')
check('Ein Zugang ohne Mitarbeiterdatensatz bekommt eine klare Antwort',
  gfListe.status === 200 && gfListe.body.chatMoeglich === false,
  `chatMoeglich=${gfListe.body.chatMoeglich}`)

const mitarbeiterSicht = await hole(anna, '/api/chat/gruppen')
check('Ein Mitarbeiter bekommt die Verwaltungssicht nicht', mitarbeiterSicht.status === 403,
  `HTTP ${mitarbeiterSicht.status}`)

const beigetreten = await sende(leitung, `/api/chat/${ohneId}`, 'PATCH', { beitreten: true })
check('Die Leitung kann beitreten', beigetreten.status === 200)

const nachBeitritt = await hole(anna, `/api/chat/${ohneId}`)
check('Der Beitritt ist für alle sichtbar — niemand liest unbemerkt mit',
  (nachBeitritt.body.nachrichten ?? [])
    .some(n => n.art === 'system' && n.text.includes('liest ab jetzt mit')),
  (nachBeitritt.body.nachrichten ?? []).filter(n => n.art === 'system')
    .map(n => n.text).join(' | ').slice(0, 120))

const kitaLeitung = await login('leitung@kita-sonnenschein.de')
const fremdeVerwaltung = (await hole(kitaLeitung, '/api/chat/gruppen')).body.gruppen ?? []
check('Die Kita-Leitung sieht keine Gruppen des anderen Mandanten',
  !fremdeVerwaltung.some(g => g.id === ohneId || g.id === gruppenId),
  `${fremdeVerwaltung.length} eigene Gruppen`)

const fremderBeitritt = await sende(kitaLeitung, `/api/chat/${ohneId}`, 'PATCH', { beitreten: true })
check('Sie kann dort auch nicht beitreten', fremderBeitritt.status === 404,
  `HTTP ${fremderBeitritt.status}`)

process.exit(bilanz() > 0 ? 1 : 0)
