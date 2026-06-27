import bcrypt from 'bcryptjs'
import { generateSecureToken } from './secure-token'

export { generateSecureToken }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
