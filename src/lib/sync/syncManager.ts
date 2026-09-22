import { connectivity } from '../connectivity/healthCheck';
import { pushPendingOperations, pullServerChanges } from './syncService';
import { processMediaQueue } from '../media/resumableUpload';
import { db } from '../db/schema';
import { getPendingOperationCount } from '../db/repositories/operations';
import { getPendingMediaCount } from '../db/repositories/media';
import { getOpenConflictCount } from '../db/repositories/conflicts';
import type { ConnectivityStatus } from '@/types/db';

// ============================================================
// Sync Manager — State Machine
//
// States:
//   OFFLINE     — no network connectivity
//   ONLINE      — connected, not currently syncing
//   SYNCING     — sync in progress
//   SYNC_ERROR  — last sync attempt failed
//
// Transitions:
//   OFFLINE → ONLINE    : connectivity restored
//   ONLINE  → SYNCING   : sync triggered (auto or manual)
//   SYNCING → ONLINE    : sync completed successfully
//   SYNCING → SYNC_ERROR: sync failed
//   SYNC_ERROR → SYNCING: retry (exponential backoff)
//   any → OFFLINE       : connectivity lost
// ============================================================

type SyncStateChangeListener = (state: ConnectivityStatus) => void;

class SyncManager {
  private _status: ConnectivityStatus = 'OFFLINE';
  private _listeners: Set<SyncStateChangeListener> = new Set();
  private _authToken: string | null = null;
  private _retryCount = 0;
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;
  private _syncInProgress = false;

  get status(): ConnectivityStatus {
    return this._status;
  }

  setAuthToken(token: string | null): void {
    this._authToken = token;
  }

  subscribe(listener: SyncStateChangeListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  start(): void {
    // Subscribe to connectivity changes
    connectivity.subscribe((online) => {
      if (online) {
        void this._onConnected();
      } else {
        this._onDisconnected();
      }
    });

    // Initial connectivity check
    void connectivity.check().then((online) => {
      if (online) void this._onConnected();
    });
  }

  /** Trigger sync manually (e.g., "Sync Now" button) */
  async syncNow(): Promise<void> {
    if (this._syncInProgress) return;
    const isOnline = await connectivity.check();
    if (!isOnline) return;
    await this._performSync();
  }

  private async _onConnected(): Promise<void> {
    if (this._status !== 'OFFLINE' && this._status !== 'SYNC_ERROR') return;
    this._setStatus('ONLINE');
    this._retryCount = 0;

    // Auto-sync when connectivity returns
    await this._performSync();
  }

  private _onDisconnected(): void {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    this._setStatus('OFFLINE');
  }

  private async _performSync(): Promise<void> {
    if (this._syncInProgress) return;
    if (!this._authToken) return;

    this._syncInProgress = true;
    this._setStatus('SYNCING');

    try {
      // 1. Push local operations
      await pushPendingOperations(this._authToken);

      // 2. Pull server changes
      await pullServerChanges(this._authToken);

      // 3. Process media queue
      await processMediaQueue(this._authToken);

      // 4. Update sync state
      await this._updateSyncState();

      this._retryCount = 0;
      this._setStatus('ONLINE');
    } catch (err) {
      console.error('[SyncManager] Sync failed:', err);
      this._setStatus('SYNC_ERROR');
      this._scheduleRetry();
    } finally {
      this._syncInProgress = false;
    }
  }

  /**
   * Exponential backoff: 2s, 4s, 8s, 16s, 32s, 60s max
   */
  private _scheduleRetry(): void {
    if (this._retryTimer) clearTimeout(this._retryTimer);

    const delay = Math.min(2000 * Math.pow(2, this._retryCount), 60000);
    this._retryCount++;

    console.info(`[SyncManager] Retry in ${delay}ms (attempt ${this._retryCount})`);

    this._retryTimer = setTimeout(() => {
      void connectivity.check().then((online) => {
        if (online) void this._performSync();
      });
    }, delay);
  }

  private async _updateSyncState(): Promise<void> {
    const syncState = await db.syncState.toCollection().first();
    if (!syncState) return;

    const [pendingOps, pendingMedia, conflicts] = await Promise.all([
      getPendingOperationCount(),
      getPendingMediaCount(),
      getOpenConflictCount(),
    ]);

    await db.syncState.update(syncState.deviceId, {
      pendingOperations: pendingOps,
      pendingMedia,
      conflictCount: conflicts,
      lastSyncAttempt: new Date().toISOString(),
      syncStatus: 'ONLINE',
    });
  }

  private _setStatus(status: ConnectivityStatus): void {
    if (this._status !== status) {
      this._status = status;
      this._listeners.forEach((l) => l(status));
    }
  }
}

export const syncManager = new SyncManager();
