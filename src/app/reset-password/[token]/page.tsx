'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Lock, Mail, CheckCircle2, AlertCircle, Calendar } from 'lucide-react'

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/auth/reset-password/${params.token}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Link konnte nicht geladen werden')
        setEmail(data.email)
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [params.token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    if (password.length < 8) errs.push('Passwort muss mindestens 8 Zeichen lang sein')
    if (password !== confirmPassword) errs.push('Passwörter stimmen nicht überein')
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    setErrors([])
    setSubmitting(true)
    try {
      const res = await fetch(`/api/auth/reset-password/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors([data.error || 'Passwort konnte nicht zurückgesetzt werden'])
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
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
            <Calendar size={20} className="text-navy" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">OKUN Workforce</p>
            <p className="text-navy-100 text-xs">Neues Passwort vergeben</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-6">
          {loading && <p className="text-sm text-gray-500 text-center py-8">Link wird geprüft …</p>}

          {!loading && loadError && (
            <div className="text-center py-6 space-y-3">
              <AlertCircle size={32} className="mx-auto text-red-400" />
              <p className="text-sm text-red-600">{loadError}</p>
            </div>
          )}

          {!loading && !loadError && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-lg font-bold text-navy">Neues Passwort vergeben</p>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                  <Mail size={14} />
                  <span>{email}</span>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                    {errors.map(err => <li key={err}>{err}</li>)}
                  </ul>
                </div>
              )}

              <Input
                label="Neues Passwort"
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
                Passwort speichern
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
