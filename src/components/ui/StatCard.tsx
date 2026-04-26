import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: { value: string; up: boolean }
  alert?: boolean
  className?: string
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor = 'text-navy', iconBg = 'bg-navy-50', trend, alert, className }: StatCardProps) {
  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3',
      alert ? 'border-red-200 bg-red-50' : 'border-gray-100',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl', iconBg)}>
          <Icon size={20} className={iconColor} />
        </div>
        {trend && (
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', trend.up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div>
        <p className={cn('text-2xl font-bold', alert ? 'text-red-700' : 'text-navy')}>{value}</p>
        <p className="text-sm font-medium text-gray-500 mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
