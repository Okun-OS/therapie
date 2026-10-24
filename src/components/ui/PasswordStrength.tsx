'use client'

import { cn } from '@/lib/utils'

interface PasswordStrengthProps {
  password: string
  className?: string
}

function analyzePassword(password: string) {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const passed = Object.values(checks).filter(Boolean).length
  const strength = passed <= 1 ? 'weak' : passed <= 2 ? 'fair' : passed <= 3 ? 'good' : passed <= 4 ? 'strong' : 'very-strong'
  return { checks, passed, strength }
}

const STRENGTH_LABELS: Record<string, { label: string; color: string }> = {
  weak:       { label: 'Sehr schwach', color: 'bg-red-500' },
  fair:       { label: 'Schwach',      color: 'bg-orange-400' },
  good:       { label: 'Mittel',       color: 'bg-yellow-400' },
  strong:     { label: 'Stark',        color: 'bg-lime-500' },
  'very-strong': { label: 'Sehr stark', color: 'bg-green-500' },
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  if (!password) return null
  const { checks, passed, strength } = analyzePassword(password)
  const { label, color } = STRENGTH_LABELS[strength]

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-300',
              i < passed ? color : 'bg-gray-200'
            )}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Passwortstärke: <span className="font-medium text-gray-700">{label}</span>
      </p>
      <ul className="text-xs space-y-0.5">
        {[
          { ok: checks.length,  label: 'Mindestens 8 Zeichen' },
          { ok: checks.upper,   label: 'Großbuchstabe (A–Z)' },
          { ok: checks.lower,   label: 'Kleinbuchstabe (a–z)' },
          { ok: checks.number,  label: 'Zahl (0–9)' },
          { ok: checks.special, label: 'Sonderzeichen (!@#$%...)' },
        ].map(({ ok, label: l }) => (
          <li key={l} className={cn('flex items-center gap-1.5', ok ? 'text-green-600' : 'text-gray-400')}>
            <span>{ok ? '✓' : '○'}</span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}
