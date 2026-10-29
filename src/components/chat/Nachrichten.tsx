'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageSquare, Users, Plus, Search, Send, Settings2, X, Check, Paperclip,
  Trash2, FileText, Download, ChevronLeft,
  AlertTriangle, Archive, LogOut, UserPlus, Lock, LifeBuoy, Sparkles,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { einreihen } from '@/lib/warteschlange'
import { schlangeGeaendert } from '@/components/offline/Warteschlange'

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
  /**
   * §143/§145 Zwei feste Räume stehen immer oben und sind nicht löschbar:
   * `assistent` (ein Programm, antwortet sofort) und `okun` (Menschen).
   */
  art: 'direkt' | 'gruppe' | 'okun' | 'assistent'
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

/**
 * §240 Die Haken.
 *
 *   ein Haken, blass      gesendet — der Server hat sie
 *   zwei Haken, blass     zugestellt — sie liegt auf dem Gerät des anderen
 *   zwei Haken, türkis    gelesen — jemand hat hingesehen
 *
 * §248 WARUM GOLD UND NICHT TÜRKIS
 * §240 hatte Türkis gewählt, die Hausfarbe — und auf der eigenen Blase, die
 * selbst türkis ist, ein kräftiges Weiß. Gemeldet kam zurück: „Dass die Haken
 * türkis sind, macht keinen Sinn, weil die Nachrichtenbox von einem selber ist
 * schon türkis. Deswegen müssten die Haken, wenn sie gelesen sind, irgendwie
 * golden werden."
 *
 * Das trifft zu, und der Weiß-Umweg war eine Krücke: Ein Zustand, den man nur
 * an einem Helligkeitssprung erkennt, ist keiner. Gold hebt sich auf der
 * türkisen Blase wirklich ab und ist im Programm bereits besetzt — das
 * Wappen oben links und der Assistent tragen es.
 *
 * `title` ist kein Beiwerk: Drei Zustände, die sich nur durch Anzahl und Farbe
 * unterscheiden, kann niemand raten, und wer eine Vorlesehilfe benutzt, sieht
 * sie gar nicht.
 */
function Haken({ status, aufFarbe }: {
  status: 'gesendet' | 'zugestellt' | 'gelesen'
  aufFarbe: boolean
}) {
  const text = { gesendet: 'Gesendet', zugestellt: 'Zugestellt', gelesen: 'Gelesen' }[status]
  // §248 Gold für gelesen — auf der türkisen Blase und daneben dasselbe.
  const farbe = status === 'gelesen'
    ? 'text-[#F2C230]'
    : (aufFarbe ? 'text-white/50' : 'text-gray-400')
  return (
    <span className={`inline-flex items-center ${farbe}`} title={text} aria-label={text}>
      <Check size={12} strokeWidth={3} />
      {status !== 'gesendet' && (
        <Check size={12} strokeWidth={3} className="-ml-[7px]" />
      )}
    </span>
  )
}

interface Nachricht {
  id: string
  text: string
  art: string
  absenderName: string
  vonMir: boolean
  createdAt: string
  // §221 Anhang: Bild, Tonaufnahme, Video, Schriftstück
  dateiId?: string | null
  dateiTyp?: string | null
  dateiName?: string | null
  dateiGroesse?: number | null
  /** Ob sie sich noch für alle zurückziehen lässt — entscheidet der Server. */
  zurueckziehbar?: boolean
  /** §240 gesendet · zugestellt · gelesen — nur bei eigenen Nachrichten. */
  status?: 'gesendet' | 'zugestellt' | 'gelesen' | null
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
  const [ohneZugang, setOhneZugang] = useState<{ anzahl: number; namen: string[] }>(
    { anzahl: 0, namen: [] })
  const [suche, setSuche] = useState('')
  const [gruppenName, setGruppenName] = useState('')
  const [gruppenText, setGruppenText] = useState('')
  const [gewaehlte, setGewaehlte] = useState<string[]>([])
  const [gruppen, setGruppen] = useState<Gruppe[]>([])

  const ende = useRef<HTMLDivElement>(null)
  const dateiFeld = useRef<HTMLInputElement>(null)
  // §221 Welche Nachricht gerade weggeräumt werden soll — und ob „für alle"
  // überhaupt noch zur Wahl steht.
  const [loeschMaske, setLoeschMaske] =
    useState<{ id: string; fuerAlle: boolean } | null>(null)
  const [gespraechWeg, setGespraechWeg] = useState(false)

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
      /*
       * §240 Hier stand `gelesen: true` — bei JEDEM Durchlauf des
       * Zehn-Sekunden-Takts.
       *
       * Damit „las" jeder, der ein Gespräch irgendwo offen liegen hatte, alles
       * binnen zehn Sekunden, ohne hinzusehen. Gemeldet wurde die Folge: Eine
       * gerade geschriebene Nachricht ließ sich nicht mehr zurückziehen, weil
       * sie angeblich schon gelesen war.
       *
       * Was hier passiert, ist Zustellung: Die Nachricht liegt auf dem Gerät.
       * Genau das heißt es jetzt auch. Gelesen wird in `alsGelesenMelden`
       * gemeldet — beim Öffnen und beim Zurückkommen ins Fenster.
       */
      await fetch(`/api/chat/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zugestellt: true }),
      })
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

  /**
   * §240 Gelesen melden — und zwar nur, wenn jemand hinsehen KANN.
   *
   * `document.visibilityState` ist der Unterschied zwischen „das Gespräch ist
   * offen" und „jemand schaut hin". Ein Reiter von gestern im Hintergrund ist
   * offen; gelesen hat dort niemand etwas.
   *
   * Die Zahl der ungelesenen in der Liste wird erst HIER zurückgesetzt. Vorher
   * tat das der Takt — und dann verschwand das Abzeichen, ohne dass jemand
   * hingesehen hatte.
   */
  const alsGelesenMelden = useCallback(async (id: string) => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    await fetch(`/api/chat/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gelesen: true }),
    }).catch(() => {})
    setRaeume(prev => prev.map(x => x.id === id ? { ...x, ungelesen: 0 } : x))
  }, [])

  /*
   * §240 Wer das Fenster wieder nach vorn holt, sieht jetzt hin.
   *
   * Ohne das bliebe eine Nachricht, die ankam, während das Fenster im
   * Hintergrund lag, für immer ungelesen — man hätte sie gesehen, und der
   * Absender wüsste es nicht.
   */
  useEffect(() => {
    if (!offen) return
    const beiSichtbar = () => {
      if (document.visibilityState === 'visible') alsGelesenMelden(offen)
    }
    document.addEventListener('visibilitychange', beiSichtbar)
    return () => document.removeEventListener('visibilitychange', beiSichtbar)
  }, [offen, alsGelesenMelden])

  async function oeffnen(id: string) {
    setOffen(id); setNachrichten([]); setFehler(''); setMaske('keine')
    alsGelesenMelden(id)
    /*
     * §223 Auf dem Telefon oben anfangen.
     *
     * Wer weit unten in der Liste auf ein Gespräch tippt, bleibt sonst auf
     * derselben Scrollhöhe stehen — und sieht als Erstes die Mitte des
     * Verlaufs, mit weißem Rand darüber. Der Sprung ist das, was den
     * Wechsel zu einer eigenen Seite überhaupt als Wechsel erkennbar macht.
     */
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
    await raumLaden(id)
  }

  /*
   * §221 Eine Datei schicken.
   *
   * Eigener Weg und nicht Teil von `senden`: Eine Datei geht als
   * `multipart/form-data` hinaus, eine Nachricht als JSON. Beides in einen
   * Aufruf zu pressen hieße, auf jeder Seite zu prüfen, was gerade gemeint
   * ist — und bei Dateien ist das die Stelle, an der stillschweigend nichts
   * ankommt.
   *
   * Die Warteschlange für Offline-Betrieb bekommt hier NICHTS: Sie merkt sich
   * JSON im Speicher des Browsers, und eine Tonaufnahme von 20 MB gehört da
   * nicht hinein.
   */
  async function dateiSenden(datei: File) {
    if (!offen) return
    setSendet(true); setFehler('')
    try {
      const daten = new FormData()
      daten.append('datei', datei)
      if (entwurf.trim()) daten.append('text', entwurf.trim())
      const r = await fetch(`/api/chat/${offen}/datei`, { method: 'POST', body: daten })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Die Datei ließ sich nicht senden.'); return }
      setNachrichten(prev => [...prev, {
        ...d.nachricht,
        vonMir: true,
        createdAt: d.nachricht.createdAt,
        dateiTyp: d.nachricht.datei?.mimeType ?? null,
        dateiName: d.nachricht.datei?.dateiname ?? null,
        dateiGroesse: d.nachricht.datei?.groesse ?? null,
        zurueckziehbar: true,
      }])
      setEntwurf('')
      setTimeout(() => ende.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      listeLaden()
    } catch {
      setFehler('Keine Verbindung — die Datei ließ sich nicht senden.')
    } finally {
      setSendet(false)
    }
  }

  /**
   * §221 Eine Nachricht wegräumen — bei mir oder für alle.
   *
   * „Für alle" geht nur, solange niemand sonst gelesen hat; das entscheidet
   * der Server und sagt es, wenn es zu spät ist.
   */
  async function nachrichtLoeschen(id: string, fuerAlle: boolean) {
    if (!offen) return
    const r = await fetch(
      `/api/chat/${offen}?nachricht=${id}${fuerAlle ? '&fuerAlle=1' : ''}`,
      { method: 'DELETE' },
    ).catch(() => null)
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => ({}))
      setFehler(d?.error ?? 'Das hat nicht geklappt.')
      return
    }
    setNachrichten(prev => prev.filter(n => n.id !== id))
    listeLaden()
  }

  /** §221 Das ganze Gespräch bei mir löschen. */
  async function gespraechLoeschen() {
    if (!offen) return
    const r = await fetch(`/api/chat/${offen}`, { method: 'DELETE' }).catch(() => null)
    if (!r || !r.ok) { setFehler('Das Gespräch ließ sich nicht löschen.'); return }
    setOffen(null)
    setNachrichten([])
    listeLaden()
  }

  async function senden() {
    if (!offen || !entwurf.trim()) return
    setSendet(true); setFehler('')
    const text = entwurf
    try {
      const r = await fetch(`/api/chat/${offen}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      // §138 503 heißt: nicht erreichbar — die Nachricht kam nie an.
      if (r.status === 503) throw new Error('offline')
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Nachricht konnte nicht gesendet werden'); return }
      setNachrichten(prev => [...prev, d.nachricht])
      setEntwurf('')
      setTimeout(() => ende.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      listeLaden()
    } catch {
      // §138 Ohne Netz wird die Nachricht gemerkt. Sie erscheint erst im
      // Verlauf, wenn sie wirklich beim Server ist — eine Nachricht, die nur
      // auf dem eigenen Telefon steht, hat niemand gelesen. Der Entwurf ist
      // trotzdem weg, sonst schickt man sie ein zweites Mal.
      const { ok } = einreihen('nachricht', `/api/chat/${offen}`, { text })
      if (!ok) { setFehler('Keine Verbindung — die Nachricht ließ sich nicht merken.'); return }
      schlangeGeaendert()
      setEntwurf('')
      setFehler('Kein Netz — die Nachricht ist gemerkt und geht raus, sobald wieder '
        + 'Empfang da ist.')
    }
    finally { setSendet(false) }
  }

  async function partnerLaden() {
    const r = await fetch('/api/chat/partner')
    const d = await r.json().catch(() => ({}))
    setPartner(d.partner ?? [])
    setOhneZugang(d.ohneZugang ?? { anzahl: 0, namen: [] })
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

  // §144 Gesucht wird über alles, was in der Zeile steht — Name, Position,
  // Standort und Rolle. Vorher nur über den Namen: Wer „Pflege" tippte, um die
  // Pflegekräfte zu finden, bekam eine leere Liste und hielt die Suche für
  // kaputt. Mehrere Wörter werden UND-verknüpft, damit sich eine große Liste
  // wirklich eingrenzen lässt.
  const begriffe = suche.toLowerCase().split(/\s+/).filter(Boolean)
  const passt = (p: Partner) => {
    const heuhaufen = [p.name, p.position, p.standort, p.rollenText]
      .filter(Boolean).join(' ').toLowerCase()
    return begriffe.every(b => heuhaufen.includes(b))
  }
  const gefilterterPartner = partner.filter(passt)
  const alleGewaehlt = gefilterterPartner.length > 0
    && gefilterterPartner.every(p => gewaehlte.includes(p.userId))
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
    <div className={`p-4 sm:p-6 space-y-4 ${offen ? '-mb-44 lg:mb-0' : ''}`}>
      {/*
        §223 Auf dem Telefon ist ein Gespräch eine EIGENE Seite.
        Vorher stand beides untereinander: oben die Liste aller Gespräche,
        darunter das offene. Wer im Verlauf nach oben wischte, landete wieder
        in der Liste — und wusste nicht mehr, wo er war. Auf einem Bildschirm
        mit Platz bleiben beide nebeneinander; das ist dort kein Durcheinander,
        sondern eine Übersicht.
      */}
      <div className={`${offen ? 'hidden lg:flex' : 'flex'} items-start gap-3 flex-wrap`}>
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
        <div className={`bg-white rounded-2xl border border-gray-100 p-2 h-fit ${
          offen ? 'hidden lg:block' : ''}`}>
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
              {/* §143 Der Draht zu OKUN steht oben und bleibt dort. Wer eine
                  Störung melden will, soll nicht suchen müssen. */}
              {[...raeume].sort((a, b) => {
                const rang = (x: Raum) =>
                  x.art === 'assistent' ? 0 : x.art === 'okun' ? 1 : 2
                return rang(a) - rang(b)
              }).map(r => (
                <button
                  key={r.id}
                  onClick={() => oeffnen(r.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl ${
                    offen === r.id ? 'bg-teal-50' : 'hover:bg-gray-50'
                  }`}>
                  <div className="flex items-center gap-2">
                    {r.art === 'assistent'
                      ? <Sparkles size={14} className="text-brand shrink-0" />
                      : r.art === 'okun'
                        ? <LifeBuoy size={14} className="text-teal-600 shrink-0" />
                        : r.art === 'gruppe'
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
              {/* §144 Auch hier: Wer fehlt, wird benannt. */}
              {ohneZugang.anzahl > 0 && (
                <p className="text-[11px] text-gray-400 px-0.5">
                  {ohneZugang.anzahl === 1 ? 'Eine Person fehlt' : `${ohneZugang.anzahl} Personen fehlen`}
                  {' — noch kein Zugang, also auch kein Postfach.'}
                </p>
              )}
              <div className="max-h-72 overflow-y-auto space-y-0.5">
                {gefilterterPartner.length === 0 && (
                  <p className="text-xs text-gray-400 px-2.5 py-3">
                    {suche.trim() ? `Niemand gefunden für „${suche}".` : 'Niemand da.'}
                  </p>
                )}
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
                  placeholder="Suchen nach Name, Position oder Standort"
                  className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5" />
              </div>

              {/* §144 „Alle auswählen" — der häufigste Fall überhaupt.
                  Eine Gruppe für das ganze Haus baut man sonst mit vierzig
                  Einzelklicks, und beim achtunddreißigsten verrutscht einer. */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setGewaehlte(
                    alleGewaehlt ? [] : gefilterterPartner.map(p => p.userId))}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5
                             rounded-lg border border-gray-200 text-navy hover:bg-gray-50">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    alleGewaehlt ? 'bg-brand border-brand' : 'border-gray-300'}`}>
                    {alleGewaehlt && <Check size={9} className="text-white" />}
                  </span>
                  {alleGewaehlt
                    ? 'Auswahl aufheben'
                    : suche.trim()
                      ? `Alle ${gefilterterPartner.length} Treffer auswählen`
                      : 'Alle Mitarbeiter auswählen'}
                </button>
                <span className="text-xs text-gray-400">
                  {gewaehlte.length} von {partner.length} ausgewählt
                </span>
              </div>

              {/* §144 Wer hier FEHLT, wird benannt statt verschwiegen. Eine
                  Liste, die schweigend unvollständig ist, lässt den Menschen
                  an der Suche zweifeln statt an der fehlenden Einladung. */}
              {ohneZugang.anzahl > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border
                                border-amber-200 p-2.5">
                  <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    {ohneZugang.anzahl === 1
                      ? 'Eine Person fehlt hier'
                      : `${ohneZugang.anzahl} Personen fehlen hier`}
                    {ohneZugang.namen.length > 0 && ` (${ohneZugang.namen.join(', ')}${
                      ohneZugang.anzahl > ohneZugang.namen.length ? ' …' : ''})`}
                    {' — '}
                    {ohneZugang.anzahl === 1 ? 'sie hat' : 'sie haben'} noch keinen Zugang
                    und {ohneZugang.anzahl === 1 ? 'kann' : 'können'} deshalb keine
                    Nachrichten empfangen. Unter <strong>Mitarbeiter</strong> lässt sich
                    eine Einladung verschicken.
                  </p>
                </div>
              )}

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
                {gefilterterPartner.length === 0 && (
                  <p className="text-xs text-gray-400 px-2.5 py-3">
                    {suche.trim()
                      ? `Niemand gefunden für „${suche}".`
                      : 'Es gibt hier noch niemanden mit Zugang.'}
                  </p>
                )}
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
                {/* §221 Bei mir löschen — für Gruppen wie für Gespräche zu
                    zweit. Die andere Seite behält ihren Verlauf. */}
                <button onClick={() => setGespraechWeg(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-red-600 border border-red-200 hover:bg-red-50">
                  <Trash2 size={13} /> Bei mir löschen
                </button>
              </div>
            </div>
          )}

          {/* Der Verlauf */}
          {offen && kopf && maske === 'keine' && (
            <div
              /*
               * §223 Die Höhe ist gemessen, nicht geschätzt.
               *
               * Das Gerüst hält unter jeder Seite 176 px für die schwebende
               * Leiste frei (`main` mit `pb-44`), obwohl die Leiste nur rund
               * 90 px hoch ist. Auf dem Telefon waren damit 86 px mehr Seite
               * da als Bildschirm — und beim Wischen rutschte das ganze
               * Gespräch mit, statt nur der Verlauf. Deshalb nimmt die Seite
               * sich diesen Platzhalter zurück (`-mb-44`), solange ein
               * Gespräch offen ist, und NUR auf dem Telefon.
               *
               * Auf einem iPhone 13 (664 px) liegt die Karte bei 102 px, die
               * schwebende Leiste beginnt bei 574 px — bleiben 464 px. Mit
               * `100dvh - 13rem` sind es 456, also ein Finger breit Luft über
               * der Leiste. Vorher waren es 11rem, und genau diese 118 px zu
               * viel machten die Seite scrollbar: Beim Wischen nach oben
               * rutschte das ganze Gespräch mit, statt nur der Verlauf.
               */
              className="bg-white rounded-2xl border border-gray-100 flex flex-col
                         h-[calc(100dvh-13rem)] lg:h-[62vh]">
              <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100">
                {/* §223 Zurück zur Liste — nur auf dem Telefon. Am
                    Schreibtisch steht die Liste daneben; ein Pfeil, der sie
                    „zurückholt", wäre dort sinnlos. */}
                <button
                  onClick={() => setOffen(null)}
                  aria-label="Zurück zur Übersicht"
                  className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0">
                  <ChevronLeft size={18} />
                </button>
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
                {/* §222 Löschen gehört in den Kopf JEDES Gesprächs.
                    Vorher lag es in der Verwalten-Maske — und die gibt es nur
                    für Gruppen. In einem Gespräch zu zweit führte damit kein
                    Weg dorthin, obwohl genau das der häufigste Fall ist. */}
                <button
                  onClick={() => setGespraechWeg(true)}
                  aria-label="Gespräch bei mir löschen"
                  title="Gespräch bei mir löschen"
                  className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600">
                  <Trash2 size={15} />
                </button>
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
                      {/* §221 Der Anhang: Bild zeigen, Ton abspielen, alles
                          andere zum Öffnen anbieten. */}
                      {n.dateiId && (
                        <Anhang
                          raum={offen!}
                          dateiId={n.dateiId}
                          typ={n.dateiTyp ?? ''}
                          name={n.dateiName ?? n.text}
                          groesse={n.dateiGroesse ?? null}
                          hell={n.vonMir}
                        />
                      )}
                      {(!n.dateiId || n.text !== n.dateiName) && (
                        <p className="text-sm whitespace-pre-wrap break-words">{n.text}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className={`text-[10px] ${n.vonMir ? 'text-white/70' : 'text-gray-400'}`}>
                          {uhrzeit(n.createdAt)}
                        </p>
                        {/* §240 Nur bei eigenen Nachrichten — bei fremden
                            wäre der eigene Lesestand keine Auskunft, sondern
                            eine Selbstverständlichkeit. */}
                        {n.vonMir && n.status && (
                          <Haken status={n.status} aufFarbe />
                        )}
                        {/* §221 Wegräumen. „Für alle" steht nur da, solange
                            es wirklich geht — ein Knopf, der mit einer
                            Fehlermeldung antwortet, ist kein Knopf. */}
                        <button
                          onClick={() => setLoeschMaske({
                            id: n.id, fuerAlle: Boolean(n.zurueckziehbar),
                          })}
                          aria-label="Nachricht löschen"
                          className={`text-[10px] underline ${
                            n.vonMir ? 'text-white/60 hover:text-white'
                              : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          löschen
                        </button>
                      </div>
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
                <div
                  /*
                   * §224 Rechts bleibt Platz für den Hilfeknopf.
                   *
                   * Gemessen auf einem iPhone 13: Der Absendeknopf lag bei
                   * x 326–361, der schwebende Hilfeknopf bei x 326–374 — also
                   * genau darunter, und weil er `fixed` mit z-40 ist, gewinnt
                   * er. Auf dem Bildschirm war vom Absenden nichts mehr zu
                   * sehen; es sah aus, als gäbe es keinen.
                   *
                   * 64 px Innenabstand rücken ihn auf x ~309 und damit frei.
                   * Am Schreibtisch ist der Hilfeknopf weit weg, dort bleibt
                   * es beim schmalen Rand.
                   */
                  className="flex items-end gap-2 pl-3 pr-16 lg:pr-3 py-3
                             border-t border-gray-100">
                  {/* §221 Datei anhängen. Ein verstecktes Eingabefeld, weil
                      der eigene Knopf überall gleich aussehen soll. */}
                  <input
                    ref={dateiFeld}
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) dateiSenden(f)
                      e.target.value = ''
                    }}
                  />
                  <button
                    onClick={() => dateiFeld.current?.click()}
                    disabled={sendet}
                    aria-label="Datei anhängen"
                    title="Bild, Tonaufnahme oder Datei anhängen"
                    className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100
                               disabled:opacity-40 shrink-0"
                  >
                    <Paperclip size={15} />
                  </button>
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

          {/*
            §222 Beide Rückfragen laufen über `Modal`.
            Vorher war es ein eigenes `fixed inset-0` — und auf dem Telefon lag
            der Knopf „Nur bei mir löschen" dann UNTER der schwebenden Leiste.
            `Modal` kündigt sein Öffnen an (`modal:open`), worauf die Leiste
            sich zurücknimmt; derselbe Fehler war schon bei der Stempeluhr
            aufgetreten und dort so gelöst.
          */}
          {loeschMaske && (
            <Modal open onClose={() => setLoeschMaske(null)} title="Nachricht löschen" size="sm">
              <div>
                <p className="text-sm text-gray-600">
                  {loeschMaske.fuerAlle
                    ? 'Noch hat sie niemand gelesen — du kannst sie ganz '
                      + 'zurückziehen oder nur bei dir wegräumen.'
                    : 'Sie ist schon gelesen worden. Zurückziehen geht jetzt '
                      + 'nicht mehr; du kannst sie bei dir wegräumen.'}
                </p>
                <div className="flex flex-col gap-2 mt-4">
                  {loeschMaske.fuerAlle && (
                    <button
                      onClick={() => { nachrichtLoeschen(loeschMaske.id, true); setLoeschMaske(null) }}
                      className="h-11 rounded-xl bg-red-600 text-white font-semibold text-sm">
                      Für alle zurückziehen
                    </button>
                  )}
                  <button
                    onClick={() => { nachrichtLoeschen(loeschMaske.id, false); setLoeschMaske(null) }}
                    className="h-11 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm">
                    Nur bei mir löschen
                  </button>
                  <button onClick={() => setLoeschMaske(null)}
                    className="h-11 rounded-xl text-gray-500 font-medium text-sm">
                    Abbrechen
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* §221 Ganzes Gespräch wegräumen */}
          {gespraechWeg && (
            <Modal open onClose={() => setGespraechWeg(false)}
              title="Gespräch bei dir löschen?" size="sm">
              <div>
                <p className="text-sm text-gray-600">
                  Der Verlauf verschwindet aus deiner Liste. Die andere Seite
                  behält ihn — ein Gespräch gehört beiden. Schreibt jemand
                  wieder, taucht es mit der neuen Nachricht erneut auf.
                </p>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setGespraechWeg(false)}
                    className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm">
                    Behalten
                  </button>
                  <button
                    onClick={() => { gespraechLoeschen(); setGespraechWeg(false); setMaske('keine') }}
                    className="flex-1 h-11 rounded-xl bg-red-600 text-white font-bold text-sm">
                    Löschen
                  </button>
                </div>
              </div>
            </Modal>
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

/**
 * §221 Ein Anhang im Verlauf.
 *
 * Bilder und Ton werden GEZEIGT und nicht nur verlinkt: Eine Sprachnachricht,
 * die man erst herunterladen muss, hört niemand, und ein Foto vom Dienstplan,
 * das als Datei danebensteht, sieht niemand an. Alles andere — PDF, Tabelle,
 * Textdatei — bekommt eine Zeile zum Öffnen, mit Name und Größe.
 */
function Anhang({ raum, dateiId, typ, name, groesse, hell }: {
  raum: string
  dateiId: string
  typ: string
  name: string
  groesse: number | null
  hell: boolean
}) {
  const adresse = `/api/chat/${raum}/datei?id=${dateiId}`
  const mb = groesse ? (groesse / 1024 / 1024) : 0
  const grosse = mb >= 1 ? `${mb.toFixed(1)} MB`
    : groesse ? `${Math.max(1, Math.round(groesse / 1024))} KB` : ''

  if (typ.startsWith('image/')) {
    return (
      <a href={adresse} target="_blank" rel="noreferrer" className="block mb-1">
        {/* Kein `next/image`: Die Datei liegt hinter einer Anmeldung und
            wird nicht vom Bildoptimierer geholt. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={adresse}
          alt={name}
          className="rounded-xl max-h-64 w-auto object-contain bg-black/5"
        />
      </a>
    )
  }

  if (typ.startsWith('audio/')) {
    return (
      <audio controls preload="none" src={adresse} className="mb-1 w-56 max-w-full">
        Dein Browser kann diese Aufnahme nicht abspielen.
      </audio>
    )
  }

  if (typ.startsWith('video/')) {
    return (
      <video controls preload="metadata" src={adresse}
        className="mb-1 rounded-xl max-h-64 w-auto bg-black/5" />
    )
  }

  return (
    <a
      href={adresse}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 mb-1 rounded-xl px-2.5 py-2 ${
        hell ? 'bg-white/15 hover:bg-white/25' : 'bg-white hover:bg-gray-50 border border-gray-200'}`}
    >
      <FileText size={16} className="shrink-0 opacity-70" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium truncate">{name}</span>
        {grosse && <span className="block text-[10px] opacity-60">{grosse}</span>}
      </span>
      <Download size={14} className="shrink-0 opacity-60" />
    </a>
  )
}
