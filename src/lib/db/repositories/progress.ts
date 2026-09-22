import { db } from '../schema';
import type { InspectionProgress } from '@/types/db';

// ============================================================
// Inspection Progress Repository
// Tracks where the technician stopped locally in IndexedDB
// ============================================================

export async function saveProgress(
  inspectionId: string,
  data: {
    lastChecklistItemId?: string;
    lastChecklistTitle?: string;
    nextChecklistItemId?: string;
    nextChecklistTitle?: string;
    completedCount: number;
    totalCount: number;
  },
): Promise<InspectionProgress> {
  const now = new Date().toISOString();
  const record: InspectionProgress = {
    inspectionId,
    lastChecklistItemId: data.lastChecklistItemId,
    lastChecklistTitle: data.lastChecklistTitle,
    nextChecklistItemId: data.nextChecklistItemId,
    nextChecklistTitle: data.nextChecklistTitle,
    completedCount: data.completedCount,
    totalCount: data.totalCount,
    lastOpenedAt: now,
    updatedAt: now,
  };

  await db.inspectionProgress.put(record);
  return record;
}

/**
 * Recalculate and update progress directly from IndexedDB state
 */
export async function syncProgressFromDB(
  inspectionId: string,
  lastAnsweredItemId?: string
): Promise<InspectionProgress | undefined> {
  const items = await db.checklistItems
    .where('inspectionId')
    .equals(inspectionId)
    .sortBy('order');

  if (items.length === 0) return undefined;

  const results = await db.inspectionResults
    .where('inspectionId')
    .equals(inspectionId)
    .toArray();

  const resultMap = new Map(results.map(r => [r.checklistItemId, r.value]));

  let completedCount = 0;
  let nextItem: typeof items[0] | undefined;
  let lastItem: typeof items[0] | undefined;

  for (const item of items) {
    const val = resultMap.get(item.id);
    const hasValue = val !== undefined && val !== null && val !== '';
    if (hasValue) {
      completedCount++;
      if (!lastAnsweredItemId || item.id === lastAnsweredItemId) {
        lastItem = item;
      }
    } else if (!nextItem) {
      nextItem = item;
    }
  }

  // If lastAnsweredItemId was passed, make sure it's the lastItem
  if (lastAnsweredItemId) {
    const found = items.find(i => i.id === lastAnsweredItemId);
    if (found) lastItem = found;
  }

  return saveProgress(inspectionId, {
    lastChecklistItemId: lastItem?.id,
    lastChecklistTitle: lastItem?.question,
    nextChecklistItemId: nextItem?.id,
    nextChecklistTitle: nextItem?.question,
    completedCount,
    totalCount: items.length,
  });
}

export async function getProgress(inspectionId: string): Promise<InspectionProgress | undefined> {
  return db.inspectionProgress.get(inspectionId);
}

export async function getMostRecentProgress(): Promise<InspectionProgress | undefined> {
  return db.inspectionProgress.orderBy('lastOpenedAt').reverse().first();
}

export async function getAllProgress(): Promise<InspectionProgress[]> {
  return db.inspectionProgress.orderBy('lastOpenedAt').reverse().toArray();
}

