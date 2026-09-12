'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { FloatingDock } from '@/components/nav/FloatingDock'
import { CommandRail } from '@/components/nav/CommandRail'
import { SystemTour } from '@/components/onboarding/SystemTour'
import { WhatsNewModal } from '@/components/onboarding/WhatsNewModal'
import { LocationModelMigrationModal } from '@/components/onboarding/LocationModelMigrationModal'
import { PageBanner } from '@/components/onboarding/PageBanner'
import { FloatingHelp } from '@/components/ui/FloatingHelp'
import { BugReportButton } from '@/components/ui/BugReportButton'
import { Warteschlange } from '@/components/offline/Warteschlange'
import type { Role } from '@/lib/types'

interface DashboardLayoutProps {
  children: React.ReactNode
  requiredRole?: Role | Role[]
}

export function DashboardLayout({ children, requiredRole }: DashboardLayoutProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
    if (!isLoading && user && requiredRole) {
      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      if (!allowed.includes(user.role)) {
        router.replace(`/${user.role}`)
      }
    }
  }, [user, isLoading, router, requiredRole])

  // Page-in animation on every navigation
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.classList.remove('page-in')
    void el.offsetWidth // force reflow to restart animation
    el.classList.add('page-in')
  }, [pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 bg-dot-grid flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-navy border-t-brand rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Wird geladen…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 bg-dot-grid">

      {/* Command Rail — persistent top bar */}
      <CommandRail />

      {/* Page content */}
      <main
        ref={contentRef}
        className="min-h-screen pt-[70px] page-in"
        style={{ paddingBottom: 'max(176px, calc(128px + env(safe-area-inset-bottom, 0px)))' }}
      >
        <PageBanner />
        {/*
          §138 Die Warteschlange sitzt im Rahmen, nicht auf einer Seite: Wer im
          Funkloch gestempelt hat und danach zum Dienstplan wechselt, soll
          weiterhin sehen, dass etwas auf die Übertragung wartet. Sie hängt
          bewusst hier und nicht nur in der Mitarbeiter-App — auch eine
          Standortleitung schreibt Nachrichten aus dem Keller, und was gemerkt
          wird, braucht überall jemanden, der es nachreicht.
        */}
        <Warteschlange />
        {children}
      </main>

      {/* Dock ambient glow — soft teal light source below the dock */}
      <div
        className="fixed bottom-0 left-0 right-0 pointer-events-none"
        style={{
          zIndex: 38,
          height: 180,
          background: 'radial-gradient(ellipse 640px 180px at 50% 100%, rgba(38,198,198,0.065) 0%, transparent 70%)',
        }}
      />

      <FloatingDock />
      <SystemTour role={user.role} />
      <WhatsNewModal role={user.role} />
      <LocationModelMigrationModal role={user.role} />
      <FloatingHelp />
      <BugReportButton />
    </div>
  )
}
