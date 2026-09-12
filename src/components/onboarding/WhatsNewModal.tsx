'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { ArrowRight, ArrowLeft, X, MapPin, Brain, Zap, CheckCircle2 } from 'lucide-react'
import type { Role } from '@/lib/types'

// Bumping this key forces the modal to reappear for all users (new update).
const SEEN_KEY = 'okun_whats_new_v2_location_model'

const KF = `
@keyframes wn-in {
  from { opacity: 0; transform: scale(0.94) translateY(16px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}
@keyframes wn-slide {
  from { opacity: 0; transform: translateX(18px); }
  to   { opacity: 1; transform: translateX(0); }
}
`

interface Slide {
  icon: React.ReactNode
  title: string
  body: React.ReactNode
  cta?: string
  ctaPath?: string
}

function adminSlides(router: ReturnType<typeof useRouter>, dismiss: () => void): Slide[] {
  return [
    {
      icon: <Brain size={36} style={{ color: '#26C6C6' }} />,
      title: 'OKUN hat ein großes Update bekommen',
      body: (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
          <p>Die KI-Planung läuft jetzt <strong style={{ color: 'rgba(255,255,255,0.85)' }}>auf Standortebene</strong> – nicht mehr auf Unternehmensebene.</p>
          <p style={{ marginTop: 10 }}>Das bedeutet: jeder Standort bekommt sein eigenes intelligentes Modell mit eigenen Regeln, Schichten und Betriebszeiten – komplett unabhängig vom Rest des Unternehmens.</p>
        </div>
      ),
    },
    {
      icon: <MapPin size={36} style={{ color: '#26C6C6' }} />,
      title: 'Dein Standort – dein Modell',
      body: (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
          <p>Das <strong style={{ color: '#26C6C6' }}>Standort-Modell</strong> speichert genau:</p>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {[
              ['⏰', 'Betriebstyp', 'Mo–Fr, 7-Tage, Schichtbetrieb …'],
              ['🗓️', 'Arbeitstage', 'Welche Wochentage geplant werden'],
              ['📋', 'Planungsregeln', 'Maximalstunden, Ruhezeiten, Folgetage'],
              ['⚖️', 'Fairness-Konfig', 'Wochenenddienste, Nachtdienst-Ausgleich'],
              ['🏢', 'Einheiten', 'Gruppen, Bereiche, Stationen'],
            ].map(([emoji, name, desc]) => (
              <div key={name} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>{emoji}</span>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 12, margin: 0 }}>{name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: <Zap size={36} style={{ color: '#26C6C6' }} />,
      title: 'Was du einmalig tun musst',
      body: (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
          <p>Das Standort-Modell wird <strong style={{ color: 'rgba(255,255,255,0.85)' }}>automatisch aus deinem Onboarding generiert</strong>. Du musst nur sicherstellen, dass dein Onboarding vollständig ist.</p>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { step: '1', label: 'Standort-Onboarding öffnen', path: '/admin/onboarding', hint: 'Navigation → „Standort-Onboarding"' },
              { step: '2', label: 'Chat durchführen oder prüfen', path: null, hint: 'Schichten, Regeln, Tagesablauf beschreiben' },
              { step: '3', label: 'Fertig – Modell wird automatisch generiert', path: null, hint: 'Die KI liest deine Daten und baut das Modell' },
            ].map(({ step, label, hint }) => (
              <div key={step} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(38,198,198,0.07)',
                border: '1px solid rgba(38,198,198,0.15)',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: '#26C6C6', color: '#1A1D1F',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                }}>{step}</div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 12, margin: 0 }}>{label}</p>
                  <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, margin: 0 }}>{hint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      cta: 'Jetzt Onboarding prüfen →',
      ctaPath: '/admin/onboarding',
    },
    {
      icon: <CheckCircle2 size={36} style={{ color: '#26C6C6' }} />,
      title: 'Und dann?',
      body: (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
          <p>Sobald das Modell aktiv ist, gilt für jeden KI-Dienstplan:</p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              '✅ Der Solver kennt genau DEINE Betriebszeiten',
              '✅ Wochenende wird nur geplant wenn du 7-Tage-Betrieb hast',
              '✅ Fairness-Regeln gelten für diesen Standort – nicht alle',
              '✅ Jede Standortleitung konfiguriert unabhängig',
              '✅ Dienstplan starten: Navigation → „Dienstplanung" → Plan erstellen',
            ].map(item => (
              <p key={item} style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.62)' }}>{item}</p>
            ))}
          </div>
        </div>
      ),
      cta: 'Onboarding prüfen',
      ctaPath: '/admin/onboarding',
    },
  ]
}

function companySlides(router: ReturnType<typeof useRouter>, dismiss: () => void): Slide[] {
  return [
    {
      icon: <Brain size={36} style={{ color: '#26C6C6' }} />,
      title: 'OKUN hat ein großes Update bekommen',
      body: (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
          <p>Die KI-Planung läuft jetzt <strong style={{ color: 'rgba(255,255,255,0.85)' }}>auf Standortebene</strong> – nicht mehr auf Unternehmensebene.</p>
          <p style={{ marginTop: 10 }}>Jeder Standort bekommt ein <strong style={{ color: '#26C6C6' }}>eigenes KI-Modell</strong> mit eigenen Schichten, Regeln und Betriebszeiten – vollständig unabhängig voneinander.</p>
        </div>
      ),
    },
    {
      icon: <MapPin size={36} style={{ color: '#26C6C6' }} />,
      title: 'Was das für Ihre Standorte bedeutet',
      body: (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
          <p>Bisher galten unternehmensweite Einstellungen für alle Standorte. Ab sofort gilt:</p>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {[
              ['🏢', 'Standort A (Mo–Fr)', 'Plant nur Werktage – ganz unabhängig von Standort B'],
              ['🏥', 'Standort B (24/7)', 'Plant Wochenenden und Nachtschichten – eigene Regeln'],
              ['🏫', 'Standort C (Schichtbetrieb)', 'Eigene Fairness-Konfiguration, eigene Gruppen'],
            ].map(([emoji, name, desc]) => (
              <div key={name} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(38,198,198,0.06)',
                border: '1px solid rgba(38,198,198,0.12)',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{emoji}</span>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 12, margin: 0 }}>{name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: <Zap size={36} style={{ color: '#26C6C6' }} />,
      title: 'Was jetzt zu tun ist',
      body: (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
          <p>Stellen Sie sicher, dass jede Standortleitung das <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Standort-Onboarding abgeschlossen</strong> hat:</p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { step: '1', label: 'Standortleitung informieren', hint: 'Admin-Login → Navigation → „Standort-Onboarding"' },
              { step: '2', label: 'Chat durchführen lassen', hint: 'Schichten, Regeln, Betriebstyp, Tagesablauf' },
              { step: '3', label: 'Modell wird automatisch generiert', hint: 'Nach Abschluss ist der Standort planungsbereit' },
            ].map(({ step, label, hint }) => (
              <div key={step} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(38,198,198,0.07)',
                border: '1px solid rgba(38,198,198,0.15)',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: '#26C6C6', color: '#1A1D1F',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                }}>{step}</div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 12, margin: 0 }}>{label}</p>
                  <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, margin: 0 }}>{hint}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Bis dahin plant die KI weiterhin mit den vorhandenen Schicht- und Regelkonfigurationen.
          </p>
        </div>
      ),
    },
    {
      icon: <CheckCircle2 size={36} style={{ color: '#26C6C6' }} />,
      title: 'Vollständig unabhängige Standorte',
      body: (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
          <p>Nach Abschluss aller Onboardings gilt für jeden Standort:</p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              '✅ Eigener Betriebstyp (Mo–Fr / 7-Tage / 24/7)',
              '✅ Eigene Schichten, Gruppen und Einheiten',
              '✅ Eigene Fairness-Regeln und Stundenlimits',
              '✅ Keine gegenseitige Beeinflussung der Standorte',
              '✅ Onboarding-Status: Unternehmensübersicht → Standorte',
            ].map(item => (
              <p key={item} style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.62)' }}>{item}</p>
            ))}
          </div>
        </div>
      ),
    },
  ]
}

export function WhatsNewModal({ role }: { role: Role }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    setMounted(true)
    if (role !== 'admin' && role !== 'company') return
    try {
      if (!localStorage.getItem(SEEN_KEY)) setVisible(true)
    } catch {}
  }, [role])

  if (!mounted) return null
  if (!visible) return null
  if (role !== 'admin' && role !== 'company') return null

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, '1') } catch {}
    setVisible(false)
  }

  function go(newStep: number) {
    setStep(newStep)
    setAnimKey(k => k + 1)
  }

  const slides = role === 'admin'
    ? adminSlides(router, dismiss)
    : companySlides(router, dismiss)

  const current = slides[step]
  const isLast = step === slides.length - 1
  const progress = ((step + 1) / slides.length) * 100

  return createPortal(
    <>
      <style>{KF}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}>
        {/* Backdrop */}
        <div
          onClick={dismiss}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(8,10,12,0.86)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        />

        {/* Ambient glow */}
        <div style={{
          position: 'absolute',
          width: 700, height: 400,
          background: 'radial-gradient(ellipse at center, rgba(38,198,198,0.12) 0%, transparent 65%)',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
        }} />

        {/* Card */}
        <div style={{
          position: 'relative',
          width: '100%', maxWidth: 480,
          background: 'rgba(16,19,22,0.98)',
          border: '1px solid rgba(38,198,198,0.22)',
          borderRadius: 28,
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(38,198,198,0.06)',
          animation: 'wn-in 0.4s cubic-bezier(.34,1.1,.64,1) both',
        }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg,#26C6C6,#0E9F9F)',
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(38,198,198,0.12)',
              border: '1px solid rgba(38,198,198,0.22)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#26C6C6', display: 'inline-block' }} />
              <span style={{ color: '#26C6C6', fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>NEU IN OKUN</span>
            </div>
            <button
              onClick={dismiss}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: 4, display: 'flex', borderRadius: 8 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Slide content */}
          <div key={animKey} style={{ padding: '20px 24px 0', animation: 'wn-slide 0.25s ease both' }}>
            <div style={{ marginBottom: 14 }}>{current.icon}</div>
            <h2 style={{ color: 'white', fontSize: 20, fontWeight: 800, marginBottom: 12, lineHeight: 1.25, letterSpacing: '-0.3px' }}>
              {current.title}
            </h2>
            <div>{current.body}</div>
          </div>

          {/* Footer */}
          <div style={{ padding: '20px 24px 24px' }}>
            {/* Step dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 16 }}>
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  style={{
                    width: i === step ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === step ? '#26C6C6' : i < step ? 'rgba(38,198,198,0.35)' : 'rgba(255,255,255,0.12)',
                    border: 'none', cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    padding: 0,
                  }}
                />
              ))}
            </div>

            {/* CTA on specific steps */}
            {current.ctaPath && (
              <button
                onClick={() => { router.push(current.ctaPath!); dismiss() }}
                style={{
                  width: '100%', padding: '11px 16px',
                  background: '#26C6C6', color: '#1A1D1F',
                  borderRadius: 14, border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  marginBottom: 8, letterSpacing: '-0.1px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {current.cta} <ArrowRight size={14} />
              </button>
            )}

            {/* Nav buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {step > 0 && (
                <button
                  onClick={() => go(step - 1)}
                  style={{
                    flexShrink: 0,
                    padding: '9px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <ArrowLeft size={12} /> Zurück
                </button>
              )}
              <button
                onClick={() => isLast ? dismiss() : go(step + 1)}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  background: current.ctaPath ? 'rgba(255,255,255,0.07)' : '#26C6C6',
                  border: current.ctaPath ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  borderRadius: 12, cursor: 'pointer',
                  color: current.ctaPath ? 'rgba(255,255,255,0.5)' : '#1A1D1F',
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                {isLast ? 'Verstanden' : current.ctaPath ? 'Überspringen' : <>Weiter <ArrowRight size={12} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
