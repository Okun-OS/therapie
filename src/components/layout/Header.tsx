'use client'

import { Bell, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)

  const notifications = [
    { id: 1, text: 'Dienstplan KW 19 wurde veröffentlicht', time: 'vor 2 Std.', unread: true },
    { id: 2, text: 'Urlaubsantrag von M. Schmidt eingegangen', time: 'vor 5 Std.', unread: true },
    { id: 3, text: 'Stundenabrechnung April ist bereit', time: 'gestern', unread: false },
  ]

  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-navy">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Bell size={20} className="text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-navy text-sm">Benachrichtigungen</p>
                  <span className="text-xs bg-brand text-navy font-bold px-2 py-0.5 rounded-full">{unreadCount} neu</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 hover:bg-gray-50 transition-colors ${n.unread ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex gap-3">
                        {n.unread && <div className="w-2 h-2 rounded-full bg-brand mt-1.5 flex-shrink-0" />}
                        {!n.unread && <div className="w-2 h-2 flex-shrink-0" />}
                        <div>
                          <p className="text-sm text-gray-800">{n.text}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center font-bold text-brand text-sm flex-shrink-0">
          {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
      </div>
    </header>
  )
}
