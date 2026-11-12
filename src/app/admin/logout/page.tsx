'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function AdminLogout() {
  const { logout } = useAuth()

  useEffect(() => {
    logout()
  }, [logout])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-navy border-t-brand rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Wird abgemeldet...</p>
      </div>
    </div>
  )
}
