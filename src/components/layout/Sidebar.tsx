'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Calendar, Clock, Palmtree, User, Users, ClipboardList,
  Building2, MapPin, BarChart3, LogOut, ChevronRight, Sparkles
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
}

const employeeNav: NavItem[] = [
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/schedule', label: 'Dienstplan', icon: Calendar },
  { href: '/employee/time-tracking', label: 'Zeiterfassung', icon: Clock },
  { href: '/employee/vacation', label: 'Urlaub', icon: Palmtree },
  { href: '/employee/profile', label: 'Profil', icon: User },
]

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/employees', label: 'Mitarbeiter', icon: Users },
  { href: '/admin/schedule', label: 'Dienstplan', icon: Calendar, badge: 'KI' },
  { href: '/admin/vacation-requests', label: 'Urlaubsanträge', icon: Palmtree },
  { href: '/admin/vacation-plan', label: 'Urlaubsplan', icon: ClipboardList, badge: 'KI' },
  { href: '/admin/reports', label: 'Berichte', icon: BarChart3 },
]

const companyNav: NavItem[] = [
  { href: '/company', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/company/locations', label: 'Standorte', icon: MapPin },
  { href: '/company/reports', label: 'Berichte', icon: BarChart3 },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const nav = user?.role === 'employee' ? employeeNav : user?.role === 'admin' ? adminNav : companyNav

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="hidden lg:flex flex-col w-64 bg-navy min-h-screen fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 border-b border-navy-light">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
            <Calendar size={18} className="text-navy" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">PlanMate</p>
            <p className="text-navy-100 text-xs">Dienstplan Pro</p>
          </div>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-4 pt-4">
        <div className="bg-navy-light rounded-xl px-3 py-2.5 flex items-center gap-2">
          <Building2 size={14} className="text-brand" />
          <span className="text-xs text-navy-100 font-medium">
            {user?.role === 'employee' ? 'Mitarbeiter' : user?.role === 'admin' ? 'Teamleitung' : 'Unternehmensebene'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 pt-3 pb-4 space-y-1">
        {nav.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-brand text-navy'
                  : 'text-navy-100 hover:bg-navy-light hover:text-white'
              )}
            >
              <Icon size={18} className={active ? 'text-navy' : 'text-navy-100 group-hover:text-white'} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5',
                  active ? 'bg-navy text-brand' : 'bg-brand text-navy'
                )}>
                  <Sparkles size={8} />
                  {badge}
                </span>
              )}
              {active && <ChevronRight size={14} className="text-navy" />}
            </Link>
          )
        })}
      </nav>

      {/* User Info + Logout */}
      <div className="p-4 border-t border-navy-light">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center font-bold text-navy text-sm">
            {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-navy-100 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-navy-100 hover:bg-red-500/20 hover:text-red-300 transition-colors"
        >
          <LogOut size={16} />
          Abmelden
        </button>
      </div>
    </div>
  )
}
