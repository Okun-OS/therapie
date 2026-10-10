'use client'

import { useState, useEffect, useRef } from 'react'
import { HelpCircle, MessageCircleQuestion, Bug, X } from 'lucide-react'
import { FloatingHelp } from './FloatingHelp'
import { BugReportButton } from './BugReportButton'

/**
 * §140 Ein Knopf statt zwei.
 *
 * WAS VORHER FALSCH WAR
 * Unten links ein grauer Käfer, 40 Pixel, 80 vom Rand. Unten rechts ein
 * türkiser Fragezeichen-Kreis, 48 Pixel, 96 vom Rand. Andere Ecke, andere
 * Größe, andere Höhe, andere Farbe — drei Unterschiede ohne einen Grund. Das
 * sah nicht nach zwei Funktionen aus, sondern nach zwei Systemen, die zufällig
 * im selben Programm gelandet sind.
 *
 * Dabei beantworten beide dieselbe Lage: „Ich komme hier gerade nicht weiter."
 * Ob daraus eine Frage wird oder eine Meldung, entscheidet sich erst danach.
 * Also ein Knopf, und die Entscheidung kommt nach dem Antippen.
 *
 * WARUM ER SO ZURÜCKHALTEND IST
 * Ein dauerhaft sichtbarer roter Käfer sagt jedem Benutzer den ganzen Tag:
 * „hier ist etwas kaputt". Der Knopf ist deshalb ruhig — weiß, dünner Rand,
 * kein Alarmton — und erst offen zeigt er, dass sich hinter ihm auch das
 * Melden verbirgt.
 *
 * WARUM ER NICHT MITSCROLLT
 * Er sitzt über der Leiste unten und geht mit ihr weg, wenn sie eingeklappt
 * wird. Ein Knopf, der über dem Inhalt klebt, verdeckt auf einem Telefon
 * genau die Zeile, die man gerade lesen will.
 */
export function Hilfeknopf() {
  const [offen, setOffen] = useState(false)
  const [hilfe, setHilfe] = useState(false)
  const [melden, setMelden] = useState(false)
  const wurzel = useRef<HTMLDivElement>(null)

  // Daneben tippen schließt das Menü. Ohne das bleibt es stehen, und beim
  // nächsten Blick weiß niemand mehr, warum da etwas offen ist.
  useEffect(() => {
    if (!offen) return
    const zu = (e: MouseEvent | TouchEvent) => {
      if (!wurzel.current?.contains(e.target as Node)) setOffen(false)
    }
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setOffen(false) }
    document.addEventListener('mousedown', zu)
    document.addEventListener('touchstart', zu)
    document.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('mousedown', zu)
      document.removeEventListener('touchstart', zu)
      document.removeEventListener('keydown', taste)
    }
  }, [offen])

  // Solange eines der beiden Fenster offen ist, hat der Knopf nichts zu tun —
  // er stünde nur im Weg.
  const versteckt = hilfe || melden

  return (
    <>
      <div
        ref={wurzel}
        className={`fixed right-4 z-40 flex flex-col items-end gap-2 transition-opacity ${
          versteckt ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{ bottom: 'max(112px, calc(96px + env(safe-area-inset-bottom, 0px)))' }}
      >
        {offen && (
          <div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden
                       w-60 animate-fade-in"
            role="menu"
          >
            <button
              role="menuitem"
              onClick={() => { setOffen(false); setHilfe(true) }}
              className="flex items-start gap-3 px-4 py-3 w-full text-left active:bg-gray-50
                         hover:bg-gray-50 transition-colors"
            >
              <MessageCircleQuestion size={18} className="text-teal-600 shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-navy">Hilfe fragen</span>
                <span className="block text-xs text-gray-400">
                  Wie geht das hier?
                </span>
              </span>
            </button>

            <div className="h-px bg-gray-50" />

            <button
              role="menuitem"
              onClick={() => { setOffen(false); setMelden(true) }}
              className="flex items-start gap-3 px-4 py-3 w-full text-left active:bg-gray-50
                         hover:bg-gray-50 transition-colors"
            >
              <Bug size={18} className="text-gray-400 shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-navy">Etwas melden</span>
                <span className="block text-xs text-gray-400">
                  Fehler, Idee oder Wunsch
                </span>
              </span>
            </button>
          </div>
        )}

        <button
          onClick={() => setOffen(v => !v)}
          aria-label={offen ? 'Menü schließen' : 'Hilfe und Melden'}
          aria-expanded={offen}
          className={`w-12 h-12 rounded-full shadow-lg border flex items-center justify-center
                      transition-all active:scale-95 ${
            offen
              ? 'bg-navy border-navy text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:text-teal-700 hover:border-teal-200'}`}
        >
          {offen ? <X size={20} /> : <HelpCircle size={22} />}
        </button>
      </div>

      <FloatingHelp offen={hilfe} beiSchliessen={() => setHilfe(false)} />
      <BugReportButton offen={melden} beiSchliessen={() => setMelden(false)} />
    </>
  )
}
