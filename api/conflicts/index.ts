import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).end();
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).end();

  const inspectionId = req.query.inspectionId as string | undefined;

  if (req.method === 'GET') {
    let query = supabase
      .from('conflicts')
      .select('*, inspection:inspections(title, site_name), local_op:operations!local_operation_id(user_id, created_at), remote_op:operations!remote_operation_id(user_id, created_at)')
      .order('created_at', { ascending: false });

    if (inspectionId) {
      query = query.eq('inspection_id', inspectionId);
    }

    const { data, count, error: fetchError } = await query;
    if (fetchError) return res.status(500).json({ error: fetchError.message });

    return res.status(200).json({ conflicts: data ?? [], total: count ?? 0 });
  }

  return res.status(405).end();
}
