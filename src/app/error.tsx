'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle size={28} className="text-red-600" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Etwas ist schiefgelaufen</h1>
        <p className="mt-2 text-sm text-gray-500">
          Diese Seite konnte nicht korrekt geladen werden. Du kannst es erneut versuchen oder zur Startseite zurückkehren.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => (window.location.href = '/')}>Zur Startseite</Button>
          <Button variant="primary" onClick={() => reset()}>Erneut versuchen</Button>
        </div>
      </div>
    </div>
  )
}
