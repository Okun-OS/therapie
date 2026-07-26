'use client'
import { useEffect, useState } from 'react'

interface PrintEmployee { id: string; name: string; weeklyHours: number }
interface PrintShift { id: string; name: string; startTime: string; endTime: string }
interface PrintWeek { dates: string[] }
interface PrintAssignment { shiftName: string; startTime: string; endTime: string }
interface PrintData {
  locationName: string
  periodLabel: string
  exportedAt: string
  employees: PrintEmployee[]
  shifts: PrintShift[]
  weeks: PrintWeek[]
  assignments: Record<string, Record<string, PrintAssignment>>
}

function getDayNameShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`
}

function calcHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 1440
  return Math.round(mins * 10 / 60) / 10
}

export default function SchedulePrintPage() {
  const [data, setData] = useState<PrintData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('schedule-print-v1')
      if (!raw) { setError(true); return }
      setData(JSON.parse(raw))
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [data])

  if (error) return (
    <div className="p-8 text-center text-gray-500">
      Keine Druckdaten gefunden. Bitte kehre zur Dienstplan-Seite zurück und klicke erneut auf &quot;PDF&quot;.
    </div>
  )

  if (!data) return (
    <div className="p-8 text-center text-gray-400">Lade Druckdaten…</div>
  )

  const allDates = data.weeks.flatMap(w => w.dates)

  return (
    <>
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: system-ui, sans-serif; background: white; color: #1a1a2e; }
      `}</style>

      {/* Print-only controls */}
      <div className="no-print flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl bg-[#1a1a2e] text-white text-sm font-semibold hover:opacity-90"
        >
          Drucken / Als PDF speichern
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
        >
          Schließen
        </button>
        <span className="text-xs text-gray-400 ml-2">Tipp: Im Druckdialog &bdquo;Als PDF speichern&ldquo; wählen</span>
      </div>

      <div className="p-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">{data.locationName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Dienstplan · {data.periodLabel}</p>
          </div>
          <p className="text-xs text-gray-400">Erstellt: {data.exportedAt}</p>
        </div>

        {/* Per-week tables */}
        {data.weeks.map((week, weekIdx) => {
          if (week.dates.length === 0) return null
          return (
            <div key={weekIdx} className={weekIdx > 0 ? 'mt-8 page-break-before' : ''}>
              {data.weeks.length > 1 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Woche {weekIdx + 1} · {formatDay(week.dates[0])} – {formatDay(week.dates[week.dates.length - 1])}
                </p>
              )}
              <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '120px' }} />
                  {week.dates.map(d => <col key={d} />)}
                  <col style={{ width: '60px' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: '#1a1a2e', color: 'white' }}>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Mitarbeiter</th>
                    {week.dates.map(d => (
                      <th key={d} className="px-2 py-2 text-center text-xs font-semibold">
                        <div>{getDayNameShort(d)}</div>
                        <div className="font-bold text-sm">{new Date(d + 'T00:00:00').getDate()}</div>
                        <div className="text-[9px] opacity-70">{formatDay(d)}</div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs font-semibold">Std.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((emp, empIdx) => {
                    const empAssign = data.assignments[emp.id] ?? {}
                    const weekHours = week.dates.reduce((sum, d) => {
                      const a = empAssign[d]
                      return a ? sum + calcHours(a.startTime, a.endTime) : sum
                    }, 0)
                    return (
                      <tr
                        key={emp.id}
                        style={{ backgroundColor: empIdx % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}
                      >
                        <td className="px-3 py-2 font-semibold text-xs truncate" style={{ color: '#1a1a2e' }}>
                          {emp.name}
                        </td>
                        {week.dates.map(d => {
                          const a = empAssign[d]
                          return (
                            <td key={d} className="px-1 py-1.5 text-center">
                              {a ? (
                                <div className="rounded-md px-1 py-1" style={{ backgroundColor: '#eef2ff' }}>
                                  <div className="text-[10px] font-bold" style={{ color: '#1a1a2e' }}>{a.startTime}–{a.endTime}</div>
                                  <div className="text-[9px] text-gray-500 truncate">{a.shiftName}</div>
                                </div>
                              ) : (
                                <span className="text-gray-200 text-xs">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center">
                          <span className={`text-xs font-mono font-bold ${weekHours > emp.weeklyHours * 1.05 ? 'text-red-600' : weekHours >= emp.weeklyHours * 0.9 ? 'text-green-700' : 'text-blue-600'}`}>
                            {weekHours.toFixed(1)}
                          </span>
                          <span className="text-[9px] text-gray-400">/{emp.weeklyHours}h</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Shift legend row at the bottom */}
                <tfoot>
                  <tr>
                    <td colSpan={week.dates.length + 2} className="pt-2 pb-0">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
                        {data.shifts.map(s => (
                          <span key={s.id} className="text-[9px] text-gray-500">
                            <span className="font-semibold text-[#1a1a2e]">{s.name}</span> {s.startTime}–{s.endTime}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}

        {/* Summary: total hours per employee across all weeks */}
        <div className="mt-8 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Stundenübersicht Gesamt</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {data.employees.map(emp => {
              const total = allDates.reduce((sum, d) => {
                const a = (data.assignments[emp.id] ?? {})[d]
                return a ? sum + calcHours(a.startTime, a.endTime) : sum
              }, 0)
              return (
                <div key={emp.id} className="text-xs">
                  <span className="font-semibold text-[#1a1a2e]">{emp.name.split(' ')[0]}</span>
                  <span className="text-gray-500 ml-1">{total.toFixed(1)}h</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
