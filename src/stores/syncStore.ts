import { create } from 'zustand';
import { connectivity } from '@/lib/connectivity/healthCheck';
import { syncManager } from '@/lib/sync/syncManager';
import { getPendingOperationCount } from '@/lib/db/repositories/operations';
import { getPendingMediaCount } from '@/lib/db/repositories/media';
import { getOpenConflictCount } from '@/lib/db/repositories/conflicts';
import { db } from '@/lib/db/schema';
import type { ConnectivityStatus } from '@/types/db';

interface SyncStoreState {
  status: ConnectivityStatus;
  pendingOperations: number;
  pendingMedia: number;
  conflictCount: number;
  lastSuccessfulSync: string | null;
  isSyncing: boolean;

  // Actions
  initialize: () => void;
  refreshCounts: () => Promise<void>;
  syncNow: () => Promise<void>;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  status: 'OFFLINE',
  pendingOperations: 0,
  pendingMedia: 0,
  conflictCount: 0,
  lastSuccessfulSync: null,
  isSyncing: false,

  initialize: () => {
    // Immediately read the current syncManager state (catches races
    // where syncManager.start() fired before this store was created).
    const currentStatus = syncManager.status;
    set({ status: currentStatus, isSyncing: currentStatus === 'SYNCING' });

    // Optimistically mark ONLINE if browser reports internet right now,
    // so the UI never flashes "Offline" when the device is connected.
    if (navigator.onLine && currentStatus === 'OFFLINE') {
      set({ status: 'ONLINE' });
    }

    // Subscribe to sync manager state changes
    syncManager.subscribe((status) => {
      set({ status, isSyncing: status === 'SYNCING' });
      void get().refreshCounts();
    });

    // Subscribe to connectivity changes
    connectivity.subscribe(() => {
      void get().refreshCounts();
    });

    // Initial counts
    void get().refreshCounts();
  },


  refreshCounts: async () => {
    const [pendingOps, pendingMedia, conflicts] = await Promise.all([
      getPendingOperationCount(),
      getPendingMediaCount(),
      getOpenConflictCount(),
    ]);

    const syncState = await db.syncState.toCollection().first();

    set({
      pendingOperations: pendingOps,
      pendingMedia,
      conflictCount: conflicts,
      lastSuccessfulSync: syncState?.lastSuccessfulSync ?? null,
    });
  },

  syncNow: async () => {
    set({ isSyncing: true });
    await syncManager.syncNow();
    await get().refreshCounts();
    set({ isSyncing: false });
  },
}));
