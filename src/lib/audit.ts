import { prisma } from './prisma'

export type AuditAction = 'create' | 'update' | 'delete' | 'login_failed' | 'export' | 'legal_contract'

interface AuditParams {
  userId: string
  userEmail: string
  userRole: string
  action: AuditAction
  entityType: string
  entityId?: string
  customerId?: string
  details?: object
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params })
  } catch (err) {
    console.error('audit log write failed:', err)
  }
}
