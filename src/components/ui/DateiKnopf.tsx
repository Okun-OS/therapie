'use client'

import { useState } from 'react'
import { Bildschau } from './Bildschau'
import { dateiSichern } from '@/lib/datei-oeffnen'

/**
 * §263 Eine Datei öffnen — an jeder Stelle gleich.
 *
 * WARUM ES DAS GEBEN MUSS
 * Seit §260 antwortet `/api/files/<id>` mit einer Umleitung in den
 * Objektspeicher. Das ist eine FREMDE Adresse, und iOS holt eine
 * installierte App dafür aus dem Vollbild in einen Browser mit Adresszeile.
 * Gemeldet wurde genau das — mit einem Bildschirmfoto, auf dem
 * `…r2.cloudflarestorage.com` stand, wo sonst nichts steht.
 *
 * An neun Stellen im Programm lag eine Unterlage hinter einem
 * `<a target="_blank">`. Jede einzeln umzubauen hieße, die Entscheidung
 * „Bild anzeigen oder sichern?" neunmal hinzuschreiben — und beim nächsten
 * Umbau liefen die Abschriften auseinander. Deshalb EIN Knopf.
 *
 * Ein Bild öffnet sich in der Bildschau, mit Zoom. Alles andere wird
 * gesichert, ohne dass die App eine fremde Adresse ansteuert.
 */
export function DateiKnopf({
  adresse, name, typ, className, title, children, onFehler,
}: {
  adresse: string
  name: string
  /** Der Dateityp, soweit bekannt. Ohne ihn wird immer gesichert. */
  typ?: string | null
  className?: string
  title?: string
  children: React.ReactNode
  onFehler?: (satz: string) => void
}) {
  const [schau, setSchau] = useState(false)
  /*
   * §263 Fehlt der Typ, entscheidet die Endung.
   *
   * Nicht jede Liste im Programm führt den Dateityp mit — manche kennen nur
   * den Namen. Daraus „dann eben sichern" zu machen wäre die bequeme Antwort
   * und die falsche: Ein abfotografierter Krankenschein gehört in die
   * Bildschau, sonst landet er im Ordner „Downloads" statt vor den Augen.
   *
   * Eine Fehleinschätzung ist hier harmlos. Zeigt die Bildschau etwas, das
   * kein Bild ist, bleibt sie leer und der Knopf zum Sichern steht daneben.
   */
  const endung = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? ''
  const istBild = typ
    ? typ.startsWith('image/')
    : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(endung)

  async function antippen() {
    if (istBild) { setSchau(true); return }
    if (await dateiSichern(adresse, name) === 'fehlgeschlagen') {
      onFehler?.('Die Datei ließ sich nicht öffnen.')
    }
  }

  return (
    <>
      <button type="button" onClick={antippen} className={className} title={title}>
        {children}
      </button>
      {schau && (
        <Bildschau
          adresse={adresse}
          name={name}
          onSchliessen={() => setSchau(false)}
          onHerunterladen={() => { dateiSichern(adresse, name) }}
        />
      )}
    </>
  )
}
