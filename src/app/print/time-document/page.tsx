'use client'

import { useEffect, useState } from 'react'

interface DayRecord {
  date: string
  weekday: string
  isWorkday: boolean
  sollHours: number
  clockIn: string | null
  clockOut: string | null
  breakMinutes: number
  totalMinutes: number
  istHours: number
  differenceMinutes: number
  note: string | null
}

interface DocumentData {
  employee: { id: string; name: string; position: string; weeklyHours: number; workDaysPerWeek: number }
  year: number
  month: number
  closing: { status: string; vacationDays: number; sickDays: number } | null
  totalSollMinutes: number
  totalIstMinutes: number
  totalDiffMinutes: number
  days: DayRecord[]
}

const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function fmtH(minutes: number): string {
  const neg = minutes < 0
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${neg ? '-' : ''}${h}:${String(m).padStart(2, '0')}`
}

function fmtDiff(minutes: number): string {
  if (minutes === 0) return '0:00'
  return (minutes > 0 ? '+' : '') + fmtH(minutes)
}

export default function TimeDocumentPage() {
  const [data, setData] = useState<DocumentData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const employeeId = params.get('employeeId')
    const year = params.get('year')
    const month = params.get('month')
    if (!employeeId || !year || !month) {
      setError('Fehlende Parameter: employeeId, year, month')
      return
    }
    fetch(`/api/time-tracking/monthly-document?employeeId=${employeeId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Dokument konnte nicht geladen werden'))
  }, [])

  if (error) return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#c00' }}>Fehler: {error}</div>
  )
  if (!data) return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#888' }}>Lade Dokument…</div>
  )

  const { employee, year, month, days, totalSollMinutes, totalIstMinutes, totalDiffMinutes, closing } = data

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000', padding: '20px 24px', maxWidth: 800, margin: '0 auto' }}>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 3px 5px; text-align: center; white-space: nowrap; }
        th { background: #f0f0f0; font-weight: bold; font-size: 10px; }
        .left { text-align: left; }
        .right { text-align: right; }
        .weekend { background: #f9f9f9; color: #999; }
        .neg { color: #c00; }
        .pos { color: #060; }
        .total-row td { background: #e8e8e8; font-weight: bold; border-top: 2px solid #999; }
        .signature-box { border: 1px solid #ccc; width: 180px; height: 40px; display: inline-block; }
      `}</style>

      <button className="no-print" onClick={() => window.print()}
        style={{ marginBottom: 16, padding: '6px 16px', background: '#003366', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
        Drucken / PDF speichern
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottom: '2px solid #003366', paddingBottom: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#003366' }}>Stundennachweis</div>
          <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>{MONTH_NAMES[month]} {year}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: '#666' }}>
          <div style={{ fontWeight: 'bold', fontSize: 13, color: '#000' }}>{employee.name}</div>
          <div>{employee.position}</div>
          <div>Soll: {employee.weeklyHours} h/Woche · {employee.workDaysPerWeek} Tage</div>
        </div>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th style={{ width: 28 }}>Tag</th>
            <th style={{ width: 24 }}>KT</th>
            <th style={{ width: 48 }}>Soll</th>
            <th style={{ width: 52 }}>Beginn</th>
            <th style={{ width: 52 }}>Ende</th>
            <th style={{ width: 44 }}>Pause</th>
            <th style={{ width: 52 }}>Ist</th>
            <th style={{ width: 56 }}>Differenz</th>
            <th style={{ width: 64 }}>Konto</th>
            <th className="left">Bemerkung</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let runningMinutes = 0
            return days.map(day => {
              const isWeekend = day.weekday === 'Sa' || day.weekday === 'So'
              const diffMin = day.differenceMinutes
              runningMinutes += diffMin
              const dayNum = parseInt(day.date.split('-')[2])
              return (
                <tr key={day.date} className={isWeekend ? 'weekend' : ''}>
                  <td style={{ fontWeight: isWeekend ? 'normal' : 'bold' }}>{dayNum}.</td>
                  <td>{day.weekday}</td>
                  <td>{day.sollHours > 0 ? fmtH(Math.round(day.sollHours * 60)) : ''}</td>
                  <td>{day.clockIn ?? ''}</td>
                  <td>{day.clockOut ?? ''}</td>
                  <td>{day.breakMinutes > 0 ? `${day.breakMinutes} min` : ''}</td>
                  <td>{day.istHours > 0 ? fmtH(Math.round(day.istHours * 60)) : day.isWorkday && !day.clockIn ? '–' : ''}</td>
                  <td className={diffMin < 0 ? 'neg' : diffMin > 0 ? 'pos' : ''}>
                    {day.sollHours > 0 || day.istHours > 0 ? fmtDiff(diffMin) : ''}
                  </td>
                  <td className={runningMinutes < 0 ? 'neg' : runningMinutes > 0 ? 'pos' : ''}>
                    {day.sollHours > 0 || day.istHours > 0 ? fmtDiff(runningMinutes) : ''}
                  </td>
                  <td className="left" style={{ fontSize: 10, color: '#666' }}>{day.note ?? ''}</td>
                </tr>
              )
            })
          })()}
          <tr className="total-row">
            <td colSpan={2} className="left">Summe</td>
            <td>{fmtH(totalSollMinutes)}</td>
            <td></td>
            <td></td>
            <td></td>
            <td>{fmtH(totalIstMinutes)}</td>
            <td className={totalDiffMinutes < 0 ? 'neg' : totalDiffMinutes > 0 ? 'pos' : ''}>
              {fmtDiff(totalDiffMinutes)}
            </td>
            <td className={totalDiffMinutes < 0 ? 'neg' : totalDiffMinutes > 0 ? 'pos' : ''}>
              {fmtDiff(totalDiffMinutes)}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {/* Zusammenfassung */}
      <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 10 }}>
        <div style={{ border: '1px solid #ccc', borderRadius: 4, padding: '6px 12px', minWidth: 120 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#003366' }}>Monatsübersicht</div>
          <table style={{ width: 'auto' }}>
            <tbody>
              <tr><td className="left" style={{ border: 'none', padding: '1px 8px 1px 0' }}>Soll-Stunden</td><td style={{ border: 'none', fontWeight: 'bold' }}>{fmtH(totalSollMinutes)} h</td></tr>
              <tr><td className="left" style={{ border: 'none', padding: '1px 8px 1px 0' }}>Ist-Stunden</td><td style={{ border: 'none', fontWeight: 'bold' }}>{fmtH(totalIstMinutes)} h</td></tr>
              <tr><td className="left" style={{ border: 'none', padding: '1px 8px 1px 0', borderTop: '1px solid #ccc', paddingTop: 4 }}>Saldo</td>
                <td style={{ border: 'none', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: 4 }}
                    className={totalDiffMinutes < 0 ? 'neg' : totalDiffMinutes > 0 ? 'pos' : ''}>
                  {fmtDiff(totalDiffMinutes)} h
                </td>
              </tr>
              {closing && <>
                <tr><td className="left" style={{ border: 'none', padding: '1px 8px 1px 0' }}>Urlaubstage</td><td style={{ border: 'none', fontWeight: 'bold' }}>{closing.vacationDays}</td></tr>
                <tr><td className="left" style={{ border: 'none', padding: '1px 8px 1px 0' }}>Krankheitstage</td><td style={{ border: 'none', fontWeight: 'bold' }}>{closing.sickDays}</td></tr>
              </>}
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1 }} />

        {/* Unterschriften */}
        <div style={{ fontSize: 10, minWidth: 280 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 4 }}>Datum, Unterschrift Mitarbeiter</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <span className="signature-box" />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Datum, Unterschrift Vorgesetzte/r</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <span className="signature-box" />
            </div>
          </div>
        </div>
      </div>

      {/* Rechtlicher Hinweis */}
      <div style={{ marginTop: 16, fontSize: 9, color: '#888', borderTop: '1px solid #ddd', paddingTop: 6 }}>
        Aufzeichnungspflicht gemäß § 17 MiLoG / § 16 ArbZG. Dieses Dokument ist 2 Jahre aufzubewahren (§ 17 Abs. 2 MiLoG).
      </div>
    </div>
  )
}
