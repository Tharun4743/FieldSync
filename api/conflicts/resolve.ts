import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole, handleError } from '../_lib/auth';
import { supabaseAdmin } from '../_lib/supabase';
import type { ResolveConflictRequest, ResolveConflictResponse } from '../../src/types/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);
    requireRole(auth.role, 'SUPERVISOR');

    const body = req.body as ResolveConflictRequest;
    if (!body.conflictId || !body.resolvedValue || !body.resolvedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date().toISOString();

    // Update conflict status
    const { data: conflict, error } = await supabaseAdmin
      .from('conflicts')
      .update({
        status: 'RESOLVED',
        resolved_value: body.resolvedValue,
        resolved_by: body.resolvedBy,
        resolved_at: now,
      })
      .eq('id', body.conflictId)
      .select()
      .single();

    if (error) throw error;

    // Create audit event for resolution
    const auditEventId = crypto.randomUUID();
    await supabaseAdmin.from('audit_events').insert({
      id: auditEventId,
      user_id: auth.userId,
      user_name: auth.email,
      device_id: 'server',
      entity_type: conflict.entity_type,
      entity_id: conflict.entity_id,
      inspection_id: conflict.inspection_id,
      action: 'CONFLICT_RESOLVED',
      field: conflict.field,
      before_value: `LOCAL:${conflict.local_value as string} vs REMOTE:${conflict.remote_value as string}`,
      after_value: body.resolvedValue,
      metadata: { conflictId: body.conflictId, resolution: body.resolution },
      created_at: now,
    });

    // Apply the resolved value to the entity
    if (conflict.entity_type === 'inspectionResult') {
      await supabaseAdmin.from('inspection_results').update({
        value: body.resolvedValue,
        updated_by: auth.userId,
        updated_at: now,
      }).eq('id', conflict.entity_id as string);
    }

    const response: ResolveConflictResponse = {
      conflictId: body.conflictId,
      status: 'RESOLVED',
      auditEventId,
    };

    return res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
}
