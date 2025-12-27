/**
 * Admin Audit Logging - Interface Segregation Principle
 * Separate interfaces for different audit concerns
 */

// Core audit event interface
export interface IAuditEvent {
  id?: string
  timestamp: string
  actorId: string
  actorEmail?: string
  actorRole?: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
}

// Interface for writing audit logs (segregated from reading)
export interface IAuditWriter {
  log(event: Omit<IAuditEvent, 'id' | 'timestamp'>): Promise<void>
}

// Interface for reading audit logs (segregated from writing)
export interface IAuditReader {
  getByActor(actorId: string, limit?: number): Promise<IAuditEvent[]>
  getByResource(resource: AuditResource, resourceId?: string, limit?: number): Promise<IAuditEvent[]>
  getByAction(action: AuditAction, limit?: number): Promise<IAuditEvent[]>
  getRecent(limit?: number): Promise<IAuditEvent[]>
}

// Interface for audit log retention/cleanup
export interface IAuditRetention {
  deleteOlderThan(days: number): Promise<number>
  archiveOlderThan(days: number): Promise<number>
}

// Combined interface for full audit service
export interface IAuditService extends IAuditWriter, IAuditReader {}

// Audit action types
export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'MINT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'CONFIG_CHANGE'
  | 'PERMISSION_CHANGE'
  | 'ROLE_CHANGE'

// Audit resource types
export type AuditResource =
  | 'submission'
  | 'campaign'
  | 'user'
  | 'profile'
  | 'purchase'
  | 'bug_report'
  | 'campaign_update'
  | 'admin_request'
  | 'system_config'
  | 'contract'
