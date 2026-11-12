import { NextRequest, NextResponse } from 'next/server'
import { karriereSeite } from '@/lib/karriere'
import { getAppOrigin } from '@/lib/app-url'
import { anzeigeText, UMFAENGE } from '@/lib/recruiting'

export const dynamic = 'force-dynamic'

/**
 * §148 Der Stellenfeed für die Börsen.
 *
 * WARUM XML UND KEINE API-ANBINDUNG
 * Weil es der einzige Weg ist, der ohne Vertrag funktioniert. Indeed,
 * StepStone, kimeta und die Bundesagentur lesen alle eine XML-Datei von einer
 * Adresse, die man ihnen nennt — man trägt den Link einmal ein, und ab da
 * holen sie sich die Anzeigen selbst. Eine echte Schnittstelle gibt es bei
 * jedem von ihnen auch, aber nur gegen Anmeldung, Schlüssel und in drei
 * verschiedenen Formaten. Der Feed ist das, was ein kleiner Träger am Montag
 * einrichten kann.
 *
 * DAS FORMAT
 * Das „Indeed XML feed"-Schema — `<source><job>…`. Es ist das am weitesten
 * verbreitete; die anderen Börsen lesen es ebenfalls oder verlangen nur
 * geringe Abweichungen.
 */

function xmlSicher(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** In das Datumsformat, das die Börsen erwarten. */
function alsDatum(d: Date | null): string {
  return (d ?? new Date()).toISOString().replace('T', ' ').slice(0, 19)
}

export async function GET(
  req: NextRequest, { params }: { params: { kunde: string } },
) {
  const seite = await karriereSeite(params.kunde)
  if (!seite) return new NextResponse('Nicht gefunden', { status: 404 })

  const basis = getAppOrigin(req)
  const zeilen = seite.stellen.map(s => {
    // Der Fließtext geht als CDATA raus: Die Börsen zeigen ihn als HTML an,
    // und ein Bindestrich mitten im Satz soll kein Tag werden.
    const text = anzeigeText(s).replace(/]]>/g, ']]&gt;')
    return `  <job>
    <title><![CDATA[${s.titel}]]></title>
    <date>${alsDatum(s.veroeffentlichtAm)}</date>
    <referencenumber>${xmlSicher(s.id)}</referencenumber>
    <url><![CDATA[${basis}/karriere/${params.kunde}/${s.slug}]]></url>
    <company><![CDATA[${seite.betrieb}]]></company>
    <city><![CDATA[${s.ort ?? seite.adresse.ort ?? ''}]]></city>
    <postalcode><![CDATA[${s.plz ?? seite.adresse.plz ?? ''}]]></postalcode>
    <country>DE</country>
    <jobtype><![CDATA[${UMFAENGE[s.umfang as keyof typeof UMFAENGE] ?? s.umfang}]]></jobtype>
    <description><![CDATA[${text}]]></description>
  </job>`
  })

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<source>
  <publisher><![CDATA[${seite.betrieb}]]></publisher>
  <publisherurl><![CDATA[${basis}/karriere/${params.kunde}]]></publisherurl>
  <lastBuildDate>${alsDatum(new Date())}</lastBuildDate>
${zeilen.join('\n')}
</source>
`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Die Börsen holen den Feed mehrmals täglich; eine Viertelstunde
      // Zwischenspeicher nimmt Last, ohne dass eine Anzeige lange fehlt.
      'Cache-Control': 'public, max-age=900',
    },
  })
}
