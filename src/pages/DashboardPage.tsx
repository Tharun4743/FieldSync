import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/db/database';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import { useI18n } from '../lib/i18n/LanguageContext';
import SyncStatusBadge from '../components/sync/SyncStatusBadge';
import OfflinePackageModal from '../components/offline/OfflinePackageModal';
import type { Inspection, AuditEvent, InspectionProgress, Asset } from '@/types/db';
import {
  ClipboardList,
  AlertTriangle,
  Upload,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  Package,
  Mic,
  Clock,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { pendingOperations, pendingMedia, status, isSyncing, syncNow } = useSyncStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);

  // Live queries from IndexedDB
  const inspections = useLiveQuery(() => db.inspections.toArray(), []);
  const assets = useLiveQuery(() => db.assets.toArray(), []);
  const myInspections = inspections?.filter(
    (i: Inspection) =>
      user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || i.assignedTo.includes(user?.id ?? '')
  );

  // Recent inspection progress (for Resume Inspection card)
  const recentProgress = useLiveQuery(
    () => db.inspectionProgress.orderBy('lastOpenedAt').reverse().first(),
    []
  ) as InspectionProgress | undefined;

  const resumeInspection = useLiveQuery(
    () => (recentProgress?.inspectionId ? db.inspections.get(recentProgress.inspectionId) : undefined),
    [recentProgress?.inspectionId]
  ) as Inspection | undefined;

  const resumeAsset = useLiveQuery(
    () => (resumeInspection?.assetId ? db.assets.get(resumeInspection.assetId) : undefined),
    [resumeInspection?.assetId]
  ) as Asset | undefined;

  const pendingVoiceNotesCount = useLiveQuery(
    () => db.voiceNotes.where('uploadStatus').anyOf(['PENDING', 'PAUSED', 'FAILED', 'UPLOADING']).count(),
    []
  );

  const recentActivity = useLiveQuery(
    () => db.auditEvents.orderBy('createdAt').reverse().limit(5).toArray(),
    []
  );

  const pendingConflicts = useLiveQuery(
    () => db.conflicts.where('status').equals('PENDING').count(),
    []
  );

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header with Greeting & Offline Package action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
            Good {getGreeting()}, {user?.fullName?.split(' ')[0] ?? 'Technician'}
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm font-medium mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <button
          onClick={() => setOfflineModalOpen(true)}
          className="h-10 px-4 rounded-xl font-bold text-xs bg-zinc-900 hover:bg-black text-white active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-zinc-200 self-start sm:self-auto"
          id="btn-prepare-offline"
        >
          <Package size={15} />
          <span>{t.prepareOffline}</span>
        </button>
      </div>

      {/* Connectivity & Sync Control Banner */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <SyncStatusBadge />
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={isSyncing || status === 'OFFLINE'}
          className="h-9 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-100 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
          aria-label="Sync now"
          id="btn-sync-now"
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? t.syncing : t.syncNow}
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* RESUME INSPECTION CARD (Specification 6)                   */}
      {/* Remembers exact progress in IndexedDB across reloads        */}
      {/* ────────────────────────────────────────────────────────── */}
      {recentProgress && resumeInspection && (
        <div
          className="bg-linear-to-r from-zinc-950 via-zinc-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-zinc-800 space-y-4"
          id="card-resume-inspection"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                In-Progress Inspection
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
              <Clock size={12} />
              {new Date(recentProgress.lastOpenedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {resumeAsset && (
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    {resumeAsset.assetCode}
                  </span>
                )}
                <span className="text-xs font-semibold text-zinc-400">{resumeInspection.siteName}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">{resumeInspection.title}</h2>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                {t.progress}
              </span>
              <span className="font-mono text-2xl font-black text-emerald-400">
                {recentProgress.completedCount} / {recentProgress.totalCount} completed
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  (recentProgress.completedCount / Math.max(1, recentProgress.totalCount)) * 100
                )}%`,
              }}
            />
          </div>

          {/* Last Completed & Next Incomplete Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
            {recentProgress.lastChecklistTitle && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Last Completed
                </span>
                <p className="font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  {recentProgress.lastChecklistTitle}
                </p>
              </div>
            )}

            {recentProgress.nextChecklistTitle ? (
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block mb-1">
                  Next Checklist Item
                </span>
                <p className="font-semibold text-indigo-100 truncate flex items-center gap-1.5">
                  <ArrowRight size={14} className="text-indigo-400 shrink-0" />
                  {recentProgress.nextChecklistTitle}
                </p>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Inspection Complete
                </p>
              </div>
            )}
          </div>

          {/* Resume Action Buttons */}
          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                const targetUrl = recentProgress.nextChecklistItemId
                  ? `/inspections/${resumeInspection.id}?item=${recentProgress.nextChecklistItemId}&mode=quick`
                  : `/inspections/${resumeInspection.id}?mode=quick`;
                navigate(targetUrl);
              }}
              className="h-12 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              id="btn-resume-inspection"
            >
              <PlayCircle size={18} />
              <span>{t.resumeInspection}</span>
            </button>

            <button
              onClick={() => navigate(`/inspections/${resumeInspection.id}`)}
              className="h-12 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              View Full Overview
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/inspections"
          className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group block"
          id="stat-my-inspections"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Assigned</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ClipboardList size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono tracking-tight">
            {myInspections?.length ?? '—'}
          </div>
          <div className="text-xs font-semibold text-zinc-600 mt-1">
            {user?.role === 'TECHNICIAN' ? 'My Inspections' : 'Total Inspections'}
          </div>
        </Link>

        <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all block">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Pending Operations</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Upload size={16} />
            </div>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              pendingOperations > 0 ? 'text-amber-600' : 'text-zinc-900'
            }`}
          >
            {pendingOperations}
          </div>
          <div className="text-xs font-semibold text-zinc-600 mt-1">Unsynced Operations</div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all block">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Media Queue</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center">
              <Mic size={16} />
            </div>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              pendingMedia + (pendingVoiceNotesCount ?? 0) > 0 ? 'text-sky-600' : 'text-zinc-900'
            }`}
          >
            {pendingMedia + (pendingVoiceNotesCount ?? 0)}
          </div>
          <div className="text-xs font-semibold text-zinc-600 mt-1">
            {pendingMedia} photos · {pendingVoiceNotesCount ?? 0} voice
          </div>
        </div>

        <Link
          to="/conflicts"
          className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-rose-300 transition-all group block"
          id="stat-conflicts"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{t.conflicts}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              (pendingConflicts ?? 0) > 0 ? 'text-rose-600 font-bold' : 'text-zinc-900'
            }`}
          >
            {pendingConflicts ?? 0}
          </div>
          <div className="text-xs font-semibold text-zinc-600 mt-1">Require Review</div>
        </Link>
      </div>

      {/* Main Content: Assigned Inspections + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Inspections */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">Active Inspections</h2>
            <Link
              to="/inspections"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            {!myInspections || myInspections.length === 0 ? (
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-sm font-bold text-zinc-900">All caught up!</p>
                <p className="text-xs text-zinc-500 mt-0.5">No pending inspections assigned to you.</p>
              </div>
            ) : (
              myInspections.slice(0, 3).map((inspection: Inspection) => {
                const inspAsset = assets?.find((a: Asset) => a.id === inspection.assetId);
                return (
                  <Link
                    key={inspection.id}
                    to={`/inspections/${inspection.id}`}
                    className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all block group"
                    id={`inspection-card-${inspection.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {inspAsset && (
                            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded">
                              {inspAsset.assetCode}
                            </span>
                          )}
                          <p className="font-bold text-zinc-900 text-sm group-hover:text-indigo-600 transition-colors truncate">
                            {inspection.title}
                          </p>
                        </div>
                        <p className="text-xs font-medium text-zinc-500 mt-0.5">{inspection.siteName}</p>
                      </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${getPriorityBadge(
                        inspection.priority
                      )}`}
                    >
                      {inspection.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadge(
                        inspection.status
                      )}`}
                    >
                      {inspection.status.replace('_', ' ')}
                    </span>
                    {inspection.localVersion > inspection.serverVersion && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Unsynced
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">Recent Activity</h2>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
            {!recentActivity || recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs font-medium text-zinc-400">
                No recent activity logged yet.
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((event: AuditEvent, idx: number) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-50 shrink-0 mt-1" />
                      {idx < recentActivity.length - 1 && (
                        <div className="w-px flex-1 bg-zinc-200 my-1" />
                      )}
                    </div>
                    <div className="min-w-0 pb-1">
                      <p className="text-xs font-bold text-zinc-900 leading-tight">
                        {formatAuditAction(event.action)}
                      </p>
                      <p className="text-[11px] font-medium text-zinc-500 mt-0.5 truncate">
                        {event.entityType} · {formatTimeShort(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Offline Package Modal */}
      <OfflinePackageModal isOpen={offlineModalOpen} onClose={() => setOfflineModalOpen(false)} />
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'IN_PROGRESS':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'CRITICAL':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'HIGH':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

function formatAuditAction(action: string): string {
  const map: Record<string, string> = {
    CREATED: 'Record created',
    UPDATED: 'Record updated',
    CONFLICT_DETECTED: 'Conflict detected',
    CONFLICT_RESOLVED: 'Conflict resolved',
    NOTE_ADDED: 'Note added',
    PHOTO_ADDED: 'Photo attached',
    PHOTO_UPLOADED: 'Photo uploaded to cloud',
    SYNCED: 'Data synchronized',
  };
  return map[action] ?? action.replace('_', ' ').toLowerCase();
}

function formatTimeShort(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
