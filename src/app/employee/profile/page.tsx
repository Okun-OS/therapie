'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/lib/auth-context'
import { Personalakte } from '@/components/employees/Personalakte'
import { useLohnsiegel, Siegelkarte, Freigabeleiste } from '@/components/employee/Lohnfreigabe'
import { MapPin, Clock, Save, Bell, Shield, ListChecks, FileText, History, Calendar, Copy, Check } from 'lucide-react'
import { formatDate, toDateString } from '@/lib/utils'
import type { Employee, Location, ScheduleEntry, Shift, OvertimeRequest, Absence, MonthlyClosing, VacationRequest } from '@/lib/types'
import { urlaubskonto } from '@/lib/urlaubskonto'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const CLOSING_STATUS_LABEL: Record<string, string> = { offen: 'Offen', geprueft: 'Geprüft', freigegeben: 'Freigegeben' }

export default function EmployeeProfile() {
  const { user } = useAuth()
  // §201 Für „Meine Daten" am Ende der Seite — die Auskunft enthält die
  // Lohndaten und liegt deshalb hinter derselben Bestätigung.
  const siegel = useLohnsiegel()
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [monthlyClosingsAll, setMonthlyClosingsAll] = useState<MonthlyClosing[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setAllEmployees(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setAllLocations(d.locations))
    fetch('/api/shifts').then(r => r.json()).then(d => setShifts(d.shifts))
  }, [])

  const employee = allEmployees.find(e => e.id === user?.employeeId)
  const location = allLocations.find(l => l.id === employee?.locationId)

  const currentYear = new Date().getFullYear()
  const todayStr = toDateString(new Date())

  const getShiftById = (shiftId: string) => shifts.find(s => s.id === shiftId)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!employee) return
    fetch(`/api/schedule-entries?employeeId=${employee.id}`).then(r => r.json()).then(d => setScheduleEntries(d.entries))
    fetch(`/api/overtime-requests?employeeId=${employee.id}`).then(r => r.json()).then(d => setOvertimeRequests(d.requests))
    fetch(`/api/absences?employeeId=${employee.id}`).then(r => r.json()).then(d => setAbsences(d.absences))
    // §235 Für die Resturlaubs-Kachel: ohne die Anträge rechnet sie anders als
    // die Urlaubsseite.
    fetch(`/api/vacation-requests?employeeId=${employee.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setMeineUrlaubsantraege(d?.requests ?? []))
      // Auch im Fehlerfall „geladen": Sonst stünde dort für immer ein Strich,
      // und niemand wüsste, ob gerechnet wird oder etwas kaputt ist.
      .finally(() => setAntraegeGeladen(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id])

  useEffect(() => {
    if (!employee) return
    const fetchClosings = () => fetch(`/api/monthly-closings?employeeId=${employee.id}`).then(r => r.json()).then(d => setMonthlyClosingsAll(d.closings))
    ;(async () => {
      for (let i = 0; i < 3; i++) {
        const d = new Date(currentYear, new Date().getMonth() - i, 1)
        await fetch('/api/monthly-closings/get-or-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: employee.id, year: d.getFullYear(), month: d.getMonth() + 1, employeeInfo: employee }),
        })
      }
      fetchClosings()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id])

  const overtimeMinutesThisYear = employee
    ? overtimeRequests
        .filter(o => (o.status === 'approved' || o.status === 'partial') && o.date.startsWith(`${currentYear}`))
        .reduce((sum, o) => sum + (o.approvedMinutes ?? 0), 0)
    : 0
  const absencesThisYear = employee ? absences.filter(a => a.startDate.startsWith(`${currentYear}`)) : []
  const sickDaysThisYear = absencesThisYear.filter(a => a.type === 'krankheit').reduce((s, a) => s + a.days, 0)
  const otherAbsenceDaysThisYear = absencesThisYear.filter(a => a.type !== 'krankheit').reduce((s, a) => s + a.days, 0)
  const monthlyClosings = employee ? monthlyClosingsAll.slice(0, 3) : []
  const shiftHistory = employee
    ? scheduleEntries
        .filter(e => e.employeeId === employee.id && e.date <= todayStr)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6)
    : []

  /**
   * §235 Die eigenen Urlaubsanträge — für dieselbe Zahl wie auf der
   * Urlaubsseite.
   *
   * Ohne sie rechnete diese Maske `Anspruch − genommen` und kam auf eine
   * andere Zahl als die Urlaubsseite daneben. Eine Kachel, die „Resturlaub"
   * sagt und etwas anderes meint als die Kachel nebenan, ist schlimmer als
   * keine Kachel.
   */
  const [meineUrlaubsantraege, setMeineUrlaubsantraege] = useState<VacationRequest[]>([])
  /**
   * §235 Solange die Anträge nicht da sind, zeigt die Kachel KEINE Zahl.
   *
   * Ohne das stand dort zuerst 16 und nach dem Laden 13 — die Rechnung ist
   * dieselbe, nur fehlten ihr anfangs die offenen Anträge. Nachgemessen auf
   * kaltem Cache: Beim ersten Aufruf sah man eine Sekunde lang die falsche
   * Zahl, und das ausgerechnet an der Kachel, deren falsche Zahl gemeldet
   * wurde. Ein Strich, der zur richtigen Zahl wird, ist ehrlich; eine Zahl,
   * die sich nachträglich ändert, ist es nicht.
   */
  const [antraegeGeladen, setAntraegeGeladen] = useState(false)

  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false)
  /**
   * §228 Die Abo-Adresse kommt vom Server, nicht aus dem Browserfenster.
   *
   * Vorher stand hier `window.location.origin` — also der Name, über den die
   * Person gerade angemeldet war. Wer über die alte Railway-Adresse hereinkam,
   * bekam ein Abo auf diesen Namen. Ein Kalender-Abo liegt Jahre im Telefon:
   * Fällt der alte Name weg, hört der Dienstplan auf, sich zu aktualisieren,
   * ohne Fehlermeldung — bis eine Schicht verpasst wird.
   */
  const [calendarFeedUrl, setCalendarFeedUrl] = useState('')
  const [calendarSyncLoading, setCalendarSyncLoading] = useState(false)
  const [calendarLinkCopied, setCalendarLinkCopied] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!employee) return
    fetch(`/api/calendar-sync?employeeId=${employee.id}`)
      .then(res => res.json())
      .then(data => {
        setCalendarSyncEnabled(data.enabled ?? false)
        setCalendarFeedUrl(data.feedUrl ?? '')
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id])

  const toggleCalendarSync = async () => {
    if (!employee) return
    setCalendarSyncLoading(true)
    try {
      const res = await fetch('/api/calendar-sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, enabled: !calendarSyncEnabled }),
      })
      const data = await res.json()
      setCalendarSyncEnabled(data.enabled ?? false)
      setCalendarFeedUrl(data.feedUrl ?? '')
    } finally {
      setCalendarSyncLoading(false)
    }
  }

  /** §247 Der laufende Stand — eine Zahl, siehe `hours-account/laufend`. */
  const [kontoMinuten, setKontoMinuten] = useState<number | null>(null)
  useEffect(() => {
    if (!employee?.id) return
    fetch(`/api/hours-account/laufend?employeeId=${employee.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.konto) setKontoMinuten(d.konto.gesamtMinuten) })
      .catch(() => {})
  }, [employee?.id])

  // §235 Dieselbe Rechnung wie auf der Urlaubsseite.
  const konto = urlaubskonto(employee ?? {}, meineUrlaubsantraege)

  if (!employee) return null

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-5">

        {/* Profile Card */}
        <Card padding="lg">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-navy flex items-center justify-center font-bold text-brand text-2xl flex-shrink-0">
              {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-navy">{employee.name}</h2>
              <p className="text-gray-500 text-sm">{employee.position}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin size={12} />
                  {location?.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock size={12} />
                  {employee.weeklyHours}h / Woche
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
            <div className="text-center">
              {/*
                §235 Dieselbe Zahl wie auf der Urlaubsseite.

                Hier stand `vacationDaysTotal - vacationDaysUsed` — also der
                Jahresanspruch ohne Abzug der offenen Anträge. Bei Juliane
                ergab das 16, während die Urlaubsseite 12 zeigte; beide
                Kacheln hießen „Resturlaub". Vier Tage Unterschied, und das
                waren genau die vier, über die noch niemand entschieden hatte.

                Gezeigt wird jetzt, was noch BEANTRAGT werden kann — die Zahl,
                nach der jemand handelt.
              */}
              <p className="text-lg font-bold text-navy" data-test="resturlaub">
                {antraegeGeladen ? konto.verfuegbar : '–'}
              </p>
              <p className="text-xs text-gray-500">Resturlaub</p>
            </div>
            <div className="text-center">
              {/*
                §247 Dieselbe Zahl wie auf „Mein Tag" — freigegebener Stand
                plus alles, was seitdem offen ist. Vorher stand hier
                `hoursBalance` allein, also nur die freigegebenen Monate; das
                war die 0, über die sich jemand zu Recht gewundert hat.
              */}
              <p className={`text-lg font-bold ${(kontoMinuten ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}
                data-test="stundenkonto">
                {kontoMinuten == null
                  ? '–'
                  : `${kontoMinuten >= 0 ? '+' : '−'}`
                    + `${Math.floor(Math.abs(kontoMinuten) / 60)}:`
                    + `${String(Math.abs(kontoMinuten) % 60).padStart(2, '0')}`}
              </p>
              {/*
                §238 „+0h" neben „1,6h Überstunden 2026" liest sich wie ein
                Widerspruch, und man kann es von außen nicht auflösen.
                Nachgesehen: Das Stundenkonto wird an genau EINER Stelle
                fortgeschrieben — beim Freigeben eines Monatsabschlusses
                (`release-closing`). Stehen alle Monate auf „Offen", ist +0
                richtig, und die Überstunden warten darauf, dort einzugehen.
                Die Zahl stimmte; es fehlte der Satz dazu.
              */}
              <p className="text-xs text-gray-500">Stundenkonto</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-navy">{employee.weeklyHours}h</p>
              <p className="text-xs text-gray-500">Wochenstunden</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-navy">{Math.round(overtimeMinutesThisYear / 6) / 10}h</p>
              <p className="text-xs text-gray-500">Überstunden {currentYear}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-navy" data-test="krankheitstage">{sickDaysThisYear}</p>
              <p className="text-xs text-gray-500">Krankheitstage {currentYear}</p>
            </div>
            <div className="text-center">
              {/*
                §238 Hier stand „Fehlzeiten". Daneben stand „8 Krankheitstage",
                und darunter eine 0 — gelesen wie ein Widerspruch, und zu Recht:
                Krankheitstage SIND Fehlzeiten. Gezählt wird hier aber
                `type !== 'krankheit'`, also alles andere. Die Zahl stimmte, das
                Wort nicht.
              */}
              <p className="text-lg font-bold text-navy" data-test="andere-fehlzeiten">{otherAbsenceDaysThisYear}</p>
              <p className="text-xs text-gray-500">Andere Fehlzeiten {currentYear}</p>
            </div>
          </div>
        </Card>

        {/* Monatsübersichten */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-navy" />
              <CardTitle>Monatsübersichten</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-2">
            {monthlyClosings.map(closing => (
              <div key={closing.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-navy">{MONTH_NAMES[closing.month - 1]} {closing.year}</p>
                  <p className="text-xs text-gray-500">{closing.arbeitstage} {closing.arbeitstage === 1 ? 'Tag' : 'Tage'} erfasst</p>
                </div>
                <Badge variant={closing.status === 'freigegeben' ? 'success' : closing.status === 'geprueft' ? 'info' : 'warning'}>
                  {CLOSING_STATUS_LABEL[closing.status]}
                </Badge>
              </div>
            ))}
            {monthlyClosings.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Noch keine Monatsübersichten vorhanden</p>}
          </div>
        </Card>

        {/* Diensthistorie */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History size={16} className="text-navy" />
              <CardTitle>Diensthistorie</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-2">
            {shiftHistory.map(entry => {
              const shift = getShiftById(entry.shiftId)
              return (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <p className="text-sm text-navy">{formatDate(entry.date)}</p>
                  {shift && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ color: shift.color, backgroundColor: shift.bgColor }}>
                      {shift.name}
                    </span>
                  )}
                </div>
              )
            })}
            {shiftHistory.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Noch keine vergangenen Dienste</p>}
          </div>
        </Card>

        {/* Eigene Aufgaben */}
        {(employee.allowedTasks?.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-navy" />
                <CardTitle>Meine Aufgaben</CardTitle>
              </div>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {employee.allowedTasks!.map(task => (
                <span key={task} className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50 border-2 border-purple-300 text-purple-700">
                  {task}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/*
          §235 Hier stand „Dienstpräferenzen" — mit dem Abzeichen
          „wird bei KI berücksichtigt".

          Gemeldet: „Diese Dienstpräferenzen, diese ganzen Dienstwünsche,
          welche Schicht am liebsten, dann diese Präferenzen und sowas alles
          — ist doch gar nicht mehr relevant, seitdem wir das Regelpaket
          haben."

          Nachgemessen stimmte das, und das Abzeichen war falsch. Der Block
          speicherte fünf Felder nach `Employee.preferences`, und
          `rule-model-service.ts` liest dieses Feld an keiner Stelle:

            Bevorzugte Dienste        → gab es ein zweites Mal als
                                        „Mein Dienstwunsch", und NUR der plant
            Einschränkungen           → „Kein Frühdienst nach Spätdienst" ist
                                        die Ruhezeit, und die steht als
                                        Betriebsregel im Regelpaket
            Maximale Folgetage        → ebenfalls Regelpaket (`maxFolgetage`)
            Sonstige Notizen          → Freitext, den kein Rechenkern liest;
                                        §200 hat dasselbe Feld an anderer
                                        Stelle schon entfernt
            Nicht verfügbar an        → gab es ein zweites Mal als
                                        `fixedOffDays`, und NUR das plant

          Das letzte war das gefährlichste: Wer hier Samstag und Sonntag
          abwählte, bekam seinen Urlaub anders gezählt (`workdays.ts` las
          dieses Feld), während der Dienstplan ihn weiter einplante. Zwei
          Felder für „an diesem Wochentag bin ich nicht da", und nur eines
          davon hat je geplant. Seit §235 lesen auch `workdays.ts` und
          `fairness.ts` `fixedOffDays`.
        */}

        {/*
          §236 Hier stand „Mein Dienstwunsch“ — Früh-, Spät-, Nachtdienst
          oder egal, mit dem Abzeichen „fließt in Planung ein“.

          Gemeldet: „Ich möchte, dass diese Dienstpräferenz rausfliegt, weil
          ich nicht möchte, dass dann auf einmal jemand dauernd Spätdienste
          bekommt, obwohl das dann halt nicht mehr mit der Fairness
          kollidiert. Es gibt ja Regeln.“

          Das Abzeichen stimmte — §229 hat den Wunsch erst erfüllbar gemacht,
          nachgemessen von 0 auf 2 erfüllte Wünsche. Genau das ist der Grund,
          warum er jetzt geht: Ein DAUERHAFTER Wunsch, der wirkt, verschiebt
          die Verteilung an den Fairness-Regeln vorbei. Wer dauerhaft
          Frühdienst wünscht, bekommt dauerhaft Frühdienst — und jemand
          anderes bekommt dauerhaft den Rest.

          Was den Plan jetzt bestimmt: das Regelpaket, das Tagesmuster, die
          festen freien Tage und die Fairness über den Zeitraum. Ein Wunsch
          für einen EINZELNEN Tag bleibt möglich — der konkurriert mit anderen
          Wünschen desselben Tages und nicht mit der Verteilung über Monate.
        */}

        {/*
          §235 Hier stand „Persönliches" — Stärken, Lebenssituation,
          bevorzugte Tätigkeiten, besondere Absprachen.

          Gemeldet: „Das mit den persönlichen, mit den Stärken und Schwächen,
          das kann auch raus, es braucht kein Mensch mehr. Das hat doch nie
          Sinn gemacht."

          §232 hatte schon die beiden Felder entfernt, die es anderswo ein
          zweites Mal gab, und den Satz korrigiert, der behauptete, die
          Angaben hülfen bei der Planung. Übrig blieb eine Maske, die
          freiwillige Angaben einsammelt, welche die Planung nicht erreichen —
          die Leitung sieht sie in der Personalakte, und der Assistent kann
          sie auf Frage heranziehen. Für den Aufwand, Gesundheits- und
          Familiendaten nach Art. 9 DSGVO zu erheben und zu schützen, ist das
          zu wenig. Mit der Maske ist auch der Grund entfallen, sie überhaupt
          zu erheben.
        */}

        {/* §100 Meine Unterlagen: Vertrag, Abrechnungen, eigene Krankmeldungen */}
        {employee && (
          <Card>
            <Personalakte ownerId={employee.id} verwalten={false} titel="Meine Unterlagen" />
          </Card>
        )}

        {/* Security */}
        <Card>
          <CardTitle className="mb-4">Sicherheit & Benachrichtigungen</CardTitle>
          <div className="space-y-3">
            {[
              { icon: Shield, label: 'Passwort ändern', desc: 'Zuletzt geändert vor 30 Tagen' },
              { icon: Bell, label: 'Push-Benachrichtigungen', desc: 'Dienstplan, Urlaub, Schichterinnerung' },
            ].map(({ icon: Icon, label, desc }) => (
              <button key={label} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Icon size={16} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Google-Kalender-Synchronisation */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>Google-Kalender-Synchronisation</CardTitle>
            <button
              onClick={toggleCalendarSync}
              disabled={calendarSyncLoading}
              aria-label="Google-Kalender-Synchronisation umschalten"
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${calendarSyncEnabled ? 'bg-brand' : 'bg-gray-200'} disabled:opacity-50`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${calendarSyncEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Dein Dienstplan wird automatisch mit deinem Google- oder Apple-Kalender synchronisiert, sofern aktiviert. Jede Änderung am Plan erscheint dort automatisch – ein manuelles Übernehmen ist nicht nötig.
          </p>
          {calendarSyncEnabled && calendarFeedUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 truncate flex-1">{calendarFeedUrl}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(calendarFeedUrl)
                    setCalendarLinkCopied(true)
                    setTimeout(() => setCalendarLinkCopied(false), 2000)
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
                  aria-label="Link kopieren"
                >
                  {calendarLinkCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Diesen Link einmalig in Google Kalender unter „Über URL hinzufügen&ldquo; oder in Apple Kalender unter „Kalender abonnieren&ldquo; einfügen.
              </p>
            </div>
          )}
        </Card>

        {/*
          §128 Auskunft nach Art.15 DSGVO.

          Das Recht steht dem Menschen zu, nicht dem Arbeitgeber — deshalb holt
          er sie hier selbst und muss niemanden darum bitten. Zwei Formate: das
          PDF erklärt in Sätzen, was gespeichert ist und wie lange; die Datei
          enthält jeden Eintrag einzeln und lässt sich weitergeben (Art.20).
        */}
        <Card>
          <CardHeader>
            <CardTitle>Meine Daten</CardTitle>
          </CardHeader>
          <p className="text-xs text-gray-500 mb-3">
            Du darfst jederzeit erfahren, welche Daten wir über dich gespeichert haben,
            wofür wir sie nutzen und wie lange wir sie aufbewahren. Die Auskunft bekommst
            du sofort — du musst dafür niemanden fragen.
          </p>

          {/*
            §201 Die Auskunft versammelt alles an einer Stelle — auch jede
            Abrechnungszeile. Sie ist damit die zweite Tür zu denselben Zahlen,
            die bei den Lohnabrechnungen verriegelt ist, und braucht dieselbe
            Bestätigung.

            Das steht Art.15 nicht im Weg: Verlangt wird keine neue Hürde,
            sondern eine Identitätsprüfung — ausdrücklich vorgesehen in
            Art.12 Abs.6 DSGVO. Gefragt wird nach dem Passwort, das die Person
            ohnehin hat, und die Auskunft kommt danach sofort.
          */}
          {siegel.frei === null ? (
            <p className="text-xs text-gray-400">Einen Moment…</p>
          ) : !siegel.frei ? (
            <Siegelkarte
              stand={siegel}
              text="Deine Auskunft enthält auch deine Lohndaten."
            />
          ) : (
            <>
              <Freigabeleiste stand={siegel} />
              <div className="flex flex-wrap gap-2 mt-3">
                <a
                  href="/api/dsgvo/auskunft?format=pdf"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50"
                >
                  <FileText size={14} /> Auskunft als PDF
                </a>
                <a
                  href="/api/dsgvo/auskunft"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50"
                >
                  <FileText size={14} /> Alle Daten als Datei
                </a>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
