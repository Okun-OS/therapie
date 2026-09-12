'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { Brain, Sparkles, CheckCircle2, X, ArrowRight } from 'lucide-react'
import type { Role } from '@/lib/types'

// Permanently suppressed once the model is generated
const DONE_KEY = 'okun_lm_migration_done'
// Timestamp of last "Später" dismiss — re-shows after SNOOZE_DAYS
const SNOOZE_KEY = 'okun_lm_migration_snoozed'
const SNOOZE_DAYS = 3

// Pages where the modal always shows, regardless of snooze
const ALWAYS_SHOW_PATHS = ['/admin/model', '/admin/onboarding']

const KF = `
@keyframes lm-in {
  from { opacity: 0; transform: scale(0.93) translateY(20px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}
@keyframes lm-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.08); }
}`

interface Props {
  role: Role
}

export function LocationModelMigrationModal({ role }: Props) {
  const [show, setShow] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    if (role !== 'admin') return
    if (typeof localStorage === 'undefined') return

    // Permanently done — never show again
    if (localStorage.getItem(DONE_KEY)) return

    const isAlwaysShowPage = ALWAYS_SHOW_PATHS.some(p => pathname === p)

    // On regular pages respect the snooze timer
    if (!isAlwaysShowPage) {
      const snoozeTs = localStorage.getItem(SNOOZE_KEY)
      if (snoozeTs) {
        const daysSince = (Date.now() - parseInt(snoozeTs, 10)) / (1000 * 60 * 60 * 24)
        if (daysSince < SNOOZE_DAYS) return
      }
    }

    fetch('/api/location-model')
      .then(r => r.json())
      .then((data: { needsMigration?: boolean }) => {
        if (data.needsMigration) setShow(true)
      })
      .catch(() => null)
  }, [role, pathname])

  if (!mounted || !show) return null

  function dismiss() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()))
    }
    setShow(false)
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/location-model/generate', { method: 'POST' })
      let data: { error?: string; model?: unknown } = {}
      try {
        data = await res.json()
      } catch {
        throw new Error('Server-Fehler: Keine gültige Antwort erhalten. Bitte erneut versuchen.')
      }
      if (!res.ok) throw new Error(data.error ?? 'Unbekannter Fehler')
      setDone(true)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DONE_KEY, '1')
        localStorage.removeItem(SNOOZE_KEY)
      }
      setTimeout(() => setShow(false), 2800)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const content = (
    <div
      onClick={e => e.target === e.currentTarget && !generating && dismiss()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,12,16,0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 10100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <style>{KF}</style>

      <div style={{
        background: 'rgba(16,19,22,0.97)',
        border: '1px solid rgba(38,198,198,0.18)',
        borderRadius: '24px',
        padding: '2rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(38,198,198,0.08)',
        animation: 'lm-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        position: 'relative',
      }}>
        {/* Close */}
        {!generating && !done && (
          <button
            onClick={dismiss}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.06)', border: 'none',
              borderRadius: '8px', width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
            }}
          >
            <X size={14} />
          </button>
        )}

        {done ? (
          /* Success state */
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(38,198,198,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <CheckCircle2 size={28} color="#26C6C6" />
            </div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Planungsmodell erstellt!
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Deine Onboarding-Angaben wurden automatisch übernommen. Der KI-Solver kennt jetzt alle deine Regeln.
            </p>
          </div>
        ) : (
          <>
            {/* Icon */}
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(38,198,198,0.2) 0%, rgba(38,198,198,0.05) 100%)',
              border: '1px solid rgba(38,198,198,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.25rem',
            }}>
              <Brain size={24} color="#26C6C6" />
            </div>

            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Einmalige Einrichtung
            </p>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.3, marginBottom: '0.75rem' }}>
              Planungsmodell noch leer
            </p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Dein Onboarding ist bereits abgeschlossen — aber das neue KI-Planungsmodell wurde noch nicht automatisch befüllt.
            </p>

            {/* Info box */}
            <div style={{
              background: 'rgba(38,198,198,0.07)',
              border: '1px solid rgba(38,198,198,0.15)',
              borderRadius: '12px',
              padding: '0.875rem 1rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <Sparkles size={15} color="#26C6C6" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.83rem', lineHeight: 1.5, margin: 0 }}>
                  Per Knopfdruck liest die KI alle Angaben aus deinem Onboarding und erstellt daraus automatisch ein vollständiges Planungsmodell mit Schichten, harten und weichen Regeln.
                </p>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px', padding: '0.625rem 0.875rem', marginBottom: '1rem',
                color: 'rgba(252,165,165,0.9)', fontSize: '0.8rem',
              }}>
                {error}
              </div>
            )}

            {generating ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                <div style={{ animation: 'lm-pulse 1.4s ease-in-out infinite' }}>
                  <Brain size={32} color="#26C6C6" />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>KI erstellt Planungsmodell…</p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.625rem', flexDirection: 'column' }}>
                <button
                  onClick={handleGenerate}
                  style={{
                    background: 'linear-gradient(135deg, #26C6C6 0%, #1fa8a8 100%)',
                    border: 'none', borderRadius: '12px',
                    padding: '0.75rem 1.25rem',
                    color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'opacity 0.15s',
                  }}
                >
                  Jetzt Planungsmodell erstellen
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={dismiss}
                  style={{
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', padding: '0.625rem 1rem',
                    color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Später — ich mache das manuell
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
