'use client'

import { cn } from '@/lib/utils'
import { SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  containerClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, label, error, hint, id, children, ...props }, ref) => {
    const selectId = id || props.name

    return (
      <div className={containerClassName}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-semibold text-navy mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full pl-4 pr-9 py-2.5 rounded-xl border text-sm text-gray-900 transition-all appearance-none bg-white',
              'focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
              error ? 'border-red-300 focus:ring-red-400' : 'border-gray-200',
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {error ? (
          <p className="text-xs text-red-600 mt-1.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
        ) : null}
      </div>
    )
  },
)

Select.displayName = 'Select'
