'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { SystemTour } from '@/components/onboarding/SystemTour'
import { FloatingHelp } from '@/components/ui/FloatingHelp'
import { BugReportButton } from '@/components/ui/BugReportButton'
import type { Role } from '@/lib/types'

interface DashboardLayoutProps {
  children: React.ReactNode
  requiredRole?: Role | Role[]
}

export function DashboardLayout({ children, requiredRole }: DashboardLayoutProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-navy border-t-brand rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Wird geladen...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <main className="min-h-screen pb-24 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileNav />
      <SystemTour role={user.role} />
      <FloatingHelp />
      <BugReportButton />
    </div>
  )
}
