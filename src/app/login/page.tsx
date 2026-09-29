'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import Link from 'next/link'
import { Mail, Lock, ShieldCheck, ArrowLeft, MessageSquare, Check } from 'lucide-react'
import { KOPF, STAERKEN } from '@/lib/website-inhalt'

type LoginStep = 'credentials' | 'totp' | 'sms'

export default function LoginPage() {
  const { login, loginWithTotp, loginWithSms } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<LoginStep>('credentials')

  // TOTP
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')

  // SMS
  const [smsUserId, setSmsUserId] = useState<string | null>(null)
  const [smsCode, setSmsCode] = useState('')
  const [smsSent, setSmsSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    if (result.ok) {
      const user = JSON.parse(sessionStorage.getItem('dienstplan_user') || '{}')
      router.push(`/${user.role}`)
    } else if (result.requiresTOTP && result.pendingToken) {
      setPendingToken(result.pendingToken)
      setStep('totp')
    } else if (result.requiresSMS && result.userId) {
      setSmsUserId(result.userId)
      setStep('sms')
      // Auto-send the SMS code
      await fetch('/api/auth/2fa/sms-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: result.userId }),
      })
      setSmsSent(true)
    } else {
      setError('E-Mail oder Passwort ungültig. Nutze den Einladungslink aus deiner E-Mail oder setze dein Passwort zurück.')
    }
    setLoading(false)
  }

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingToken) return
    setError('')
    setLoading(true)
    const result = await loginWithTotp(pendingToken, totpCode)
    if (result.ok) {
      const user = JSON.parse(sessionStorage.getItem('dienstplan_user') || '{}')
      router.push(`/${user.role}`)
    } else {
      setError(result.error ?? 'Ungültiger Code. Bitte erneut versuchen.')
    }
    setLoading(false)
  }

  const handleSmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!smsUserId) return
    setError('')
    setLoading(true)
    const result = await loginWithSms(smsUserId, smsCode)
    if (result.ok) {
      const user = JSON.parse(sessionStorage.getItem('dienstplan_user') || '{}')
      router.push(`/${user.role}`)
    } else {
      setError(result.error ?? 'Ungültiger Code. Bitte erneut versuchen.')
    }
    setLoading(false)
  }

  const goBack = () => {
    setStep('credentials')
    setPendingToken(null)
    setSmsUserId(null)
    setTotpCode('')
    setSmsCode('')
    setError('')
    setSmsSent(false)
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-navy p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, #26C6C6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #C89C5B 0%, transparent 40%)' }} />

        <div className="relative z-10">
          <div className="mb-16">
            <Logo variant="wordmark" onDark iconSize={40} />
          </div>

          {/*
            §180 Hier stand „Dienstplanung, einfach smart." und darunter vier
            Kacheln mit Emoji: Roboter, Telefon, Stoppuhr, Hochhaus. Beides war
            älter als das Produkt. Die Anmeldeseite ist die Seite, die ein
            Interessent direkt nach der Startseite sieht — und dort stand das
            Programm plötzlich wieder als Dienstplansoftware da, obwohl eine
            Bildschirmbreite weiter „Vom Bewerber bis zum Lohn" steht.

            Der Text kommt jetzt aus derselben Quelle wie die Website. Nicht
            abgeschrieben, sondern importiert: sonst laufen beide beim nächsten
            Umbau wieder auseinander.
          */}
          <div>
            <p className="font-display text-xs font-bold uppercase leading-relaxed tracking-[0.12em] text-gold mb-5">
              {KOPF.vorspann}
            </p>
            <h1 className="font-display text-4xl font-bold text-white leading-tight mb-6">
              {KOPF.zeilen[0]}<br />
              <span className="text-brand">{KOPF.zeilen[1]}</span>
            </h1>
            <p className="text-navy-100 text-lg leading-relaxed max-w-sm">
              {KOPF.text}
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-3">
          {STAERKEN.slice(0, 4).map(s => (
            <div key={s.titel} className="flex items-center gap-3 bg-navy-light rounded-xl px-4 py-3">
              <Check size={15} className="shrink-0 text-brand" />
              <span className="text-navy-100 text-sm">{s.titel}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 min-h-screen">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Logo variant="wordmark" onDark iconSize={40} />
          </div>

          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <p className="font-display text-lg font-semibold text-navy">Anmelden</p>
              <p className="text-sm text-gray-500">Melde dich mit deinem OKUN Workforce Konto an.</p>
            </div>

            <div className="p-6 pt-2">
              {step === 'credentials' && (
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
              )}

              {step === 'totp' && (
                <form onSubmit={handleTotpSubmit} className="space-y-4">
                  <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
                    <ShieldCheck size={20} className="text-teal-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-teal-800">Zwei-Faktor-Authentifizierung</p>
                      <p className="text-xs text-teal-600">Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-navy mb-1.5">Authenticator-Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9 ]*"
                      maxLength={7}
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                      placeholder="000 000"
                      autoFocus
                      className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" size="lg" loading={loading}>
                    Bestätigen
                  </Button>

                  <button type="button" onClick={goBack} className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors">
                    <ArrowLeft size={14} />
                    Zurück zur Anmeldung
                  </button>
                </form>
              )}

              {step === 'sms' && (
                <form onSubmit={handleSmsSubmit} className="space-y-4">
                  <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
                    <MessageSquare size={20} className="text-teal-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-teal-800">SMS-Bestätigung</p>
                      <p className="text-xs text-teal-600">
                        {smsSent ? 'Wir haben dir einen Code per SMS gesendet.' : 'Code wird gesendet…'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-navy mb-1.5">SMS-Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={smsCode}
                      onChange={e => setSmsCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="000000"
                      autoFocus
                      className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" size="lg" loading={loading} disabled={smsCode.length < 6}>
                    Bestätigen
                  </Button>

                  <button type="button" onClick={goBack} className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors">
                    <ArrowLeft size={14} />
                    Zurück zur Anmeldung
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* §153 Vorher stand hier nur der Text „Datenschutz · Impressum",
              ohne Ziel. Ein Hinweis, der ins Leere zeigt, ist schlechter als
              keiner: Er sieht nach Erfüllung aus. §5 DDG verlangt „leicht
              erkennbar, unmittelbar erreichbar und ständig verfügbar". */}
          <p className="text-center text-navy-100 text-xs mt-6">
            © {new Date().getFullYear()} OKUN Workforce{' · '}
            <Link href="/datenschutz" className="hover:underline">Datenschutz</Link>
            {' · '}
            <Link href="/impressum" className="hover:underline">Impressum</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
