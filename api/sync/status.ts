import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).end();
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).end();

  const deviceId = req.query.deviceId as string;

  const { data: cursor } = await supabase
    .from('sync_cursors')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  const { count: pendingConflicts } = await supabase
    .from('conflicts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');

  return res.status(200).json({
    deviceId,
    lastPullCursor: cursor?.last_pull_cursor ?? '',
    lastPushAt: cursor?.last_push_at,
    serverTime: new Date().toISOString(),
    pendingConflicts: pendingConflicts ?? 0,
  });
}
