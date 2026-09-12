import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/lib/toast-context'
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt'

export const metadata: Metadata = {
  title: {
    default: 'OKUN Workforce',
    template: '%s · OKUN Workforce',
  },
  description: 'KI-gestützte Dienstplanung und Mitarbeiterverwaltung für soziale Einrichtungen',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OKUN Workforce',
    startupImage: '/brand/icon-512.png',
  },
  icons: {
    icon: [
      { url: '/brand/favicon.ico', sizes: 'any' },
      { url: '/brand/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/brand/apple-icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/brand/favicon.ico',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'application-name': 'OKUN Workforce',
    'msapplication-TileColor': '#1A1D1F',
    'msapplication-TileImage': '/brand/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1D1F' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
            <PwaInstallPrompt />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
