'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ChevronUp } from 'lucide-react'
import { getDockItems, type DockItem } from './navData'

// ── Ripple helper ────────────────────────────────────────────────
function spawnRipples(el: HTMLElement, isGold: boolean) {
  const color = isGold ? '200,156,91' : '38,198,198'
  for (let i = 0; i < 2; i++) {
    const r = document.createElement('span')
    r.style.cssText = `
      position:absolute;inset:0;border-radius:inherit;pointer-events:none;
      background:rgba(${color},${i === 0 ? 0.28 : 0});
      border:${i === 1 ? `1.5px solid rgba(${color},0.5)` : 'none'};
      animation:${i === 0 ? 'ripple-fill' : 'ripple-ring'} ${i === 0 ? '0.5s' : '0.6s'} ease-out forwards;
      animation-delay:${i * 60}ms;
    `
    el.appendChild(r)
    r.addEventListener('animationend', () => r.remove())
  }
}

// ── Portal tooltip ───────────────────────────────────────────────
// Renders as position:fixed so it escapes any overflow container on the dock
function DockLabel({ label, x, bottom }: { label: string; x: number; bottom: number }) {
  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: x,
        bottom,
        transform: 'translateX(-50%)',
        animation: 'tooltip-up 0.18s ease-out forwards',
      }}
    >
      <span className="block text-[11px] font-semibold text-white/90 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 whitespace-nowrap">
        {label}
      </span>
    </div>,
    document.body
  )
}

// ── Panel ────────────────────────────────────────────────────────
function MegaPanel({ item, onClose }: { item: DockItem; onClose: () => void }) {
  const pathname = usePathname()
  const panel = item.panel!

  return (
    <div
      className="animate-panel-in fixed z-50"
      style={{ bottom: 96, left: '50%', width: 'min(92vw, 520px)' }}
    >
      <div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(20,23,25,0.92)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(38,198,198,0.18)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          maxHeight: 'calc(100dvh - 120px)',
        }}
      >
        {/* Panel header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.07]">
          <span className="text-white/90 text-sm font-semibold tracking-wide">{panel.title}</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l8 8M9 1L1 9" />
            </svg>
          </button>
        </div>

        {/* Sections */}
        <div className="p-3 space-y-1 overflow-y-auto">
          {panel.sections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-2 pt-2 pb-1">
                  {section.title}
                </p>
              )}
              {section.items.map((it) => {
                const active = pathname === it.href || (it.href !== '/' && pathname.startsWith(it.href))
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group"
                    style={{
                      background: active ? 'rgba(38,198,198,0.14)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {/* Icon container — always rendered so text aligns */}
                    <span
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg leading-none select-none"
                      style={{
                        background: active ? 'rgba(38,198,198,0.2)' : 'rgba(255,255,255,0.09)',
                        border: active ? '1px solid rgba(38,198,198,0.25)' : '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      {it.icon ?? '·'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${active ? 'text-brand' : 'text-white/85'}`}>
                          {it.label}
                        </span>
                        {it.badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${it.isGold ? 'bg-gold/20 text-gold' : 'bg-brand/20 text-brand'}`}>
                            {it.badge}
                          </span>
                        )}
                      </div>
                      {it.description && (
                        <p className="text-white/35 text-xs mt-0.5 truncate">{it.description}</p>
                      )}
                    </div>
                    <svg
                      width="14" height="14" viewBox="0 0 14 14" fill="none"
                      stroke={active ? 'rgb(38,198,198)' : 'rgba(255,255,255,0.25)'}
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                    >
                      <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Dock Icon ────────────────────────────────────────────────────
function DockIcon({
  item, isActive, onActivate, scale,
}: {
  item: DockItem
  isActive: boolean
  onActivate: (id: string | null) => void
  scale: number
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [labelPos, setLabelPos] = useState<{ x: number; bottom: number } | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const isPathActive = item.href
    ? (item.href === '/admin' || item.href === '/employee' || item.href === '/company' || item.href === '/okun'
        ? pathname === item.href
        : pathname.startsWith(item.href))
    : (item.panel?.sections.flatMap(s => s.items).some(i => pathname.startsWith(i.href)) ?? false)

  const handleMouseEnter = () => {
    const el = btnRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setLabelPos({ x: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + 10 })
  }

  const handleClick = () => {
    const el = btnRef.current
    if (!el) return

    if ('vibrate' in navigator) navigator.vibrate([10])

    spawnRipples(el, item.isGold ?? false)

    const glowClass = item.isGold ? 'animate-dock-glow-gold' : 'animate-dock-glow'
    el.classList.remove(glowClass)
    void el.offsetWidth
    el.classList.add(glowClass)
    el.addEventListener('animationend', () => el.classList.remove(glowClass), { once: true })

    if (item.href) {
      onActivate(null)
      router.push(item.href)
    } else {
      onActivate(isActive ? null : item.id)
    }
  }

  const Icon = item.icon

  return (
    <div className="relative flex flex-col items-center" style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out', transformOrigin: 'bottom center' }}>
      {labelPos && <DockLabel label={item.label} x={labelPos.x} bottom={labelPos.bottom} />}

      <button
        ref={btnRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setLabelPos(null)}
        className="relative flex flex-col items-center gap-0 focus:outline-none"
        style={{ WebkitTapHighlightColor: 'transparent' }}
        aria-label={item.label}
      >
        {/* Icon wrapper */}
        <div
          className="relative w-12 h-12 flex items-center justify-center rounded-2xl transition-colors duration-150"
          style={{
            background: isActive
              ? (item.isGold ? 'rgba(200,156,91,0.2)' : 'rgba(38,198,198,0.18)')
              : isPathActive
              ? (item.isGold ? 'rgba(200,156,91,0.12)' : 'rgba(38,198,198,0.1)')
              : 'rgba(255,255,255,0.07)',
            border: isActive || isPathActive
              ? `1.5px solid ${item.isGold ? 'rgba(200,156,91,0.5)' : 'rgba(38,198,198,0.45)'}`
              : '1.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <Icon
            size={40}
            className={item.isGold ? 'animate-gold-glitch' : undefined}
          />
          {/* Badge */}
          {item.badge !== undefined && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold"
              style={{
                background: item.isGold ? '#C89C5B' : '#26C6C6',
                color: '#1A1D1F',
              }}
            >
              {item.badge}
            </span>
          )}
        </div>

        {/* Active dot */}
        {(isActive || isPathActive) && (
          <div
            className="w-1 h-1 rounded-full mt-1"
            style={{ background: item.isGold ? '#C89C5B' : '#26C6C6' }}
          />
        )}
      </button>
    </div>
  )
}

// ── FloatingDock ─────────────────────────────────────────────────
export function FloatingDock() {
  const { user } = useAuth()
  const dockRef = useRef<HTMLDivElement>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [scales, setScales] = useState<Record<string, number>>({})
  const [dockHidden, setDockHidden] = useState(false)

  const items = getDockItems(user?.role)
  const openItem = items.find(i => i.id === openId) ?? null

  // ── Dock hide/show persistence ──
  useEffect(() => {
    const stored = localStorage.getItem('okun_dock_hidden')
    if (stored === '1') setDockHidden(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('okun_dock_hidden', dockHidden ? '1' : '0')
  }, [dockHidden])

  // Auto-show when cursor near bottom edge
  useEffect(() => {
    if (!dockHidden) return
    const handler = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight - 40) setDockHidden(false)
    }
    document.addEventListener('mousemove', handler)
    return () => document.removeEventListener('mousemove', handler)
  }, [dockHidden])

  // Auto-minimize when a fullscreen modal opens, restore when it closes
  useEffect(() => {
    const onOpen = () => setDockHidden(true)
    const onClose = () => setDockHidden(false)
    window.addEventListener('modal:open', onOpen)
    window.addEventListener('modal:close', onClose)
    return () => {
      window.removeEventListener('modal:open', onOpen)
      window.removeEventListener('modal:close', onClose)
    }
  }, [])

  // ── Magnetic effect ──
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const dock = dockRef.current
    if (!dock) return
    const icons = Array.from(dock.querySelectorAll<HTMLElement>('[data-dock-slot]'))
    const next: Record<string, number> = {}
    icons.forEach(el => {
      const id = el.dataset.dockSlot!
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
      const radius = 90
      next[id] = dist < radius ? 1 + (1 - dist / radius) * 0.42 : 1
    })
    setScales(next)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setScales({})
  }, [])

  useEffect(() => {
    const dock = dockRef.current
    if (!dock) return
    dock.addEventListener('mousemove', handleMouseMove)
    dock.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      dock.removeEventListener('mousemove', handleMouseMove)
      dock.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [handleMouseMove, handleMouseLeave])

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dockRef.current?.contains(e.target as Node)) {
        const panelEl = document.querySelector('[data-megapanel]')
        if (!panelEl?.contains(e.target as Node)) setOpenId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
      {/* Mega Panel */}
      {openItem?.panel && (
        <div data-megapanel>
          <MegaPanel item={openItem} onClose={() => setOpenId(null)} />
        </div>
      )}

      {/* Dock */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          transform: dockHidden ? 'translateY(calc(100% - 20px))' : 'translateY(0)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Grip / toggle strip */}
        <div className="flex justify-center pb-0.5">
          <button
            onClick={() => setDockHidden(h => !h)}
            aria-label={dockHidden ? 'Dock einblenden' : 'Dock ausblenden'}
            className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-t-xl hover:bg-black/5 transition-colors"
          >
            <div className="w-8 h-1 rounded-full bg-gray-300/80" />
            <ChevronUp
              size={10}
              className="text-gray-400 transition-transform"
              style={{ transform: dockHidden ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
            />
          </button>
        </div>

        {/* Horizontally scrollable wrapper */}
        <div
          ref={dockRef}
          className="dock-scroll flex justify-center items-end px-3"
          style={{ overflowX: 'auto', overflowY: 'visible', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } as React.CSSProperties}
        >
          <div
            data-tour="dock-bar"
            className="flex items-end gap-1.5 px-3 py-2.5 rounded-[26px] flex-shrink-0"
            style={{
              background: 'rgba(20,23,25,0.88)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(38,198,198,0.15)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Nav items */}
            {items.map(item => (
              <div key={item.id} data-dock-slot={item.id}>
                <DockIcon
                  item={item}
                  isActive={openId === item.id}
                  onActivate={setOpenId}
                  scale={scales[item.id] ?? 1}
                />
              </div>
            ))}

            {/*
              §140 Hier standen bis eben noch Suche, Konto und Abmelden.
              Alle drei sind weg, und zwar aus demselben Grund: Suche und Konto
              stehen schon oben in der Leiste, und zwei Wege zum selben Ziel
              sind kein Komfort, sondern eine Frage, die sich der Mensch stellen
              muss („sind die beiden dasselbe?"). Abmelden wiederum ist ein
              Handgriff von zweimal am Tag — der gehört nicht auf die Fläche,
              die man hundertmal antippt; er steht unter „Mein Konto".

              Damit trägt die Leiste genau das, wofür sie da ist: die Ziele.
            */}
          </div>
        </div>
      </div>
    </>
  )
}
