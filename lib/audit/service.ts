import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  IAuditService,
  IAuditEvent,
  IAuditWriter,
  IAuditReader,
  AuditAction,
  AuditResource,
} from './types'

/**
 * Supabase-based Audit Service Implementation
 * Implements both IAuditWriter and IAuditReader (full IAuditService)
 */
export class SupabaseAuditService implements IAuditService {
  private supabase: SupabaseClient
  private tableName = 'admin_audit_logs'

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )
  }

  async log(event: Omit<IAuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: IAuditEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    }

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AUDIT]', auditEvent.action, auditEvent.resource, auditEvent.resourceId || '')
    }

    const { error } = await this.supabase.from(this.tableName).insert({
      actor_id: auditEvent.actorId,
      actor_email: auditEvent.actorEmail,
      actor_role: auditEvent.actorRole,
      action: auditEvent.action,
      resource: auditEvent.resource,
      resource_id: auditEvent.resourceId,
      details: auditEvent.details,
      ip_address: auditEvent.ipAddress,
      user_agent: auditEvent.userAgent,
      success: auditEvent.success,
      error_message: auditEvent.errorMessage,
      created_at: auditEvent.timestamp,
    })

    if (error) {
      console.error('[AUDIT] Failed to write audit log:', error.message)
      // Don't throw - audit failures shouldn't break the main operation
    }
  }

  async getByActor(actorId: string, limit = 100): Promise<IAuditEvent[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`)
    return this.mapRecords(data || [])
  }

  async getByResource(resource: AuditResource, resourceId?: string, limit = 100): Promise<IAuditEvent[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('resource', resource)

    if (resourceId) {
      query = query.eq('resource_id', resourceId)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`)
    return this.mapRecords(data || [])
  }

  async getByAction(action: AuditAction, limit = 100): Promise<IAuditEvent[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`)
    return this.mapRecords(data || [])
  }

  async getRecent(limit = 50): Promise<IAuditEvent[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`)
    return this.mapRecords(data || [])
  }

  private mapRecords(records: any[]): IAuditEvent[] {
    return records.map((r) => ({
      id: r.id,
      timestamp: r.created_at,
      actorId: r.actor_id,
      actorEmail: r.actor_email,
      actorRole: r.actor_role,
      action: r.action,
      resource: r.resource,
      resourceId: r.resource_id,
      details: r.details,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      success: r.success,
      errorMessage: r.error_message,
    }))
  }
}

/**
 * Console-only audit writer for development/testing
 */
export class ConsoleAuditWriter implements IAuditWriter {
  async log(event: Omit<IAuditEvent, 'id' | 'timestamp'>): Promise<void> {
    console.log('[AUDIT]', JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    }, null, 2))
  }
}

// Singleton instance
let auditService: IAuditService | null = null

/**
 * Get the audit service instance
 */
export function getAuditService(): IAuditService {
  if (!auditService) {
    auditService = new SupabaseAuditService()
  }
  return auditService
}

/**
 * Convenience function to log an audit event
 */
export async function auditLog(
  action: AuditAction,
  resource: AuditResource,
  actor: { id: string; email?: string; role?: string },
  options?: {
    resourceId?: string
    details?: Record<string, any>
    success?: boolean
    errorMessage?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  const service = getAuditService()
  await service.log({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action,
    resource,
    resourceId: options?.resourceId,
    details: options?.details,
    success: options?.success ?? true,
    errorMessage: options?.errorMessage,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  })
}
