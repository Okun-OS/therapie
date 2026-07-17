'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  danger = true,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-sm bg-white shadow-2xl rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {danger && (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
          )}
          <h2 className="text-lg font-semibold text-navy text-center mb-2">
            {title}
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className={
                danger
                  ? 'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors'
                  : 'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-navy hover:bg-navy/90 transition-colors'
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
