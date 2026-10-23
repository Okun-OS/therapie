'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Square, Coffee, AlertTriangle, Loader2, CloudOff } from 'lucide-react'
import {
  einreihen, alle, zustandMitWarteschlange, type Uhrzustand,
} from '@/lib/warteschlange'
import {
  abweichungBeimKommen, alsDauer,
} from '@/lib/stempelgrund'
import { OVERTIME_REASONS } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { schlangeGeaendert, SCHLANGE_EREIGNIS } from '@/components/offline/Warteschlange'

/**
 * §137 Die Stempeluhr.
 *
 * Das ist der Handgriff, für den die App morgens um zehn vor sechs geöffnet
 * wird. Er ist deshalb das Erste und Größte auf dem Bildschirm — kein Scrollen,
 * kein Suchen, ein Daumendruck.
 *
 * Drei Dinge, die hier bewusst so sind:
 *
 *   DER ZUSTAND KOMMT VOM SERVER. Vorher hat die Startseite nur eine Anzeige
 *   umgeschaltet und gar nicht gestempelt. Wer darauf gedrückt hat und
 *   weggegangen ist, war nicht eingestempelt — ein Fehler, der aussieht wie
 *   Erfolg. Jetzt gilt, was der Server sagt, und nichts anderes.
 *
 *   EIN KNOPF ZUR ZEIT. Wer eingestempelt ist, sieht „Ausstempeln" und
 *   „Pause" — nicht beides plus „Einstempeln" ausgegraut. Ein ausgegrauter
 *   Knopf ist eine Frage, die niemand gestellt hat.
 *
 *   DIE LAUFENDE ZEIT STEHT DA. Nicht als Zierde: Wer sie sieht, merkt, dass
 *   er gestern das Ausstempeln vergessen hat — und zwar sofort und nicht erst
 *   beim Monatsabschluss.
 */

type Zustand = Uhrzustand

/**
 * §138 Der zuletzt bekannte Stand des Servers, damit die Uhr auch ohne Netz
 * etwas anzeigen kann. Ohne ihn stünde nach einem Neuladen im Funkloch
 * „nicht eingestempelt", obwohl die Person längst arbeitet.
 */
const LETZTER_STAND = 'okun_stempel_stand'

function standLesen(): Zustand | null {
  try {
    const roh = window.localStorage.getItem(LETZTER_STAND)
    return roh ? JSON.parse(roh) : null
  } catch { return null }
}

function standSchreiben(z: Zustand) {
  try { window.localStorage.setItem(LETZTER_STAND, JSON.stringify(z)) } catch { /* egal */ }
}

interface Log {
  id: string
  date: string
  clockIn: string
  clockInAt?: string | null
  breakStart?: string | null
  breakMinutes?: number | null
  quelle?: string | null
}

const ZEIT = (ms: number) => {
  const min = Math.floor(ms / 60000)
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

export function Stempeluhr({ dienst }: { dienst?: { name: string; von: string; bis: string } | null }) {
  const [zustand, setZustand] = useState<Zustand>({ laeuft: false, pause: false })
  const [log, setLog] = useState<Log | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [arbeitet, setArbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')
  const [jetzt, setJetzt] = useState(() => Date.now())
  const [offline, setOffline] = useState(false)
  const ersterLauf = useRef(true)

  // §203 Die beiden Rückfragen: vor dem Einstempeln ohne Dienst, und nach dem
  // Ausstempeln, wenn die Zeit nicht zum Plan passt.
  // §219 Der Server entscheidet, WELCHE der drei Rückfragen es ist (kein
  // Dienst, zu früh, zu spät) — und schickt den passenden Wortlaut mit. Ein
  // fest eingebauter Text hier hätte bei zwei von drei Fällen danebengelegen.
  const [frageKommen, setFrageKommen] =
    useState<{ art: string; titel: string; text: string } | null>(null)
  const [nachfrage, setNachfrage] =
    useState<{ art: string; text: string; logId: string } | null>(null)
  const [grund, setGrund] = useState('')
  const [kategorie, setKategorie] = useState('')
  const [schickt, setSchickt] = useState(false)

  const holen = useCallback(async () => {
    try {
      const r = await fetch('/api/time-tracking/stempeln')
      if (!r.ok) throw new Error('offline')
      // §138 Der Service Worker liefert im Funkloch den zuletzt gespeicherten
      // Stand aus und sagt das im Kopf der Antwort. Das ist ein Stand von
      // vorhin, kein Stand von jetzt — und muss auch so angezeigt werden.
      const gespeichert = r.headers.get('X-Okun-Stand') === 'gespeichert'
      const d = await r.json()
      const vomServer: Zustand = d.zustand ?? { laeuft: false, pause: false }
      if (!gespeichert) standSchreiben(vomServer)
      // §138 Was noch in der Warteschlange liegt, kennt der Server nicht —
      // angezeigt wird der Stand INKLUSIVE dieser Vorgänge.
      setZustand(zustandMitWarteschlange(vomServer, alle()))
      setLog(d.log ?? null)
      setOffline(gespeichert)
    } catch {
      // Ohne Netz: der letzte bekannte Stand plus das, was seither gemerkt wurde.
      const gespeichert = standLesen() ?? { laeuft: false, pause: false }
      setZustand(zustandMitWarteschlange(gespeichert, alle()))
      setOffline(true)
    } finally {
      setLaedt(false)
      ersterLauf.current = false
    }
  }, [])

  useEffect(() => {
    holen()
    // Sobald die Warteschlange etwas losgeworden ist, gilt wieder der Server.
    window.addEventListener(SCHLANGE_EREIGNIS, holen)
    window.addEventListener('online', holen)
    return () => {
      window.removeEventListener(SCHLANGE_EREIGNIS, holen)
      window.removeEventListener('online', holen)
    }
  }, [holen])

  // Die laufende Zeit tickt mit. Eine Minute Takt reicht — sekundengenau
  // flackert nur und kostet Strom.
  useEffect(() => {
    if (!zustand.laeuft) return
    const takt = setInterval(() => setJetzt(Date.now()), 30000)
    return () => clearInterval(takt)
  }, [zustand.laeuft])

  /**
   * §203 Einstempeln ohne geplanten Dienst — erst fragen.
   *
   * Gesperrt wird nicht: Es gibt den Einspringer, die Übergabe, den Notfall,
   * und wer dann nicht stempeln kann, arbeitet unbezahlt. Was fehlt, ist
   * nicht die Erlaubnis, sondern die Erklärung.
   *
   * Gefragt wird HIER und nicht erst nach einer Antwort des Servers: Sonst
   * ginge es im Funkloch gar nicht. Der Server prüft trotzdem noch einmal —
   * ein Gerät, das die Rückfrage überspringt, soll nicht die Lücke sein.
   */
  function kommen() {
    /*
     * §219 Gefragt wird auch, wenn der Dienst zwar geplant ist, aber zu einer
     * anderen Zeit. Vorher reichte irgendein Dienst am Tag — wer um 23 Uhr
     * einstempelte, während 07:15 im Plan stand, wurde nichts gefragt.
     */
    const jetztUhr = new Date().toTimeString().slice(0, 5)
    const abw = abweichungBeimKommen(
      dienst ? { von: dienst.von, bis: dienst.bis } : null, jetztUhr)
    if (abw) {
      const spaet = abw.art === 'kommen-spaet'
      setFrageKommen({
        art: abw.art,
        titel: abw.art === 'ohne-dienst' ? 'Du hast heute keinen Dienst'
          : spaet ? 'Du fängst später an als geplant'
            : 'Du fängst früher an als geplant',
        text: abw.art === 'ohne-dienst'
          ? 'Trotzdem einstempeln? Schreib bitte kurz dazu, warum — das spart '
            + 'deiner Leitung am Monatsende eine Rückfrage.'
          : `Geplant ist ${abw.plan!.von}–${abw.plan!.bis}, jetzt ist es `
            + `${jetztUhr} — ${alsDauer(abw.minuten)} ${spaet ? 'später' : 'früher'}. `
            + 'Schreib bitte kurz dazu, warum.',
      })
      setGrund('')
      return
    }
    stempeln('kommen')
  }

  async function stempeln(aktion: string, grundText?: string) {
    setArbeitet(aktion); setFehler(''); setHinweis('')
    // Der Zeitpunkt entsteht HIER, nicht beim Absenden: Im Funkloch zählt
    // später die Zeit des Stempelns, nicht die des Hochladens.
    const zeitpunkt = new Date().toISOString()
    const daten: Record<string, unknown> = { aktion, zeitpunkt }
    if (grundText) daten.grund = grundText

    try {
      const r = await fetch('/api/time-tracking/stempeln', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
      })

      // §138 503 heißt: nicht erreichbar (Netz weg, Server gerade nicht da).
      // Das ist keine Ablehnung — der Stempel ist nie angekommen und gehört
      // in die Warteschlange, nicht in eine Fehlermeldung.
      if (r.status === 503) throw new Error('offline')

      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        // §203 Der Server hält den Dienstplan für maßgeblich, nicht die
        // Anzeige. Sagt er „ohne Dienst", wird gefragt — auch wenn oben ein
        // Dienst stand, der inzwischen abgesagt wurde.
        if (d.code === 'GRUND_NOETIG') {
          setFrageKommen(d.frage ?? {
            art: 'ohne-dienst', titel: 'Du hast heute keinen Dienst',
            text: 'Trotzdem einstempeln? Schreib bitte kurz dazu, warum.',
          })
          setGrund('')
          return
        }
        setFehler(d.error ?? 'Das hat nicht geklappt.')
        if (d.zustand) setZustand(d.zustand)
        return
      }
      standSchreiben(d.zustand)
      setZustand(d.zustand); setLog(d.log ?? null)
      setJetzt(Date.now())
      setOffline(false)
      if (d.hinweis) setHinweis(d.hinweis)
      // §203 Die gearbeitete Zeit passt nicht zum Plan. Der Stempel ist schon
      // gesetzt — gefragt wird danach.
      if (d.nachfrage) { setNachfrage(d.nachfrage); setGrund(''); setKategorie('') }
    } catch {
      // §138 Kein Netz: merken statt verlieren. Die angezeigte Uhr geht
      // trotzdem weiter — für den Menschen hat der Handgriff stattgefunden.
      const { ok } = einreihen('stempeln', '/api/time-tracking/stempeln', daten)
      if (!ok) {
        setFehler('Kein Netz — und der Stempel ließ sich auch nicht merken. '
          + 'Bitte der Standortleitung Bescheid geben.')
        return
      }
      setZustand(z => zustandMitWarteschlange(z, [{
        id: '', art: 'stempeln', pfad: '', methode: 'POST',
        daten, erzeugtAm: zeitpunkt, versuche: 0,
      }]))
      setOffline(true)
      setHinweis('Kein Netz — gemerkt und wird übertragen, sobald es wieder geht.')
      schlangeGeaendert()
    } finally {
      setArbeitet(null)
    }
  }

  /** Den nachgereichten Grund abschicken. */
  async function begruendungSenden() {
    if (!nachfrage) return
    setSchickt(true)
    try {
      const r = await fetch('/api/time-tracking/begruendung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: nachfrage.logId, grund, kategorie }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setFehler(d.error ?? 'Der Grund ließ sich nicht speichern.')
        return
      }
      const d = await r.json().catch(() => ({}))
      setNachfrage(null)
      setGrund('')
      setKategorie('')
      setHinweis(d.antrag
        ? 'Danke — der Überstundenantrag ist raus.'
        : 'Danke — das steht jetzt dabei.')
    } catch {
      /*
       * §203 Ohne Netz geht der Grund verloren, der Stempel nicht.
       *
       * Das ist die richtige Reihenfolge: Die gearbeitete Zeit ist Lohn, die
       * Begründung ist Erklärung. Die Abweichung bleibt beim Eintrag
       * vermerkt — die Leitung sieht „länger geblieben, ohne Angabe" und
       * kann fragen. Eine Begründung zu merken und Tage später
       * nachzuschicken wäre schlimmer: Dann stünde ein Satz an einem
       * Arbeitstag, an den sich niemand mehr erinnert.
       */
      setFehler('Kein Netz — der Stempel ist gesetzt, der Grund nicht. '
        + 'Bitte sag deiner Leitung kurz Bescheid.')
      setNachfrage(null)
    } finally {
      setSchickt(false)
    }
  }

  const seit = log?.clockInAt ? new Date(log.clockInAt).getTime() : null
  const dauer = seit ? ZEIT(jetzt - seit) : null
  // Über acht Stunden ohne Ausstempeln: fast immer ein vergessener Stempel.
  const verdaechtigLang = seit ? (jetzt - seit) / 3600000 > 12 : false

  return (
    <div className="rounded-3xl bg-navy text-white p-5 shadow-lg">
      {/* Kopf: was heute ansteht */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-white/60 text-xs font-medium">
            {dienst ? 'Heute' : 'Kein Dienst geplant'}
          </p>
          {dienst && (
            <p className="text-white font-bold text-lg leading-tight">
              {dienst.name}
              <span className="text-white/70 font-normal text-base">
                {' '}· {dienst.von}–{dienst.bis}
              </span>
            </p>
          )}
        </div>
        {zustand.laeuft && (
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <span className={`w-2 h-2 rounded-full ${
                zustand.pause ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`} />
              <span className="text-white/70 text-xs">
                {zustand.pause ? 'Pause' : 'läuft'}
              </span>
            </div>
            <p className="text-white text-2xl font-bold tabular-nums leading-tight">{dauer}</p>
            <p className="text-white/50 text-[11px]">seit {log?.clockIn} Uhr</p>
          </div>
        )}
      </div>

      {verdaechtigLang && (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-400/15 p-3 mb-3">
          <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-amber-100 text-xs">
            Du bist seit über zwölf Stunden eingestempelt. Hast du gestern das Ausstempeln
            vergessen? Stemple aus — die Standortleitung kann die Zeit danach richtigstellen.
          </p>
        </div>
      )}

      {/* Der Handgriff */}
      {laedt ? (
        <div className="h-16 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-white/40" />
        </div>
      ) : !zustand.laeuft ? (
        <button
          onClick={kommen}
          disabled={!!arbeitet}
          className="w-full h-16 rounded-2xl bg-brand text-navy font-bold text-lg
                     flex items-center justify-center gap-2.5 active:scale-[0.98]
                     transition-transform disabled:opacity-60"
        >
          {arbeitet === 'kommen'
            ? <Loader2 size={22} className="animate-spin" />
            : <Play size={22} fill="currentColor" />}
          Einstempeln
        </button>
      ) : (
        <div className="flex gap-2.5">
          <button
            onClick={() => stempeln('gehen')}
            disabled={!!arbeitet}
            className="flex-1 h-16 rounded-2xl bg-white text-navy font-bold text-lg
                       flex items-center justify-center gap-2 active:scale-[0.98]
                       transition-transform disabled:opacity-60"
          >
            {arbeitet === 'gehen'
              ? <Loader2 size={22} className="animate-spin" />
              : <Square size={20} fill="currentColor" />}
            Ausstempeln
          </button>
          <button
            onClick={() => stempeln(zustand.pause ? 'pause-ende' : 'pause-start')}
            disabled={!!arbeitet}
            aria-label={zustand.pause ? 'Pause beenden' : 'Pause beginnen'}
            className={`w-20 h-16 rounded-2xl font-semibold text-sm flex flex-col
                        items-center justify-center gap-1 active:scale-[0.98]
                        transition-transform disabled:opacity-60 ${
              zustand.pause ? 'bg-amber-400 text-navy' : 'bg-white/15 text-white'}`}
          >
            <Coffee size={18} />
            {zustand.pause ? 'zurück' : 'Pause'}
          </button>
        </div>
      )}

      {(fehler || hinweis) && (
        <p className={`text-xs mt-3 ${fehler ? 'text-amber-200' : 'text-white/60'}`}>
          {fehler || hinweis}
        </p>
      )}

      {offline && !fehler && (
        <p className="text-white/50 text-[11px] mt-3 flex items-center gap-1.5">
          <CloudOff size={12} /> Ohne Netz — zu sehen ist der letzte bekannte Stand.
          Was du jetzt stempelst, wird gemerkt und geht raus, sobald wieder Empfang da ist.
        </p>
      )}

      {log?.quelle === 'offline' && !fehler && !offline && (
        <p className="text-white/50 text-[11px] mt-3">
          Ohne Netz gestempelt — die Zeit des Stempelns zählt, nicht die der Übertragung.
        </p>
      )}

      {/* §203/§219 Vor dem Einstempeln: kein Dienst, oder nicht zu dieser Zeit */}
      {frageKommen && (
        <Rueckfrage
          titel={frageKommen.titel}
          text={frageKommen.text}
          platzhalter={frageKommen.art === 'ohne-dienst'
            ? 'z. B. für Melanie eingesprungen'
            : 'z. B. Dienst mit Melanie getauscht'}
          grund={grund}
          setGrund={setGrund}
          laeuft={!!arbeitet}
          bestaetigen="Ja, einstempeln"
          abbrechen={() => { setFrageKommen(null); setGrund('') }}
          absenden={() => { setFrageKommen(null); stempeln('kommen', grund.trim()) }}
        />
      )}

      {/* §203 Nach dem Ausstempeln, wenn die Zeit nicht zum Plan passt */}
      {nachfrage && (
        <Rueckfrage
          // §219 „Du bist früher gegangen" stand hier auch dann, wenn jemand
          // um 22:30 ging — verglichen wird die Dauer, nicht die Uhrzeit.
          // Gemeint war immer: Die Stunden kommen nicht zusammen.
          titel={nachfrage.art === 'laenger' ? 'Du warst länger da'
            : nachfrage.art === 'frueher' ? 'Deine Stunden stimmen nicht'
              : 'Heute war kein Dienst geplant'}
          text={`${nachfrage.text} Woran lag es?`}
          platzhalter="z. B. Übergabe hat länger gedauert"
          grund={grund}
          setGrund={setGrund}
          laeuft={schickt}
          bestaetigen="Speichern"
          // §203 Nur bei Mehrarbeit: Daraus wird ein Überstundenantrag, und
          // die Leitung sieht die Anträge gruppiert. Beim früheren Gehen gibt
          // es nichts zu gruppieren — dort wären die Kategorien nur eine
          // zusätzliche Frage ohne Zweck.
          kategorien={nachfrage.art === 'laenger' ? [...OVERTIME_REASONS] : undefined}
          kategorie={kategorie}
          setKategorie={setKategorie}
          // Ausgestempelt ist ausgestempelt — wer jetzt wegwischt, verliert
          // nichts als die Erklärung. Deshalb „Später", nicht „Abbrechen".
          abbrechenText="Später"
          abbrechen={() => { setNachfrage(null); setGrund('') }}
          absenden={begruendungSenden}
        />
      )}
    </div>
  )
}

/**
 * §203 Die Rückfrage.
 *
 * Eine Maske für beide Fälle: Zwei Abschriften derselben Eingabe laufen
 * auseinander — dann hat die eine eine Mindestlänge und die andere nicht.
 *
 * Sie liegt über dem ganzen Bildschirm und nicht in der Karte: Auf einem
 * Telefon ist die Stempeluhr oben, und ein Eingabefeld, das die Tastatur
 * verdeckt, ist keins.
 */
function Rueckfrage({
  titel, text, platzhalter, grund, setGrund, laeuft,
  bestaetigen, abbrechen, absenden, abbrechenText = 'Abbrechen',
  kategorien, kategorie, setKategorie,
}: {
  titel: string
  text: string
  platzhalter: string
  grund: string
  setGrund: (w: string) => void
  laeuft: boolean
  bestaetigen: string
  abbrechenText?: string
  abbrechen: () => void
  absenden: () => void
  kategorien?: string[]
  kategorie?: string
  setKategorie?: (w: string) => void
}) {
  /*
   * §219 Der Knopf sagt, warum er nicht geht.
   *
   * Vorher war er bei zu kurzem Text einfach ausgegraut — ohne ein Wort
   * dazu. Wer eine Kategorie angetippt und nichts geschrieben hatte, sah
   * einen toten Knopf und keinen Hinweis; genau diese Rückmeldung kam aus
   * dem Betrieb. Jetzt steht darunter, was noch fehlt.
   *
   * Der freie Text zählt weiter, die Kategorie ist das Beiwerk: Umgekehrt
   * stünde in der Übersicht der Leitung siebenmal „Personalmangel" und sonst
   * nichts.
   */
  const reicht = grund.trim().length >= 3

  /*
   * §203 Die Maske läuft über `Modal` und damit über ein Portal am `body`.
   *
   * Erster Versuch war ein eigenes `fixed inset-0 z-50` innerhalb der Karte.
   * Im Bild lag die Rückfrage dann UNTER der schwebenden Leiste: `main` trägt
   * eine Animation und bildet damit einen eigenen Stapelkontext — ein z-Wert
   * darin kommt gegen ein Geschwisterelement draußen nicht an, egal wie hoch
   * er ist. Dieselbe Komponente kündigt außerdem ihr Öffnen an, worauf die
   * Leiste sich zurücknimmt.
   */
  return (
    <Modal open onClose={abbrechen} title={titel} size="sm">
      <p className="text-sm text-gray-600">{text}</p>

      {kategorien && setKategorie && (
        <div className="flex flex-wrap gap-2 mt-4">
          {kategorien.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setKategorie(kategorie === k ? '' : k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${
                kategorie === k
                  ? 'bg-brand border-brand text-navy'
                  : 'border-gray-200 text-gray-600'}`}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <textarea
        autoFocus
        value={grund}
        onChange={e => setGrund(e.target.value)}
        placeholder={platzhalter}
        rows={3}
        maxLength={500}
        className="w-full mt-4 rounded-2xl border border-gray-200 px-4 py-3 text-sm
                   text-navy focus:outline-none focus:ring-2 focus:ring-teal-500/30
                   focus:border-teal-500 resize-none"
      />

      {!reicht && (
        <p className="text-xs text-gray-500 mt-2">
          {grund.trim().length === 0
            ? 'Schreib bitte kurz, woran es lag — ein paar Worte genügen.'
            : 'Noch ein paar Zeichen, dann lässt es sich speichern.'}
        </p>
      )}

      <div className="flex gap-2.5 mt-4">
        <button
          onClick={abbrechen}
          disabled={laeuft}
          className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700
                     font-semibold text-sm active:bg-gray-200 disabled:opacity-50"
        >
          {abbrechenText}
        </button>
        <button
          onClick={absenden}
          disabled={!reicht || laeuft}
          className="flex-1 h-12 rounded-2xl bg-brand text-navy font-bold text-sm
                     flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {laeuft && <Loader2 size={16} className="animate-spin" />}
          {bestaetigen}
        </button>
      </div>
    </Modal>
  )
}
