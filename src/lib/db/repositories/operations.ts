import { db } from '../schema';
import { LogicalClock, buildOperationId } from '../logicalClock';
import { getCachedDeviceId } from '../device';
import { CURRENT_SCHEMA_VERSION } from '../schema';
import { v4 as uuidv4 } from 'uuid';
import type { Operation, AuditEvent, AuditAction } from '@/types/db';

// ============================================================
// Operations Repository
//
// Every user edit that must be synchronized creates an Operation.
// Operations are queued locally and pushed to the server when online.
// ============================================================

export interface CreateOperationParams {
  userId: string;
  entityType: string;
  entityId: string;
  inspectionId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  field?: string;
  beforeValue?: string;
  afterValue?: string;
}

/**
 * Create a new operation record.
 * This is the primary entry point for all user edits.
 *
 * Flow:
 *   User action
 *     → createOperation()
 *     → IndexedDB operation saved with PENDING status
 *     → Audit event created
 *     → Sync manager notified
 */
export async function createOperation(params: CreateOperationParams): Promise<Operation> {
  const deviceId = getCachedDeviceId();
  const logicalClock = await LogicalClock.tick();
  const operationId = buildOperationId(params.entityId, logicalClock);

  const operation: Operation = {
    operationId,
    deviceId,
    userId: params.userId,
    entityType: params.entityType,
    entityId: params.entityId,
    operationType: params.operationType,
    payload: params.payload,
    logicalClock,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    syncStatus: 'PENDING',
    retryCount: 0,
  };

  await db.operations.put(operation);

  // Create audit event for this operation
  await createAuditEvent({
    operationId,
    userId: params.userId,
    entityType: params.entityType,
    entityId: params.entityId,
    inspectionId: params.inspectionId,
    action: operationTypeToAction(params.operationType),
    field: params.field,
    beforeValue: params.beforeValue,
    afterValue: params.afterValue,
  });

  return operation;
}

function operationTypeToAction(op: 'CREATE' | 'UPDATE' | 'DELETE'): AuditAction {
  switch (op) {
    case 'CREATE': return 'CREATED';
    case 'UPDATE': return 'UPDATED';
    case 'DELETE': return 'DELETED';
  }
}

export async function getPendingOperations(): Promise<Operation[]> {
  return db.operations
    .where('syncStatus')
    .equals('PENDING')
    .sortBy('logicalClock');
}

export async function markOperationSynced(operationId: string): Promise<void> {
  await db.operations.update(operationId, { syncStatus: 'SYNCED' });
}

export async function markOperationFailed(operationId: string, error: string): Promise<void> {
  const op = await db.operations.get(operationId);
  if (!op) return;
  await db.operations.update(operationId, {
    syncStatus: 'FAILED',
    retryCount: (op.retryCount ?? 0) + 1,
    lastError: error,
  });
}

export async function markOperationDuplicate(operationId: string): Promise<void> {
  await db.operations.update(operationId, { syncStatus: 'DUPLICATE' });
}

export async function getPendingOperationCount(): Promise<number> {
  return db.operations.where('syncStatus').equals('PENDING').count();
}

// ============================================================
// Audit Events Repository
// Append-only — audit events are NEVER deleted or modified.
// ============================================================

interface CreateAuditEventParams {
  operationId?: string;
  userId: string;
  entityType: string;
  entityId: string;
  inspectionId: string;
  action: AuditAction;
  field?: string;
  beforeValue?: string;
  afterValue?: string;
  metadata?: Record<string, unknown>;
  userName?: string;
}

export async function createAuditEvent(params: CreateAuditEventParams): Promise<AuditEvent> {
  const deviceId = getCachedDeviceId();

  const event: AuditEvent = {
    id: uuidv4(),
    operationId: params.operationId,
    userId: params.userId,
    userName: params.userName ?? params.userId,
    deviceId,
    entityType: params.entityType,
    entityId: params.entityId,
    inspectionId: params.inspectionId,
    action: params.action,
    field: params.field,
    beforeValue: params.beforeValue,
    afterValue: params.afterValue,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  };

  await db.auditEvents.put(event);
  return event;
}

export async function getInspectionAuditHistory(inspectionId: string): Promise<AuditEvent[]> {
  return db.auditEvents
    .where('inspectionId')
    .equals(inspectionId)
    .sortBy('createdAt');
}

export async function addAuditEventsFromServer(events: AuditEvent[]): Promise<void> {
  // Upsert — server events may already exist locally
  for (const event of events) {
    const existing = await db.auditEvents.get(event.id);
    if (!existing) {
      await db.auditEvents.put(event);
    }
    // Never update existing audit events — they are immutable
  }
}
