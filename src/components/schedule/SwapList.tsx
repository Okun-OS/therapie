'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CheckCircle, XCircle, ArrowLeftRight, MessageSquare, Sun, Moon, Briefcase, Mail } from 'lucide-react'
import type { SwapRequest, Shift } from '@/lib/types'
import { formatDate, getDayName } from '@/lib/utils'

interface SwapListProps {
  swaps: SwapRequest[]
  currentUserId: string
  shifts: Shift[]
  onAccept?: (id: string) => void
  onDecline?: (id: string) => void
}

const SHIFT_ICONS: Record<string, React.ElementType> = { early: Sun, late: Moon, mid: Briefcase }

const STATUS_CFG = {
  pending: { label: 'Ausstehend', badge: 'warning' as const, icon: ArrowLeftRight },
  accepted: { label: 'Angenommen', badge: 'success' as const, icon: CheckCircle },
  declined: { label: 'Abgelehnt', badge: 'danger' as const, icon: XCircle },
  cancelled: { label: 'Storniert', badge: 'default' as const, icon: XCircle },
}

export function SwapList({ swaps, currentUserId, shifts, onAccept, onDecline }: SwapListProps) {
  const incoming = swaps.filter(s => s.targetEmployeeId === currentUserId && s.status === 'pending')
  const outgoing = swaps.filter(s => s.requesterId === currentUserId)
  const history = swaps.filter(s => s.targetEmployeeId === currentUserId && s.status !== 'pending')

  const renderShiftTag = (shiftId: string, date: string) => {
    const shift = shifts.find(s => s.id === shiftId)
    if (!shift) return null
    const Icon = SHIFT_ICONS[shift.type] || Briefcase
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: shift.bgColor, color: shift.color }}>
        <Icon size={12} />
        {shift.name} · {getDayName(date, true)} {formatDate(date)}
      </div>
    )
  }

  const mailtoLink = (swap: SwapRequest) => {
    const subject = encodeURIComponent(`Diensttausch-Anfrage: ${formatDate(swap.requesterDate)}`)
    const body = encodeURIComponent(swap.message || '')
    return `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="space-y-5">
      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-bold text-navy">Eingehende Anfragen</p>
            <span className="text-xs bg-brand text-navy font-bold px-2 py-0.5 rounded-full">{incoming.length}</span>
          </div>
          <div className="space-y-3">
            {incoming.map(swap => (
              <div key={swap.id} className="bg-amber-50 border-2 border-brand rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-brand text-xs font-bold">
                        {swap.requesterName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <p className="text-sm font-bold text-navy">{swap.requesterName}</p>
                    </div>
                    <p className="text-xs text-gray-500">möchte tauschen:</p>
                  </div>
                  <Badge variant="warning">Neu</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Gibt ab</p>
                    {renderShiftTag(swap.requesterShiftId, swap.requesterDate)}
                  </div>
                  <ArrowLeftRight size={14} className="text-gray-400 mt-3" />
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Nimmt an</p>
                    {renderShiftTag(swap.targetShiftId, swap.targetDate)}
                  </div>
                </div>
                {swap.message && (
                  <div className="bg-white rounded-xl px-3 py-2 flex gap-2">
                    <MessageSquare size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-600 italic">{swap.message}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" className="flex-1 gap-1.5" onClick={() => onDecline?.(swap.id)}>
                    <XCircle size={14} />
                    Ablehnen
                  </Button>
                  <Button variant="success" size="sm" className="flex-1 gap-1.5" onClick={() => onAccept?.(swap.id)}>
                    <CheckCircle size={14} />
                    Annehmen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <div>
          <p className="text-sm font-bold text-navy mb-3">Meine Anfragen</p>
          <div className="space-y-2">
            {outgoing.map(swap => {
              const cfg = STATUS_CFG[swap.status]
              const StatusIcon = cfg.icon
              return (
                <div key={swap.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <StatusIcon size={18} className={swap.status === 'accepted' ? 'text-green-600' : swap.status === 'declined' ? 'text-red-500' : 'text-amber-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-navy">Mit {swap.targetEmployeeName}</p>
                      <Badge variant={cfg.badge}>{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderShiftTag(swap.requesterShiftId, swap.requesterDate)}
                      <ArrowLeftRight size={12} className="text-gray-400" />
                      {renderShiftTag(swap.targetShiftId, swap.targetDate)}
                    </div>
                    {swap.status === 'declined' && (
                      <a
                        href={mailtoLink(swap)}
                        className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:underline"
                      >
                        <Mail size={12} />
                        {swap.targetEmployeeName.split(' ')[0]} direkt kontaktieren
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* History (incoming, resolved) */}
      {history.length > 0 && (
        <div>
          <p className="text-sm font-bold text-navy mb-3">Verlauf</p>
          <div className="space-y-2">
            {history.map(swap => {
              const cfg = STATUS_CFG[swap.status]
              const StatusIcon = cfg.icon
              return (
                <div key={swap.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start gap-3 opacity-80">
                  <StatusIcon size={16} className={swap.status === 'accepted' ? 'text-green-500 mt-0.5' : 'text-red-400 mt-0.5'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-navy">{swap.requesterName} anfragte Tausch</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {renderShiftTag(swap.requesterShiftId, swap.requesterDate)}
                      <ArrowLeftRight size={10} className="text-gray-400" />
                      {renderShiftTag(swap.targetShiftId, swap.targetDate)}
                    </div>
                  </div>
                  <Badge variant={cfg.badge} className="flex-shrink-0">{cfg.label}</Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {incoming.length === 0 && outgoing.length === 0 && history.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <ArrowLeftRight size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Keine Tausch-Anfragen</p>
        </div>
      )}
    </div>
  )
}
