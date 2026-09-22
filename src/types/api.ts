// ============================================================
// FieldSync — API Request / Response Types
// ============================================================

import type { Conflict, AuditEvent } from './db';

// ---- Health ----

export interface HealthResponse {
  status: 'ok';
  ts: number;
  version: string;
}

// ---- Sync Push ----

export interface PushOperation {
  operationId: string;
  deviceId: string;
  userId: string;
  entityType: string;
  entityId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  logicalClock: number;
  schemaVersion: number;
  createdAt: string;
}

export interface PushRequest {
  operations: PushOperation[];
  yjsUpdates?: Record<string, string>; // inspectionId → base64 encoded Yjs update
}

export type OperationResult =
  | { operationId: string; status: 'APPLIED' }
  | { operationId: string; status: 'DUPLICATE' }
  | { operationId: string; status: 'CONFLICT'; conflictId: string }
  | { operationId: string; status: 'SCHEMA_MISMATCH'; requiredVersion: number }
  | { operationId: string; status: 'ERROR'; message: string };

export interface PushResponse {
  results: OperationResult[];
  serverTs: number;
}

// ---- Sync Pull ----

export interface ServerChange {
  operationId: string;
  entityType: string;
  entityId: string;
  inspectionId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  userId: string;
  deviceId: string;
  logicalClock: number;
  schemaVersion: number;
  createdAt: string;
}

export interface PullResponse {
  changes: ServerChange[];
  conflicts: Conflict[];
  auditEvents: AuditEvent[];
  yjsUpdates: Record<string, string>; // inspectionId → base64 Yjs update
  nextCursor: string;
  hasMore: boolean;
  serverTs: number;
}

// ---- Sync Status ----

export interface SyncStatusResponse {
  deviceId: string;
  lastPullCursor?: string;
  lastSuccessfulSync?: string;
  pendingOnServer: number;
  serverTs: number;
}

// ---- Conflicts ----

export interface ResolveConflictRequest {
  conflictId: string;
  resolvedValue: string;
  resolvedBy: string;
  resolution: 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'CUSTOM';
}

export interface ResolveConflictResponse {
  conflictId: string;
  status: 'RESOLVED';
  auditEventId: string;
}

// ---- Media Sign ----

export interface SignMediaRequest {
  mediaId: string;
  inspectionId: string;
  fileName: string;
  mimeType: string;
  uploadedBytes?: number; // for resume
}

export interface SignMediaResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  uploadPreset: string;
  uploadId: string; // X-Unique-Upload-Id
  folder: string;
  publicId: string;
}

// ---- Audit ----

export interface AuditResponse {
  events: AuditEvent[];
  total: number;
  cursor?: string;
}

// ---- Generic ----

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
