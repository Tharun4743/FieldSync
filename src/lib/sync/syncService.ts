import { getPendingOperations, markOperationSynced, markOperationFailed, markOperationDuplicate } from '../db/repositories/operations';
import { upsertConflictsFromServer } from '../db/repositories/conflicts';
import { addAuditEventsFromServer } from '../db/repositories/operations';
import { yjsManager } from '../crdt/yjsManager';
import { LogicalClock } from '../db/logicalClock';
import { db } from '../db/schema';
import type { PushRequest, PushResponse, PullResponse, OperationResult } from '@/types/api';
import type { Operation } from '@/types/db';

const PUSH_URL = '/api/sync/push';
const PULL_URL = '/api/sync/pull';

/**
 * Push pending local operations to the server.
 *
 * Protocol:
 *   1. Load all PENDING operations from IndexedDB
 *   2. Batch them (max 50 per request)
 *   3. Include Yjs state updates for affected inspections
 *   4. POST to /api/sync/push
 *   5. Process results: APPLIED | DUPLICATE | CONFLICT | ERROR
 *   6. Update operation sync status in IndexedDB
 *
 * Idempotency:
 *   The server uses operationId to detect duplicates.
 *   If network fails after server applies but before client receives response,
 *   the retry will receive DUPLICATE status — which is handled gracefully.
 */
export async function pushPendingOperations(authToken: string): Promise<{
  applied: number;
  duplicates: number;
  conflicts: number;
  errors: number;
}> {
  const pending = await getPendingOperations();
  if (pending.length === 0) return { applied: 0, duplicates: 0, conflicts: 0, errors: 0 };

  const stats = { applied: 0, duplicates: 0, conflicts: 0, errors: 0 };

  // Process in batches of 50
  for (let i = 0; i < pending.length; i += 50) {
    const batch = pending.slice(i, i + 50);
    await pushBatch(batch, authToken, stats);
  }

  return stats;
}

async function pushBatch(
  operations: Operation[],
  authToken: string,
  stats: { applied: number; duplicates: number; conflicts: number; errors: number }
): Promise<void> {
  // Collect Yjs updates for all affected inspections
  const inspectionIds = new Set(operations.map((op) => op.payload['inspectionId'] as string).filter(Boolean));
  const yjsUpdates: Record<string, string> = {};

  for (const inspectionId of inspectionIds) {
    try {
      const update = yjsManager.encodeStateAsBase64(inspectionId);
      if (update) yjsUpdates[inspectionId] = update;
    } catch {
      // Doc not loaded — skip Yjs update for this inspection
    }
  }

  const request: PushRequest = {
    operations: operations.map((op) => ({
      operationId: op.operationId,
      deviceId: op.deviceId,
      userId: op.userId,
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      payload: op.payload,
      logicalClock: op.logicalClock,
      schemaVersion: op.schemaVersion,
      createdAt: op.createdAt,
    })),
    yjsUpdates,
  };

  const response = await fetch(PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    // Mark all as failed for retry
    for (const op of operations) {
      await markOperationFailed(op.operationId, `HTTP ${response.status}`);
      stats.errors++;
    }
    return;
  }

  const data = await response.json() as PushResponse;

  for (const result of data.results) {
    await processOperationResult(result, stats);
  }
}

async function processOperationResult(
  result: OperationResult,
  stats: { applied: number; duplicates: number; conflicts: number; errors: number }
): Promise<void> {
  switch (result.status) {
    case 'APPLIED':
      await markOperationSynced(result.operationId);
      stats.applied++;
      break;

    case 'DUPLICATE':
      await markOperationDuplicate(result.operationId);
      stats.duplicates++;
      break;

    case 'CONFLICT':
      // Conflict was created on server — pull will bring it down
      await markOperationSynced(result.operationId);
      stats.conflicts++;
      break;

    case 'SCHEMA_MISMATCH':
      // Operation schema is too old — mark failed for manual review
      await markOperationFailed(result.operationId, `Schema mismatch. Required: ${result.requiredVersion}`);
      stats.errors++;
      break;

    case 'ERROR':
      await markOperationFailed(result.operationId, result.message);
      stats.errors++;
      break;
  }
}

// ============================================================
// Pull — receive server changes
// ============================================================

/**
 * Pull changes from the server since last cursor.
 *
 * Safety: cursor is ONLY advanced after successful local application.
 * If local apply fails, the cursor stays at its previous value
 * and the pull will be retried next sync cycle.
 */
export async function pullServerChanges(authToken: string): Promise<{
  changesApplied: number;
  conflictsReceived: number;
  auditEventsReceived: number;
  nextCursor: string | null;
}> {
  // Get current cursor
  const syncState = await db.syncState.toCollection().first();
  const cursor = syncState?.lastPullCursor ?? '';

  const url = cursor ? `${PULL_URL}?cursor=${encodeURIComponent(cursor)}` : PULL_URL;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  if (!response.ok) {
    throw new Error(`Pull failed: HTTP ${response.status}`);
  }

  const data = await response.json() as PullResponse;

  // --- Apply local changes BEFORE advancing cursor ---

  // 1. Apply server operations to local DB
  for (const change of data.changes) {
    await applyServerChange(change);
  }

  // 2. Apply Yjs updates from server
  for (const [inspectionId, base64Update] of Object.entries(data.yjsUpdates)) {
    try {
      // Load doc if not already loaded
      await yjsManager.getDoc(inspectionId);
      yjsManager.applyRemoteUpdate(inspectionId, base64Update);
    } catch {
      // Doc load failed — skip Yjs update (will retry next sync)
    }
  }

  // 3. Update conflict records
  await upsertConflictsFromServer(data.conflicts);

  // 4. Store audit events (append-only, never overwrite)
  await addAuditEventsFromServer(data.auditEvents);

  // 5. Update logical clock from received operations
  if (data.changes.length > 0) {
    const maxClock = Math.max(...data.changes.map((c) => c.logicalClock));
    await LogicalClock.receive(maxClock);
  }

  // --- Only now advance the cursor ---
  if (syncState) {
    await db.syncState.update(syncState.deviceId, {
      lastPullCursor: data.nextCursor,
      lastSuccessfulSync: new Date().toISOString(),
    });
  }

  return {
    changesApplied: data.changes.length,
    conflictsReceived: data.conflicts.length,
    auditEventsReceived: data.auditEvents.length,
    nextCursor: data.nextCursor,
  };
}

async function applyServerChange(change: PullResponse['changes'][number]): Promise<void> {
  switch (change.entityType) {
    case 'inspectionResult':
      await applyResultChange(change);
      break;
    case 'note':
      await applyNoteChange(change);
      break;
    case 'inspection':
      await applyInspectionChange(change);
      break;
    // Add more entity types as needed
  }
}

async function applyResultChange(change: PullResponse['changes'][number]): Promise<void> {
  const payload = change.payload as {
    inspectionId: string;
    checklistItemId: string;
    value: string;
    valueType: 'string' | 'number' | 'boolean';
    version: number;
  };

  const existing = await db.inspectionResults
    .where('[inspectionId+checklistItemId]')
    .equals([payload.inspectionId, payload.checklistItemId])
    .first();

  // Only apply if server version is newer than local
  if (existing && existing.version >= (payload.version ?? 0)) return;

  await db.inspectionResults.put({
    id: change.entityId,
    inspectionId: payload.inspectionId,
    checklistItemId: payload.checklistItemId,
    value: payload.value,
    valueType: payload.valueType,
    updatedBy: change.userId,
    updatedAt: change.createdAt,
    version: payload.version ?? 1,
    localVersion: existing?.localVersion ?? 1,
    syncStatus: 'SYNCED',
  });
}

async function applyNoteChange(change: PullResponse['changes'][number]): Promise<void> {
  const payload = change.payload as {
    inspectionId: string;
    authorId: string;
    authorName: string;
    content: string;
  };

  if (change.operationType === 'CREATE') {
    const exists = await db.notes.get(change.entityId);
    if (exists) return; // Already have it

    await db.notes.put({
      id: change.entityId,
      inspectionId: payload.inspectionId,
      authorId: payload.authorId,
      authorName: payload.authorName,
      content: payload.content,
      createdAt: change.createdAt,
      updatedAt: change.createdAt,
      syncStatus: 'SYNCED',
    });
  }
}

async function applyInspectionChange(change: PullResponse['changes'][number]): Promise<void> {
  const payload = change.payload as Partial<import('@/types/db').Inspection>;
  const existing = await db.inspections.get(change.entityId);

  if (!existing) return; // Don't create inspections locally from server (only pull assigned ones)

  await db.inspections.update(change.entityId, {
    ...payload,
    syncStatus: 'SYNCED',
  });
}
