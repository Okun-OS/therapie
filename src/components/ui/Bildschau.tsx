'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download } from 'lucide-react'

/**
 * §263 Ein Bild groß ansehen — ohne die App zu verlassen.
 *
 * ZWEI MELDUNGEN, EINE URSACHE
 *
 *   „Man kann das Bild nicht richtig schön vergrößern, gibt es da eine
 *    Lösung?"
 *   „Plus man sieht jetzt in der App oben in der App, und die Website kommt
 *    immer noch!!!"
 *
 * Beides kam von derselben Stelle. Ein Anhang war ein Verweis:
 * `<a href="/api/chat/…/datei" target="_blank">`. Seit §260 antwortet diese
 * Adresse mit einer Umleitung in den Objektspeicher — und damit auf eine
 * FREMDE Adresse. iOS lässt eine installierte App bei einer fremden Adresse
 * nicht im Vollbild: Es öffnet einen Browser darin, mit Adresszeile oben. Ab
 * da ist man nicht mehr in der App, sondern in Safari — und dort steht dann
 * auch wieder die Verkaufsseite.
 *
 * Auf dem Bildschirmfoto war es zu sehen: oben stand
 * `a0dc8.eu.r2.cloudflarestorage.com`. Das war meine Umleitung.
 *
 * WARUM EIN EIGENER ZOOM UND NICHT DER DES BROWSERS
 * Weil es den hier nicht gibt. Das Grundgerüst setzt
 * `maximum-scale=1, user-scalable=no` — ohne das springt auf dem Telefon bei
 * jedem Tippen in ein Eingabefeld die ganze Seite. Die Folge: Zwei Finger tun
 * nirgends etwas, auch nicht auf einem Foto. Genau das war die Meldung.
 *
 * Also eine eigene Lupe: zwei Finger zum Vergrößern, ein Finger zum
 * Verschieben, Doppeltippen springt zwischen ganz und nah.
 *
 * WAS DIESE ANSICHT NICHT TUT
 * Sie verlässt die Seite nicht. Kein neuer Tab, keine fremde Adresse, keine
 * Adresszeile — und der Speicher bleibt unsichtbar, wo er hingehört.
 */

/** Weiter als das Sechsfache wird aus jedem Foto ein Pixelbrei. */
const HOECHSTENS = 6
/** Wohin ein Doppeltipp springt. Nah genug, um eine Unterschrift zu lesen. */
const DOPPELTIPP = 2.5

interface Lage { s: number; x: number; y: number }

const GANZ: Lage = { s: 1, x: 0, y: 0 }

export function Bildschau({ adresse, name, onSchliessen, onHerunterladen }: {
  adresse: string
  name: string
  onSchliessen: () => void
  /** Fehlt er, wird kein Knopf zum Sichern angeboten. */
  onHerunterladen?: () => void
}) {
  const buehne = useRef<HTMLDivElement>(null)
  const [lage, setLage] = useState<Lage>(GANZ)
  const [laedt, setLaedt] = useState(true)

  /*
   * Was während einer Geste gilt. Bewusst in einer Referenz und nicht im
   * Zustand: Bei jedem Finger-Zwischenschritt neu zu zeichnen, nur um
   * Startwerte zu merken, macht die Geste auf einem älteren Telefon zäh.
   */
  const geste = useRef<{
    art: 'kneifen' | 'schieben' | null
    startLage: Lage
    startAbstand: number
    mitte: { x: number; y: number }
    letzter: { x: number; y: number }
  }>({ art: null, startLage: GANZ, startAbstand: 0, mitte: { x: 0, y: 0 }, letzter: { x: 0, y: 0 } })

  const letzterTipp = useRef(0)

  /**
   * Die Verschiebung so begrenzen, dass immer Bild zu sehen ist.
   *
   * Ohne das lässt sich ein vergrößertes Foto aus dem Bild schieben, und dann
   * steht man vor einer schwarzen Fläche und weiß nicht, warum.
   */
  const zaehmen = useCallback((l: Lage): Lage => {
    if (l.s <= 1) return GANZ
    const k = buehne.current
    if (!k) return l
    const b = k.clientWidth
    const h = k.clientHeight
    return {
      s: Math.min(l.s, HOECHSTENS),
      x: Math.min(0, Math.max((1 - l.s) * b, l.x)),
      y: Math.min(0, Math.max((1 - l.s) * h, l.y)),
    }
  }, [])

  /**
   * Auf einen Punkt zu vergrößern.
   *
   * Der Punkt unter den Fingern soll unter den Fingern bleiben — sonst
   * rutscht das Bild beim Kneifen weg, und das fühlt sich kaputt an. Aus
   *     Bildpunkt = (Bildschirmpunkt − Verschiebung) / Maßstab
   * folgt für den neuen Maßstab:
   *     Verschiebung' = Punkt − (Punkt − Verschiebung) · Maßstab'/Maßstab
   */
  const aufPunkt = useCallback((von: Lage, neuerMassstab: number, px: number, py: number): Lage => {
    const s = Math.min(Math.max(neuerMassstab, 1), HOECHSTENS)
    const f = s / von.s
    return zaehmen({ s, x: px - (px - von.x) * f, y: py - (py - von.y) * f })
  }, [zaehmen])

  const inDieBuehne = (t: Touch) => {
    const r = buehne.current?.getBoundingClientRect()
    return { x: t.clientX - (r?.left ?? 0), y: t.clientY - (r?.top ?? 0) }
  }

  /*
   * Die Finger-Behandlung hängt direkt am Element und NICHT über React-
   * Eigenschaften dran. Der Grund ist `preventDefault`: React hängt
   * `touchmove` als „passiv" ein, und ein passiver Zuhörer darf das Wischen
   * der Seite nicht unterdrücken. Ohne das scrollt beim Verschieben des
   * Bildes die Seite darunter mit.
   */
  useEffect(() => {
    const k = buehne.current
    if (!k) return

    const anfang = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = inDieBuehne(e.touches[0])
        const b = inDieBuehne(e.touches[1])
        geste.current = {
          art: 'kneifen',
          startLage: lage,
          startAbstand: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          mitte: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          letzter: { x: 0, y: 0 },
        }
      } else if (e.touches.length === 1) {
        const p = inDieBuehne(e.touches[0])
        geste.current = {
          art: lage.s > 1 ? 'schieben' : null,
          startLage: lage,
          startAbstand: 0,
          mitte: p,
          letzter: p,
        }
      }
    }

    const bewegen = (e: TouchEvent) => {
      const g = geste.current
      if (!g.art) return
      e.preventDefault()

      if (g.art === 'kneifen' && e.touches.length === 2) {
        const a = inDieBuehne(e.touches[0])
        const b = inDieBuehne(e.touches[1])
        const abstand = Math.hypot(a.x - b.x, a.y - b.y)
        setLage(aufPunkt(g.startLage, g.startLage.s * (abstand / g.startAbstand), g.mitte.x, g.mitte.y))
        return
      }

      if (g.art === 'schieben' && e.touches.length === 1) {
        const p = inDieBuehne(e.touches[0])
        const dx = p.x - g.letzter.x
        const dy = p.y - g.letzter.y
        g.letzter = p
        setLage(alt => zaehmen({ ...alt, x: alt.x + dx, y: alt.y + dy }))
      }
    }

    const ende = () => {
      geste.current.art = null
      setLage(alt => zaehmen(alt))
    }

    k.addEventListener('touchstart', anfang, { passive: false })
    k.addEventListener('touchmove', bewegen, { passive: false })
    k.addEventListener('touchend', ende)
    k.addEventListener('touchcancel', ende)
    return () => {
      k.removeEventListener('touchstart', anfang)
      k.removeEventListener('touchmove', bewegen)
      k.removeEventListener('touchend', ende)
      k.removeEventListener('touchcancel', ende)
    }
  }, [lage, aufPunkt, zaehmen])

  // Die Flucht nach oben: Escape schließt. Am Schreibtisch erwartet das jeder.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') onSchliessen() }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  // Solange die Schau offen ist, soll die Liste darunter nicht mitscrollen.
  useEffect(() => {
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = vorher }
  }, [])

  function tippen(e: React.MouseEvent) {
    const jetzt = Date.now()
    const istDoppel = jetzt - letzterTipp.current < 300
    letzterTipp.current = jetzt
    if (!istDoppel) return

    const r = buehne.current?.getBoundingClientRect()
    const px = e.clientX - (r?.left ?? 0)
    const py = e.clientY - (r?.top ?? 0)
    setLage(alt => (alt.s > 1 ? GANZ : aufPunkt(alt, DOPPELTIPP, px, py)))
  }

  /*
   * §263 Die Schau hängt am Dokument selbst, nicht dort, wo sie aufgerufen
   * wird.
   *
   * Ohne das lag die Kopfleiste der App ÜBER dem Bild — gefunden vom eigenen
   * Nachweis, der den Schließen-Knopf nicht treffen konnte. Der Grund ist
   * eine Eigenheit von CSS: `z-index` gilt nur innerhalb des Stapels, zu dem
   * ein Element gehört. Eine Nachrichtenblase steht in einem solchen Stapel,
   * und dann nützt auch 10000 nichts gegen eine Leiste mit 30, die weiter
   * oben hängt.
   *
   * Am Dokument selbst gibt es diesen Deckel nicht.
   */
  if (typeof document === 'undefined') return null

  return createPortal((
    <div
      className="fixed inset-0 z-[10000] bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Bild: ${name}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 text-white/90 shrink-0">
        <button
          onClick={onSchliessen}
          aria-label="Schließen"
          className="rounded-full p-2 hover:bg-white/10 active:bg-white/20"
        >
          <X size={20} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
        {onHerunterladen && (
          <button
            onClick={onHerunterladen}
            aria-label="Sichern"
            className="rounded-full p-2 hover:bg-white/10 active:bg-white/20"
          >
            <Download size={20} />
          </button>
        )}
      </div>

      <div
        ref={buehne}
        onClick={tippen}
        className="relative flex-1 overflow-hidden touch-none select-none"
      >
        {laedt && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
            Wird geladen …
          </div>
        )}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${lage.x}px, ${lage.y}px) scale(${lage.s})`,
            transformOrigin: '0 0',
            // Während der Geste KEINE Übergangszeit — sonst läuft das Bild
            // den Fingern hinterher.
            transition: geste.current.art ? 'none' : 'transform 160ms ease-out',
          }}
        >
          {/* Kein `next/image`: Die Datei liegt hinter einer Anmeldung und
              wird nicht vom Bildoptimierer geholt. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={adresse}
            alt={name}
            onLoad={() => setLaedt(false)}
            onError={() => setLaedt(false)}
            draggable={false}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </div>

      <p className="shrink-0 px-4 pb-4 pt-1 text-center text-[11px] text-white/40">
        {lage.s > 1
          ? 'Einen Finger zum Verschieben · doppelt tippen für die ganze Ansicht'
          : 'Zwei Finger zum Vergrößern · oder doppelt tippen'}
      </p>
    </div>
  ), document.body)
}
