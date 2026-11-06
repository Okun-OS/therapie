import type { NextRequest } from 'next/server'
import { kanonischeBasis } from './kanonische-basis'

/**
 * Die Adresse, unter der dieses Programm von außen erreichbar ist.
 *
 * `req.nextUrl.origin` spiegelt auf Railway und hinter Vermittlern oft die
 * interne Bindeadresse (localhost) statt der öffentlichen Domain — als Link in
 * einer E-Mail wäre das unbrauchbar. Darum entscheidet `kanonischeBasis`, und
 * die Adresse der Anfrage ist nur noch der Rückfall für die Entwicklung.
 *
 * §238 Vorher stand hier `process.env.APP_URL || req.nextUrl.origin`. Das
 * war richtig gedacht und reichte nicht: Am laufenden System trug `APP_URL`
 * den von Railway erzeugten Namen, und der ging damit in jede E-Mail und in
 * jede Kalenderadresse. Was dagegen hilft, steht in `kanonische-basis.ts`.
 */
export function getAppOrigin(req: NextRequest): string {
  return kanonischeBasis(req.nextUrl.origin)
}
