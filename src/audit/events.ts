/**
 * Audit event types and interfaces
 */

export type AuditEventType =
  | 'auth_success'
  | 'auth_failure'
  | 'session_created'
  | 'session_closed'
  | 'tool_call'
  | 'tool_error'
  | 'config_loaded'
  | 'server_started'
  | 'server_stopped';

export interface BaseAuditEvent {
  timestamp: string;
  event: AuditEventType;
  requestId?: string;
}

export interface AuthEvent extends BaseAuditEvent {
  event: 'auth_success' | 'auth_failure';
  clientId?: string;
  authMode: 'none' | 'bearer';
  error?: string;
  ipAddress?: string;
}

export interface SessionEvent extends BaseAuditEvent {
  event: 'session_created' | 'session_closed';
  sessionId: string;
  clientId: string;
  authMode: 'none' | 'bearer';
  reason?: string;
}

export interface ToolCallEvent extends BaseAuditEvent {
  event: 'tool_call' | 'tool_error';
  sessionId?: string;
  clientId: string;
  authMode: 'none' | 'bearer';
  tool: string;
  operation?: string;
  success: boolean;
  durationMs?: number;
  error?: string;
}

export interface ServerEvent extends BaseAuditEvent {
  event: 'config_loaded' | 'server_started' | 'server_stopped';
  details?: Record<string, unknown>;
}

export type AuditEvent = AuthEvent | SessionEvent | ToolCallEvent | ServerEvent;

