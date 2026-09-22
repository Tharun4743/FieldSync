import { getPendingOperations, markOperationSynced, markOperationFailed, markOperationDuplicate } from '../db/repositories/operations';
import { upsertConflictsFromServer } from '../db/repositories/conflicts';
import { addAuditEventsFromServer } from '../db/repositories/operations';
import { yjsManager } from '../crdt/yjsManager';
import { LogicalClock } from '../db/logicalClock';
import { db } from '../db/schema';
import { supabase } from '../auth/supabaseClient';
import { syncFromSupabase } from './cloudSync';
import type { PushRequest, PushResponse, PullResponse, OperationResult } from '@/types/api';
import type { Operation } from '@/types/db';

const PUSH_URL = '/api/sync/push';
const PULL_URL = '/api/sync/pull';

/**
 * Push pending local operations to Supabase.
 *
 * Protocol:
 *   1. Load all PENDING operations from IndexedDB
 *   2. Push directly to Supabase tables (real-time cloud database)
 *   3. Fallback to /api/sync/push if deployed on Vercel
 *   4. Mark operations as SYNCED upon successful cloud persistence
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

  for (const op of pending) {
    try {
      const res = await pushOperationDirectToSupabase(op);
      if (res === 'APPLIED') {
        await markOperationSynced(op.operationId);
        stats.applied++;
      } else {
        await markOperationFailed(op.operationId, 'Cloud sync failed');
        stats.errors++;
      }
    } catch (err) {
      console.warn(`[SyncService] Failed to push operation ${op.operationId} to Supabase:`, err);
      // Try Vercel endpoint as secondary fallback
      try {
        await pushBatch([op], authToken, stats);
      } catch {
        await markOperationFailed(op.operationId, err instanceof Error ? err.message : String(err));
        stats.errors++;
      }
    }
  }

  return stats;
}

/**
 * Direct client-to-Supabase operation synchronizer.
 * Writes to public.inspections, public.checklist_items, public.notes, public.inspection_results, and public.operations.
 */
async function pushOperationDirectToSupabase(op: Operation): Promise<'APPLIED' | 'ERROR'> {
  try {
    if (op.entityType === 'inspection') {
      const localInsp = await db.inspections.get(op.entityId);
      const payload = ((op.payload && Object.keys(op.payload).length > 0 ? op.payload : localInsp) || {}) as Record<string, any>;
      const id = op.entityId || payload.id;

      if (id) {
        const row = {
          id,
          title: payload.title || 'Untitled Inspection',
          site_name: payload.siteName || payload.site_name || 'General Site',
          asset_id: payload.assetId || payload.asset_id || null,
          category: payload.category || 'GENERAL',
          status: payload.status || 'PENDING',
          issue_status: payload.issueStatus || payload.issue_status || 'NEW',
          priority: payload.priority || 'MEDIUM',
          workflow_stage: payload.workflowStage || payload.workflow_stage || 'RAISED',
          assigned_to: Array.isArray(payload.assignedTo) && payload.assignedTo.length > 0
            ? payload.assignedTo[0]
            : (payload.assigned_to || null),
          assigned_at: payload.assignedAt || payload.assigned_at || null,
          supervisor_id: payload.supervisorId || payload.supervisor_id || null,
          supervisor_name: payload.supervisorName || payload.supervisor_name || null,
          supervisor_notes: payload.supervisorNotes || payload.supervisor_notes || null,
          supervised_at: payload.supervisedAt || payload.supervised_at || null,
          reported_by: payload.reportedBy || payload.reported_by || null,
          customer_id: payload.customerId || payload.customer_id || null,
          customer_phone: payload.customerPhone || payload.customer_phone || null,
          customer_email: payload.customerEmail || payload.customer_email || null,
          customer_notes: payload.customerNotes || payload.customer_notes || null,
          technician_completed_at: payload.technicianCompletedAt || payload.technician_completed_at || null,
          rework_reason: payload.reworkReason || payload.rework_reason || null,
          verified_by: payload.verifiedBy || payload.verified_by || null,
          verified_by_name: payload.verifiedByName || payload.verified_by_name || null,
          verified_at: payload.verifiedAt || payload.verified_at || null,
          resolution_summary: payload.resolutionSummary || payload.resolution_summary || null,
          scheduled_date: payload.scheduledDate || payload.scheduled_date || null,
          version: payload.version || payload.serverVersion || 1,
          created_at: payload.createdAt || payload.created_at || new Date().toISOString(),
          updated_at: payload.updatedAt || payload.updated_at || new Date().toISOString(),
        };

        const { error: inspErr } = await supabase.from('inspections').upsert(row);
        if (inspErr) throw inspErr;

        // Push checklist items for this inspection
        const items = await db.checklistItems.where('inspectionId').equals(id).toArray();
        if (items.length > 0) {
          const remoteItems = items.map((it) => ({
            id: it.id,
            inspection_id: it.inspectionId,
            question: it.question,
            type: it.type,
            required: it.required,
            sort_order: it.order,
            unit: it.unit || null,
            min_value: it.minValue || null,
            max_value: it.maxValue || null,
            options: it.options || null,
            created_at: it.createdAt || new Date().toISOString(),
          }));
          await supabase.from('checklist_items').upsert(remoteItems);
        }

        // Push notes for this inspection
        const notes = await db.notes.where('inspectionId').equals(id).toArray();
        if (notes.length > 0) {
          const remoteNotes = notes.map((n) => ({
            id: n.id,
            inspection_id: n.inspectionId,
            author_id: n.authorId,
            author_name: n.authorName,
            content: n.content,
            text: n.content,
            created_at: n.createdAt,
            updated_at: n.updatedAt,
          }));
          await supabase.from('notes').upsert(remoteNotes);
        }
      }
    } else if (op.entityType === 'inspectionResult') {
      const payload = op.payload as Record<string, any>;
      const { error: resErr } = await supabase.from('inspection_results').upsert({
        id: op.entityId,
        inspection_id: payload.inspectionId,
        checklist_item_id: payload.checklistItemId,
        value: payload.value,
        value_type: payload.valueType,
        updated_by: op.userId,
        updated_at: op.createdAt || new Date().toISOString(),
        version: payload.version || 1,
      }, { onConflict: 'inspection_id,checklist_item_id' });
      if (resErr) throw resErr;
    } else if (op.entityType === 'note') {
      const payload = op.payload as Record<string, any>;
      const { error: noteErr } = await supabase.from('notes').upsert({
        id: op.entityId,
        inspection_id: payload.inspectionId,
        author_id: payload.authorId || op.userId,
        author_name: payload.authorName || 'User',
        content: payload.content || '',
        text: payload.content || '',
        created_at: op.createdAt || new Date().toISOString(),
        updated_at: op.createdAt || new Date().toISOString(),
      });
      if (noteErr) throw noteErr;
    }

    // Record the operation in public.operations
    await supabase.from('operations').upsert({
      operation_id: op.operationId,
      device_id: op.deviceId,
      user_id: op.userId,
      entity_type: op.entityType,
      entity_id: op.entityId,
      operation_type: op.operationType,
      payload: op.payload,
      logical_clock: op.logicalClock,
      schema_version: op.schemaVersion,
      created_at: op.createdAt,
      status: 'APPLIED',
    });

    return 'APPLIED';
  } catch (err) {
    console.error('[SyncService] Direct Supabase push error:', err);
    return 'ERROR';
  }
}

async function pushBatch(
  operations: Operation[],
  authToken: string,
  stats: { applied: number; duplicates: number; conflicts: number; errors: number }
): Promise<void> {
  const inspectionIds = new Set(operations.map((op) => op.payload['inspectionId'] as string).filter(Boolean));
  const yjsUpdates: Record<string, string> = {};

  for (const inspectionId of inspectionIds) {
    try {
      const update = yjsManager.encodeStateAsBase64(inspectionId);
      if (update) yjsUpdates[inspectionId] = update;
    } catch {
      // ignore
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
    for (const op of operations) {
      await markOperationFailed(op.operationId, `HTTP ${response.status}`);
      stats.errors++;
    }
    return;
  }

  const data = (await response.json()) as PushResponse;
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
      await markOperationSynced(result.operationId);
      stats.conflicts++;
      break;
    case 'SCHEMA_MISMATCH':
      await markOperationFailed(result.operationId, `Schema mismatch: ${result.requiredVersion}`);
      stats.errors++;
      break;
    case 'ERROR':
      await markOperationFailed(result.operationId, result.message ?? 'Error');
      stats.errors++;
      break;
  }
}

/**
 * Pull changes from the server since last cursor.
 */
export async function pullServerChanges(authToken: string): Promise<{
  changesApplied: number;
  conflictsReceived: number;
  auditEventsReceived: number;
  nextCursor: string | null;
}> {
  try {
    const synced = await syncFromSupabase();
    return {
      changesApplied: synced ? 1 : 0,
      conflictsReceived: 0,
      auditEventsReceived: 0,
      nextCursor: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[SyncService] Direct pull from Supabase failed, trying endpoint:', err);
    try {
      const syncState = await db.syncState.toCollection().first();
      const cursor = syncState?.lastPullCursor ?? '';
      const url = cursor ? `${PULL_URL}?cursor=${encodeURIComponent(cursor)}` : PULL_URL;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = (await response.json()) as PullResponse;
        await upsertConflictsFromServer(data.conflicts);
        await addAuditEventsFromServer(data.auditEvents);
        if (data.changes.length > 0) {
          const maxClock = Math.max(...data.changes.map((c) => c.logicalClock));
          await LogicalClock.receive(maxClock);
        }
        return {
          changesApplied: data.changes.length,
          conflictsReceived: data.conflicts.length,
          auditEventsReceived: data.auditEvents.length,
          nextCursor: data.nextCursor,
        };
      }
    } catch {
      // ignore
    }
    return { changesApplied: 0, conflictsReceived: 0, auditEventsReceived: 0, nextCursor: null };
  }
}
