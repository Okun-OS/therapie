'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LogOut, ShieldCheck, Search } from 'lucide-react'
import { getDockItems, type DockItem } from './navData'
import { SearchModal } from './SearchModal'

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
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(20,23,25,0.92)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(38,198,198,0.18)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.07]">
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
        <div className="p-3 space-y-1">
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
  const [showTooltip, setShowTooltip] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const isPathActive = item.href
    ? (item.href === '/admin' || item.href === '/employee' || item.href === '/company' || item.href === '/okun'
        ? pathname === item.href
        : pathname.startsWith(item.href))
    : (item.panel?.sections.flatMap(s => s.items).some(i => pathname.startsWith(i.href)) ?? false)

  const handleClick = () => {
    const el = btnRef.current
    if (!el) return

    // Haptic
    if ('vibrate' in navigator) navigator.vibrate([10])

    // Ripple
    spawnRipples(el, item.isGold ?? false)

    // Glow pulse via class
    const glowClass = item.isGold ? 'animate-dock-glow-gold' : 'animate-dock-glow'
    el.classList.remove(glowClass)
    void el.offsetWidth // force reflow
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
      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full mb-2.5 left-1/2 whitespace-nowrap pointer-events-none"
          style={{ animation: 'tooltip-up 0.18s ease-out forwards', transform: 'translateX(-50%)' }}
        >
          <span className="text-[11px] font-semibold text-white/90 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10">
            {item.label}
          </span>
        </div>
      )}

      <button
        ref={btnRef}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
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
  const { user, logout } = useAuth()
  const router = useRouter()
  const dockRef = useRef<HTMLDivElement>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [scales, setScales] = useState<Record<string, number>>({})
  const [searchOpen, setSearchOpen] = useState(false)

  const items = getDockItems(user?.role)
  const openItem = items.find(i => i.id === openId) ?? null

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

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

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
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* Horizontally scrollable wrapper — hides overflow on narrow screens */}
        <div
          ref={dockRef}
          className="dock-scroll flex justify-center items-end px-3"
          style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
        <div
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

          {/* Divider */}
          <div className="w-px h-8 mx-1 self-center" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Search */}
          <div data-dock-slot="search">
            <div className="relative flex flex-col items-center" style={{ transform: `scale(${scales['search'] ?? 1})`, transition: 'transform 0.15s ease-out', transformOrigin: 'bottom center' }}>
              <button
                onClick={() => setSearchOpen(true)}
                className="w-12 h-12 flex items-center justify-center rounded-2xl transition-colors duration-150 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.08)' }}
                aria-label="Suche"
              >
                <Search size={20} className="text-white/55" />
              </button>
            </div>
          </div>

          {/* Account */}
          <div data-dock-slot="account">
            <div className="relative flex flex-col items-center" style={{ transform: `scale(${scales['account'] ?? 1})`, transition: 'transform 0.15s ease-out', transformOrigin: 'bottom center' }}>
              <div className="flex flex-col items-center gap-1">
                <Link
                  href="/account/security"
                  className="w-12 h-12 flex items-center justify-center rounded-2xl transition-colors duration-150 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.08)' }}
                  aria-label="Sicherheit"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-navy"
                    style={{ background: 'linear-gradient(135deg, #26C6C6 0%, #0E6B6F 100%)' }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div data-dock-slot="logout">
            <div className="relative flex flex-col items-center" style={{ transform: `scale(${scales['logout'] ?? 1})`, transition: 'transform 0.15s ease-out', transformOrigin: 'bottom center' }}>
              <button
                onClick={handleLogout}
                className="w-12 h-12 flex items-center justify-center rounded-2xl transition-colors duration-150 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.08)' }}
                aria-label="Abmelden"
              >
                <LogOut size={18} className="text-white/45 hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Search Modal */}
      {searchOpen && (
        <SearchModal items={items} onClose={() => setSearchOpen(false)} />
      )}
    </>
  )
}
