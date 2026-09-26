'use client'

import { cn } from '@/lib/utils'
import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, label, error, hint, id, rows = 3, ...props }, ref) => {
    const textareaId = id || props.name

    return (
      <div className={containerClassName}>
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-semibold text-navy mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            'w-full px-4 py-2.5 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 transition-all resize-none',
            'focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
            error ? 'border-red-300 focus:ring-red-400' : 'border-gray-200',
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-600 mt-1.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
        ) : null}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
