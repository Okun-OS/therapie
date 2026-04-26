'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Calendar, Mail, Lock, Users, Shield, Building2, Sparkles, ChevronRight } from 'lucide-react'
import type { Role } from '@/lib/types'

const DEMO_ACCOUNTS = [
  {
    role: 'employee' as Role,
    label: 'Mitarbeiter',
    name: 'Maria Schmidt',
    email: 'employee@demo.de',
    desc: 'Erzieherin · Kita Sonnenschein',
    icon: Users,
    color: 'from-blue-500 to-blue-600',
  },
  {
    role: 'admin' as Role,
    label: 'Teamleitung',
    name: 'Thomas Müller',
    email: 'admin@demo.de',
    desc: 'Admin · Kita Sonnenschein',
    icon: Shield,
    color: 'from-purple-500 to-purple-600',
  },
  {
    role: 'company' as Role,
    label: 'Unternehmen',
    name: 'BrightCare GmbH',
    email: 'company@demo.de',
    desc: 'Geschäftsführung · Alle Standorte',
    icon: Building2,
    color: 'from-emerald-500 to-emerald-600',
  },
]

export default function LoginPage() {
  const { login, loginDemo } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'demo' | 'login'>('demo')

  const handleDemoLogin = (role: Role) => {
    loginDemo(role)
    const target = role === 'employee' ? '/employee' : role === 'admin' ? '/admin' : '/company'
    router.push(target)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    const ok = login(email, password)
    if (ok) {
      const user = JSON.parse(sessionStorage.getItem('dienstplan_user') || '{}')
      const target = user.role === 'employee' ? '/employee' : user.role === 'admin' ? '/admin' : '/company'
      router.push(target)
    } else {
      setError('E-Mail oder Passwort ungültig. Nutze einen Demo-Account oben.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-navy p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, #F5B800 0%, transparent 50%), radial-gradient(circle at 80% 20%, #1D4ED8 0%, transparent 40%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center">
              <Calendar size={22} className="text-navy" />
            </div>
            <div>
              <p className="text-white font-bold text-xl leading-tight">PlanMate</p>
              <p className="text-navy-100 text-sm">Dienstplan Pro</p>
            </div>
          </div>

          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-6">
              Dienstplanung,<br />
              <span className="text-brand">einfach smart.</span>
            </h1>
            <p className="text-navy-100 text-lg leading-relaxed max-w-sm">
              KI-gestützte Schichtplanung, Zeiterfassung und Urlaubsmanagement – alles in einer modernen App.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-3">
          {[
            { icon: '🤖', text: 'KI erstellt optimale Dienstpläne automatisch' },
            { icon: '📱', text: 'Mobile-first, wie eine native App' },
            { icon: '⏱️', text: 'Echtzeit-Zeiterfassung und Stundenkonten' },
            { icon: '🏢', text: 'Multi-Standort für große Träger' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-navy-light rounded-xl px-4 py-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-navy-100 text-sm">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 min-h-screen">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
              <Calendar size={20} className="text-navy" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">PlanMate</p>
              <p className="text-navy-100 text-xs">Dienstplan Pro</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('demo')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'demo' ? 'text-navy border-b-2 border-brand' : 'text-gray-400'}`}
              >
                Demo-Zugang
              </button>
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'login' ? 'text-navy border-b-2 border-brand' : 'text-gray-400'}`}
              >
                Anmelden
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'demo' ? (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <Sparkles size={16} className="text-brand" />
                    <p className="text-sm text-gray-600 font-medium">Klicke auf einen Demo-Account zum sofortigen Einloggen:</p>
                  </div>
                  <div className="space-y-3">
                    {DEMO_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.role}
                        onClick={() => handleDemoLogin(acc.role)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-brand hover:bg-amber-50 transition-all group text-left"
                      >
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${acc.color} flex items-center justify-center flex-shrink-0`}>
                          <acc.icon size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-navy text-sm">{acc.name}</p>
                          <p className="text-xs text-gray-500">{acc.desc}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{acc.email}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-brand transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-navy mb-1.5">E-Mail</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="name@firma.de"
                        required
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-navy mb-1.5">Passwort</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" size="lg" loading={loading}>
                    Anmelden
                  </Button>

                  <p className="text-center text-xs text-gray-400">
                    Demo: Passwort beliebig eingeben · E-Mail aus Demo-Tab verwenden
                  </p>
                </form>
              )}
            </div>
          </div>

          <p className="text-center text-navy-100 text-xs mt-6">
            © 2026 PlanMate · Datenschutz · Impressum
          </p>
        </div>
      </div>
    </div>
  )
}
