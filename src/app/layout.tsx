import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/lib/toast-context'
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt'

export const metadata: Metadata = {
  title: 'OKUN Workforce',
  description: 'Modernes Mitarbeiter- und Dienstplan-Management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OKUN Workforce',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0B1F3A',
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
