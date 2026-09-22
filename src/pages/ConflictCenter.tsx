import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db/database';
import { useAuthStore } from '../stores/authStore';
import { resolveConflict } from '../lib/db/repositories/conflicts';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ShieldAlert,
  History,
} from 'lucide-react';
import type { Conflict, Inspection } from '@/types/db';

export default function ConflictCenter() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const isSupervisorOrAdmin = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const isTechnician = user?.role === 'TECHNICIAN';

  // Fetch all inspections to scope conflict visibility for technicians
  const inspections = useLiveQuery(() => db.inspections.toArray(), []);
  const inspectionMap = Object.fromEntries(
    inspections?.map((i: Inspection) => [i.id, i]) ?? []
  );

  // Technicians only see conflicts on their assigned inspections
  const myInspectionIds = isTechnician
    ? new Set(
        (inspections ?? [])
          .filter((i: Inspection) => i.assignedTo.includes(user?.id ?? ''))
          .map((i: Inspection) => i.id)
      )
    : null;

  const openConflicts = useLiveQuery(
    () => db.conflicts.where('status').equals('OPEN').toArray(),
    []
  ) ?? [];

  const resolvedConflicts = useLiveQuery(
    () => db.conflicts.where('status').equals('RESOLVED').toArray(),
    []
  ) ?? [];

  // Apply scoping filter for technicians
  const filteredOpen = myInspectionIds
    ? openConflicts.filter((c: Conflict) => myInspectionIds.has(c.inspectionId))
    : openConflicts;

  const filteredResolved = myInspectionIds
    ? resolvedConflicts.filter((c: Conflict) => myInspectionIds.has(c.inspectionId))
    : resolvedConflicts;


  const displayList = activeTab === 'OPEN' ? filteredOpen : filteredResolved;


  async function handleResolve(conflict: Conflict, chosenValue: string) {
    if (!user) return;
    setResolvingId(conflict.id);
    try {
      await resolveConflict({
        conflictId: conflict.id,
        resolvedValue: chosenValue,
        resolvedBy: user.id,
        resolvedByName: user.fullName || user.email,
        callerRole: user.role,
      });
    } catch (err) {
      console.error('[ConflictCenter] Failed to resolve conflict:', err);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5">
            <AlertTriangle className="text-amber-500" />
            Conflict Center
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm font-medium mt-1">
            Deterministic adjudication for concurrent offline changes.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-white border border-zinc-200 p-1 rounded-xl shadow-2xs">
          <button
            onClick={() => setActiveTab('OPEN')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'OPEN'
                ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ShieldAlert size={14} />
            Open ({filteredOpen.length})
          </button>
          <button
            onClick={() => setActiveTab('RESOLVED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'RESOLVED'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <History size={14} />
            History ({filteredResolved.length})
          </button>
        </div>
      </div>

      {/* Role Notice */}
      {!isSupervisorOrAdmin && activeTab === 'OPEN' && (
        <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200/80 text-sky-900 text-xs flex items-center gap-2.5 font-medium">
          <span className="text-base">ℹ️</span>
          <span>
            Logged in as <strong>Technician</strong>. Read-only view — showing conflicts on your assigned inspections only. A Supervisor or Admin can officially adjudicate conflicting values.
          </span>
        </div>
      )}

      {/* Conflict Cards List */}
      <div className="space-y-4">
        {displayList.length === 0 ? (
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-base font-bold text-zinc-900">
              {activeTab === 'OPEN' ? 'No open conflicts' : 'No resolved conflict records'}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'OPEN'
                ? 'All concurrent operations have synchronized cleanly without collisions.'
                : 'Resolved records are permanently retained in the audit history.'}
            </p>
          </div>
        ) : (
          displayList.map((conflict: Conflict) => {
            const inspection = inspectionMap[conflict.inspectionId];
            const isResolving = resolvingId === conflict.id;

            return (
              <div
                key={conflict.id}
                className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4"
              >
                {/* Top Info */}
                <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                      {inspection?.siteName ?? 'Industrial Site'}
                    </span>
                    <h3 className="text-base font-bold text-zinc-900 mt-0.5">
                      {inspection?.title ?? 'Inspection Item'}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                      Contested Field: <span className="font-bold text-amber-600">{conflict.field}</span>
                    </p>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      conflict.status === 'OPEN'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {conflict.status}
                  </span>
                </div>

                {/* Base value */}
                {conflict.baseValue && (
                  <div className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 font-medium">
                    Prior shared value: <code className="font-bold text-zinc-800">{conflict.baseValue}</code>
                  </div>
                )}

                {/* Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Local Device Edit */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-indigo-800 font-bold mb-2">
                        <span className="flex items-center gap-1.5">
                          <User size={13} /> Local Edit ({conflict.localUserName || 'This Device'})
                        </span>
                        <span className="text-zinc-500 font-normal flex items-center gap-1">
                          <Clock size={11} /> {formatDateShort(conflict.localTimestamp)}
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-indigo-200 text-sm font-mono text-zinc-900 font-bold break-all shadow-2xs">
                        {conflict.localValue || '(empty)'}
                      </div>
                    </div>

                    {conflict.status === 'OPEN' && isSupervisorOrAdmin && (
                      <button
                        onClick={() => void handleResolve(conflict, conflict.localValue)}
                        disabled={isResolving}
                        className="mt-3 h-9 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        Keep Local Value
                      </button>
                    )}
                  </div>

                  {/* Remote / Server Edit */}
                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-purple-800 font-bold mb-2">
                        <span className="flex items-center gap-1.5">
                          <User size={13} /> Remote Edit ({conflict.remoteUserName || 'Other User'})
                        </span>
                        <span className="text-zinc-500 font-normal flex items-center gap-1">
                          <Clock size={11} /> {formatDateShort(conflict.remoteTimestamp)}
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-purple-200 text-sm font-mono text-zinc-900 font-bold break-all shadow-2xs">
                        {conflict.remoteValue || '(empty)'}
                      </div>
                    </div>

                    {conflict.status === 'OPEN' && isSupervisorOrAdmin && (
                      <button
                        onClick={() => void handleResolve(conflict, conflict.remoteValue)}
                        disabled={isResolving}
                        className="mt-3 h-9 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        Accept Remote Value
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Resolution */}
                {conflict.status === 'OPEN' && isSupervisorOrAdmin && (
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                    <input
                      type="text"
                      className="h-10 px-3.5 bg-white border border-zinc-200 rounded-xl text-xs flex-1 font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                      placeholder="Or enter custom adjudicated value…"
                      value={customValues[conflict.id] ?? ''}
                      onChange={(e) =>
                        setCustomValues({ ...customValues, [conflict.id]: e.target.value })
                      }
                    />
                    <button
                      onClick={() => {
                        const val = customValues[conflict.id]?.trim();
                        if (val) void handleResolve(conflict, val);
                      }}
                      disabled={!customValues[conflict.id]?.trim() || isResolving}
                      className="h-10 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Apply Custom
                    </button>
                  </div>
                )}

                {/* Resolution Summary */}
                {conflict.status === 'RESOLVED' && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        Resolved by: {conflict.resolvedByName ?? 'Supervisor'}
                      </span>
                      <span className="text-zinc-500 font-medium">
                        {conflict.resolvedAt ? formatDateShort(conflict.resolvedAt) : ''}
                      </span>
                    </div>
                    <div className="text-zinc-700 font-medium mt-1">
                      Adjudicated Final Value:{' '}
                      <span className="font-mono font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                        {conflict.resolvedValue}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
