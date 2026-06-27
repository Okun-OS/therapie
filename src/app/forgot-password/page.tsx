'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Mail, Calendar, CheckCircle2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {}
    setDone(true)
    setSubmitting(false)
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
            <p className="text-navy-100 text-xs">Passwort zurücksetzen</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-6">
          {done ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <p className="text-sm text-navy font-semibold">E-Mail wurde versendet</p>
              <p className="text-sm text-gray-500">
                Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen des Passworts geschickt.
              </p>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-brand font-semibold mt-2">
                <ArrowLeft size={14} />
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-lg font-bold text-navy">Passwort vergessen?</p>
                <p className="text-sm text-gray-500 mt-1">
                  Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen des Passworts.
                </p>
              </div>

              <Input
                label="E-Mail"
                icon={Mail}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@firma.de"
                required
              />

              <Button type="submit" className="w-full" size="lg" loading={submitting}>
                Link senden
              </Button>

              <Link href="/login" className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-navy">
                <ArrowLeft size={12} />
                Zurück zur Anmeldung
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
