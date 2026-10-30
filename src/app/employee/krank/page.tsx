'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  Stethoscope, Camera, Check, AlertTriangle, Loader2, FileText, CloudOff,
} from 'lucide-react'
import { einreihen } from '@/lib/warteschlange'
import { schlangeGeaendert } from '@/components/offline/Warteschlange'
import { istApp, kameraFoto } from '@/lib/nativ'
import type { NachweisLageDaten } from '@/lib/types'
import { AU_ARTEN } from '@/lib/bem'
import { NACHWEIS_AB_TAG_STANDARD } from '@/lib/krankmeldung-regel'
import { bildVerkleinern } from '@/lib/bild-verkleinern'
import { direktHochladen } from '@/lib/datei-direkt'

/**
 * §137 Krankmelden vom Telefon.
 *
 * Bisher ging das nur über die Personalakte: Datei hochladen, Kategorie wählen,
 * Zeitraum eintragen — und die Fehlzeit selbst meldete jemand anders. Wer
 * morgens um halb sechs mit Fieber im Bett liegt, macht das nicht.
 *
 * Hier sind es zwei Angaben: seit wann, und voraussichtlich bis wann. Der Rest
 * ergibt sich. Die Bescheinigung kann gleich mit — oder später, wenn man sie
 * beim Arzt geholt hat.
 *
 * Was die App dabei von selbst weiß: ob überhaupt eine Bescheinigung nötig ist.
 * Das steht im Gesetz (§5 EntgFG: ab dem vierten Kalendertag, §242: der
 * Betrieb darf es früher verlangen und diese Seite liest das jetzt) und im
 * Arbeitsvertrag (der Betrieb darf sie früher verlangen) — beides muss niemand
 * im Kopf haben, der gerade krank ist.
 */

interface Krankmeldung {
  id: string
  type: string
  startDate: string
  endDate: string
  days: number
  verificationStatus?: string
  nachweisLage?: NachweisLageDaten
}

/** „19.10." — in einer Liste reicht Tag und Monat, das Jahr steht am Ende. */
const datumKurz = (iso: string) => {
  const [j, m, t] = iso.split('-')
  return t && m ? `${t}.${m}.${j}` : iso
}

const heuteStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const kalendertage = (von: string, bis: string) => {
  const a = Date.parse(`${von}T00:00:00Z`), b = Date.parse(`${bis}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}

export default function Krankmelden() {
  const { user } = useAuth()
  const [von, setVon] = useState(heuteStr())
  const [bis, setBis] = useState(heuteStr())
  const [notiz, setNotiz] = useState('')
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')
  /**
   * §138 `id: null` heißt: gemerkt, aber noch nicht übertragen. Dann gibt es
   * noch keine Fehlzeit, der die Bescheinigung zugeordnet werden könnte — der
   * Knopf zum Abfotografieren wäre eine Lüge. Er verschwindet, und stattdessen
   * steht da, wo die Bescheinigung später hingehört.
   */
  const [fertig, setFertig] = useState<
    { id: string | null; pflichtig: boolean; text: string } | null>(null)
  const [laedtHoch, setLaedtHoch] = useState(false)
  const [eingereicht, setEingereicht] = useState(false)
  const [locationId, setLocationId] = useState<string | null>(null)
  /**
   * §227 Die eigenen Krankmeldungen.
   *
   * GEMELDET
   * „Ich muss dann auch irgendwie einen Bereich mit meinen [Krankmeldungen]
   * haben, wenn ich auf Krankmelden klicke."
   *
   * Es gab keinen. Wer sich gemeldet hatte, sah danach ein grünes Häkchen und
   * beim nächsten Öffnen wieder ein leeres Formular — ob die Meldung
   * angekommen war, stand nirgends. Und wer die Bescheinigung später
   * nachreichen wollte, fand die Krankmeldung nicht mehr, zu der sie gehört.
   */
  const [meine, setMeine] = useState<Krankmeldung[] | null>(null)
  const dateiFeld = useRef<HTMLInputElement>(null)

  /**
   * §242 Ab dem wievielten Tag DIESER Betrieb eine Bescheinigung verlangt.
   *
   * DIE MELDUNG
   * „Dann wurde behauptet, dass Krankenschein erst am vierten Tag nötig ist,
   * obwohl das gar nicht stimmt. Das ist ab dem ersten Tag nötig."
   *
   * Die Regel ist seit §130 einstellbar (`auNachweisAbTag`, zu finden unter
   * Einstellungen → Krankmeldung), und der Server rechnet auch damit. Nur
   * diese Seite hat sie nie gelesen: Hier stand dreimal eine feste 4. Wer die
   * Einstellung auf 1 setzte, bekam am Bildschirm weiterhin „ab dem vierten
   * Kalendertag" zu sehen — eine Zusage, die der Betrieb gar nicht macht.
   *
   * Ohne Antwort bleibt es bei der gesetzlichen Grenze (§5 Abs.1 EntgFG). Das
   * ist die vorsichtigere Richtung: Sie verspricht niemandem, er brauche
   * keinen Schein.
   */
  const [abTag, setAbTag] = useState(NACHWEIS_AB_TAG_STANDARD)

  useEffect(() => {
    fetch('/api/org-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const wert = Number(d?.settings?.auNachweisAbTag)
        if (Number.isFinite(wert) && wert >= 1) setAbTag(wert)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user?.employeeId) return
    // §253 Nur den eigenen Datensatz — siehe `api/employees/route.ts`.
    fetch(`/api/employees?employeeId=${user.employeeId}`)
      .then(r => r.json())
      .then(d => setLocationId((d.employees ?? [])[0]?.locationId ?? user.locationId ?? null))
      .catch(() => setLocationId(user.locationId ?? null))
  }, [user?.employeeId, user?.locationId])

  const meineLaden = useCallback(() => {
    if (!user?.employeeId) return
    fetch(`/api/absences?employeeId=${user.employeeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setMeine(
        ((d?.absences ?? []) as Krankmeldung[])
          .filter(a => AU_ARTEN.includes(a.type))
          .sort((a, b) => b.startDate.localeCompare(a.startDate)),
      ))
      // Kein Netz heißt nicht „keine Meldungen" — eine leere Liste wäre hier
      // eine Lüge, und zwar eine beruhigende.
      .catch(() => setMeine(null))
  }, [user?.employeeId])

  useEffect(() => { meineLaden() }, [meineLaden])

  const tage = kalendertage(von, bis)

  const melden = useCallback(async () => {
    if (!user?.employeeId || !locationId) {
      setFehler('Für deinen Zugang ist kein Standort hinterlegt. Bitte bei der Leitung melden.')
      return
    }
    if (tage < 1) {
      setFehler('Das Ende liegt vor dem Anfang.')
      return
    }
    setSendet(true); setFehler('')
    const daten = {
      employeeId: user.employeeId,
      employeeName: user.name,
      locationId,
      type: 'krankheit',
      startDate: von,
      endDate: bis,
      days: tage,
      note: notiz.trim() || undefined,
    }
    try {
      const r = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
      })
      // §138 503 heißt: nicht erreichbar. Keine Ablehnung — die Meldung ist nie
      // angekommen und gehört in die Warteschlange.
      if (r.status === 503) throw new Error('offline')
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Die Meldung konnte nicht gespeichert werden.'); return }

      // Ob eine Bescheinigung nötig ist, sagt der Server — dort steht die
      // betriebliche Regelung. Im Zweifel lieber der Hinweis als keiner.
      const lage = await fetch(`/api/absences/${d.absence.id}/nachweise`)
        .then(x => x.json()).catch(() => null)
      setFertig({
        id: d.absence.id,
        pflichtig: lage?.lage?.pflicht?.pflichtig ?? tage >= abTag,
        text: lage?.lage?.pflicht?.begruendung ?? '',
      })
      // §227 Damit die Liste beim Zurückgehen die neue Meldung enthält und
      // nicht den Stand von vorher zeigt.
      meineLaden()
    } catch {
      // §138 Kein Netz: merken statt verlieren. Eine Krankmeldung, die im
      // Funkloch verpufft, kostet die Person am Monatsende Lohn — und die
      // Leitung erfährt erst vom Fehlen, wenn die Schicht leer bleibt.
      const { ok } = einreihen('krankmeldung', '/api/absences', daten)
      if (!ok) {
        setFehler('Keine Verbindung — und die Meldung ließ sich auch nicht merken. '
          + 'Bitte bei der Standortleitung anrufen.')
        return
      }
      schlangeGeaendert()
      setFertig({
        id: null,
        /*
         * Ohne Netz kann der Server nicht antworten — gerechnet wird mit der
         * betrieblichen Regel, die diese Seite beim Öffnen geladen hat.
         *
         * §242 Vorher stand hier eine feste 4, also die gesetzliche Grenze.
         * Für einen Betrieb, der die Bescheinigung ab dem ersten Tag verlangt,
         * war das die falsche Auskunft, und zwar in der gefährlichen Richtung:
         * Sie sagte „brauchst du nicht".
         */
        pflichtig: tage >= abTag,
        text: tage >= abTag
          ? (abTag <= 1
            ? 'Hier braucht es ab dem ersten Tag eine Bescheinigung.'
            : `Ab dem ${abTag}. Kalendertag braucht es eine Bescheinigung.`)
          : `Bei bis zu ${abTag - 1} ${abTag - 1 === 1 ? 'Kalendertag' : 'Kalendertagen'} `
            + 'in der Regel nicht. Sobald die Meldung übertragen ist, sagt dir '
            + 'die App verbindlich Bescheid.',
      })
    } finally { setSendet(false) }
  }, [user, locationId, von, bis, tage, notiz, meineLaden])

  /**
   * §139 In der App die richtige Kamera, im Browser das Dateifeld.
   *
   * Der Unterschied ist nicht Kosmetik: Die Hülle liefert ein verkleinertes
   * Bild zurück. Ein Krankenschein aus einer Telefonkamera sind sonst fünf
   * Megabyte — die überträgt sich mit einem Balken Empfang nicht, und genau da
   * steht die Person, wenn sie den Schein beim Arzt abfotografiert.
   */
  async function fotografieren() {
    if (istApp()) {
      const foto = await kameraFoto()
      // Kein Foto heißt abgebrochen oder abgelehnt — beides ist eine
      // Entscheidung und keine Störung.
      if (foto) await hochladen(foto)
      return
    }
    dateiFeld.current?.click()
  }

  async function hochladen(eingang: File) {
    if (!fertig?.id || !user?.employeeId) return
    setLaedtHoch(true); setFehler('')
    try {
      /*
       * §249 Auch im BROWSER verkleinern, nicht nur in der App-Hülle.
       *
       * §139 oben hat das Problem genau benannt — „ein Krankenschein aus
       * einer Telefonkamera sind sonst fünf Megabyte, die überträgt sich mit
       * einem Balken Empfang nicht" — und für die Hülle gelöst. Wer die App
       * im Browser benutzt, bekam weiterhin das volle Bild auf die Leitung.
       * Das ist die Mehrheit.
       */
      const datei = await bildVerkleinern(eingang)

      /*
       * §261 Zuerst der direkte Weg: Das Bild geht unmittelbar in den
       * Objektspeicher, die Anwendung erfährt nur, wo es liegt.
       *
       * Genau diese Übertragung ist die, die gemeldet wurde — „der Upload hat
       * nicht funktioniert". Sie läuft jetzt nicht mehr durch die Anwendung.
       * Ist kein Objektspeicher eingerichtet oder kommt der direkte Weg nicht
       * durch, läuft unten der alte Weg weiter.
       */
      const kontext = {
        ownerType: 'employee',
        ownerId: user.employeeId,
        kategorie: 'krankenschein',
      }
      const direkt = await direktHochladen({
        adressePfad: '/api/files/adresse',
        vermerkPfad: '/api/files',
        datei,
        kontext,
        // §130 Direkt der eben gemeldeten Fehlzeit zuordnen.
        zusatz: { gueltigVon: von, gueltigBis: bis, absenceId: fertig.id },
      })
      if (direkt.art === 'abgewiesen') { setFehler(direkt.fehler); return }
      if (direkt.art === 'ok') {
        setEingereicht(true)
        meineLaden()
        return
      }

      const form = new FormData()
      form.append('datei', datei)
      form.append('ownerType', 'employee')
      form.append('ownerId', user.employeeId)
      form.append('kategorie', 'krankenschein')
      form.append('gueltigVon', von)
      form.append('gueltigBis', bis)
      // §130 Direkt der eben gemeldeten Fehlzeit zuordnen — dann muss das
      // niemand später von Hand zusammensuchen.
      form.append('absenceId', fertig.id)
      const r = await fetch('/api/files', { method: 'POST', body: form })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        /*
         * §249 Die Nummer und die Größe mit in die Meldung.
         *
         * Ohne sie sieht eine Abweisung durch die Vermittlungsschicht genauso
         * aus wie eine durch die Anwendung. Dreimal wurde „geht nicht"
         * gemeldet, und dreimal konnte ich daraus nicht ablesen, woran es
         * lag.
         */
        setFehler(d.error
          ?? `Das Bild konnte nicht übertragen werden (Fehler ${r.status}, `
            + `${Math.round(datei.size / 1024)} kB).`)
        return
      }
      setEingereicht(true)
      meineLaden()
    } catch {
      setFehler('Keine Verbindung. Das Bild wurde nicht übertragen.')
    } finally {
      setLaedtHoch(false)
      if (dateiFeld.current) dateiFeld.current.value = ''
    }
  }

  // ── Nach der Meldung ─────────────────────────────────────────────────────
  if (fertig) {
    return (
      <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
            fertig.id ? 'bg-green-100' : 'bg-gray-200'}`}>
            {fertig.id
              ? <Check size={22} className="text-green-600" />
              : <CloudOff size={22} className="text-gray-600" />}
          </div>
          <p className="font-bold text-navy">
            {fertig.id ? 'Krankmeldung ist raus' : 'Krankmeldung gemerkt'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {fertig.id
              ? 'Deine Standortleitung sieht sie jetzt. Gute Besserung.'
              : 'Kein Netz — sie geht raus, sobald wieder Empfang da ist. '
                + 'Solange die Leitung sie nicht sieht, ruf im Zweifel kurz an.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-semibold text-navy flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
            {fertig.pflichtig ? 'Bescheinigung nötig' : 'Bescheinigung nicht nötig'}
          </p>
          <p className="text-xs text-gray-500">{fertig.text}</p>

          {!fertig.id ? (
            <p className="text-xs text-gray-500">
              Die Bescheinigung kannst du hochladen, sobald die Meldung übertragen ist —
              du findest sie dann unter &bdquo;Ich&ldquo;.
            </p>
          ) : eingereicht ? (
            <p className="text-xs text-green-700 flex items-center gap-1.5">
              <Check size={14} /> Bescheinigung eingereicht und der Krankmeldung zugeordnet.
            </p>
          ) : (
            <>
              <input
                ref={dateiFeld}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) hochladen(f) }}
              />
              <button
                onClick={fotografieren}
                disabled={laedtHoch}
                className="w-full h-12 rounded-2xl bg-brand text-navy font-semibold
                           flex items-center justify-center gap-2 active:scale-[0.98]
                           transition-transform disabled:opacity-60"
              >
                {laedtHoch
                  ? <Loader2 size={18} className="animate-spin" />
                  : <Camera size={18} />}
                Bescheinigung abfotografieren
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                Geht auch später — du findest die Krankmeldung unter &bdquo;Ich&ldquo;.
              </p>
            </>
          )}

          {fehler && <p className="text-xs text-amber-700">{fehler}</p>}
        </div>
      </div>
    )
  }

  // ── Die Meldung ──────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-navy font-bold text-xl flex items-center gap-2">
          <Stethoscope size={20} className="text-purple-600" /> Krankmelden
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Zwei Angaben genügen. Die Bescheinigung kannst du gleich mitschicken oder später
          nachreichen.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            Krank seit
          </label>
          <input
            type="date" value={von}
            onChange={e => { setVon(e.target.value); if (e.target.value > bis) setBis(e.target.value) }}
            className="w-full h-12 text-base border border-gray-200 rounded-xl px-3"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            Voraussichtlich bis
          </label>
          <input
            type="date" value={bis} min={von}
            onChange={e => setBis(e.target.value)}
            className="w-full h-12 text-base border border-gray-200 rounded-xl px-3"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {tage > 0
              ? `${tage} ${tage === 1 ? 'Kalendertag' : 'Kalendertage'}`
              : 'Das Ende liegt vor dem Anfang.'}
            {tage >= abTag && (abTag <= 1
              ? ' — dafür braucht es eine Bescheinigung, hier ab dem ersten Tag.'
              : ` — dafür braucht es ab dem ${abTag}. Kalendertag eine Bescheinigung.`)}
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            Notiz (freiwillig)
          </label>
          <input
            value={notiz}
            onChange={e => setNotiz(e.target.value)}
            placeholder={'z. B. „bin beim Arzt, melde mich nachmittags“'}
            className="w-full h-12 text-base border border-gray-200 rounded-xl px-3"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Was dir fehlt, geht niemanden etwas an — die Diagnose gehört nicht hierher.
          </p>
        </div>

        {fehler && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">{fehler}</p>
          </div>
        )}

        <button
          onClick={melden}
          disabled={sendet || tage < 1}
          className="w-full h-14 rounded-2xl bg-purple-600 text-white font-bold text-base
                     flex items-center justify-center gap-2 active:scale-[0.98]
                     transition-transform disabled:opacity-50"
        >
          {sendet ? <Loader2 size={20} className="animate-spin" /> : <Stethoscope size={20} />}
          Krankmeldung abschicken
        </button>
      </div>

      {/*
        §227 Meine Krankmeldungen.

        Was hier steht, ist genau das, was man wissen will, wenn man sich schon
        gemeldet hat: Ist sie angekommen, ist eine Bescheinigung fällig, und
        fehlt sie noch. Die Antwort auf die dritte Frage kommt aus derselben
        Rechnung wie die Pflicht nach der Meldung (`nachweisLage`) — eine
        zweite Zählung hier würde irgendwann etwas anderes sagen.
      */}
      {meine && meine.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-semibold text-navy">Meine Krankmeldungen</p>
          <div className="divide-y divide-gray-100">
            {meine.map(m => {
              // „Offen" heißt: Es ist eine Bescheinigung fällig und sie
              // deckt die Fehlzeit nicht ab. `deckung` kennt dafür vier
              // Zustände; nur zwei davon sind ein Grund zum Nachreichen.
              const offen = m.nachweisLage?.deckung === 'keine'
                || m.nachweisLage?.deckung === 'teilweise'
              return (
                <div key={m.id} className="py-2.5 flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    m.verificationStatus === 'abgelehnt' ? 'bg-red-400'
                      : offen ? 'bg-amber-400' : 'bg-green-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-navy">
                      {m.startDate === m.endDate
                        ? datumKurz(m.startDate)
                        : `${datumKurz(m.startDate)} – ${datumKurz(m.endDate)}`}
                      <span className="text-gray-400">
                        {' '}· {m.days} {m.days === 1 ? 'Tag' : 'Tage'}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {m.verificationStatus === 'abgelehnt'
                        ? 'Von der Leitung zurückgewiesen — bitte nachfragen.'
                        : m.nachweisLage?.text ?? 'Die Meldung ist bei der Leitung.'}
                    </p>
                  </div>
                  {offen && (
                    <button
                      onClick={() => {
                        // Die bestehende Meldung ist der Besitzer des Bildes.
                        // Deshalb wird sie als „fertig" gesetzt — derselbe
                        // Weg wie direkt nach dem Melden, nur später.
                        setVon(m.startDate); setBis(m.endDate)
                        setEingereicht(false)
                        setFertig({
                          id: m.id, pflichtig: true,
                          text: m.nachweisLage?.text
                            ?? 'Die Bescheinigung fehlt noch zu dieser Krankmeldung.',
                        })
                      }}
                      className="text-[11px] font-semibold text-purple-700 underline shrink-0"
                    >
                      Nachreichen
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
