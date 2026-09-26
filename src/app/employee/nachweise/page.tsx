'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { MeineAnforderungen } from '@/components/hr/MeineAnforderungen'
import { MeineBelehrungen } from '@/components/hr/MeineBelehrungen'

/**
 * §149 „Meine Nachweise" — was der Betrieb von mir braucht.
 *
 * Eine eigene Seite und kein Kasten auf der Startseite: Hier liegt etwas, das
 * man abarbeitet, und dafür braucht es Ruhe. Die Startseite zeigt, was heute
 * ansteht — nicht, was noch fehlt.
 */
export default function MeineNachweise() {
  return (
    <div className="p-4 space-y-5 pb-24">
      <div>
        <Link href="/employee/ich"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 font-medium">
          <ArrowLeft size={15} /> Ich
        </Link>
        <h1 className="text-xl font-bold text-navy flex items-center gap-2 mt-3">
          <ShieldCheck size={20} className="text-teal-600" /> Meine Nachweise
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Was eingereicht werden soll — und was schon erledigt ist.
        </p>
      </div>

      {/* §150 Belehrungen zuerst: Sie sind mit einem Klick erledigt, eine
          Anforderung braucht ein Dokument. Was schnell geht, gehört nach oben. */}
      <MeineBelehrungen />
      <MeineAnforderungen />
    </div>
  )
}
