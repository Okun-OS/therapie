import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex')
}
