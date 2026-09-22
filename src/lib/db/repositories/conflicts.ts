import { db } from '../schema';
import type { Conflict } from '@/types/db';
import { v4 as uuidv4 } from 'uuid';
import { createAuditEvent } from './operations';

// ============================================================
// Conflicts Repository
//
// Conflicts are NEVER deleted — only their status changes.
// A conflict record is the permanent record of a disagreement
// and its resolution.
// ============================================================

export interface DetectConflictParams {
  inspectionId: string;
  entityType: string;
  entityId: string;
  field: string;
  baseValue: string;       // last known shared value
  localValue: string;      // what this device set
  remoteValue: string;     // what the server has
  localOperationId: string;
  remoteOperationId: string;
  localUserId: string;
  remoteUserId: string;
  localUserName: string;
  remoteUserName: string;
  localTimestamp: string;
  remoteTimestamp: string;
}

/**
 * Create a business-level conflict record.
 *
 * Called when:
 *   - Two devices changed the same field to different values
 *   - Both values diverged from the shared base value
 *
 * This is SEPARATE from Yjs CRDT convergence.
 * Yjs handles the technical merge; this handles semantic disagreement.
 */
export async function detectAndCreateConflict(params: DetectConflictParams): Promise<Conflict | null> {
  // No conflict if values agree
  if (params.localValue === params.remoteValue) return null;
  // No conflict if only one side changed
  if (params.localValue === params.baseValue) return null;
  if (params.remoteValue === params.baseValue) return null;

  // Check if we already have an open conflict for this field
  const existing = await db.conflicts
    .where('[entityId+field]')
    .equals([params.entityId, params.field])
    .filter((c) => c.status === 'OPEN')
    .first();

  if (existing) return existing; // Don't create duplicate conflicts

  const id = uuidv4();
  const conflict: Conflict = {
    id,
    inspectionId: params.inspectionId,
    entityType: params.entityType,
    entityId: params.entityId,
    field: params.field,
    baseValue: params.baseValue,
    localValue: params.localValue,
    remoteValue: params.remoteValue,
    localOperationId: params.localOperationId,
    remoteOperationId: params.remoteOperationId,
    localUserId: params.localUserId,
    remoteUserId: params.remoteUserId,
    localUserName: params.localUserName,
    remoteUserName: params.remoteUserName,
    localTimestamp: params.localTimestamp,
    remoteTimestamp: params.remoteTimestamp,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };

  await db.conflicts.put(conflict);

  // Mark inspection as having a conflict
  await db.inspections.update(params.inspectionId, { syncStatus: 'CONFLICT' });

  // Audit: conflict detected
  await createAuditEvent({
    userId: 'system',
    userName: 'System',
    entityType: params.entityType,
    entityId: params.entityId,
    inspectionId: params.inspectionId,
    action: 'CONFLICT_DETECTED',
    field: params.field,
    beforeValue: params.baseValue,
    afterValue: `LOCAL:${params.localValue} vs REMOTE:${params.remoteValue}`,
    metadata: { conflictId: id },
  });

  return conflict;
}

export interface ResolveConflictParams {
  conflictId: string;
  resolvedValue: string;
  resolvedBy: string;
  resolvedByName: string;
}

/**
 * Resolve a conflict — called by supervisor.
 *
 * The conflict record is NEVER deleted.
 * Its status changes to RESOLVED and the resolved value is stored.
 */
export async function resolveConflict(params: ResolveConflictParams): Promise<Conflict> {
  const conflict = await db.conflicts.get(params.conflictId);
  if (!conflict) throw new Error(`Conflict ${params.conflictId} not found`);

  const now = new Date().toISOString();

  const updated: Conflict = {
    ...conflict,
    status: 'RESOLVED',
    resolvedValue: params.resolvedValue,
    resolvedBy: params.resolvedBy,
    resolvedByName: params.resolvedByName,
    resolvedAt: now,
  };

  await db.conflicts.put(updated);

  // Update conflict count in sync state
  const openCount = await db.conflicts.where('status').equals('OPEN').count();
  const syncState = await db.syncState.toCollection().first();
  if (syncState) {
    await db.syncState.update(syncState.deviceId, { conflictCount: openCount });
  }

  // Audit: conflict resolved
  await createAuditEvent({
    userId: params.resolvedBy,
    userName: params.resolvedByName,
    entityType: conflict.entityType,
    entityId: conflict.entityId,
    inspectionId: conflict.inspectionId,
    action: 'CONFLICT_RESOLVED',
    field: conflict.field,
    beforeValue: `LOCAL:${conflict.localValue} vs REMOTE:${conflict.remoteValue}`,
    afterValue: params.resolvedValue,
    metadata: { conflictId: params.conflictId },
  });

  return updated;
}

export async function getOpenConflicts(): Promise<Conflict[]> {
  return db.conflicts
    .where('status')
    .equals('OPEN')
    .sortBy('createdAt');
}

export async function getInspectionConflicts(inspectionId: string): Promise<Conflict[]> {
  return db.conflicts
    .where('inspectionId')
    .equals(inspectionId)
    .sortBy('createdAt');
}

export async function getAllConflicts(): Promise<Conflict[]> {
  return db.conflicts.orderBy('createdAt').reverse().toArray();
}

export async function getOpenConflictCount(): Promise<number> {
  return db.conflicts.where('status').equals('OPEN').count();
}

export async function upsertConflictsFromServer(conflicts: Conflict[]): Promise<void> {
  for (const conflict of conflicts) {
    await db.conflicts.put(conflict);
  }
}
