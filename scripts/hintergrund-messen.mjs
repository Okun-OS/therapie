import { lesen } from '/home/user/therapie/scripts/png.mjs'
const kanal = v => { const s = v/255; return s <= 0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4 }
for (const [name, datei] of [
  ['Start', 'start-aufmacher'], ['Funktionen', 'funktionen-aufmacher'], ['Band', 'band-verbunden'],
]) {
  const b = lesen(`public/hintergrund/quelle/${datei}.png`)
  // In Zehnteln der Breite: Wie hell ist das Bild dort von sich aus?
  const zeilen = []
  for (let z = 0; z < 10; z++) {
    const x0 = Math.floor(b.w * z / 10), x1 = Math.floor(b.w * (z + 1) / 10)
    let max = 0, summe = 0, n = 0
    for (let y = 0; y < b.h; y++) for (let x = x0; x < x1; x++) {
      const i = (y * b.w + x) * 4
      const l = 0.2126*kanal(b.rgba[i]) + 0.7152*kanal(b.rgba[i+1]) + 0.0722*kanal(b.rgba[i+2])
      if (l > max) max = l
      summe += l; n++
    }
    zeilen.push(`${(z*10).toString().padStart(2)}–${(z+1)*10}%: max ${max.toFixed(3)} mittel ${(summe/n).toFixed(3)}`)
  }
  console.log(`\n${name}`)
  zeilen.forEach(z => console.log('  ' + z))
}
