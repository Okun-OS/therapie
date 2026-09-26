'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle size={28} className="text-red-600" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Etwas ist schiefgelaufen</h1>
        <p className="mt-2 text-sm text-gray-500">
          Dieser Bereich konnte nicht korrekt geladen werden. Du kannst es erneut versuchen oder zum Dashboard zurückkehren.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => (window.location.href = '/admin')}>Zum Dashboard</Button>
          <Button variant="primary" onClick={() => reset()}>Erneut versuchen</Button>
        </div>
      </div>
    </div>
  )
}
