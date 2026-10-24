'use client'

import { Nachrichten } from '@/components/chat/Nachrichten'

// §129 Mitarbeitersicht: schreiben ja, Gruppen eröffnen nein.
export default function Seite() {
  return <Nachrichten darfGruppen={false} />
}
