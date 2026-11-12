/**
 * RFC 6238 TOTP implementation using only Node.js built-in crypto.
 * Compatible with Google Authenticator, Authy, and all RFC 6238 apps.
 */

import { createHmac, randomBytes } from 'crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer): string {
  let out = ''
  let bits = 0
  let val = 0
  for (let i = 0; i < buf.length; i++) {
    val = (val << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      out += BASE32[(val >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(val << (5 - bits)) & 31]
  return out
}

function base32Decode(str: string): Buffer {
  const s = str.toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bytes: number[] = []
  let bits = 0
  let val = 0
  for (const c of s) {
    const idx = BASE32.indexOf(c)
    if (idx === -1) continue
    val = (val << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((val >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const msg = Buffer.alloc(8)
  msg.writeBigInt64BE(BigInt(counter))
  const mac = createHmac('sha1', key).update(msg).digest()
  const offset = mac[mac.length - 1] & 0xf
  const code =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

/** Generate a new random TOTP secret (20 bytes, base32-encoded). */
export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

/**
 * Verify a 6-digit TOTP token.
 * Accepts codes from ±1 time step (30 s) to allow clock drift.
 */
export function verifyTotp(secret: string, token: string): boolean {
  const t = Math.floor(Date.now() / 1000 / 30)
  for (let i = -1; i <= 1; i++) {
    if (hotp(secret, t + i) === token.replace(/\s/g, '')) return true
  }
  return false
}

/** Returns the otpauth:// URI for QR code generation. */
export function totpUri(email: string, secret: string): string {
  const issuer = 'OKUN Workforce'
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}
