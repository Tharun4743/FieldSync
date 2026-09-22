import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/db/database';
import {
  History,
  Filter,
  ArrowLeft,
  ArrowRight,
  Clock,
  User,
  AlertCircle,
  FileText,
  Camera,
  CheckCircle,
  Tag,
} from 'lucide-react';
import type { AuditEvent, Inspection } from '@/types/db';

export default function AuditHistory() {
  // Route is /inspections/:id/history — param is 'id', not 'inspectionId'
  const { id: routeInspectionId } = useParams<{ id?: string }>();
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  const auditEvents = useLiveQuery(
    () => {
      let query = db.auditEvents.orderBy('createdAt').reverse();
      if (routeInspectionId) {
        return db.auditEvents
          .where('inspectionId')
          .equals(routeInspectionId)
          .reverse()
          .sortBy('createdAt');
      }
      return query.toArray();
    },
    [routeInspectionId]
  ) ?? [];

  const inspections = useLiveQuery(() => db.inspections.toArray(), []);
  const inspectionMap = Object.fromEntries(
    inspections?.map((i: Inspection) => [i.id, i]) ?? []
  );

  const currentInspection = routeInspectionId ? inspectionMap[routeInspectionId] : null;

  const filteredEvents = auditEvents.filter((e: AuditEvent) => {
    if (selectedAction === 'ALL') return true;
    return e.action === selectedAction;
  });

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Optional back button if route is inspection-scoped */}
      {routeInspectionId && (
        <Link
          to={`/inspections/${routeInspectionId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
        >
          <ArrowLeft size={14} /> Back to Inspection
        </Link>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5">
            <History className="text-indigo-600" />
            Audit Trail & History
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm font-medium mt-1">
            {currentInspection
              ? `Immutable audit record for: ${currentInspection.title}`
              : 'Complete immutable log of all inspections, checklist responses, and sync events.'}
          </p>
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-zinc-400" />
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="h-10 px-3.5 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all shadow-2xs"
          >
            <option value="ALL">All Actions</option>
            <option value="UPDATED">Updated Values</option>
            <option value="CREATED">Created Records</option>
            <option value="CONFLICT_DETECTED">Conflicts Detected</option>
            <option value="CONFLICT_RESOLVED">Conflicts Resolved</option>
            <option value="NOTE_ADDED">Notes Added</option>
            <option value="PHOTO_ADDED">Photos Captured</option>
          </select>
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
        {filteredEvents.length === 0 ? (
          <div className="p-10 text-center text-zinc-400 text-sm font-medium">
            No audit records found matching criteria.
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredEvents.map((event: AuditEvent, idx: number) => {
              const inspection = inspectionMap[event.inspectionId];
              const isLast = idx === filteredEvents.length - 1;

              return (
                <div key={event.id} className="flex gap-4">
                  {/* Timeline indicator line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 border ${getActionBadgeStyle(
                        event.action
                      )}`}
                    >
                      {getActionIcon(event.action)}
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-zinc-200 my-1" />}
                  </div>

                  {/* Content card */}
                  <div className={`flex-1 min-w-0 ${!isLast ? 'pb-6' : ''}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 text-xs">
                          {formatActionTitle(event.action)}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {event.entityType}
                        </span>
                      </div>

                      <span className="text-xs text-zinc-400 font-mono flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {/* Inspection reference if viewing all */}
                    {!routeInspectionId && inspection && (
                      <div className="text-xs text-indigo-600 font-medium mt-0.5">
                        <Link to={`/inspections/${inspection.id}`} className="hover:underline">
                          {inspection.title}
                        </Link>
                      </div>
                    )}

                    {/* Field & Value diff */}
                    {(event.field || event.beforeValue !== undefined || event.afterValue !== undefined) && (
                      <div className="mt-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200/70 text-xs font-mono space-y-1">
                        {event.field && (
                          <div className="text-zinc-500 mb-1 font-sans">
                            Field: <span className="text-zinc-900 font-bold">{event.field}</span>
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          {event.beforeValue !== undefined && (
                            <div className="text-rose-600 line-through truncate max-w-md bg-white px-2 py-0.5 rounded border border-rose-200">
                              {event.beforeValue || '(empty)'}
                            </div>
                          )}
                          {event.beforeValue !== undefined && event.afterValue !== undefined && (
                            <ArrowRight size={12} className="text-zinc-400 hidden sm:inline" />
                          )}
                          {event.afterValue !== undefined && (
                            <div className="text-emerald-700 font-bold truncate max-w-md bg-white px-2 py-0.5 rounded border border-emerald-200">
                              {event.afterValue || '(empty)'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* User & device info */}
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1 font-medium">
                        <User size={11} /> {event.userName ?? event.userId}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getActionIcon(action: string) {
  if (action.includes('CONFLICT')) return <AlertCircle size={13} />;
  if (action.includes('NOTE')) return <FileText size={13} />;
  if (action.includes('PHOTO')) return <Camera size={13} />;
  if (action.includes('RESOLVED')) return <CheckCircle size={13} />;
  return <Tag size={13} />;
}

function getActionBadgeStyle(action: string): string {
  if (action === 'CONFLICT_DETECTED') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (action === 'CONFLICT_RESOLVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (action === 'PHOTO_ADDED' || action === 'PHOTO_UPLOADED')
    return 'bg-sky-50 text-sky-700 border-sky-200';
  if (action === 'NOTE_ADDED') return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-zinc-50 text-zinc-700 border-zinc-200';
}

function formatActionTitle(action: string): string {
  const map: Record<string, string> = {
    CREATED: 'Record Created',
    UPDATED: 'Value Updated',
    DELETED: 'Record Deleted',
    CONFLICT_DETECTED: 'Conflict Detected',
    CONFLICT_RESOLVED: 'Conflict Resolved',
    NOTE_ADDED: 'Note Appended',
    PHOTO_ADDED: 'Photo Queued',
    PHOTO_UPLOADED: 'Photo Uploaded',
    SYNCED: 'Synced to Cloud',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}
