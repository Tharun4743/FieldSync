import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleError } from '../_lib/auth';
import { supabaseAdmin } from '../_lib/supabase';
import type { PullResponse, ServerChange } from '../../src/types/api';
import type { Conflict, AuditEvent } from '../../src/types/db';

const PAGE_SIZE = 100;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);
    const cursor = (req.query['cursor'] as string) ?? '';

    // Pull operations since cursor
    let opsQuery = supabaseAdmin
      .from('operations')
      .select('*')
      .neq('user_id', auth.userId) // Don't send back own operations
      .order('created_at', { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) {
      opsQuery = opsQuery.gt('created_at', cursor);
    }

    const { data: operations, error: opsError } = await opsQuery;
    if (opsError) throw opsError;

    // Pull open conflicts for this user's inspections
    const { data: conflicts, error: conflictsError } = await supabaseAdmin
      .from('conflicts')
      .select('*')
      .eq('status', 'OPEN')
      .order('created_at', { ascending: true });

    if (conflictsError) throw conflictsError;

    // Pull audit events since cursor
    let auditQuery = supabaseAdmin
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) {
      auditQuery = auditQuery.gt('created_at', cursor);
    }

    const { data: auditEvents, error: auditError } = await auditQuery;
    if (auditError) throw auditError;

    // Pull Yjs updates for affected inspections
    const inspectionIds = new Set(
      operations?.map((op) => (op.payload as Record<string, unknown>)['inspectionId'] as string).filter(Boolean)
    );

    const yjsUpdates: Record<string, string> = {};
    for (const inspectionId of inspectionIds) {
      const { data: yjsData } = await supabaseAdmin
        .from('yjs_updates')
        .select('update_data')
        .eq('inspection_id', inspectionId)
        .single();

      if (yjsData?.update_data) {
        yjsUpdates[inspectionId] = yjsData.update_data as string;
      }
    }

    // Build next cursor from last item's created_at
    const allItems = [...(operations ?? []), ...(auditEvents ?? [])];
    const nextCursor = allItems.length > 0
      ? allItems[allItems.length - 1].created_at as string
      : cursor;

    const changes: ServerChange[] = (operations ?? []).map((op) => ({
      operationId: op.operation_id as string,
      entityType: op.entity_type as string,
      entityId: op.entity_id as string,
      inspectionId: ((op.payload as Record<string, unknown>)['inspectionId'] as string) ?? '',
      operationType: op.operation_type as 'CREATE' | 'UPDATE' | 'DELETE',
      payload: op.payload as Record<string, unknown>,
      userId: op.user_id as string,
      deviceId: op.device_id as string,
      logicalClock: op.logical_clock as number,
      schemaVersion: op.schema_version as number,
      createdAt: op.created_at as string,
    }));

    const mappedConflicts: Conflict[] = (conflicts ?? []).map((c) => ({
      id: c.id as string,
      inspectionId: c.inspection_id as string,
      entityType: c.entity_type as string,
      entityId: c.entity_id as string,
      field: c.field as string,
      baseValue: c.base_value as string,
      localValue: c.local_value as string,
      remoteValue: c.remote_value as string,
      localOperationId: c.local_operation_id as string,
      remoteOperationId: c.remote_operation_id as string,
      localUserId: c.local_user_id as string,
      remoteUserId: c.remote_user_id as string,
      localUserName: c.local_user_name as string ?? '',
      remoteUserName: c.remote_user_name as string ?? '',
      localTimestamp: c.local_timestamp as string,
      remoteTimestamp: c.remote_timestamp as string,
      status: c.status as 'OPEN' | 'RESOLVED',
      resolvedValue: c.resolved_value as string | undefined,
      resolvedBy: c.resolved_by as string | undefined,
      resolvedAt: c.resolved_at as string | undefined,
      createdAt: c.created_at as string,
    }));

    const mappedAuditEvents: AuditEvent[] = (auditEvents ?? []).map((e) => ({
      id: e.id as string,
      operationId: e.operation_id as string | undefined,
      userId: e.user_id as string,
      userName: e.user_name as string ?? e.user_id as string,
      deviceId: e.device_id as string,
      entityType: e.entity_type as string,
      entityId: e.entity_id as string,
      inspectionId: e.inspection_id as string,
      action: e.action as AuditEvent['action'],
      field: e.field as string | undefined,
      beforeValue: e.before_value as string | undefined,
      afterValue: e.after_value as string | undefined,
      metadata: e.metadata as Record<string, unknown> | undefined,
      createdAt: e.created_at as string,
    }));

    const response: PullResponse = {
      changes,
      conflicts: mappedConflicts,
      auditEvents: mappedAuditEvents,
      yjsUpdates,
      nextCursor,
      hasMore: (operations?.length ?? 0) >= PAGE_SIZE,
      serverTs: Date.now(),
    };

    return res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
}
