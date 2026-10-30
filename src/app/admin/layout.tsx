import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout requiredRole="admin">{children}</DashboardLayout>
}
