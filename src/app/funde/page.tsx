'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/lib/auth-context'
import {
  ClipboardList, Plus, Check, X, AlertTriangle, MessageCircleQuestion,
  ThumbsUp, ThumbsDown, Search, Send, CircleDot, Wrench,
} from 'lucide-react'
import { topf, TOPF_TEXT, type Topf } from '@/lib/funde'

/**
 * §133 Funde — der Ort für alles, was beim Testen auffällt.
 *
 * Eine Seite für alle Rollen. Wer testet, meldet hier ausführlich; der
 * Käfer-Knopf unten links bleibt für den schnellen Fund unterwegs. Beides
 * landet in derselben Tabelle, mit denselben Pflichtangaben.
 *
 * Was die Rolle ändert, ist nur der Umfang: OKUN sieht alle Funde und
 * entscheidet über Verbesserungsvorschläge; alle anderen sehen ihre eigenen
 * Meldungen und können auf Rückfragen antworten. Eine Fundliste ist eine
 * Mängelliste des Betriebs — die geht Dritte nichts an.
 */

const ARTEN = [
  { wert: 'fehler', text: 'Fehler', hilfe: 'Etwas funktioniert nicht so, wie es soll.' },
  { wert: 'verbesserung', text: 'Verbesserungsvorschlag', hilfe: 'Es funktioniert, ist aber umständlich, unklar oder fehlt.' },
  { wert: 'frage', text: 'Frage', hilfe: 'Unklar, ob das so gedacht ist.' },
  { wert: 'wunsch', text: 'Wunsch', hilfe: 'Etwas, das es noch gar nicht gibt.' },
]

const BEREICHE = [
  { wert: 'dienstplan', text: 'Dienstplanung' },
  { wert: 'zeit', text: 'Zeiterfassung' },
  { wert: 'urlaub', text: 'Urlaub und Abwesenheit' },
  { wert: 'lohn', text: 'Lohn und Zuschläge' },
  { wert: 'nachrichten', text: 'Nachrichten' },
  { wert: 'akte', text: 'Personalakte und Dokumente' },
  { wert: 'datenschutz', text: 'Datenschutz' },
  { wert: 'einrichtung', text: 'Einrichtung und Stammdaten' },
  { wert: 'anmeldung', text: 'Anmeldung und Zugänge' },
  { wert: 'sonstiges', text: 'Sonstiges' },
]

const EBENEN = [
  { wert: 'employee', text: 'als Mitarbeiter' },
  { wert: 'admin', text: 'als Standortleitung' },
  { wert: 'company', text: 'als Unternehmen' },
  { wert: 'okun', text: 'als OKUN' },
]

const HAEUFIGKEITEN = [
  { wert: 'immer', text: 'Immer' },
  { wert: 'manchmal', text: 'Manchmal' },
  { wert: 'einmal', text: 'Bisher einmal' },
]

const STATUS_TEXT: Record<string, string> = {
  open: 'Neu',
  wartet_freigabe: 'Wartet auf Freigabe',
  freigegeben: 'Freigegeben',
  rueckfrage: 'Rückfrage offen',
  in_progress: 'In Arbeit',
  resolved: 'Erledigt',
  abgelehnt: 'Abgelehnt',
}

const STATUS_FARBE: Record<string, string> = {
  open: 'bg-red-50 text-red-700',
  wartet_freigabe: 'bg-amber-50 text-amber-800',
  freigegeben: 'bg-teal-50 text-teal-800',
  rueckfrage: 'bg-purple-50 text-purple-700',
  in_progress: 'bg-blue-50 text-blue-700',
  resolved: 'bg-green-50 text-green-700',
  abgelehnt: 'bg-gray-100 text-gray-500',
}

interface Fund {
  id: string
  ticketId: string
  status: string
  art: string
  bereich: string
  ebene: string | null
  title: string
  description: string | null
  schritte: string | null
  erwartet: string | null
  haeufigkeit: string | null
  heikel: boolean
  meldeQualitaet: string
  freigabe: string | null
  freigabeVon: string | null
  freigabeNotiz: string | null
  rueckfrage: string | null
  antwort: string | null
  vorschlag: string | null
  adminNotes: string | null
  userName: string | null
  userRole: string | null
  page: string | null
  version: string | null
  createdAt: string
}

const LEER = {
  art: 'fehler', bereich: '', ebene: '', title: '',
  schritte: '', description: '', erwartet: '', haeufigkeit: '', heikel: false,
}

const datum = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

/**
 * Dieselbe Bewertung wie auf dem Server — hier nur, damit die Ampel schon beim
 * Tippen mitläuft. Verbindlich ist die Antwort des Servers.
 */
function fehlendeAngaben(f: typeof LEER): string[] {
  const kurz = (w: string) => w.trim().length < 12
  const fehlt: string[] = []
  if (kurz(f.title)) fehlt.push('Eine Überschrift in einem Satz')
  if (f.art === 'fehler' || f.art === 'frage') {
    if (kurz(f.schritte)) fehlt.push('Was hast du getan?')
    if (kurz(f.description)) fehlt.push('Was ist passiert?')
    if (kurz(f.erwartet)) fehlt.push('Was hättest du erwartet?')
    if (!f.haeufigkeit) fehlt.push('Tritt es immer auf?')
  } else {
    if (kurz(f.description)) fehlt.push('Was stört heute daran?')
    if (kurz(f.erwartet)) fehlt.push('Wie sollte es stattdessen sein?')
  }
  if (!f.bereich || f.bereich === 'sonstiges') fehlt.push('Welcher Bereich?')
  return fehlt
}

export default function FundePage() {
  const { user } = useAuth()
  const istOkun = user?.role === 'okun'

  const [funde, setFunde] = useState<Fund[]>([])
  const [laedt, setLaedt] = useState(true)
  const [formular, setFormular] = useState(false)
  const [form, setForm] = useState({ ...LEER })
  const [sendet, setSendet] = useState(false)
  const [hinweis, setHinweis] = useState('')
  const [fehler, setFehler] = useState('')
  const [filter, setFilter] = useState<string>('offen')
  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState<string | null>(null)
  const [notiz, setNotiz] = useState('')
  const [antwort, setAntwort] = useState('')

  const laden = useCallback(async () => {
    setLaedt(true)
    try {
      const r = await fetch('/api/bug-reports')
      const d = await r.json()
      setFunde(d.reports ?? [])
    } catch { setFehler('Funde konnten nicht geladen werden') }
    finally { setLaedt(false) }
  }, [])

  useEffect(() => { laden() }, [laden])

  const fehlt = fehlendeAngaben(form)
  const istVorschlag = form.art === 'verbesserung' || form.art === 'wunsch'

  async function absenden() {
    setSendet(true); setFehler(''); setHinweis('')
    try {
      const r = await fetch('/api/bug-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ebene: form.ebene || user?.role,
          version: process.env.NEXT_PUBLIC_BUILD_ID,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Konnte nicht gespeichert werden'); return }
      setHinweis(
        d.freigabePflichtig
          ? `${d.ticketId} angelegt. Vorschläge werden erst umgesetzt, wenn OKUN sie freigibt.`
          : `${d.ticketId} angelegt. ${d.bewertung?.text ?? ''}`,
      )
      setForm({ ...LEER }); setFormular(false)
      await laden()
    } catch { setFehler('Konnte nicht gespeichert werden') }
    finally { setSendet(false) }
  }

  async function aendern(id: string, daten: Record<string, unknown>) {
    setFehler('')
    const r = await fetch('/api/bug-reports', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...daten }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setFehler(d.error ?? 'Änderung fehlgeschlagen')
      return
    }
    setNotiz(''); setAntwort('')
    await laden()
  }

  const OFFENE = ['open', 'wartet_freigabe', 'freigegeben', 'rueckfrage', 'in_progress']
  const gefiltert = funde
    .filter(f => filter === 'alle'
      || (filter === 'offen' ? OFFENE.includes(f.status) : f.status === filter))
    .filter(f => !suche
      || f.title.toLowerCase().includes(suche.toLowerCase())
      || f.ticketId.toLowerCase().includes(suche.toLowerCase()))

  const zuFreigeben = funde.filter(f => f.status === 'wartet_freigabe').length

  /*
    §135 Was beim nächsten Lauf passieren wird.
    
    Dieselbe Einsortierung, die der Lauf selbst benutzt — damit hier nicht
    etwas anderes steht als das, was dann tatsächlich geschieht. Ein Bericht,
    der vom Ablauf abweicht, ist schlimmer als keiner.
  */
  const OFFENE_STATUS = ['open', 'wartet_freigabe', 'freigegeben', 'rueckfrage', 'in_progress']
  const offeneFunde = funde.filter(f => OFFENE_STATUS.includes(f.status))
  const jeTopf = offeneFunde.reduce((acc, f) => {
    const t = topf(f)
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {} as Record<Topf, number>)

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-navy flex items-center gap-2">
              <ClipboardList size={20} className="text-teal-600" /> Funde
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Alles, was beim Testen auffällt: Fehler, Verbesserungsvorschläge, Fragen und
              Wünsche. Unterwegs geht es schneller über den Käfer unten links — hier ist
              Platz, es ordentlich aufzuschreiben.
            </p>
          </div>
          <button
            onClick={() => { setFormular(v => !v); setHinweis('') }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white bg-brand">
            {formular ? <><X size={13} /> Abbrechen</> : <><Plus size={13} /> Fund melden</>}
          </button>
        </div>

        {/* §135 Der Bericht: was beim nächsten Lauf ansteht */}
        {istOkun && offeneFunde.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-navy flex items-center gap-2">
              <Wrench size={15} className="text-teal-600" /> Was beim nächsten Lauf ansteht
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {(['selbst', 'vorschlag', 'freigabe', 'rueckfrage'] as Topf[]).map(t => (
                <div key={t} className={`rounded-xl p-3 ${
                  t === 'freigabe' && (jeTopf[t] ?? 0) > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <p className="text-lg font-bold text-navy">{jeTopf[t] ?? 0}</p>
                  <p className="text-[11px] text-gray-500 leading-tight">{TOPF_TEXT[t]}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Der Lauf erledigt nur, was im ersten Topf steht. Alles andere wartet auf
              dich — Vorschläge auf eine Freigabe, unvollständige Meldungen auf eine
              Antwort.
            </p>
          </div>
        )}

        {istOkun && zuFreigeben > 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <ThumbsUp size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">
              {zuFreigeben} {zuFreigeben === 1 ? 'Vorschlag wartet' : 'Vorschläge warten'} auf
              deine Freigabe. Ohne sie wird nichts davon gebaut.
            </p>
          </div>
        )}

        {hinweis && (
          <div className="flex items-start gap-2 rounded-2xl border border-teal-200 bg-teal-50 p-3">
            <Check size={16} className="text-teal-600 shrink-0 mt-0.5" />
            <p className="text-xs text-teal-900">{hinweis}</p>
          </div>
        )}
        {fehler && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">{fehler}</p>
          </div>
        )}

        {/* ── Erfassen ────────────────────────────────────────────────── */}
        {formular && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-4 max-w-3xl">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Worum geht es?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ARTEN.map(a => (
                  <button key={a.wert}
                    onClick={() => setForm(f => ({ ...f, art: a.wert }))}
                    className={`text-left px-3 py-2 rounded-xl border text-xs ${
                      form.art === a.wert
                        ? 'border-brand bg-teal-50 text-navy font-semibold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {a.text}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                {ARTEN.find(a => a.wert === form.art)?.hilfe}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Bereich
                </label>
                <select
                  value={form.bereich}
                  onChange={e => setForm(f => ({ ...f, bereich: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2">
                  <option value="">— bitte wählen —</option>
                  {BEREICHE.map(b => <option key={b.wert} value={b.wert}>{b.text}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  In welcher Rolle getestet?
                </label>
                <select
                  value={form.ebene}
                  onChange={e => setForm(f => ({ ...f, ebene: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2">
                  <option value="">— wie angemeldet —</option>
                  {EBENEN.map(e => <option key={e.wert} value={e.wert}>{e.text}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Überschrift
              </label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={istVorschlag
                  ? 'Was sollte besser werden? In einem Satz.'
                  : 'Woran hast du es gemerkt? In einem Satz.'}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
            </div>

            {!istVorschlag && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Was hast du getan?
                </label>
                <textarea
                  value={form.schritte} rows={3}
                  onChange={e => setForm(f => ({ ...f, schritte: e.target.value }))}
                  placeholder="Schritt für Schritt, damit sich der Fund nachstellen lässt."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                {istVorschlag ? 'Was stört heute daran?' : 'Was ist passiert?'}
              </label>
              <textarea
                value={form.description} rows={3}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none" />
            </div>

            {/*
              §133 Das entscheidende Feld. Ohne es lässt sich nicht klären, ob
              etwas kaputt ist oder nur anders als gedacht — und genau daran
              hängt, ob daraus eine Behebung wird oder eine Rückfrage.
            */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                {istVorschlag ? 'Wie sollte es stattdessen sein?' : 'Was hättest du erwartet?'}
              </label>
              <textarea
                value={form.erwartet} rows={2}
                onChange={e => setForm(f => ({ ...f, erwartet: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none" />
              <p className="text-[11px] text-gray-400 mt-1">
                Das ist die wichtigste Angabe. Ohne sie ist nicht zu entscheiden, ob etwas
                kaputt ist oder nur anders, als du es erwartet hast.
              </p>
            </div>

            {!istVorschlag && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Tritt es immer auf?
                </label>
                <div className="flex gap-2 flex-wrap">
                  {HAEUFIGKEITEN.map(h => (
                    <button key={h.wert}
                      onClick={() => setForm(f => ({ ...f, haeufigkeit: h.wert }))}
                      className={`px-3 py-1.5 rounded-xl border text-xs ${
                        form.haeufigkeit === h.wert
                          ? 'border-brand bg-teal-50 text-navy font-semibold'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {h.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.heikel} className="mt-0.5"
                onChange={e => setForm(f => ({ ...f, heikel: e.target.checked }))} />
              <span className="text-xs text-gray-600">
                Dabei geht es um Geld oder Recht — Lohn, Arbeitszeiten, Fristen oder
                Zugriffsrechte.
                <span className="block text-[11px] text-gray-400">
                  Setzt die Dringlichkeit hoch. Solche Funde werden nie ohne Bestätigung
                  geändert.
                </span>
              </span>
            </label>

            {/* Die Ampel */}
            <div className={`rounded-xl p-3 ${fehlt.length === 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
              <p className={`text-xs ${fehlt.length === 0 ? 'text-green-800' : 'text-amber-900'}`}>
                {fehlt.length === 0
                  ? '✓ Damit kann ich arbeiten.'
                  : `Noch offen: ${fehlt.join(' · ')}`}
              </p>
              {fehlt.length > 0 && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Du kannst trotzdem absenden — dann kommt später eine Rückfrage dazu.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={absenden}
                disabled={sendet || form.title.trim().length < 3}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl text-white bg-brand disabled:opacity-40">
                <Send size={13} /> {sendet ? 'Wird gesendet …' : 'Fund melden'}
              </button>
              {istVorschlag && (
                <span className="text-[11px] text-gray-500">
                  Vorschläge werden erst gebaut, wenn OKUN sie freigibt.
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Liste ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {['offen', 'wartet_freigabe', 'resolved', 'abgelehnt', 'alle'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
                filter === s ? 'bg-navy text-white' : 'text-gray-600 border border-gray-200'}`}>
              {s === 'offen' ? 'Offen' : s === 'alle' ? 'Alle' : STATUS_TEXT[s]}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input value={suche} onChange={e => setSuche(e.target.value)}
              placeholder="Suchen"
              className="text-sm border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5" />
          </div>
        </div>

        {laedt ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : gefiltert.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-sm text-gray-400">
              {funde.length === 0
                ? 'Noch nichts gemeldet.'
                : 'In dieser Auswahl ist nichts.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {gefiltert.map(f => (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100">
                <button
                  onClick={() => setOffen(offen === f.id ? null : f.id)}
                  className="w-full text-left p-4 flex items-start gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        STATUS_FARBE[f.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_TEXT[f.status] ?? f.status}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {ARTEN.find(a => a.wert === f.art)?.text ?? f.art}
                      </span>
                      {f.heikel && (
                        <span className="text-[10px] font-semibold text-red-600">
                          Geld/Recht
                        </span>
                      )}
                      {f.meldeQualitaet !== 'gruen' && (
                        <span className="text-[10px] text-amber-700">unvollständig</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-navy mt-1">{f.title}</p>
                    <p className="text-[11px] text-gray-400">
                      {f.ticketId} · {BEREICHE.find(b => b.wert === f.bereich)?.text ?? f.bereich}
                      {istOkun && f.userName ? ` · ${f.userName}` : ''}
                      {' · '}{datum(f.createdAt)}
                    </p>
                  </div>
                  <CircleDot size={14} className="text-gray-300 shrink-0 mt-1" />
                </button>

                {offen === f.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                    {f.schritte && (
                      <Abschnitt titel="Was getan wurde" text={f.schritte} />
                    )}
                    {f.description && (
                      <Abschnitt titel={f.art === 'verbesserung' || f.art === 'wunsch'
                        ? 'Was heute stört' : 'Was passiert ist'} text={f.description} />
                    )}
                    {f.erwartet && (
                      <Abschnitt titel={f.art === 'verbesserung' || f.art === 'wunsch'
                        ? 'Wie es sein sollte' : 'Was erwartet wurde'} text={f.erwartet} />
                    )}
                    <p className="text-[11px] text-gray-400">
                      {f.haeufigkeit ? `Tritt ${f.haeufigkeit} auf · ` : ''}
                      {f.page ? `Seite ${f.page} · ` : ''}
                      {f.ebene ? EBENEN.find(e => e.wert === f.ebene)?.text ?? f.ebene : ''}
                      {f.version ? ` · Version ${f.version}` : ''}
                    </p>

                    {f.rueckfrage && (
                      <div className="rounded-xl bg-purple-50 p-3 space-y-2">
                        <p className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                          <MessageCircleQuestion size={13} /> Rückfrage
                        </p>
                        <p className="text-xs text-purple-900">{f.rueckfrage}</p>
                        {f.antwort
                          ? <p className="text-xs text-gray-600">Antwort: {f.antwort}</p>
                          : (
                            <div className="flex gap-2">
                              <input
                                value={antwort} onChange={e => setAntwort(e.target.value)}
                                placeholder="Antwort"
                                className="flex-1 text-xs border border-purple-200 rounded-lg px-2.5 py-1.5" />
                              <button
                                onClick={() => aendern(f.id, { antwort })}
                                disabled={!antwort.trim()}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white disabled:opacity-40">
                                Senden
                              </button>
                            </div>
                          )}
                      </div>
                    )}

                    {f.freigabe === 'abgelehnt' && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-600">
                          Abgelehnt von {f.freigabeVon}
                          {f.freigabeNotiz ? `: ${f.freigabeNotiz}` : '.'}
                        </p>
                      </div>
                    )}

                    {/* ── Nur OKUN: entscheiden ─────────────────────────── */}
                    {istOkun && (
                      <div className="space-y-2 pt-1">
                        {f.status === 'wartet_freigabe' && (
                          <>
                            <input
                              value={notiz} onChange={e => setNotiz(e.target.value)}
                              placeholder="Begründung (bei Ablehnung besonders wichtig)"
                              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5" />
                            <div className="flex gap-2">
                              <button
                                onClick={() => aendern(f.id, { freigabe: 'freigegeben', freigabeNotiz: notiz })}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white bg-brand">
                                <ThumbsUp size={13} /> Freigeben
                              </button>
                              <button
                                onClick={() => aendern(f.id, { freigabe: 'abgelehnt', freigabeNotiz: notiz })}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200">
                                <ThumbsDown size={13} /> Ablehnen
                              </button>
                            </div>
                          </>
                        )}
                        {f.status !== 'wartet_freigabe' && f.status !== 'resolved' && (
                          <div className="flex gap-2 flex-wrap">
                            <input
                              value={notiz} onChange={e => setNotiz(e.target.value)}
                              placeholder="Rückfrage an den Melder"
                              className="flex-1 min-w-[180px] text-xs border border-gray-200 rounded-lg px-2.5 py-1.5" />
                            <button
                              onClick={() => aendern(f.id, { rueckfrage: notiz })}
                              disabled={!notiz.trim()}
                              className="text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 disabled:opacity-40">
                              Nachfragen
                            </button>
                            <button
                              onClick={() => aendern(f.id, { erledigtNotiz: notiz || 'erledigt' })}
                              className="text-xs font-semibold px-3 py-2 rounded-xl text-white bg-navy">
                              Erledigt
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function Abschnitt({ titel, text }: { titel: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase">{titel}</p>
      <p className="text-xs text-gray-700 whitespace-pre-wrap">{text}</p>
    </div>
  )
}
