import { getPendingUploads, updateUploadProgress, markUploadPaused, markUploadCompleted, markUploadFailed } from '../db/repositories/media';
import { getPendingVoiceNotes, updateVoiceNoteUploadStatus } from '../db/repositories/voiceNotes';
import { createAuditEvent } from '../db/repositories/operations';
import type { MediaRecord, VoiceNote } from '@/types/db';
import type { SignMediaRequest, SignMediaResponse } from '@/types/api';

// ============================================================
// Resumable Chunked Upload via Cloudinary
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

async function uploadVoiceNote(vn: VoiceNote, authToken: string): Promise<void> {
  if (!vn.localBlob) return;

  try {
    const uploadId = vn.id;
    const signRequest: SignMediaRequest = {
      mediaId: vn.id,
      inspectionId: vn.inspectionId,
      fileName: vn.fileName,
      mimeType: vn.mimeType,
      uploadedBytes: vn.uploadedBytes,
    };

    const signResponse = await fetch('/api/media/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(signRequest),
    });

    if (!signResponse.ok) {
      await updateVoiceNoteUploadStatus(vn.id, 'FAILED');
      return;
    }

    const signData = (await signResponse.json()) as SignMediaResponse;
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
    const uploadUrl = CLOUDINARY_UPLOAD_URL(cloudName);

    const startByte = vn.uploadedBytes ?? 0;
    const totalBytes = vn.localBlob.size;

    let currentByte = startByte;
    while (currentByte < totalBytes) {
      const endByte = Math.min(currentByte + CHUNK_SIZE, totalBytes);
      const chunk = vn.localBlob.slice(currentByte, endByte);

      const formData = new FormData();
      formData.append('file', chunk);
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
    // Get or create a stable upload ID
    const uploadId = media.uploadId ?? media.id;

    // Request signed upload parameters from Vercel Function
    const signRequest: SignMediaRequest = {
      mediaId: media.id,
      inspectionId: media.inspectionId,
      fileName: media.fileName,
      mimeType: media.mimeType,
      uploadedBytes: media.uploadedBytes,
    };

    const signResponse = await fetch('/api/media/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(signRequest),
    });

    if (!signResponse.ok) {
      await markUploadFailed(media.id);
      return;
    }

    const signData = await signResponse.json() as SignMediaResponse;
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
    const uploadUrl = CLOUDINARY_UPLOAD_URL(cloudName);

    // Resume from where we left off
    const startByte = media.uploadedBytes ?? 0;
    const totalBytes = media.localBlob.size;

    // Upload chunks
    let currentByte = startByte;
    while (currentByte < totalBytes) {
      const endByte = Math.min(currentByte + CHUNK_SIZE, totalBytes);
      const chunk = media.localBlob.slice(currentByte, endByte);

      const formData = new FormData();
      formData.append('file', chunk);
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
        // Network failure during upload — pause and record progress
        await markUploadPaused(media.id, currentByte);
        return;
      }

      if (!chunkResponse.ok && chunkResponse.status !== 308) {
        // 308 = Resume Incomplete (expected for non-final chunks)
        await markUploadPaused(media.id, currentByte);
        return;
      }

      currentByte = endByte;

      // Persist progress — survive page refresh
      await updateUploadProgress(media.id, currentByte, uploadId);

      // If this was the last chunk, we get the final response
      if (currentByte >= totalBytes) {
        const result = await chunkResponse.json() as {
          public_id: string;
          secure_url: string;
        };

        await markUploadCompleted({
          mediaId: media.id,
          cloudinaryPublicId: result.public_id,
          secureUrl: result.secure_url,
        });

        // Create audit event for upload completion
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
