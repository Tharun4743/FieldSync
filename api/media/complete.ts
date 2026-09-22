import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).end();
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).end();

  const { mediaId, inspectionId, cloudinaryPublicId, secureUrl, bytes } = req.body as {
    mediaId: string;
    inspectionId: string;
    cloudinaryPublicId: string;
    secureUrl: string;
    bytes: number;
  };

  // Upsert media metadata into Supabase (reference only, no binary stored in Postgres)
  const { error: upsertError } = await supabase.from('media').upsert({
    id: mediaId,
    inspection_id: inspectionId,
    cloudinary_public_id: cloudinaryPublicId,
    secure_url: secureUrl,
    upload_status: 'COMPLETED',
    uploaded_bytes: bytes,
    total_bytes: bytes,
  }, { onConflict: 'id' });

  if (upsertError) {
    console.error('[MediaComplete] Upsert error:', upsertError);
    return res.status(500).json({ error: upsertError.message });
  }

  // Generate thumbnail URL via Cloudinary transformation
  const thumbnailUrl = secureUrl.replace('/upload/', '/upload/w_300,h_300,c_fill/');

  // Create audit event
  await supabase.from('audit_events').insert({
    id: `audit-media-${mediaId}`,
    user_id: user.id,
    entity_type: 'media',
    entity_id: mediaId,
    action: 'PHOTO_UPLOADED',
    after_value: JSON.stringify({ secureUrl, cloudinaryPublicId }),
    metadata: { inspectionId },
    created_at: new Date().toISOString(),
  });

  return res.status(200).json({
    mediaId,
    secureUrl,
    thumbnailUrl,
  });
}
