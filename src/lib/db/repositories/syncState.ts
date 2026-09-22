import { db } from '../schema';
import type { SyncState, ConnectivityStatus } from '@/types/db';
import { getCachedDeviceId } from '../device';
import { getPendingOperationCount } from './operations';
import { getPendingMediaCount } from './media';
import { getOpenConflictCount } from './conflicts';

export async function getSyncState(): Promise<SyncState | undefined> {
  return db.syncState.get(getCachedDeviceId());
}

export async function updateSyncState(updates: Partial<SyncState>): Promise<void> {
  const deviceId = getCachedDeviceId();
  const existing = await db.syncState.get(deviceId);
  if (existing) {
    await db.syncState.update(deviceId, updates);
  } else {
    await db.syncState.put({
      deviceId,
      lastPullCursor: '',
      pendingOperations: 0,
      pendingMedia: 0,
      conflictCount: 0,
      syncStatus: 'OFFLINE',
      ...updates,
    });
  }
}

export async function setSyncStatus(status: ConnectivityStatus): Promise<void> {
  await updateSyncState({ syncStatus: status });
}

export async function advanceCursor(cursor: string): Promise<void> {
  await updateSyncState({
    lastPullCursor: cursor,
    lastSuccessfulSync: new Date().toISOString(),
  });
}

/** Refresh counters from actual DB counts */
export async function refreshSyncCounts(): Promise<void> {
  const [pendingOperations, pendingMedia, conflictCount] = await Promise.all([
    getPendingOperationCount(),
    getPendingMediaCount(),
    getOpenConflictCount(),
  ]);
  await updateSyncState({ pendingOperations, pendingMedia, conflictCount });
}
