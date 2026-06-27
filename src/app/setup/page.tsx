'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Calendar, Mail, Lock, User, KeyRound, ArrowLeft } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [configured, setConfigured] = useState(true)

  const [secret, setSecret] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/setup')
      .then(res => res.json())
      .then(data => {
        setNeedsSetup(!!data.needsSetup)
        setConfigured(!!data.configured)
      })
      .finally(() => setChecking(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Setup fehlgeschlagen')
        setLoading(false)
        return
      }
      router.push('/okun')
    } catch {
      setError('Setup fehlgeschlagen. Bitte versuche es erneut.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
            <Calendar size={20} className="text-navy" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">OKUN Workforce</p>
            <p className="text-navy-100 text-xs">Erstinstallation</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-6">
          {checking ? (
            <p className="text-sm text-gray-500 text-center py-6">Wird geprüft…</p>
          ) : !configured ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-navy font-semibold">Setup nicht konfiguriert</p>
              <p className="text-sm text-gray-500">
                Diese Installation hat noch keinen SETUP_SECRET hinterlegt. Setze die Umgebungsvariable
                SETUP_SECRET und lade die Seite neu, um das erste OKUN-Administratorkonto anzulegen.
              </p>
            </div>
          ) : !needsSetup ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-navy font-semibold">Setup bereits abgeschlossen</p>
              <p className="text-sm text-gray-500">
                Es existiert bereits ein Konto auf dieser Installation. Melde dich stattdessen an.
              </p>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-brand font-semibold mt-2">
                <ArrowLeft size={14} />
                Zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-lg font-bold text-navy">Erstes Konto anlegen</p>
                <p className="text-sm text-gray-500 mt-1">
                  Lege das erste OKUN-Administratorkonto für diese Installation an. Den Setup-Schlüssel findest
                  du in der Server-Konfiguration (SETUP_SECRET).
                </p>
              </div>

              <Input
                label="Setup-Schlüssel"
                icon={KeyRound}
                type="password"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                placeholder="SETUP_SECRET"
                required
              />
              <Input
                label="Name"
                icon={User}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Vor- und Nachname"
                required
              />
              <Input
                label="E-Mail"
                icon={Mail}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@firma.de"
                required
              />
              <Input
                label="Passwort"
                icon={Lock}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                required
              />

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Konto anlegen
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
