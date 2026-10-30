import bcrypt from 'bcryptjs'
import { generateSecureToken } from './secure-token'

export { generateSecureToken }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  strength: 'weak' | 'fair' | 'strong' | 'very-strong'
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []
  if (password.length < 8) errors.push('Mindestens 8 Zeichen')
  if (!/[A-Z]/.test(password)) errors.push('Mindestens ein Großbuchstabe')
  if (!/[a-z]/.test(password)) errors.push('Mindestens ein Kleinbuchstabe')
  if (!/[0-9]/.test(password)) errors.push('Mindestens eine Zahl')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Mindestens ein Sonderzeichen (!@#$%...)')

  let strength: PasswordValidationResult['strength'] = 'weak'
  const passed = 5 - errors.length
  if (passed === 5 && password.length >= 12) strength = 'very-strong'
  else if (passed >= 4) strength = 'strong'
  else if (passed >= 3) strength = 'fair'

  return { valid: errors.length === 0, errors, strength }
}
