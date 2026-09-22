import { db } from '../schema';
import type { MediaRecord } from '@/types/db';
import { createOperation } from './operations';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Media Repository
//
// Offline flow:
//   File/Camera → localBlob stored in IndexedDB → PENDING status
//
// Online upload flow:
//   MediaQueue → /api/media/sign → Cloudinary direct chunked upload
//   → update cloudinaryPublicId + secureUrl → COMPLETED
//
// Resume flow:
//   On reconnect, check PAUSED/FAILED items → resume from uploadedBytes
// ============================================================

export async function queueMedia(params: {
  inspectionId: string;
  checklistItemId?: string;
  file: File | Blob;
  fileName?: string;
  userId: string;
}): Promise<MediaRecord> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const fileName = params.fileName ?? (params.file instanceof File ? params.file.name : `photo-${Date.now()}.jpg`);
  const mimeType = params.file.type || 'image/jpeg';

  const record: MediaRecord = {
    id,
    inspectionId: params.inspectionId,
    checklistItemId: params.checklistItemId,
    fileName,
    mimeType,
    size: params.file.size,
    localBlob: params.file,
    uploadStatus: 'PENDING',
    uploadedBytes: 0,
    totalBytes: params.file.size,
    createdAt: now,
    syncStatus: 'PENDING',
  };

  await db.media.put(record);

  // Create operation to record that media was added
  await createOperation({
    userId: params.userId,
    entityType: 'media',
    entityId: id,
    inspectionId: params.inspectionId,
    operationType: 'CREATE',
    payload: {
      inspectionId: params.inspectionId,
      checklistItemId: params.checklistItemId,
      fileName,
      mimeType,
      size: params.file.size,
    },
  });

  return record;
}

export const addMediaToQueue = queueMedia;

export async function updateUploadProgress(
  mediaId: string,
  uploadedBytes: number,
  uploadId?: string
): Promise<void> {
  const updates: Partial<MediaRecord> = {
    uploadedBytes,
    uploadStatus: 'UPLOADING',
  };
  if (uploadId) updates.uploadId = uploadId;
  await db.media.update(mediaId, updates);
}

export async function markUploadPaused(mediaId: string, uploadedBytes: number): Promise<void> {
  await db.media.update(mediaId, {
    uploadStatus: 'PAUSED',
    uploadedBytes,
  });
}

export async function markUploadCompleted(params: {
  mediaId: string;
  cloudinaryPublicId: string;
  secureUrl: string;
}): Promise<void> {
  const record = await db.media.get(params.mediaId);
  await db.media.update(params.mediaId, {
    cloudinaryPublicId: params.cloudinaryPublicId,
    secureUrl: params.secureUrl,
    remoteReference: params.secureUrl,
    uploadStatus: 'COMPLETED',
    uploadedBytes: record?.totalBytes ?? 0,
    syncStatus: 'SYNCED',
    // Keep localBlob for offline viewing
  });
}

export async function markUploadFailed(mediaId: string): Promise<void> {
  await db.media.update(mediaId, { uploadStatus: 'FAILED' });
}

export async function getPendingUploads(): Promise<MediaRecord[]> {
  return db.media
    .where('uploadStatus')
    .anyOf(['PENDING', 'PAUSED', 'FAILED'])
    .toArray();
}

export async function getInspectionMedia(inspectionId: string): Promise<MediaRecord[]> {
  return db.media
    .where('inspectionId')
    .equals(inspectionId)
    .toArray();
}

export async function getPendingMediaCount(): Promise<number> {
  return db.media
    .where('uploadStatus')
    .anyOf(['PENDING', 'PAUSED', 'FAILED', 'UPLOADING'])
    .count();
}

export async function getMediaByChecklistItem(checklistItemId: string): Promise<MediaRecord[]> {
  return db.media.where('checklistItemId').equals(checklistItemId).toArray();
}

export async function deleteMedia(id: string, userId: string): Promise<void> {
  const existing = await db.media.get(id);
  if (!existing) return;

  // If unsynced, cancel its pending operation to avoid uploading orphan photo
  if (existing.syncStatus === 'PENDING') {
    await db.operations.where('entityId').equals(id).delete();
  } else {
    // If already synced, queue a DELETE operation
    await createOperation({
      userId,
      entityType: 'media',
      entityId: id,
      inspectionId: existing.inspectionId,
      operationType: 'DELETE',
      payload: { id },
    });
  }

  await db.media.delete(id);
}

