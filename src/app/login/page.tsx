'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'
import { Calendar, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await login(email, password)
    if (ok) {
      const user = JSON.parse(sessionStorage.getItem('dienstplan_user') || '{}')
      router.push(`/${user.role}`)
    } else {
      setError('E-Mail oder Passwort ungültig. Nutze den Einladungslink aus deiner E-Mail oder setze dein Passwort zurück.')
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
              <p className="text-white font-bold text-xl leading-tight">OKUN Workforce</p>
              <p className="text-navy-100 text-sm">Open Workforce</p>
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
              <p className="text-white font-bold text-lg">OKUN Workforce</p>
              <p className="text-navy-100 text-xs">Open Workforce</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <p className="text-lg font-semibold text-navy">Anmelden</p>
              <p className="text-sm text-gray-500">Melde dich mit deinem OKUN Workforce Konto an.</p>
            </div>

            <div className="p-6 pt-2">
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="E-Mail"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@firma.de"
                  required
                />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold text-navy">Passwort</label>
                    <Link href="/forgot-password" className="text-xs text-brand font-medium hover:underline">
                      Passwort vergessen?
                    </Link>
                  </div>
                  <Input
                    icon={Lock}
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
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
                  Noch kein Konto? Nutze den Einladungslink aus deiner E-Mail.
                </p>
              </form>
            </div>
          </div>

          <p className="text-center text-navy-100 text-xs mt-6">
            © 2026 OKUN Workforce · Datenschutz · Impressum
          </p>
        </div>
      </div>
    </div>
  )
}
