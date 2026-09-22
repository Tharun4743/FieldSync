import { db } from '../schema';
import type { VoiceNote, UploadStatus } from '@/types/db';
import { createOperation } from './operations';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Voice Notes Repository
// Offline-first audio capture and upload queue
// ============================================================

export async function queueVoiceNote(params: {
  inspectionId: string;
  checklistItemId?: string;
  technicianId: string;
  blob: Blob;
  duration: number; // in seconds
  fileName?: string;
}): Promise<VoiceNote> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const fileName = params.fileName ?? `voice-${Date.now()}.webm`;

  const record: VoiceNote = {
    id,
    inspectionId: params.inspectionId,
    checklistItemId: params.checklistItemId,
    technicianId: params.technicianId,
    fileName,
    mimeType: params.blob.type || 'audio/webm',
    duration: Math.round(params.duration),
    localBlob: params.blob,
    uploadStatus: 'PENDING',
    uploadedBytes: 0,
    totalBytes: params.blob.size,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 3,
    syncStatus: 'PENDING',
  };

  await db.voiceNotes.put(record);

  // Durable sync operation
  await createOperation({
    userId: params.technicianId,
    entityType: 'voiceNote',
    entityId: id,
    inspectionId: params.inspectionId,
    operationType: 'CREATE',
    payload: {
      inspectionId: params.inspectionId,
      checklistItemId: params.checklistItemId,
      fileName,
      mimeType: record.mimeType,
      duration: record.duration,
      size: params.blob.size,
    },
  });

  return record;
}

export async function getVoiceNotesByInspection(inspectionId: string): Promise<VoiceNote[]> {
  return db.voiceNotes.where('inspectionId').equals(inspectionId).toArray();
}

export async function getVoiceNotesByChecklistItem(checklistItemId: string): Promise<VoiceNote[]> {
  return db.voiceNotes.where('checklistItemId').equals(checklistItemId).toArray();
}

export async function getPendingVoiceNotes(): Promise<VoiceNote[]> {
  return db.voiceNotes
    .where('uploadStatus')
    .anyOf(['PENDING', 'PAUSED', 'FAILED'])
    .toArray();
}

export async function getPendingVoiceNoteCount(): Promise<number> {
  return db.voiceNotes
    .where('uploadStatus')
    .anyOf(['PENDING', 'PAUSED', 'FAILED', 'UPLOADING'])
    .count();
}

export async function updateVoiceNoteUploadStatus(
  id: string,
  status: UploadStatus,
  uploadedBytes?: number,
  cloudinaryPublicId?: string,
  remoteUrl?: string,
): Promise<void> {
  const updates: Partial<VoiceNote> = {
    uploadStatus: status,
    updatedAt: new Date().toISOString(),
  };

  if (uploadedBytes !== undefined) updates.uploadedBytes = uploadedBytes;
  if (cloudinaryPublicId) updates.cloudinaryPublicId = cloudinaryPublicId;
  if (remoteUrl) updates.remoteUrl = remoteUrl;
  if (status === 'COMPLETED') updates.syncStatus = 'SYNCED';

  await db.voiceNotes.update(id, updates);
}

export async function deleteVoiceNote(id: string, userId: string): Promise<void> {
  const existing = await db.voiceNotes.get(id);
  if (!existing) return;

  // If unsynced, cancel its pending operation to prevent ghost uploads
  if (existing.syncStatus === 'PENDING') {
    await db.operations.where('entityId').equals(id).delete();
  } else {
    // If already synced, queue a DELETE operation
    await createOperation({
      userId,
      entityType: 'voiceNote',
      entityId: id,
      inspectionId: existing.inspectionId,
      operationType: 'DELETE',
      payload: { id },
    });
  }

  await db.voiceNotes.delete(id);
}
