'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Calendar, Clock, Palmtree, User, Users, ClipboardList, BarChart3, MapPin, UserPlus } from 'lucide-react'

const employeeNav = [
  { href: '/employee', label: 'Home', icon: LayoutDashboard },
  { href: '/employee/schedule', label: 'Plan', icon: Calendar },
  { href: '/employee/time-tracking', label: 'Zeit', icon: Clock },
  { href: '/employee/vacation', label: 'Urlaub', icon: Palmtree },
  { href: '/employee/substitutions', label: 'Vertretung', icon: UserPlus },
  { href: '/employee/profile', label: 'Profil', icon: User },
]

const adminNav = [
  { href: '/admin', label: 'Home', icon: LayoutDashboard },
  { href: '/admin/employees', label: 'Team', icon: Users },
  { href: '/admin/schedule', label: 'Plan', icon: Calendar },
  { href: '/admin/vacation-requests', label: 'Urlaub', icon: Palmtree },
  { href: '/admin/substitutions', label: 'Vertretung', icon: UserPlus },
  { href: '/admin/reports', label: 'Berichte', icon: BarChart3 },
]

const companyNav = [
  { href: '/company', label: 'Home', icon: LayoutDashboard },
  { href: '/company/locations', label: 'Standorte', icon: MapPin },
  { href: '/company/reports', label: 'Berichte', icon: BarChart3 },
]

export function MobileNav() {
  const { user } = useAuth()
  const pathname = usePathname()

  const nav = user?.role === 'employee' ? employeeNav : user?.role === 'admin' ? adminNav : companyNav

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-area-bottom">
      <div className="flex">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-colors',
                active ? 'text-navy' : 'text-gray-400'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-xl transition-colors',
                active ? 'bg-brand' : 'bg-transparent'
              )}>
                <Icon size={18} className={active ? 'text-navy' : 'text-gray-400'} />
              </div>
              <span className={cn('text-[10px] font-medium', active ? 'text-navy' : 'text-gray-400')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
