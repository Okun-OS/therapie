'use client'

import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'
import { LucideIcon } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: LucideIcon
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, label, error, hint, icon: Icon, id, ...props }, ref) => {
    const inputId = id || props.name

    return (
      <div className={containerClassName}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-navy mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full py-2.5 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 transition-all',
              'focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
              Icon ? 'pl-9 pr-4' : 'px-4',
              error ? 'border-red-300 focus:ring-red-400' : 'border-gray-200',
              className,
            )}
            {...props}
          />
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

Input.displayName = 'Input'
