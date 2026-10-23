// Nachweis E5: Nachrichten zwischen Mitarbeitern, Gruppen der Standortleitung.
//
// Der gefährliche Teil eines Chats ist nicht das Senden, sondern das Lesen.
// Geprüft wird deshalb vor allem, wer NICHT hineinkommt: der Kollege, der nicht
// im Gespräch ist; die Leitung, die ein Gespräch zu zweit sehen will; der
// andere Mandant; OKUN.

import { BASIS, pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const anna = await login('anna.fischer@rheinblick-reha.de')
const thomas = await login('thomas.weber@rheinblick-reha.de')
const maria = await login('maria.schneider@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const susi = await login('susi.sonnenschein@kita-sonnenschein.de')
const okun = await login('okun@okun.de')

const gf = await login('gf@rheinblick-reha.de')

const ich = async c => (await hole(c, '/api/auth/me')).body.user
const [mAnna, mThomas, mMaria, mLeitung, mSusi, mGf] = await Promise.all(
  [anna, thomas, maria, leitung, susi, gf].map(ich))

// §131 Der Teilnehmer ist das Benutzerkonto, nicht der Mitarbeiterdatensatz.
// Sonst koennten Standortleitung und Geschaeftsfuehrung gar nicht mitreden —
// genau die zwei Rollen, die am meisten zu kommunizieren haben.
console.log(`Anna ${String(mAnna.id).slice(0, 8)} · `
  + `Thomas ${String(mThomas.id).slice(0, 8)} · `
  + `Leitung ${String(mLeitung.id).slice(0, 8)} · `
  + `GF ${String(mGf.id).slice(0, 8)}\n`)

// ── E5 Wen man überhaupt erreicht ──────────────────────────────────────────
console.log('=== E5 Wen man erreicht ===')

const partnerAnna = (await hole(anna, '/api/chat/partner')).body.partner ?? []
check('Kollegen des eigenen Standorts stehen zur Auswahl',
  partnerAnna.some(p => p.userId === mThomas.id),
  `${partnerAnna.length} Personen`)
check('Man selbst steht nicht in der eigenen Liste',
  !partnerAnna.some(p => p.userId === mAnna.id))
check('Der andere Mandant taucht nicht auf',
  !partnerAnna.some(p => p.userId === mSusi.id))
check('Die Standortleitung ist erreichbar — sie ist selbst Mitarbeiterin',
  partnerAnna.some(p => p.userId === mLeitung.id))

const partnerOkun = (await hole(okun, '/api/chat/partner')).body.partner ?? []
check('OKUN hat niemanden zum Anschreiben', partnerOkun.length === 0,
  `${partnerOkun.length} Personen`)

const okunVersuch = await sende(okun, '/api/chat', 'POST', {
  art: 'direkt', userId: mAnna.id,
})
check('OKUN kann kein Gespräch beginnen', okunVersuch.status === 403,
  `HTTP ${okunVersuch.status}`)

// ── E5 Gespräch zu zweit ───────────────────────────────────────────────────
console.log('\n=== E5 Gespräch zu zweit ===')

const eroeffnet = await sende(anna, '/api/chat', 'POST', {
  art: 'direkt', userId: mThomas.id,
})
check('Anna beginnt ein Gespräch mit Thomas', eroeffnet.status === 200 && !!eroeffnet.body.raum,
  eroeffnet.body.error)
const raumId = eroeffnet.body.raum?.id

// Beide gleichzeitig: ohne eindeutigen Schluessel gaebe es zwei Raeume und
// jeder saehe nur seine Haelfte des Gespraechs.
const nochmal = await sende(anna, '/api/chat', 'POST', {
  art: 'direkt', userId: mThomas.id,
})
check('Ein zweiter Versuch öffnet dasselbe Gespräch',
  nochmal.body.raum?.id === raumId && nochmal.body.neu === false)

const andersherum = await sende(thomas, '/api/chat', 'POST', {
  art: 'direkt', userId: mAnna.id,
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
  art: 'direkt', userId: mSusi.id,
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

// §143 Gezählt wird IN DIESEM Raum, nicht über alle.
//
// Vorher stand hier der Gesamtzähler auf null. Das stimmte nur, solange es
// ausser Kollegengesprächen nichts gab — seit es den Kanal zu OKUN gibt, hat
// jeder dort ungelesene Nachrichten (Rückmeldungen auf gemeldete Funde), und
// die Prüfung schlug fehl, obwohl das Gezählte richtig war. Eine Prüfung, die
// an fremdem Zustand hängt, prüft nicht das, was sie behauptet.
const listeAnna = (await hole(anna, '/api/chat')).body.raeume ?? []
check('Die eigene Nachricht zählt für einen selbst nicht als ungelesen',
  (listeAnna.find(r => r.id === raumId)?.ungelesen ?? -1) === 0,
  `${listeAnna.find(r => r.id === raumId)?.ungelesen}`)

await sende(thomas, `/api/chat/${raumId}`, 'PATCH', { gelesen: true })
const listeDanach = (await hole(thomas, '/api/chat')).body.raeume ?? []
check('Nach dem Lesen ist der Zähler zurück',
  (listeDanach.find(r => r.id === raumId)?.ungelesen ?? -1) === 0,
  `${listeDanach.find(r => r.id === raumId)?.ungelesen}`)

// ── E5 Gruppen ─────────────────────────────────────────────────────────────
console.log('\n=== E5 Gruppen der Standortleitung ===')

const durchMitarbeiter = await sende(anna, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Heimliche Runde', mitglieder: [mThomas.id],
})
check('Ein Mitarbeiter eröffnet keine Gruppe', durchMitarbeiter.status === 403,
  `HTTP ${durchMitarbeiter.status}`)

const gruppe = await sende(leitung, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Frühdienst Station 1',
  beschreibung: 'Absprachen zum Frühdienst',
  mitglieder: [mAnna.id, mThomas.id],
})
check('Die Leitung eröffnet eine Gruppe', gruppe.status === 200 && !!gruppe.body.raum,
  gruppe.body.error)
const gruppenId = gruppe.body.raum?.id

const mitFremdem = await sende(leitung, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Quer durchs Haus', mitglieder: [mSusi.id],
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
  hinzufuegen: [mMaria.id],
})
check('Ein Mitglied kann niemanden hinzufügen', durchAnna.status === 403,
  `HTTP ${durchAnna.status}`)

const dazu = await sende(leitung, `/api/chat/${gruppenId}`, 'PATCH', {
  hinzufuegen: [mMaria.id],
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
  entfernen: mMaria.id,
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
  art: 'gruppe', name: 'Nur das Team', mitglieder: [mAnna.id, mThomas.id],
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

// ── E5 Die Unternehmensebene ───────────────────────────────────────────────
//
// §131 Der Fehler, der im Betrieb sofort auffiel: Die Geschaeftsfuehrung hat
// ein Konto, aber keinen Mitarbeiterdatensatz — und konnte deshalb niemanden
// anschreiben. Ausgerechnet die Rolle, die mit allen Standorten reden muss.
console.log('\n=== E5 Die Unternehmensebene ===')

const gfListe = await hole(gf, '/api/chat')
check('Die Geschäftsführung kann den Chat benutzen',
  gfListe.status === 200 && gfListe.body.chatMoeglich === true,
  `chatMoeglich=${gfListe.body.chatMoeglich}`)

const partnerGf = (await hole(gf, '/api/chat/partner')).body.partner ?? []
check('Sie erreicht die Standortleitung',
  partnerGf.some(p => p.userId === mLeitung.id), `${partnerGf.length} Personen`)
check('Und die Mitarbeiter aller eigenen Standorte',
  partnerGf.some(p => p.userId === mAnna.id) && partnerGf.some(p => p.userId === mThomas.id))
check('Aber niemanden aus einem fremden Unternehmen',
  !partnerGf.some(p => p.userId === mSusi.id))
check('Zu jedem Namen steht, wer das ist',
  partnerGf.find(p => p.userId === mLeitung.id)?.rollenText === 'Standortleitung',
  partnerGf.find(p => p.userId === mLeitung.id)?.rollenText)

const gfAnLeitung = await sende(gf, '/api/chat', 'POST', {
  art: 'direkt', userId: mLeitung.id,
})
check('Sie kann die Standortleitung anschreiben', gfAnLeitung.status === 200,
  gfAnLeitung.body.error)
const gfRaum = gfAnLeitung.body.raum?.id
check('Und die Nachricht geht raus',
  (await sende(gf, `/api/chat/${gfRaum}`, 'POST', { text: 'Kurze Rückfrage zum Monatsabschluss.' }))
    .status === 200)
check('Die Leitung sieht sie',
  ((await hole(leitung, `/api/chat/${gfRaum}`)).body.nachrichten ?? [])
    .some(n => n.text.startsWith('Kurze Rückfrage')))

// Auch andersherum: ein Mitarbeiter muss seiner Geschaeftsfuehrung antworten
// koennen, sonst waere es kein Gespraech, sondern ein Rundschreiben.
check('Ein Mitarbeiter erreicht auch die Unternehmensebene',
  partnerAnna.some(p => p.userId === mGf.id),
  partnerAnna.map(p => p.rollenText).join(', ').slice(0, 80))

const gfGruppe = await sende(gf, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Alle Standortleitungen',
  beschreibung: 'Absprachen über die Häuser hinweg',
  mitglieder: [mLeitung.id],
})
check('Die Geschäftsführung kann eine Gruppe eröffnen', gfGruppe.status === 200,
  gfGruppe.body.error)
const gfGruppenId = gfGruppe.body.raum?.id
check('Die Leitung ist darin und sieht sie',
  (await hole(leitung, `/api/chat/${gfGruppenId}`)).status === 200)

const inFremderGruppe = await sende(gf, '/api/chat', 'POST', {
  art: 'gruppe', name: 'Quer durch die Kunden', mitglieder: [mSusi.id],
})
check('Über die Unternehmensgrenze geht auch für sie nichts',
  inFremderGruppe.status === 403, `HTTP ${inFremderGruppe.status}`)

// ── E5 Wer in der Auswahl fehlt ────────────────────────────────────────────
//
// §144 Der Fund aus dem Betrieb: „Wenn ich als Standortleitung die Mitarbeiter
// suche, findet er nicht alle." Das stimmt — im Chat sind Benutzerkonten die
// Teilnehmer, und wer nie angemeldet war, hat keins. Ihn trotzdem zur Auswahl
// zu stellen, waere schlimmer: Man setzte jemanden in eine Gruppe, in der er
// nie etwas liest. Richtig ist, die Luecke zu benennen.
console.log('\n=== E5 Wer fehlt, wird benannt ===')

const auswahl = (await hole(leitung, '/api/chat/partner')).body
check('Die Auswahl nennt, wie viele noch keinen Zugang haben',
  typeof auswahl.ohneZugang?.anzahl === 'number',
  `${auswahl.ohneZugang?.anzahl} ohne Zugang, ${(auswahl.partner ?? []).length} mit`)
check('Und nennt ein paar davon beim Namen, wenn es welche gibt',
  (auswahl.ohneZugang?.anzahl ?? 0) === 0
  || (auswahl.ohneZugang?.namen ?? []).length > 0,
  (auswahl.ohneZugang?.namen ?? []).join(', '))
check('Aber nicht alle — eine Liste mit vierzig Namen liest niemand',
  (auswahl.ohneZugang?.namen ?? []).length <= 5)

// Niemand ohne Zugang steht gleichzeitig in der Auswahl — sonst waere die
// Zahl eine Verdopplung statt einer Ergaenzung.
const namenMitZugang = new Set((auswahl.partner ?? []).map(p => p.name))
check('Wer fehlt, steht nicht gleichzeitig in der Auswahl',
  !(auswahl.ohneZugang?.namen ?? []).some(n => namenMitZugang.has(n)))

const auswahlMitarbeiter = (await hole(anna, '/api/chat/partner')).body
check('Auch ein Mitarbeiter bekommt die Angabe',
  typeof auswahlMitarbeiter.ohneZugang?.anzahl === 'number')

// Der fremde Mandant taucht in keiner der beiden Zahlen auf.
const fremdeAuswahl = (await hole(susi, '/api/chat/partner')).body
check('Die Zahl endet am eigenen Mandanten',
  !(fremdeAuswahl.ohneZugang?.namen ?? []).some(n => namenMitZugang.has(n)),
  `${fremdeAuswahl.ohneZugang?.anzahl} beim anderen Kunden`)

// ── §221 Dateien und Löschen ───────────────────────────────────────────────
console.log('\n=== §221 Dateien im Gespräch ===')

/*
 * Der Ausgangszustand: ein frisches Gespräch zwischen Anna und Thomas. Es
 * über eine vorhandene Unterhaltung zu legen hieße, auf deren Lesestand
 * angewiesen zu sein — und genau der entscheidet hier über das Ergebnis.
 */
const raum221 = (await sende(anna, '/api/chat', 'POST',
  { art: 'direkt', userId: mThomas.id })).body.raum
check('Ein Gespräch für die Prüfung steht', Boolean(raum221?.id), String(raum221?.id))

async function dateiSenden(cookie, raumId, name, typ, inhalt, text) {
  const form = new FormData()
  form.append('datei', new File([inhalt], name, { type: typ }))
  if (text) form.append('text', text)
  const r = await fetch(`${BASIS}/api/chat/${raumId}/datei`, {
    method: 'POST', headers: { cookie }, body: form,
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// Ein winziges PNG — echte Bytes, kein umbenannter Text.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64')

const bild = await dateiSenden(anna, raum221.id, 'dienstplan.png', 'image/png', png,
  'Der Plan von der Wand')
check('Ein Bild lässt sich schicken', bild.status === 200,
  `HTTP ${bild.status} · ${JSON.stringify(bild.body?.error ?? '')}`)
check('Es hängt als Datei an der Nachricht',
  Boolean(bild.body?.nachricht?.dateiId) && bild.body?.nachricht?.art === 'datei',
  JSON.stringify(bild.body?.nachricht?.art))

const ton = await dateiSenden(anna, raum221.id, 'sprachnachricht.m4a', 'audio/mp4',
  Buffer.from('nicht wirklich Ton, aber vom richtigen Typ'))
check('Eine Tonaufnahme auch', ton.status === 200,
  `HTTP ${ton.status} · ${JSON.stringify(ton.body?.error ?? '')}`)

const boese = await dateiSenden(anna, raum221.id, 'programm.exe',
  'application/x-msdownload', Buffer.from('MZ'))
check('Etwas Ausführbares NICHT', boese.status === 400,
  `HTTP ${boese.status} · ${String(boese.body?.error ?? '').slice(0, 60)}`)

const dateiId = bild.body?.nachricht?.dateiId
const holen = await fetch(`${BASIS}/api/chat/${raum221.id}/datei?id=${dateiId}`,
  { headers: { cookie: thomas } })
check('Der Empfänger kann sie holen', holen.status === 200, `HTTP ${holen.status}`)
check('Und bekommt den richtigen Typ',
  (holen.headers.get('content-type') ?? '').includes('image/png'),
  holen.headers.get('content-type') ?? '')

const fremdeDatei = await fetch(`${BASIS}/api/chat/${raum221.id}/datei?id=${dateiId}`,
  { headers: { cookie: maria } })
check('Eine Fremde kommt nicht an sie heran', fremdeDatei.status === 404,
  `HTTP ${fremdeDatei.status}`)

const verlauf221 = await hole(anna, `/api/chat/${raum221.id}`)
const bildNachricht = (verlauf221.body.nachrichten ?? []).find(n => n.dateiId === dateiId)
check('Der Verlauf nennt Name und Typ des Anhangs',
  bildNachricht?.dateiName === 'dienstplan.png' && bildNachricht?.dateiTyp === 'image/png',
  `${bildNachricht?.dateiName} · ${bildNachricht?.dateiTyp}`)

console.log('\n=== §221 Löschen: bei mir, oder für alle ===')

// Thomas hat noch nichts gelesen — jetzt lässt sich zurückziehen.
const frisch = await sende(anna, `/api/chat/${raum221.id}`, 'POST',
  { text: 'Vertippt, kommt gleich weg' })
check('Eine ungelesene Nachricht gilt als zurückziehbar',
  (await hole(anna, `/api/chat/${raum221.id}`)).body.nachrichten
    ?.find(n => n.id === frisch.body?.nachricht?.id)?.zurueckziehbar === true)

const zurueck = await fetch(
  `${BASIS}/api/chat/${raum221.id}?nachricht=${frisch.body.nachricht.id}&fuerAlle=1`,
  { method: 'DELETE', headers: { cookie: anna } })
check('Zurückziehen gelingt vor dem Lesen', zurueck.status === 200, `HTTP ${zurueck.status}`)
check('Und sie ist auch beim Empfänger fort',
  !((await hole(thomas, `/api/chat/${raum221.id}`)).body.nachrichten ?? [])
    .some(n => n.id === frisch.body.nachricht.id))

// Jetzt liest Thomas — danach geht es nicht mehr.
const bleibt = await sende(anna, `/api/chat/${raum221.id}`, 'POST',
  { text: 'Diese bleibt stehen' })
await sende(thomas, `/api/chat/${raum221.id}`, 'PATCH', { gelesen: true })

const zuSpaet = await fetch(
  `${BASIS}/api/chat/${raum221.id}?nachricht=${bleibt.body.nachricht.id}&fuerAlle=1`,
  { method: 'DELETE', headers: { cookie: anna } })
const zuSpaetGrund = await zuSpaet.json().catch(() => ({}))
check('Nach dem Lesen geht Zurückziehen NICHT mehr', zuSpaet.status === 409,
  `HTTP ${zuSpaet.status} · ${String(zuSpaetGrund.error ?? '').slice(0, 60)}`)
check('Und die Begründung sagt, warum',
  zuSpaetGrund.code === 'SCHON_GELESEN', String(zuSpaetGrund.code))

const nurBeiMir = await fetch(
  `${BASIS}/api/chat/${raum221.id}?nachricht=${bleibt.body.nachricht.id}`,
  { method: 'DELETE', headers: { cookie: anna } })
check('Bei mir wegräumen geht immer', nurBeiMir.status === 200, `HTTP ${nurBeiMir.status}`)
check('Bei mir ist sie weg',
  !((await hole(anna, `/api/chat/${raum221.id}`)).body.nachrichten ?? [])
    .some(n => n.id === bleibt.body.nachricht.id))
check('Beim anderen steht sie noch — das ist der Unterschied',
  ((await hole(thomas, `/api/chat/${raum221.id}`)).body.nachrichten ?? [])
    .some(n => n.id === bleibt.body.nachricht.id))

const fremdeNachricht = await fetch(
  `${BASIS}/api/chat/${raum221.id}?nachricht=${bleibt.body.nachricht.id}&fuerAlle=1`,
  { method: 'DELETE', headers: { cookie: thomas } })
check('Eine fremde Nachricht zieht niemand zurück',
  fremdeNachricht.status === 403 || fremdeNachricht.status === 409,
  `HTTP ${fremdeNachricht.status}`)

console.log('\n=== §221 Das ganze Gespräch bei mir ===')

const weg = await fetch(`${BASIS}/api/chat/${raum221.id}`,
  { method: 'DELETE', headers: { cookie: anna } })
check('Das Gespräch lässt sich bei mir löschen', weg.status === 200, `HTTP ${weg.status}`)
check('Es steht nicht mehr in meiner Liste',
  !((await hole(anna, '/api/chat')).body.raeume ?? []).some(r => r.id === raum221.id))
check('Mein Verlauf ist leer',
  ((await hole(anna, `/api/chat/${raum221.id}`)).body.nachrichten ?? []).length === 0)
check('Beim anderen steht alles unverändert',
  ((await hole(thomas, `/api/chat/${raum221.id}`)).body.nachrichten ?? []).length > 0,
  `${((await hole(thomas, `/api/chat/${raum221.id}`)).body.nachrichten ?? []).length} Nachrichten`)

await sende(thomas, `/api/chat/${raum221.id}`, 'POST', { text: 'Bist du noch da?' })
const wiederDa = (await hole(anna, '/api/chat')).body.raeume ?? []
check('Schreibt die andere Seite, taucht es wieder auf',
  wiederDa.some(r => r.id === raum221.id))
const nachWiederkehr = (await hole(anna, `/api/chat/${raum221.id}`)).body.nachrichten ?? []
check('Aber nur mit dem, was danach kam',
  nachWiederkehr.length === 1 && nachWiederkehr[0].text === 'Bist du noch da?',
  `${nachWiederkehr.length} Nachrichten`)

/*
 * Aufräumen: Ohne diese Zeile bliebe die letzte Nachricht ungelesen liegen,
 * und beim nächsten Durchlauf scheiterte weiter oben die Prüfung „Die eigene
 * Nachricht zählt für einen selbst nicht als ungelesen" — an Zustand aus dem
 * vorigen Lauf, nicht am Programm. Genau so ist es beim ersten Mal passiert.
 */
await sende(anna, `/api/chat/${raum221.id}`, 'PATCH', { gelesen: true })
check('Die Prüfung lässt nichts Ungelesenes zurück',
  ((await hole(anna, '/api/chat')).body.raeume ?? [])
    .find(r => r.id === raum221.id)?.ungelesen === 0)

process.exit(bilanz() > 0 ? 1 : 0)
