import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function OkunLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout requiredRole="okun">{children}</DashboardLayout>
}
