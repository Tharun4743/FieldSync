import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleError } from '../_lib/auth';
import crypto from 'crypto';
import type { SignMediaRequest, SignMediaResponse } from '../../src/types/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireAuth(req);

    const body = req.body as SignMediaRequest;
    if (!body.mediaId || !body.inspectionId) {
      return res.status(400).json({ error: 'Missing mediaId or inspectionId' });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET ?? 'fieldsync-uploads';

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Cloudinary credentials not configured' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `fieldsync/${body.inspectionId}`;
    const publicId = `${body.inspectionId}/${body.mediaId}`;
    const uploadId = body.mediaId; // Stable X-Unique-Upload-Id

    // Generate Cloudinary signature
    // Signature covers: folder, public_id, timestamp, upload_preset
    const paramsToSign = [
      `folder=${folder}`,
      `public_id=${publicId}`,
      `timestamp=${timestamp}`,
      `upload_preset=${uploadPreset}`,
    ].sort().join('&');

    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    const response: SignMediaResponse = {
      signature,
      timestamp,
      apiKey,
      cloudName,
      uploadPreset,
      uploadId,
      folder,
      publicId,
    };

    return res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
}
