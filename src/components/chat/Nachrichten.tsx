'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageSquare, Users, Plus, Search, Send, Settings2, X, Check,
  AlertTriangle, Archive, LogOut, UserPlus, Lock,
} from 'lucide-react'

/**
 * §129 Nachrichten.
 *
 * Eine Seite für alle Rollen — der Chat einer Pflegekraft und der ihrer Leitung
 * unterscheiden sich nur darin, ob der Knopf „Gruppe eröffnen" da ist. Zwei
 * getrennte Oberflächen für dieselbe Sache wären doppelte Arbeit und würden
 * schon nach dem ersten Umbau auseinanderlaufen.
 *
 * Was hier bewusst NICHT passiert: Es gibt keine Lesebestätigung für andere und
 * keine Anzeige „schreibt gerade". Beides erzeugt in einem Betrieb Druck —
 * jemand sieht, dass gelesen und nicht geantwortet wurde. Der Lesestand ist
 * ausschließlich für den eigenen Ungelesen-Zähler da.
 */

interface Raum {
  id: string
  art: 'direkt' | 'gruppe'
  titel: string
  beschreibung?: string | null
  archiviert: boolean
  mitgliederAnzahl: number
  darfVerwalten: boolean
  letzteNachricht?: { text: string; absenderName: string; createdAt: string; art: string } | null
  ungelesen: number
  letzteAktivitaet: string
}

interface Partner {
  userId: string
  name: string
  rollenText: string
  standort?: string | null
  position?: string | null
}

interface Mitglied {
  userId: string
  name: string
  position: string | null
  rolle: string
  ichSelbst: boolean
}

interface Nachricht {
  id: string
  text: string
  art: string
  absenderName: string
  vonMir: boolean
  createdAt: string
}

interface Gruppe {
  id: string
  name: string | null
  beschreibung: string | null
  archiviert: boolean
  mitgliederAnzahl: number
  binMitglied: boolean
  letzteAktivitaet: string
}

const uhrzeit = (iso: string) => {
  const d = new Date(iso)
  const heute = new Date()
  const gleicherTag = d.toDateString() === heute.toDateString()
  return gleicherTag
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function Nachrichten({ darfGruppen }: { darfGruppen: boolean }) {
  const [raeume, setRaeume] = useState<Raum[]>([])
  const [offen, setOffen] = useState<string | null>(null)
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([])
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([])
  const [kopf, setKopf] = useState<{
    titel: string; art: string; beschreibung?: string | null
    archiviert: boolean; darfVerwalten: boolean
  } | null>(null)
  const [entwurf, setEntwurf] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(true)
  const [sendet, setSendet] = useState(false)
  const [moeglich, setMoeglich] = useState(true)

  const [maske, setMaske] = useState<'keine' | 'direkt' | 'gruppe' | 'verwalten' | 'gruppenliste'>('keine')
  const [partner, setPartner] = useState<Partner[]>([])
  const [suche, setSuche] = useState('')
  const [gruppenName, setGruppenName] = useState('')
  const [gruppenText, setGruppenText] = useState('')
  const [gewaehlte, setGewaehlte] = useState<string[]>([])
  const [gruppen, setGruppen] = useState<Gruppe[]>([])

  const ende = useRef<HTMLDivElement>(null)

  const listeLaden = useCallback(async () => {
    try {
      const r = await fetch('/api/chat')
      const d = await r.json()
      setRaeume(d.raeume ?? [])
      setMoeglich(d.chatMoeglich !== false)
    } catch { setFehler('Gespräche konnten nicht geladen werden') }
    finally { setLaedt(false) }
  }, [])

  const raumLaden = useCallback(async (id: string, scrollen = true) => {
    try {
      const r = await fetch(`/api/chat/${id}`)
      if (!r.ok) { setFehler('Gespräch nicht gefunden'); setOffen(null); return }
      const d = await r.json()
      setKopf(d.raum); setMitglieder(d.mitglieder ?? []); setNachrichten(d.nachrichten ?? [])
      await fetch(`/api/chat/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gelesen: true }),
      })
      setRaeume(prev => prev.map(x => x.id === id ? { ...x, ungelesen: 0 } : x))
      if (scrollen) setTimeout(() => ende.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { setFehler('Gespräch konnte nicht geladen werden') }
  }, [])

  useEffect(() => { listeLaden() }, [listeLaden])

  // Regelmäßig nachsehen. Kein Live-Kanal: für einen Betriebschat sind zehn
  // Sekunden schnell genug, und eine dauerhafte Verbindung je Gerät wäre
  // Aufwand, der sich hier nicht auszahlt.
  useEffect(() => {
    const takt = setInterval(() => {
      listeLaden()
      if (offen) raumLaden(offen, false)
    }, 10000)
    return () => clearInterval(takt)
  }, [offen, listeLaden, raumLaden])

  async function oeffnen(id: string) {
    setOffen(id); setNachrichten([]); setFehler(''); setMaske('keine')
    await raumLaden(id)
  }

  async function senden() {
    if (!offen || !entwurf.trim()) return
    setSendet(true); setFehler('')
    try {
      const r = await fetch(`/api/chat/${offen}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: entwurf }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Nachricht konnte nicht gesendet werden'); return }
      setNachrichten(prev => [...prev, d.nachricht])
      setEntwurf('')
      setTimeout(() => ende.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      listeLaden()
    } catch { setFehler('Nachricht konnte nicht gesendet werden') }
    finally { setSendet(false) }
  }

  async function partnerLaden() {
    const r = await fetch('/api/chat/partner')
    const d = await r.json().catch(() => ({}))
    setPartner(d.partner ?? [])
  }

  async function direktStarten(userId: string) {
    setFehler('')
    const r = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ art: 'direkt', userId }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setFehler(d.error ?? 'Gespräch konnte nicht begonnen werden'); return }
    setMaske('keine'); setSuche('')
    await listeLaden()
    await oeffnen(d.raum.id)
  }

  async function gruppeAnlegen() {
    setFehler('')
    const r = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        art: 'gruppe', name: gruppenName, beschreibung: gruppenText, mitglieder: gewaehlte,
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setFehler(d.error ?? 'Gruppe konnte nicht angelegt werden'); return }
    setMaske('keine'); setGruppenName(''); setGruppenText(''); setGewaehlte([]); setSuche('')
    await listeLaden()
    await oeffnen(d.raum.id)
  }

  async function raumAendern(daten: Record<string, unknown>) {
    if (!offen) return
    setFehler('')
    const r = await fetch(`/api/chat/${offen}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setFehler(d.error ?? 'Änderung fehlgeschlagen'); return }
    if (daten.verlassen) { setOffen(null); setMaske('keine'); await listeLaden(); return }
    await raumLaden(offen, false)
    await listeLaden()
  }

  async function gruppenlisteLaden() {
    const r = await fetch('/api/chat/gruppen')
    const d = await r.json().catch(() => ({}))
    setGruppen(d.gruppen ?? [])
    setMaske('gruppenliste')
  }

  async function beitreten(id: string) {
    setFehler('')
    const r = await fetch(`/api/chat/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beitreten: true }),
    })
    if (!r.ok) { setFehler('Beitritt fehlgeschlagen'); return }
    await listeLaden()
    await oeffnen(id)
  }

  const gefilterterPartner = partner.filter(p =>
    p.name.toLowerCase().includes(suche.toLowerCase()))
  const nichtMitglied = partner.filter(p => !mitglieder.some(m => m.userId === p.userId))

  // §131 Nur Plattformzugänge bleiben draußen: sie gehören zu keinem Kunden.
  // Ein Gespräch zwischen zwei Menschen im Betrieb geht OKUN nichts an.
  if (!moeglich && !laedt) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-xl font-bold text-navy flex items-center gap-2">
          <MessageSquare size={20} className="text-teal-600" /> Nachrichten
        </h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-4 max-w-2xl">
          <p className="text-sm text-gray-600">
            Dieser Zugang nimmt an Gesprächen im Betrieb nicht teil.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Plattformzugänge von OKUN gehören zu keinem Unternehmen. Was zwei Menschen
            im Betrieb einander schreiben, geht uns nichts an.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-navy flex items-center gap-2">
            <MessageSquare size={20} className="text-teal-600" /> Nachrichten
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Schreiben Sie Kolleginnen und Kollegen an Ihrem Standort — damit
            Dienstpläne und Krankmeldungen nicht mehr über private Telefone laufen.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { partnerLaden(); setMaske('direkt'); setSuche('') }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white bg-brand">
            <Plus size={13} /> Neue Nachricht
          </button>
          {darfGruppen && (
            <>
              <button
                onClick={() => { partnerLaden(); setMaske('gruppe'); setSuche('') }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                <Users size={13} /> Gruppe eröffnen
              </button>
              <button
                onClick={gruppenlisteLaden}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                <Settings2 size={13} /> Alle Gruppen
              </button>
            </>
          )}
        </div>
      </div>

      {fehler && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* ── Gesprächsliste ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-2 h-fit">
          {laedt ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
            </div>
          ) : raeume.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-6 text-center">
              Noch keine Gespräche. Mit &bdquo;Neue Nachricht&ldquo; fängt eines an.
            </p>
          ) : (
            <div className="max-h-[62vh] overflow-y-auto space-y-0.5">
              {raeume.map(r => (
                <button
                  key={r.id}
                  onClick={() => oeffnen(r.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl ${
                    offen === r.id ? 'bg-teal-50' : 'hover:bg-gray-50'
                  }`}>
                  <div className="flex items-center gap-2">
                    {r.art === 'gruppe'
                      ? <Users size={14} className="text-gray-400 shrink-0" />
                      : <MessageSquare size={14} className="text-gray-400 shrink-0" />}
                    <span className={`text-sm truncate flex-1 ${
                      r.ungelesen > 0 ? 'font-bold text-navy' : 'font-semibold text-navy'
                    }`}>{r.titel}</span>
                    {r.ungelesen > 0 && (
                      <span className="text-[10px] font-bold text-white bg-brand rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {r.ungelesen}
                      </span>
                    )}
                  </div>
                  {r.letzteNachricht && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5 pl-6">
                      {r.art === 'gruppe' && r.letzteNachricht.art === 'text'
                        ? `${r.letzteNachricht.absenderName}: ` : ''}
                      {r.letzteNachricht.text}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-300 pl-6">
                    {uhrzeit(r.letzteAktivitaet)}
                    {r.archiviert && ' · geschlossen'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Rechte Seite ────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Neue Direktnachricht */}
          {maske === 'direkt' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-navy flex-1">Wem möchten Sie schreiben?</p>
                <button onClick={() => setMaske('keine')} className="p-1 rounded-lg hover:bg-gray-100">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  value={suche} onChange={e => setSuche(e.target.value)}
                  placeholder="Name suchen"
                  className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5" />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-0.5">
                {gefilterterPartner.map(p => (
                  <button key={p.userId} onClick={() => direktStarten(p.userId)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50">
                    <span className="text-sm font-semibold text-navy">{p.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {[p.position ?? p.rollenText, p.standort].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
                {gefilterterPartner.length === 0 && (
                  <p className="text-xs text-gray-400 px-2.5 py-3">Niemand gefunden.</p>
                )}
              </div>
            </div>
          )}

          {/* Neue Gruppe */}
          {maske === 'gruppe' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-navy flex-1">Neue Gruppe</p>
                <button onClick={() => setMaske('keine')} className="p-1 rounded-lg hover:bg-gray-100">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
              <input
                value={gruppenName} onChange={e => setGruppenName(e.target.value)}
                placeholder={'Name der Gruppe, z. B. „Frühdienst Station 1“'}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
              <input
                value={gruppenText} onChange={e => setGruppenText(e.target.value)}
                placeholder="Wofür ist die Gruppe da? (freiwillig)"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  value={suche} onChange={e => setSuche(e.target.value)}
                  placeholder="Mitglieder suchen"
                  className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5" />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {gefilterterPartner.map(p => {
                  const drin = gewaehlte.includes(p.userId)
                  return (
                    <button key={p.userId}
                      onClick={() => setGewaehlte(prev =>
                        drin ? prev.filter(x => x !== p.userId) : [...prev, p.userId])}
                      className={`w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg ${
                        drin ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        drin ? 'bg-brand border-brand' : 'border-gray-300'}`}>
                        {drin && <Check size={11} className="text-white" />}
                      </span>
                      <span className="text-sm font-semibold text-navy">{p.name}</span>
                      <span className="text-xs text-gray-400">
                        {[p.position ?? p.rollenText, p.standort].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={gruppeAnlegen}
                  disabled={gruppenName.trim().length < 2}
                  className="text-xs font-semibold px-3 py-2 rounded-xl text-white bg-brand disabled:opacity-40">
                  Gruppe eröffnen
                </button>
                <span className="text-xs text-gray-400">
                  {gewaehlte.length} {gewaehlte.length === 1 ? 'Person' : 'Personen'} ausgewählt
                </span>
              </div>
            </div>
          )}

          {/* Alle Gruppen des Standorts — die Verwaltungssicht */}
          {maske === 'gruppenliste' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-navy flex-1">Alle Gruppen</p>
                <button onClick={() => setMaske('keine')} className="p-1 rounded-lg hover:bg-gray-100">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Hier stehen auch Gruppen, in denen Sie nicht sind. Sie sehen, dass es
                sie gibt und wer darin ist — aber keine Nachricht. Zum Mitlesen müssen
                Sie beitreten, und das erscheint für alle sichtbar im Verlauf.
              </p>
              <div className="divide-y divide-gray-100">
                {gruppen.map(g => (
                  <div key={g.id} className="flex items-center gap-3 py-2.5 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">{g.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {g.mitgliederAnzahl} {g.mitgliederAnzahl === 1 ? 'Mitglied' : 'Mitglieder'}
                        {g.archiviert && ' · geschlossen'}
                        {g.beschreibung ? ` · ${g.beschreibung}` : ''}
                      </p>
                    </div>
                    {g.binMitglied ? (
                      <button onClick={() => oeffnen(g.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                        Öffnen
                      </button>
                    ) : (
                      <button onClick={() => beitreten(g.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                        <Lock size={12} /> Beitreten und mitlesen
                      </button>
                    )}
                  </div>
                ))}
                {gruppen.length === 0 && (
                  <p className="text-xs text-gray-400 py-3">Noch keine Gruppen.</p>
                )}
              </div>
            </div>
          )}

          {/* Verwaltung der geöffneten Gruppe */}
          {maske === 'verwalten' && kopf && offen && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-navy flex-1">Gruppe verwalten</p>
                <button onClick={() => setMaske('keine')} className="p-1 rounded-lg hover:bg-gray-100">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>

              {kopf.darfVerwalten && (
                <>
                  <input
                    defaultValue={kopf.titel}
                    onBlur={e => { if (e.target.value !== kopf.titel) raumAendern({ name: e.target.value }) }}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
                  <input
                    defaultValue={kopf.beschreibung ?? ''}
                    placeholder="Wofür ist die Gruppe da?"
                    onBlur={e => raumAendern({ beschreibung: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
                </>
              )}

              <div className="divide-y divide-gray-100">
                {mitglieder.map(m => (
                  <div key={m.userId} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">
                        {m.name}{m.ichSelbst && ' (Sie)'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {m.position ?? ''}{m.rolle === 'leitung' ? ' · Leitung' : ''}
                      </p>
                    </div>
                    {kopf.darfVerwalten && !m.ichSelbst && (
                      <button onClick={() => raumAendern({ entfernen: m.userId })}
                        className="text-xs text-gray-400 hover:text-red-600 px-2 py-1">
                        entfernen
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {kopf.darfVerwalten && nichtMitglied.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Hinzufügen</p>
                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {nichtMitglied.map(p => (
                      <button key={p.userId}
                        onClick={() => raumAendern({ hinzufuegen: [p.userId] })}
                        className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50">
                        <UserPlus size={13} className="text-gray-400" />
                        <span className="text-sm text-navy">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap pt-1">
                {kopf.darfVerwalten && (
                  <button onClick={() => raumAendern({ archivieren: !kopf.archiviert })}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                    <Archive size={13} /> {kopf.archiviert ? 'Wieder öffnen' : 'Gruppe schließen'}
                  </button>
                )}
                <button onClick={() => raumAendern({ verlassen: true })}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                  <LogOut size={13} /> Gruppe verlassen
                </button>
              </div>
            </div>
          )}

          {/* Der Verlauf */}
          {offen && kopf && maske === 'keine' && (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col h-[62vh]">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy truncate">{kopf.titel}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {kopf.art === 'gruppe'
                      ? `${mitglieder.length} ${mitglieder.length === 1 ? 'Mitglied' : 'Mitglieder'}`
                      : 'Nur Sie beide — sonst liest niemand mit'}
                    {kopf.beschreibung ? ` · ${kopf.beschreibung}` : ''}
                    {kopf.archiviert && ' · geschlossen'}
                  </p>
                </div>
                {kopf.art === 'gruppe' && (
                  <button onClick={() => { partnerLaden(); setMaske('verwalten') }}
                    className="p-2 rounded-xl hover:bg-gray-100">
                    <Settings2 size={15} className="text-gray-500" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {nachrichten.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">
                    Noch nichts geschrieben.
                  </p>
                )}
                {nachrichten.map(n => n.art === 'system' ? (
                  <p key={n.id} className="text-[11px] text-gray-400 text-center py-1">
                    {n.text}
                  </p>
                ) : (
                  <div key={n.id} className={`flex ${n.vonMir ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      n.vonMir ? 'bg-brand text-white' : 'bg-gray-100 text-navy'}`}>
                      {!n.vonMir && kopf.art === 'gruppe' && (
                        <p className="text-[10px] font-semibold opacity-70 mb-0.5">{n.absenderName}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{n.text}</p>
                      <p className={`text-[10px] mt-0.5 ${n.vonMir ? 'text-white/70' : 'text-gray-400'}`}>
                        {uhrzeit(n.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={ende} />
              </div>

              {kopf.archiviert ? (
                <p className="text-xs text-gray-400 px-4 py-3 border-t border-gray-100">
                  Diese Gruppe ist geschlossen. Der Verlauf bleibt lesbar.
                </p>
              ) : (
                <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-100">
                  <textarea
                    value={entwurf}
                    onChange={e => setEntwurf(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); senden() }
                    }}
                    rows={1}
                    placeholder="Nachricht schreiben …"
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none max-h-32" />
                  <button
                    onClick={senden}
                    disabled={sendet || !entwurf.trim()}
                    aria-label="Nachricht senden"
                    className="p-2.5 rounded-xl text-white bg-brand disabled:opacity-40 shrink-0">
                    <Send size={15} />
                  </button>
                </div>
              )}
            </div>
          )}

          {!offen && maske === 'keine' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-sm text-gray-400">
                Wählen Sie links ein Gespräch — oder fangen Sie ein neues an.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
