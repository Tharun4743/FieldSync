import { db } from '../schema';
import type { InspectionResult, Note } from '@/types/db';
import { createOperation } from './operations';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Inspection Results Repository
//
// All writes follow local-first pattern:
//   1. Validate locally
//   2. Update IndexedDB immediately
//   3. Update Yjs state (done by caller)
//   4. Update UI immediately (reactive via Dexie hooks)
//   5. Create operation record → sync queue
//   6. No network wait
// ============================================================

export async function upsertInspectionResult(params: {
  inspectionId: string;
  checklistItemId: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean';
  userId: string;
  userName: string;
  previousValue?: string;
}): Promise<InspectionResult> {
  const existing = await db.inspectionResults
    .where('[inspectionId+checklistItemId]')
    .equals([params.inspectionId, params.checklistItemId])
    .first();

  const now = new Date().toISOString();
  const id = existing?.id ?? uuidv4();
  const version = (existing?.version ?? 0) + 1;
  const localVersion = (existing?.localVersion ?? 0) + 1;

  const result: InspectionResult = {
    id,
    inspectionId: params.inspectionId,
    checklistItemId: params.checklistItemId,
    value: params.value,
    valueType: params.valueType,
    updatedBy: params.userId,
    updatedAt: now,
    version,
    localVersion,
    syncStatus: 'PENDING',
  };

  await db.inspectionResults.put(result);

  // Update inspection's updatedAt and mark as pending sync
  await db.inspections.update(params.inspectionId, {
    updatedAt: now,
    syncStatus: 'PENDING',
    localVersion: (await db.inspections.get(params.inspectionId))?.localVersion ?? 0 + 1,
  });

  // Create operation for sync queue
  await createOperation({
    userId: params.userId,
    entityType: 'inspectionResult',
    entityId: id,
    inspectionId: params.inspectionId,
    operationType: existing ? 'UPDATE' : 'CREATE',
    payload: {
      inspectionId: params.inspectionId,
      checklistItemId: params.checklistItemId,
      value: params.value,
      valueType: params.valueType,
      version,
    },
    field: params.checklistItemId,
    beforeValue: params.previousValue,
    afterValue: params.value,
  });

  return result;
}

export async function getInspectionResults(inspectionId: string): Promise<InspectionResult[]> {
  return db.inspectionResults
    .where('inspectionId')
    .equals(inspectionId)
    .toArray();
}

// ============================================================
// Notes Repository
// ============================================================

export async function addNote(params: {
  inspectionId: string;
  authorId: string;
  authorName: string;
  content: string;
}): Promise<Note> {
  const now = new Date().toISOString();
  const id = uuidv4();

  const note: Note = {
    id,
    inspectionId: params.inspectionId,
    authorId: params.authorId,
    authorName: params.authorName,
    content: params.content,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'PENDING',
  };

  await db.notes.put(note);

  await createOperation({
    userId: params.authorId,
    entityType: 'note',
    entityId: id,
    inspectionId: params.inspectionId,
    operationType: 'CREATE',
    payload: {
      inspectionId: params.inspectionId,
      authorId: params.authorId,
      authorName: params.authorName,
      content: params.content,
    },
    afterValue: params.content,
  });

  return note;
}

export async function getInspectionNotes(inspectionId: string): Promise<Note[]> {
  return db.notes
    .where('inspectionId')
    .equals(inspectionId)
    .sortBy('createdAt');
}
