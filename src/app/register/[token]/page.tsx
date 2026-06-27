'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { Lock, Mail, CheckCircle2, AlertCircle } from 'lucide-react'

const ROLE_LABEL: Record<string, string> = {
  employee: 'Mitarbeiter',
  admin: 'Standortleitung',
  company: 'Geschäftsführung',
  okun: 'OKUN Administrator',
}

interface InvitationPreview {
  email: string
  role: string
  name?: string | null
  customerName?: string | null
}

export default function RegisterPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/invitations/${params.token}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Einladung konnte nicht geladen werden')
        setInvitation(data.invitation)
        setName(data.invitation.name || data.invitation.customerName || '')
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [params.token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    if (!name.trim()) errs.push('Name ist erforderlich')
    if (password.length < 8) errs.push('Passwort muss mindestens 8 Zeichen lang sein')
    if (password !== confirmPassword) errs.push('Passwörter stimmen nicht überein')
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    setErrors([])
    setSubmitting(true)
    try {
      const res = await fetch(`/api/invitations/${params.token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors([data.error || 'Konto konnte nicht erstellt werden'])
        setSubmitting(false)
        return
      }
      sessionStorage.setItem('dienstplan_user', JSON.stringify(data.user))
      window.location.href = `/${data.user.role}`
    } catch {
      setErrors(['Verbindung fehlgeschlagen. Bitte erneut versuchen.'])
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Logo variant="wordmark" onDark iconSize={40} />
          <p className="text-navy-100 text-xs">Konto einrichten</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-6">
          {loading && <p className="text-sm text-gray-500 text-center py-8">Einladung wird geprüft …</p>}

          {!loading && loadError && (
            <div className="text-center py-6 space-y-3">
              <AlertCircle size={32} className="mx-auto text-red-400" />
              <p className="text-sm text-red-600">{loadError}</p>
              <p className="text-xs text-gray-400">Bitten Sie Ihre Standortleitung oder Geschäftsführung um eine neue Einladung.</p>
            </div>
          )}

          {!loading && invitation && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-lg font-bold text-navy">Willkommen bei OKUN Workforce</p>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                  <Mail size={14} />
                  <span>{invitation.email}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Rolle: {ROLE_LABEL[invitation.role] || invitation.role}
                  {invitation.customerName ? ` · ${invitation.customerName}` : ''}
                </p>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                    {errors.map(err => <li key={err}>{err}</li>)}
                  </ul>
                </div>
              )}

              <Input
                label="Name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Vor- und Nachname"
              />

              <Input
                label="Passwort"
                icon={Lock}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
              />

              <Input
                label="Passwort bestätigen"
                icon={Lock}
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
              />

              <Button type="submit" className="w-full gap-2" size="lg" loading={submitting}>
                <CheckCircle2 size={16} />
                Konto erstellen
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
