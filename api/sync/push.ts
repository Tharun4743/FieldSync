import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleError } from '../_lib/auth';
import { supabaseAdmin } from '../_lib/supabase';
import type { PushRequest, PushResponse, OperationResult } from '../../src/types/api';

const CURRENT_SCHEMA_VERSION = 2;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await requireAuth(req);
    const body = req.body as PushRequest;

    if (!body.operations || !Array.isArray(body.operations)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const results: OperationResult[] = [];

    for (const op of body.operations) {
      const result = await processOperation(op, auth.userId);
      results.push(result);
    }

    // Apply Yjs updates to server store
    if (body.yjsUpdates) {
      for (const [inspectionId, base64Update] of Object.entries(body.yjsUpdates)) {
        await storeYjsUpdate(inspectionId, base64Update, auth.userId);
      }
    }

    const response: PushResponse = {
      results,
      serverTs: Date.now(),
    };

    return res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
}

async function processOperation(
  op: PushRequest['operations'][number],
  authenticatedUserId: string
): Promise<OperationResult> {
  // Security: userId in operation must match authenticated user
  if (op.userId !== authenticatedUserId) {
    return { operationId: op.operationId, status: 'ERROR', message: 'User ID mismatch' };
  }

  // 1. Check for duplicate (idempotency)
  const { data: existing } = await supabaseAdmin
    .from('operations')
    .select('operation_id, status')
    .eq('operation_id', op.operationId)
    .single();

  if (existing) {
    return { operationId: op.operationId, status: 'DUPLICATE' };
  }

  // 2. Schema version check
  if (op.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      operationId: op.operationId,
      status: 'SCHEMA_MISMATCH',
      requiredVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  // 3. Store the operation
  const { error: opError } = await supabaseAdmin
    .from('operations')
    .insert({
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

  if (opError) {
    console.error('[Push] Failed to store operation:', opError);
    return { operationId: op.operationId, status: 'ERROR', message: opError.message };
  }

  // 4. Apply the operation to the entity table
  const conflictResult = await applyOperation(op);

  // 5. Create server-side audit event
  await supabaseAdmin.from('audit_events').insert({
    operation_id: op.operationId,
    user_id: op.userId,
    device_id: op.deviceId,
    entity_type: op.entityType,
    entity_id: op.entityId,
    inspection_id: (op.payload['inspectionId'] as string) ?? null,
    action: op.operationType === 'CREATE' ? 'CREATED' : 'UPDATED',
    field: op.payload['field'] as string ?? null,
    before_value: op.payload['beforeValue'] as string ?? null,
    after_value: op.payload['afterValue'] as string ?? null,
    created_at: op.createdAt,
  });

  if (conflictResult) {
    return { operationId: op.operationId, status: 'CONFLICT', conflictId: conflictResult };
  }

  return { operationId: op.operationId, status: 'APPLIED' };
}

async function applyOperation(op: PushRequest['operations'][number]): Promise<string | null> {
  switch (op.entityType) {
    case 'inspectionResult':
      return applyResultOperation(op);
    case 'note':
      return applyNoteOperation(op);
    case 'media':
      return applyMediaOperation(op);
    default:
      return null;
  }
}

async function applyResultOperation(op: PushRequest['operations'][number]): Promise<string | null> {
  const payload = op.payload as {
    inspectionId: string;
    checklistItemId: string;
    value: string;
    valueType: string;
    version: number;
  };

  // Get current server value for conflict detection
  const { data: current } = await supabaseAdmin
    .from('inspection_results')
    .select('value, version, updated_by, updated_at')
    .eq('id', op.entityId)
    .single();

  // Detect conflict: if server has a value different from what we're setting,
  // and the server value was set by a DIFFERENT device/user
  if (current && current.value !== payload.value && current.updated_by !== op.userId) {
    // Create conflict record on server
    const conflictId = crypto.randomUUID();
    await supabaseAdmin.from('conflicts').insert({
      id: conflictId,
      inspection_id: payload.inspectionId,
      entity_type: 'inspectionResult',
      entity_id: op.entityId,
      field: payload.checklistItemId,
      base_value: current.value, // simplification — ideally we'd know the actual base
      local_value: payload.value,
      remote_value: current.value,
      local_operation_id: op.operationId,
      remote_operation_id: null,
      local_user_id: op.userId,
      remote_user_id: current.updated_by,
      local_timestamp: op.createdAt,
      remote_timestamp: current.updated_at,
      status: 'OPEN',
      created_at: new Date().toISOString(),
    });
    return conflictId;
  }

  // Apply the operation
  if (op.operationType === 'CREATE') {
    await supabaseAdmin.from('inspection_results').upsert({
      id: op.entityId,
      inspection_id: payload.inspectionId,
      checklist_item_id: payload.checklistItemId,
      value: payload.value,
      value_type: payload.valueType,
      updated_by: op.userId,
      updated_at: op.createdAt,
      version: payload.version ?? 1,
    });
  } else if (op.operationType === 'UPDATE') {
    await supabaseAdmin.from('inspection_results').upsert({
      id: op.entityId,
      inspection_id: payload.inspectionId,
      checklist_item_id: payload.checklistItemId,
      value: payload.value,
      value_type: payload.valueType,
      updated_by: op.userId,
      updated_at: op.createdAt,
      version: payload.version ?? 1,
    });
  }

  return null;
}

async function applyNoteOperation(op: PushRequest['operations'][number]): Promise<string | null> {
  const payload = op.payload as {
    inspectionId: string;
    authorId: string;
    authorName: string;
    content: string;
  };

  if (op.operationType === 'CREATE') {
    await supabaseAdmin.from('notes').upsert({
      id: op.entityId,
      inspection_id: payload.inspectionId,
      author_id: payload.authorId,
      author_name: payload.authorName,
      content: payload.content,
      created_at: op.createdAt,
      updated_at: op.createdAt,
    });
  }

  return null;
}

async function applyMediaOperation(op: PushRequest['operations'][number]): Promise<string | null> {
  const payload = op.payload as {
    inspectionId: string;
    fileName: string;
    mimeType: string;
    size: number;
  };

  if (op.operationType === 'CREATE') {
    await supabaseAdmin.from('media').upsert({
      id: op.entityId,
      inspection_id: payload.inspectionId,
      file_name: payload.fileName,
      mime_type: payload.mimeType,
      size: payload.size,
      upload_status: 'PENDING',
      uploaded_bytes: 0,
      total_bytes: payload.size,
      created_at: op.createdAt,
    });
  }

  return null;
}

async function storeYjsUpdate(
  inspectionId: string,
  base64Update: string,
  userId: string
): Promise<void> {
  // Store Yjs update in Supabase for distribution to other clients
  await supabaseAdmin.from('yjs_updates').upsert({
    inspection_id: inspectionId,
    update_data: base64Update,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'inspection_id' });
}
