'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login')
      } else if (user.role === 'employee') {
        router.replace('/employee')
      } else if (user.role === 'admin') {
        router.replace('/admin')
      } else {
        router.replace('/company')
      }
    }
  }, [user, isLoading, router])

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-navy-light border-t-brand rounded-full animate-spin" />
    </div>
  )
}
