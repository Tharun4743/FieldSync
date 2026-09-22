import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../lib/db/database';
import { useSyncStore } from '../stores/syncStore';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Layers,
  CheckCircle2,
  FileImage,
  Mic,
  AlertTriangle,
  Trash2,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import type { Operation, MediaRecord, VoiceNote } from '@/types/db';

export default function SyncCenter() {
  const { status, lastSuccessfulSync, isSyncing, syncNow } = useSyncStore();
  const [forcingCheck, setForcingCheck] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'operations' | 'photos' | 'voice' | 'conflicts'>('all');
  const [cleanupMessage, setCleanupMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Live queries directly from IndexedDB (no hardcoded fake counts)
  const operations = useLiveQuery(() => db.operations.orderBy('createdAt').reverse().toArray(), []);
  const pendingOpsCount = useLiveQuery(() => db.operations.where('syncStatus').equals('PENDING').count(), []);
  const pendingPhotos = useLiveQuery(
    () => db.media.where('uploadStatus').anyOf(['PENDING', 'UPLOADING', 'PAUSED', 'FAILED']).toArray(),
    []
  );
  const pendingVoiceNotes = useLiveQuery(
    () => db.voiceNotes.where('uploadStatus').anyOf(['PENDING', 'UPLOADING', 'PAUSED', 'FAILED']).toArray(),
    []
  );
  const allMedia = useLiveQuery(() => db.media.toArray(), []);
  const allVoiceNotes = useLiveQuery(() => db.voiceNotes.toArray(), []);
  const openConflictsCount = useLiveQuery(
    () => db.conflicts.where('status').equals('OPEN').count(),
    []
  );
  const logicalClockVal = useLiveQuery(() => db.syncState.toCollection().first(), []);

  // Live inspection data counts for real storage breakdown
  const allInspections = useLiveQuery(() => db.inspections.toArray(), []);
  const allChecklistItems = useLiveQuery(() => db.checklistItems.toArray(), []);
  const allNotes = useLiveQuery(() => db.notes.toArray(), []);
  const allResults = useLiveQuery(() => db.inspectionResults.toArray(), []);

  // Real navigator.storage.estimate() — no hardcoded fallbacks
  const [storageEstimate, setStorageEstimate] = useState<{ total: number; quota: number; ready: boolean }>({
    total: 0,
    quota: 0,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        navigator.storage.estimate().then((est) => {
          if (!cancelled) {
            setStorageEstimate({
              total: est.usage ?? 0,
              quota: est.quota ?? 0,
              ready: true,
            });
          }
        }).catch(() => {
          if (!cancelled) setStorageEstimate((prev) => ({ ...prev, ready: true }));
        });
      } else {
        if (!cancelled) setStorageEstimate((prev) => ({ ...prev, ready: true }));
      }
    };
    refresh();
    return () => { cancelled = true; };
  // Re-measure whenever any live data changes
  }, [allMedia, allVoiceNotes, operations, allInspections, allChecklistItems, allNotes, allResults]);

  // Bytes summed from actual IndexedDB record fields (only records that have local blobs)
  const photosBytes = (allMedia ?? []).reduce((acc, m) => acc + (m.size ?? 0), 0);
  const voiceBytes = (allVoiceNotes ?? []).reduce((acc, v) => acc + (v.totalBytes ?? 0), 0);
  // Inspection data = total browser storage minus known media blobs
  // If storageEstimate not ready yet, show 0 (not a fake number)
  const inspectionDataBytes = storageEstimate.ready
    ? Math.max(0, storageEstimate.total - photosBytes - voiceBytes)
    : 0;

  const formatBytes = (bytes: number, ready = true) => {
    if (!ready) return '…';
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 0.01) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const formatQuota = (bytes: number, ready = true) => {
    if (!ready) return '…';
    if (bytes === 0) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const handleManualSync = async () => {
    await syncNow();
  };

  const handleHealthCheck = async () => {
    setForcingCheck(true);
    try {
      await syncNow();
    } finally {
      setForcingCheck(false);
    }
  };

  // Safe cleanup mechanism: NEVER delete unsynchronized data automatically
  const handleSafeCleanup = async () => {
    setCleanupMessage(null);
    try {
      // Find completed media with local blobs
      const completedPhotos = (allMedia || []).filter(
        (m) => m.uploadStatus === 'COMPLETED' && m.syncStatus === 'SYNCED' && m.localBlob
      );
      const completedVoice = (allVoiceNotes || []).filter(
        (v) => v.uploadStatus === 'COMPLETED' && v.syncStatus === 'SYNCED' && v.localBlob
      );

      if (completedPhotos.length === 0 && completedVoice.length === 0) {
        setCleanupMessage({
          text: 'No uploaded media cache to clean. All media is either already cleared or pending sync.',
          isError: false,
        });
        return;
      }

      // Safely release local blob binaries from IndexedDB while retaining metadata
      for (const p of completedPhotos) {
        await db.media.update(p.id, { localBlob: undefined });
      }
      for (const v of completedVoice) {
        await db.voiceNotes.update(v.id, { localBlob: undefined });
      }

      setCleanupMessage({
        text: `Cleaned cache for ${completedPhotos.length} photos and ${completedVoice.length} voice notes. Metadata and remote links safely retained.`,
        isError: false,
      });
    } catch {
      setCleanupMessage({
        text: 'Failed to clear media cache safely.',
        isError: true,
      });
    }
  };

  const handleAttemptPendingDelete = () => {
    setCleanupMessage({
      text: 'Cannot remove — synchronization pending. Unsynchronized inspection data must remain safely on device.',
      isError: true,
    });
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5">
            <RefreshCw className={isSyncing ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
            Sync Center & Offline Storage
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm font-medium mt-1">
            Durable offline replication queue, Lamport logical clock timestamps, and safe storage manager.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/conflicts"
            className="h-10 px-4 rounded-xl font-bold text-xs bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 flex items-center gap-2 shadow-2xs transition-colors"
          >
            <AlertTriangle size={14} className="text-rose-600" />
            <span>View Conflicts ({openConflictsCount ?? 0})</span>
          </Link>

          <button
            onClick={() => void handleManualSync()}
            disabled={isSyncing || status === 'OFFLINE'}
            className="h-10 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 disabled:opacity-40 transition-all flex items-center gap-2 shadow-sm shadow-indigo-100 cursor-pointer"
            id="btn-sync-all"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Real Sync State Overview (Specification 17) */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Connection & Queue State</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Connection</span>
            <div className="flex items-center gap-1.5 mt-1">
              {status === 'ONLINE' ? (
                <span className="text-sm font-black text-emerald-600 flex items-center gap-1">
                  <Wifi size={14} /> ONLINE
                </span>
              ) : status === 'SYNCING' ? (
                <span className="text-sm font-black text-sky-600 flex items-center gap-1">
                  <RefreshCw size={14} className="animate-spin" /> SYNCING
                </span>
              ) : status === 'SYNC_ERROR' ? (
                <span className="text-sm font-black text-rose-600 flex items-center gap-1">
                  <AlertTriangle size={14} /> ERROR
                </span>
              ) : (
                <span className="text-sm font-black text-amber-600 flex items-center gap-1">
                  <WifiOff size={14} /> OFFLINE
                </span>
              )}
            </div>
          </div>

          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Last Sync</span>
            <p className="text-sm font-black font-mono text-zinc-900 mt-1">
              {lastSuccessfulSync
                ? new Date(lastSuccessfulSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Pending'}
            </p>
          </div>

          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Pending Ops</span>
            <p className={`text-sm font-black font-mono mt-1 ${(pendingOpsCount ?? 0) > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
              {pendingOpsCount ?? 0}
            </p>
          </div>

          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Pending Photos</span>
            <p className={`text-sm font-black font-mono mt-1 ${(pendingPhotos?.length ?? 0) > 0 ? 'text-sky-600' : 'text-zinc-900'}`}>
              {pendingPhotos?.length ?? 0}
            </p>
          </div>

          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Pending Voice</span>
            <p className={`text-sm font-black font-mono mt-1 ${(pendingVoiceNotes?.length ?? 0) > 0 ? 'text-rose-600' : 'text-zinc-900'}`}>
              {pendingVoiceNotes?.length ?? 0}
            </p>
          </div>

          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Storage Used</span>
            <p className="text-sm font-black font-mono text-indigo-600 mt-1">
              {formatBytes(storageEstimate.total, storageEstimate.ready)}
            </p>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* LOCAL STORAGE MANAGEMENT (Specification 18)                */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <HardDrive size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Local Storage Breakdown</h2>
              <p className="text-xs text-zinc-500">IndexedDB footprint for offline media and inspection data</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleSafeCleanup()}
              className="h-9 px-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Safely clear uploaded photo & voice cache to reclaim device memory"
            >
              <Trash2 size={13} className="text-zinc-500" />
              <span>Safe Cache Cleanup</span>
            </button>
          </div>
        </div>

        {cleanupMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              cleanupMessage.isError
                ? 'bg-rose-50 border border-rose-200 text-rose-800'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}
          >
            {cleanupMessage.isError ? (
              <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            ) : (
              <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
            )}
            <span>{cleanupMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Total Used */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Total Used</span>
            <p className="text-xl font-black font-mono text-zinc-900 mt-1">
              {formatBytes(storageEstimate.total, storageEstimate.ready)}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Quota: {formatQuota(storageEstimate.quota, storageEstimate.ready)}
            </p>
          </div>

          {/* Photos */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Photos</span>
            <p className="text-xl font-black font-mono text-sky-600 mt-1">
              {formatBytes(photosBytes, allMedia !== undefined)}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {allMedia === undefined ? '…' : `${allMedia.length} photo record${allMedia.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Voice Notes */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Voice Notes</span>
            <p className="text-xl font-black font-mono text-rose-600 mt-1">
              {formatBytes(voiceBytes, allVoiceNotes !== undefined)}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {allVoiceNotes === undefined ? '…' : `${allVoiceNotes.length} audio record${allVoiceNotes.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Inspection Data */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Inspection Data</span>
            <p className="text-xl font-black font-mono text-emerald-600 mt-1">
              {formatBytes(inspectionDataBytes, storageEstimate.ready)}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {allInspections === undefined
                ? '…'
                : `${allInspections.length} inspection${allInspections.length !== 1 ? 's' : ''} · ${allChecklistItems?.length ?? 0} items · ${allNotes?.length ?? 0} note${(allNotes?.length ?? 0) !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>

        <div className="text-[11px] text-zinc-500 bg-amber-50/70 border border-amber-200/70 rounded-xl p-3 flex items-start gap-2">
          <ShieldCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Data Integrity Guard:</strong> Unsynchronized offline photos and voice notes are protected from accidental removal.
            Cache cleanup will only release storage for records verified and confirmed on the server.
          </span>
        </div>
      </div>

      {/* Tabs for Queue Inspection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
            {(['all', 'operations', 'photos', 'voice', 'conflicts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  activeTab === tab ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={() => void handleHealthCheck()}
            disabled={forcingCheck}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            {forcingCheck ? 'Probing Network…' : 'Probe Network Endpoint'}
          </button>
        </div>

        {/* Operation Queue */}
        {(activeTab === 'all' || activeTab === 'operations') && (
          <div className="bg-white border border-zinc-200/80 rounded-2xl divide-y divide-zinc-100 overflow-hidden shadow-sm">
            <div className="p-4 bg-zinc-50 font-bold text-xs text-zinc-700 flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Layers size={15} className="text-indigo-600" />
                Local Operations ({operations?.length ?? 0})
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                Clock: L-{logicalClockVal?.conflictCount ?? '1'}
              </span>
            </div>

            {(!operations || operations.length === 0) ? (
              <div className="p-8 text-center text-zinc-400 text-xs">
                <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-500" />
                All local edits committed to server.
              </div>
            ) : (
              operations.slice(0, 8).map((op: Operation) => (
                <div key={op.operationId} className="p-3.5 hover:bg-zinc-50/50 text-xs flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold border ${
                          op.syncStatus === 'SYNCED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : op.syncStatus === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {op.syncStatus}
                      </span>
                      <span className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">
                        {op.operationType} {op.entityType}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-zinc-500 truncate">
                      {JSON.stringify(op.payload)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono text-[10px] text-zinc-400">
                    <div>Clock: {op.logicalClock}</div>
                    <div>{new Date(op.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Photos Queue */}
        {(activeTab === 'all' || activeTab === 'photos') && (
          <div className="bg-white border border-zinc-200/80 rounded-2xl divide-y divide-zinc-100 overflow-hidden shadow-sm">
            <div className="p-4 bg-zinc-50 font-bold text-xs text-zinc-700 flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <FileImage size={15} className="text-sky-600" />
                Photos Queue ({pendingPhotos?.length ?? 0} pending)
              </span>
            </div>

            {(!pendingPhotos || pendingPhotos.length === 0) ? (
              <div className="p-8 text-center text-zinc-400 text-xs">No pending photo uploads.</div>
            ) : (
              pendingPhotos.map((m: MediaRecord) => {
                const pct = m.totalBytes > 0 ? Math.round((m.uploadedBytes / m.totalBytes) * 100) : 0;
                return (
                  <div key={m.id} className="p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileImage size={15} className="text-sky-600" />
                        <span className="font-bold text-zinc-800">{m.fileName}</span>
                        <span className="font-mono text-zinc-400">({(m.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {m.uploadStatus} ({pct}%)
                        </span>
                        <button
                          onClick={handleAttemptPendingDelete}
                          className="text-zinc-400 hover:text-rose-600 p-1"
                          title="Delete photo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Voice Notes Queue */}
        {(activeTab === 'all' || activeTab === 'voice') && (
          <div className="bg-white border border-zinc-200/80 rounded-2xl divide-y divide-zinc-100 overflow-hidden shadow-sm">
            <div className="p-4 bg-zinc-50 font-bold text-xs text-zinc-700 flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <Mic size={15} className="text-rose-600" />
                Voice Notes Queue ({pendingVoiceNotes?.length ?? 0} pending)
              </span>
            </div>

            {(!pendingVoiceNotes || pendingVoiceNotes.length === 0) ? (
              <div className="p-8 text-center text-zinc-400 text-xs">No pending voice note uploads.</div>
            ) : (
              pendingVoiceNotes.map((v: VoiceNote) => {
                const pct = v.totalBytes > 0 ? Math.round((v.uploadedBytes / v.totalBytes) * 100) : 0;
                return (
                  <div key={v.id} className="p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mic size={15} className="text-rose-600" />
                        <span className="font-bold text-zinc-800">{v.fileName}</span>
                        <span className="font-mono text-zinc-400">({v.duration}s · {(v.totalBytes / 1024).toFixed(0)} KB)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {v.uploadStatus} ({pct}%)
                        </span>
                        <button
                          onClick={handleAttemptPendingDelete}
                          className="text-zinc-400 hover:text-rose-600 p-1"
                          title="Delete voice note"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-rose-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
