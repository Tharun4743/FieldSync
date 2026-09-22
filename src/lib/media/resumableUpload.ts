import { getPendingUploads, updateUploadProgress, markUploadPaused, markUploadCompleted, markUploadFailed } from '../db/repositories/media';
import { getPendingVoiceNotes, updateVoiceNoteUploadStatus } from '../db/repositories/voiceNotes';
import { createAuditEvent } from '../db/repositories/operations';
import { supabase } from '../auth/supabaseClient';
import type { MediaRecord, VoiceNote } from '@/types/db';
import type { SignMediaRequest, SignMediaResponse } from '@/types/api';

// ============================================================
// Resumable Chunked Upload via Cloudinary & Supabase Sync
//
// Cloudinary supports resumable uploads using:
//   - X-Unique-Upload-Id header (stable per upload session)
//   - Content-Range header (byte range of this chunk)
//   - The upload ID can be resumed across network failures
//
// Priority ordering:
//   1. Voice notes (small, critical technician observations)
//   2. Photos (larger files)
// ============================================================

const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB
const CLOUDINARY_UPLOAD_URL = (cloudName: string) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

export async function processMediaQueue(authToken: string): Promise<void> {
  // 1. Process Voice Notes first (Priority 6)
  await processVoiceNotes(authToken);

  // 2. Process Photos second (Priority 7)
  await processPhotos(authToken);
}

async function processVoiceNotes(authToken: string): Promise<void> {
  const pending = await getPendingVoiceNotes();
  for (const vn of pending) {
    if (!vn.localBlob) continue;
    await uploadVoiceNote(vn, authToken);
  }
}

async function processPhotos(authToken: string): Promise<void> {
  const pending = await getPendingUploads();
  for (const media of pending) {
    if (!media.localBlob) continue;
    await uploadMedia(media, authToken);
  }
}

/**
 * Obtain Cloudinary signature from backend or calculate on client if endpoint unavailable.
 */
async function getCloudinarySignData(
  mediaId: string,
  inspectionId: string,
  authToken: string,
  fileName?: string,
  mimeType?: string,
  uploadedBytes?: number
): Promise<SignMediaResponse> {
  // 1. Try server endpoint first
  try {
    const signRequest: SignMediaRequest = {
      mediaId,
      inspectionId,
      fileName: fileName ?? 'file',
      mimeType: mimeType ?? 'application/octet-stream',
      uploadedBytes: uploadedBytes ?? 0,
    };

    const res = await fetch('/api/media/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(signRequest),
    });

    if (res.ok) {
      const data = (await res.json()) as SignMediaResponse;
      if (data?.signature) return data;
    }
  } catch {
    // Ignore and fallback to client-side signing
  }

  // 2. Client-side signing fallback
  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || 'lt6lmhj9';
  const apiKey = (import.meta.env.VITE_CLOUDINARY_API_KEY as string) || '';
  const apiSecret = (import.meta.env.VITE_CLOUDINARY_API_SECRET as string) || '';
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `fieldsync/${inspectionId}`;
  const publicId = `${inspectionId}/${mediaId}`;
  const uploadPreset = 'fieldsync-uploads';
  const uploadId = mediaId;

  let signature = '';
  if (apiSecret) {
    const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}&upload_preset=${uploadPreset}`;
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-1', enc.encode(paramsToSign + apiSecret));
    signature = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    uploadPreset,
    uploadId,
    folder,
    publicId,
  };
}

async function uploadVoiceNote(vn: VoiceNote, authToken: string): Promise<void> {
  if (!vn.localBlob) return;

  try {
    const uploadId = vn.id;
    const signData = await getCloudinarySignData(
      vn.id,
      vn.inspectionId,
      authToken,
      vn.fileName,
      vn.mimeType,
      vn.uploadedBytes
    );

    const cloudName = signData.cloudName || ((import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || 'lt6lmhj9');
    const uploadUrl = CLOUDINARY_UPLOAD_URL(cloudName);

    const startByte = vn.uploadedBytes ?? 0;
    const totalBytes = vn.localBlob.size;

    let currentByte = startByte;
    while (currentByte < totalBytes) {
      const endByte = Math.min(currentByte + CHUNK_SIZE, totalBytes);
      const chunk = vn.localBlob.slice(currentByte, endByte);

      const formData = new FormData();
      formData.append('file', chunk, vn.fileName);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('upload_preset', signData.uploadPreset);
      formData.append('public_id', signData.publicId);
      formData.append('folder', signData.folder);

      let chunkResponse: Response;
      try {
        chunkResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'X-Unique-Upload-Id': uploadId,
            'Content-Range': `bytes ${currentByte}-${endByte - 1}/${totalBytes}`,
          },
          body: formData,
        });
      } catch {
        // Network disconnected — pause and retain offset
        await updateVoiceNoteUploadStatus(vn.id, 'PAUSED', currentByte);
        return;
      }

      if (!chunkResponse.ok && chunkResponse.status !== 308) {
        await updateVoiceNoteUploadStatus(vn.id, 'PAUSED', currentByte);
        return;
      }

      currentByte = endByte;
      await updateVoiceNoteUploadStatus(vn.id, 'UPLOADING', currentByte);

      if (currentByte >= totalBytes) {
        const result = (await chunkResponse.json()) as {
          public_id: string;
          secure_url: string;
        };

        await updateVoiceNoteUploadStatus(
          vn.id,
          'COMPLETED',
          totalBytes,
          result.public_id,
          result.secure_url
        );

        // Sync media record to Supabase
        await supabase.from('media').upsert({
          id: vn.id,
          inspection_id: vn.inspectionId,
          url: result.secure_url,
          file_name: vn.fileName,
          file_type: 'audio',
          mime_type: vn.mimeType,
          size: totalBytes,
          uploaded_bytes: totalBytes,
          total_bytes: totalBytes,
          upload_status: 'COMPLETED',
          sync_status: 'synced',
          created_at: new Date().toISOString(),
        });

        await createAuditEvent({
          userId: vn.technicianId || 'system',
          userName: 'Technician',
          entityType: 'voiceNote',
          entityId: vn.id,
          inspectionId: vn.inspectionId,
          action: 'UPLOADED',
          afterValue: result.secure_url,
          metadata: { cloudinaryPublicId: result.public_id },
        });
      }
    }
  } catch (err) {
    console.error('[VoiceNoteUpload] Upload failed:', err);
    await updateVoiceNoteUploadStatus(vn.id, 'FAILED');
  }
}

async function uploadMedia(media: MediaRecord, authToken: string): Promise<void> {
  if (!media.localBlob) return;

  try {
    const uploadId = media.uploadId ?? media.id;
    const signData = await getCloudinarySignData(
      media.id,
      media.inspectionId,
      authToken,
      media.fileName,
      media.mimeType,
      media.uploadedBytes
    );

    const cloudName = signData.cloudName || ((import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || 'lt6lmhj9');
    const uploadUrl = CLOUDINARY_UPLOAD_URL(cloudName);

    const startByte = media.uploadedBytes ?? 0;
    const totalBytes = media.localBlob.size;

    let currentByte = startByte;
    while (currentByte < totalBytes) {
      const endByte = Math.min(currentByte + CHUNK_SIZE, totalBytes);
      const chunk = media.localBlob.slice(currentByte, endByte);

      const formData = new FormData();
      formData.append('file', chunk, media.fileName);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('upload_preset', signData.uploadPreset);
      formData.append('public_id', signData.publicId);
      formData.append('folder', signData.folder);

      let chunkResponse: Response;
      try {
        chunkResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'X-Unique-Upload-Id': uploadId,
            'Content-Range': `bytes ${currentByte}-${endByte - 1}/${totalBytes}`,
          },
          body: formData,
        });
      } catch {
        await markUploadPaused(media.id, currentByte);
        return;
      }

      if (!chunkResponse.ok && chunkResponse.status !== 308) {
        await markUploadPaused(media.id, currentByte);
        return;
      }

      currentByte = endByte;
      await updateUploadProgress(media.id, currentByte, uploadId);

      if (currentByte >= totalBytes) {
        const result = (await chunkResponse.json()) as {
          public_id: string;
          secure_url: string;
        };

        await markUploadCompleted({
          mediaId: media.id,
          cloudinaryPublicId: result.public_id,
          secureUrl: result.secure_url,
        });

        // Sync media record to Supabase
        await supabase.from('media').upsert({
          id: media.id,
          inspection_id: media.inspectionId,
          checklist_item_id: media.checklistItemId || null,
          url: result.secure_url,
          file_name: media.fileName,
          file_type: media.mimeType.startsWith('image/') ? 'image' : 'file',
          mime_type: media.mimeType,
          size: totalBytes,
          uploaded_bytes: totalBytes,
          total_bytes: totalBytes,
          upload_status: 'COMPLETED',
          sync_status: 'synced',
          created_at: new Date().toISOString(),
        });

        await createAuditEvent({
          userId: 'system',
          userName: 'System',
          entityType: 'media',
          entityId: media.id,
          inspectionId: media.inspectionId,
          action: 'UPLOADED',
          afterValue: result.secure_url,
          metadata: { cloudinaryPublicId: result.public_id },
        });
      }
    }
  } catch (err) {
    console.error('[MediaUpload] Upload failed:', err);
    await markUploadFailed(media.id);
  }
}
