'use client'

import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { FeatureIntro } from '@/components/onboarding/FeatureIntro'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CUSTOMERS, TEST_ACCOUNTS, INVITATIONS, SUPPORT_LOG } from '@/lib/mock-data'
import { Building2, KeyRound, Mail, LifeBuoy, ChevronRight, AlertTriangle } from 'lucide-react'
import type { CustomerStatus } from '@/lib/types'

const STATUS_BADGE: Record<CustomerStatus, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' }> = {
  trial: { label: 'Test', variant: 'info' },
  active: { label: 'Aktiv', variant: 'success' },
  suspended: { label: 'Gesperrt', variant: 'danger' },
  cancelled: { label: 'Gekündigt', variant: 'warning' },
}

export default function OkunOverview() {
  const activeCustomers = CUSTOMERS.filter(c => c.status === 'active').length
  const trialCustomers = CUSTOMERS.filter(c => c.status === 'trial').length
  const suspendedCustomers = CUSTOMERS.filter(c => c.status === 'suspended')
  const totalSeatsUsed = CUSTOMERS.reduce((s, c) => s + c.seatsUsed, 0)
  const totalSeatsLicensed = CUSTOMERS.reduce((s, c) => s + c.seatsLicensed, 0)
  const pendingInvitations = INVITATIONS.filter(i => i.status === 'pending')
  const openSupportAccess = SUPPORT_LOG.filter(s => !s.revokedAt)

  return (
    <>
      <Header title="Systemübersicht" subtitle="OKUN Plattform-Administration" />
      <div className="p-4 sm:p-6 space-y-5">
        <FeatureIntro
          featureKey="okun-overview"
          text="Hier verwalten Sie alle Kunden der Plattform: Lizenzen, Testzugänge, Einladungen und Support-Zugriffe."
        />

        {suspendedCustomers.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-red-500" />
              <p className="font-semibold text-red-700 text-sm">Handlungsbedarf</p>
            </div>
            <ul className="space-y-1">
              {suspendedCustomers.map(c => (
                <li key={c.id} className="text-sm text-red-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {c.name} ist gesperrt{c.notes ? ` – ${c.notes}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Kunden" value={CUSTOMERS.length} subtitle={`${activeCustomers} aktiv · ${trialCustomers} im Test`} icon={Building2} iconColor="text-navy" iconBg="bg-navy-50" />
          <StatCard title="Lizenz-Auslastung" value={`${totalSeatsUsed}/${totalSeatsLicensed}`} subtitle="Plätze genutzt" icon={KeyRound} iconColor="text-blue-600" iconBg="bg-blue-100" />
          <StatCard title="Testzugänge" value={TEST_ACCOUNTS.length} subtitle="laufend" icon={KeyRound} iconColor="text-amber-600" iconBg="bg-amber-100" />
          <StatCard title="Offene Einladungen" value={pendingInvitations.length} subtitle="ausstehend" icon={Mail} iconColor="text-purple-600" iconBg="bg-purple-100" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kunden</CardTitle>
            <Link href="/okun/customers" className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
              Alle anzeigen <ChevronRight size={12} />
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {CUSTOMERS.map(c => (
              <Link key={c.id} href="/okun/customers" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                  <Building2 size={16} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.plan} · {c.seatsUsed}/{c.seatsLicensed} Plätze · {c.locationsCount} Einrichtungen</p>
                </div>
                <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktive Support-Zugriffe</CardTitle>
            <Link href="/okun/support" className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
              Alle anzeigen <ChevronRight size={12} />
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {openSupportAccess.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Keine aktiven Zugriffe</p>
            ) : (
              openSupportAccess.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <LifeBuoy size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{s.customerName}</p>
                    <p className="text-xs text-gray-500 truncate">{s.reason}</p>
                  </div>
                  <Badge variant="warning">Aktiv</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
