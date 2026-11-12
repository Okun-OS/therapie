'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import {
  Receipt, Palmtree, Stethoscope, Clock, User, TrendingUp,
  ChevronRight, LogOut, Shield, ShieldCheck,
} from 'lucide-react'
import type { Employee, VacationRequest } from '@/lib/types'
import { AppEinstellungen } from '@/components/app/AppEinstellungen'
import { urlaubskonto } from '@/lib/urlaubskonto'

/**
 * §137 „Ich" — alles, was einen selbst betrifft.
 *
 * Die Startseite zeigt, was heute ansteht. Hier steht, was man nachschlägt:
 * Resturlaub, Stundenkonto, Abrechnungen, Unterlagen. Diese Trennung ist der
 * eigentliche Umbau — vorher lag beides auf derselben Seite, und das Wichtige
 * ging im Nützlichen unter.
 *
 * Die zwei Zahlen oben sind die, nach denen im Betrieb am häufigsten gefragt
 * wird: „Wie viel Urlaub habe ich noch?" und „Wie stehen meine Stunden?"
 */

export default function Ich() {
  const { user, logout } = useAuth()
  const [mich, setMich] = useState<Employee | null>(null)
  const [offeneNachweise, setOffeneNachweise] = useState(0)
  /**
   * §238 Die DRITTE Kachel mit derselben Zahl.
   *
   * §235 hat Urlaubsseite und Profil auf eine Rechnung gebracht. Diese hier
   * ist mir entgangen — und sie ist die erste, die jemand sieht:
   *
   *     Mein Tag     „16 Urlaubstage übrig"
   *     Mein Profil  „12 Resturlaub"
   *     Urlaub       „12 von 30 Tagen"
   *
   * Gemeldet: „Bei zwei Sachen stimmt jetzt die Urlaubszahl überein, aber
   * einem steht trotzdem noch 16. Das macht keinen Sinn."
   *
   * Der Grund war derselbe wie beim ersten Mal: Hier stand die Rechnung
   * `gesamt − genommen` von Hand im Bauteil, ohne die offenen Anträge. Dass
   * §235 eine gemeinsame Datei angelegt hat, half nichts, solange eine Stelle
   * sie nicht benutzt. Zwei von drei Masken umzustellen ist kein halber
   * Erfolg — für den, der die dritte zuerst aufschlägt, ist es gar keiner.
   */
  const [meineAntraege, setMeineAntraege] = useState<VacationRequest[]>([])
  const [antraegeGeladen, setAntraegeGeladen] = useState(false)

  useEffect(() => {
    if (!user?.employeeId) return
    // §253 Nur den eigenen Datensatz holen, nicht die ganze Belegschaft.
    fetch(`/api/employees?employeeId=${user.employeeId}`)
      .then(r => r.json())
      .then(d => setMich((d.employees ?? [])[0] ?? null))
      .catch(() => {})
    // §149/§150 Beides zählt in eine Zahl: Für den Menschen ist es dasselbe —
    // etwas wartet auf ihn. Zwei Zähler nebeneinander wären eine Unterscheidung,
    // die nur das Programm interessiert.
    Promise.all([
      fetch('/api/anforderungen?offen=1').then(r => r.ok ? r.json() : null)
        .catch(() => null),
      fetch('/api/belehrungen').then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]).then(([a, b]) => {
      const z = a?.zusammenfassung
      setOffeneNachweise(
        (z?.offen ?? 0) + (z?.rueckfrage ?? 0) + (b?.offen ?? 0))
    })
    // §238 Die Anträge gehören zur Zahl — ohne sie zählt die Kachel Tage mit,
    // die schon vergeben sind.
    fetch(`/api/vacation-requests?employeeId=${user.employeeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setMeineAntraege(d?.requests ?? []))
      // Auch im Fehlerfall „geladen": Sonst stünde dort für immer ein Strich,
      // und niemand wüsste, ob gerechnet wird oder etwas kaputt ist.
      .finally(() => setAntraegeGeladen(true))
  }, [user?.employeeId])


  /**
   * §247 Das Stundenkonto als EINE Zahl.
   *
   * §243 hat hier die laufende Monatsdifferenz BENANNT danebengestellt — in
   * der Annahme, zwei Zahlen mit zwei Namen widersprächen sich nicht.
   * Gemeldet kam zurück: „Es macht keinen Sinn, dass das Stundenkonto auf 0
   * steht und darunter minus 98 Stunden in diesem Monat."
   *
   * Das stimmt. Über der Kachel steht ein Wort — „Stundenkonto" —, und was
   * darunter steht, liest jeder als dieselbe Sache. Zwei Namen helfen nicht,
   * wenn die Überschrift eine ist.
   *
   * Gezeigt wird jetzt der freigegebene Stand PLUS alles, was seitdem offen
   * ist. Gerechnet wird das am Server (`/api/hours-account/laufend`), weil
   * dafür mehrere Monate durchgegangen werden müssen und eine Oberfläche das
   * nicht Monat für Monat nachfragen soll.
   */
  const [kontoMinuten, setKontoMinuten] = useState<number | null>(null)
  const [kontoUnvollstaendig, setKontoUnvollstaendig] = useState(false)

  useEffect(() => {
    if (!user?.employeeId) return
    fetch('/api/hours-account/laufend')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.konto) return
        setKontoMinuten(d.konto.gesamtMinuten)
        setKontoUnvollstaendig(Boolean(d.konto.abgeschnitten))
      })
      .catch(() => {})
  }, [user?.employeeId])

  // §238 Dieselbe Rechnung wie auf Urlaubsseite und Profil.
  const konto = urlaubskonto(mich ?? {}, meineAntraege)

  /**
   * §151 Das Stundenkonto ist der LAUFENDE Saldo, nicht der des Monats.
   *
   * Hier stand vorher zusätzlich eine Abfrage auf /api/hours-account. Sie ging
   * ohne Jahr und Monat hinaus, bekam bei jedem Seitenaufruf einen 400 zurück
   * und trug nie etwas bei — angezeigt wurde immer schon der Wert aus dem
   * Mitarbeiterdatensatz. Sie richtig zu stellen hätte es schlimmer gemacht:
   * Diese Schnittstelle liefert die Über- und Unterstunden EINES Monats, und
   * das ist unter der Überschrift „Stundenkonto" die falsche Zahl.
   */
  /*
   * §247 Ein Strich, bis die Zahl da ist.
   *
   * Vorher stand hier der Wert aus dem Mitarbeiterdatensatz, also der
   * freigegebene Stand allein. Eine 0, die sich gleich in −98:50 verwandelt,
   * ist schlimmer als ein Strich: Sie sieht aus, als stünde sie fest.
   */
  const kontoText = kontoMinuten == null
    ? '—'
    : `${kontoMinuten >= 0 ? '+' : '−'}${Math.floor(Math.abs(kontoMinuten) / 60)}:`
      + `${String(Math.abs(kontoMinuten) % 60).padStart(2, '0')}`

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-navy font-bold text-xl">{user?.name}</h1>
        <p className="text-sm text-gray-500">{mich?.position ?? 'Mitarbeiter'}</p>
      </div>

      {/* Die zwei Zahlen, nach denen am häufigsten gefragt wird */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <Palmtree size={18} className="text-teal-600 mb-2" />
          {/*
            §238 Ein Strich, bis die Anträge da sind — wie im Profil.
            Eine Zahl, die sich eine Sekunde später ändert, ist schlimmer als
            keine: Sie sieht aus, als stünde sie fest.
          */}
          <p className="text-2xl font-bold text-navy tabular-nums"
            data-test="urlaubstage-uebrig">
            {mich && antraegeGeladen ? konto.verfuegbar : '—'}
          </p>
          <p className="text-xs text-gray-400">Urlaubstage übrig</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <Clock size={18} className="text-navy mb-2" />
          <p className={`text-2xl font-bold tabular-nums ${
            (kontoMinuten ?? 0) < 0 ? 'text-amber-700' : 'text-navy'}`}
            data-test="stundenkonto">
            {kontoText}
          </p>
          <p className="text-xs text-gray-400">Stundenkonto</p>
          {/* §247 Nur, wenn die Zahl wirklich nicht alles erfasst. Sonst
              stünde dort wieder eine zweite Angabe, die niemand braucht. */}
          {kontoUnvollstaendig && (
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
              älteste Monate nicht enthalten
            </p>
          )}
        </div>
      </div>

      <Gruppe>
        <Zeile href="/employee/lohn" icon={<Receipt size={18} className="text-teal-600" />}
          titel="Lohnabrechnungen" text="Ansehen und herunterladen" />
        <Zeile href="/employee/vacation" icon={<Palmtree size={18} className="text-teal-600" />}
          titel="Urlaub" text="Beantragen und Anträge ansehen" />
        <Zeile href="/employee/krank" icon={<Stethoscope size={18} className="text-purple-600" />}
          titel="Krankmelden" text="Meldung und Bescheinigung" />
        <Zeile href="/employee/time-tracking" icon={<Clock size={18} className="text-navy" />}
          titel="Meine Zeiten" text="Buchungen, Überstunden, Monatsabschluss" />
        {/* §149 Mit Zähler: Was von einem gebraucht wird, soll man sehen,
            ohne die Seite zu öffnen — sonst liegt es dort und niemand merkt es. */}
        <Zeile href="/employee/nachweise"
          icon={<ShieldCheck size={18} className="text-amber-600" />}
          titel="Meine Nachweise"
          text={offeneNachweise > 0
            ? `${offeneNachweise} ${offeneNachweise === 1 ? 'Sache wartet' : 'Sachen warten'} auf dich`
            : 'Belehrungen, Bescheinigungen, Führungszeugnis'} />
      </Gruppe>

      {/*
        §243 Hier standen acht weitere Zeilen in drei Gruppen.
        Gemeldet: „Ich finde, das sind zu viele Punkte. Könnte man das
        irgendwie aufräumen, dass es da nicht so unübersichtlich [ist]."

        ZWEI DAVON WAREN DASSELBE
        „Meine Unterlagen" und „Profil und Einstellungen" führten BEIDE auf
        `/employee/profile` — zwei Einträge, ein Ziel, zwei verschiedene
        Versprechen. Wer den oberen nahm und seine Kontaktdaten suchte, hatte
        sie vor sich und wusste es nicht. Geblieben ist einer, und sein
        Untertitel nennt jetzt beides.

        DER REST IST WEGGEKLAPPT, NICHT WEG
        Punkte, Datenauskunft, Fehlermeldung und Impressum braucht man selten
        und muss sie jederzeit erreichen können — zwei Dinge, die sich nicht
        widersprechen, wenn man sie faltet. Ausgeblendet werden darf keines
        davon: Die Auskunft nach Art. 15/17 DSGVO und das Impressum müssen in
        der App erreichbar bleiben (§139, §153).
      */}
      <Gruppe>
        <Zeile href="/employee/profile" icon={<User size={18} className="text-gray-400" />}
          titel="Mein Profil" text="Unterlagen, Kontaktdaten, Kalender, Benachrichtigungen" />
      </Gruppe>

      {/* §139 Nur in der App: Benachrichtigungen und die Sperre. Beides gehört
          zum Telefon, nicht zum Konto — im Browser rendert es nichts. */}
      <AppEinstellungen />

      <details className="group rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer
                            text-sm font-semibold text-navy list-none">
          Mehr
          <ChevronRight size={16}
            className="text-gray-300 transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-gray-100">
          <Zeile href="/employee/workforce-score" icon={<TrendingUp size={18} className="text-gray-400" />}
            titel="Meine Punkte" text="Workforce Score" />
          {/* §139 Vorher führte das direkt in ein PDF. Die Auskunft ist aber
              nur die eine Hälfte des Rechts — die andere ist die Löschung, und
              die muss in der App erreichbar sein (Art. 17 DSGVO, Apple 5.1.1 v). */}
          <Zeile href="/employee/daten" icon={<Shield size={18} className="text-gray-400" />}
            titel="Meine Daten" text="Auskunft, Mitnehmen und Löschung beantragen" />
          <Zeile href="/funde" icon={<Shield size={18} className="text-gray-400" />}
            titel="Etwas melden" text="Fehler oder Verbesserungsvorschlag" />
          {/* §153 Auch in der App erreichbar — nicht nur auf der Anmeldeseite.
              Wer angemeldet ist, kommt sonst nie wieder daran vorbei. */}
          <Zeile href="/datenschutz" extern
            icon={<Shield size={18} className="text-gray-400" />}
            titel="Datenschutz & Impressum" text="Wer verarbeitet was, und wer haftet" />
        </div>
      </details>

      <button
        onClick={() => logout()}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold
                   text-gray-500 py-4"
      >
        <LogOut size={16} /> Abmelden
      </button>
    </div>
  )
}

function Gruppe({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
      {children}
    </div>
  )
}

function Zeile({ href, icon, titel, text, extern }: {
  href: string; icon: React.ReactNode; titel: string; text: string; extern?: boolean
}) {
  const inhalt = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy">{titel}</span>
        <span className="block text-xs text-gray-400">{text}</span>
      </span>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </>
  )
  const klassen = 'flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 w-full text-left'
  return extern
    ? <a href={href} target="_blank" rel="noreferrer" className={klassen}>{inhalt}</a>
    : <Link href={href} className={klassen}>{inhalt}</Link>
}
