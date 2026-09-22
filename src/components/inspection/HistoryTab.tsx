import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db/database';
import type { AuditAction } from '../../types/db.types';
import { CheckCircle2, AlertTriangle, FileText, Camera, UploadCloud, Edit3, Clock } from 'lucide-react';

interface Props {
  inspectionId: string;
}

export default function HistoryTab({ inspectionId }: Props) {
  const events = useLiveQuery(
    () => db.auditEvents
      .where('inspectionId')
      .equals(inspectionId)
      .sortBy('createdAt'),
    [inspectionId]
  );

  const users = useLiveQuery(() => db.users.toArray(), []);
  const userMap = Object.fromEntries(users?.map(u => [u.id, u]) ?? []);

  if (!events?.length) {
    return (
      <div className="text-center text-zinc-400 py-12 bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-sm">
        <Clock size={32} className="mx-auto mb-2 text-zinc-300" />
        <p className="font-semibold text-sm">No history yet for this inspection.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
      <h3 className="text-base font-bold text-zinc-900 mb-5">Immutable Audit Timeline</h3>
      <div className="flex flex-col">
        {events.map((event, idx) => {
          const config = getEventConfig(event.action);
          const Icon = config.icon;
          const author = userMap[event.userId];
          const isLast = idx === events.length - 1;

          return (
            <div key={event.id} className="flex gap-3.5" id={`audit-event-${event.id}`}>
              {/* Timeline track */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${config.bg} ${config.border}`}>
                  <Icon size={14} className={config.color} />
                </div>
                {!isLast && <div className="w-px flex-1 bg-zinc-200 my-1" />}
              </div>

              {/* Content */}
              <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-bold text-zinc-900">{config.label}</span>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>

                <div className="mt-0.5 text-xs text-zinc-500 font-medium">
                  <span className="font-semibold text-zinc-800">{author?.fullName ?? 'System'}</span>
                  {' · '}
                  <span className="font-mono text-zinc-400">{event.entityType}</span>
                </div>

                {/* Before → After value */}
                {(event.beforeValue !== undefined || event.afterValue !== undefined) && (
                  <div className="mt-2.5 bg-zinc-50 border border-zinc-200/70 rounded-xl p-3 text-xs space-y-1">
                    {event.beforeValue && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 font-medium">Before:</span>
                        <code className="text-rose-600 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-rose-200">
                          {event.beforeValue}
                        </code>
                      </div>
                    )}
                    {event.afterValue && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 font-medium">After:</span>
                        <code className="text-emerald-600 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                          {event.afterValue}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const EVENT_CONFIGS: Record<AuditAction, {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  bg: string;
  border: string;
  color: string;
}> = {
  CREATED: { label: 'Record Created', icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', color: 'text-emerald-700' },
  UPDATED: { label: 'Value Updated', icon: Edit3, bg: 'bg-sky-50', border: 'border-sky-200', color: 'text-sky-700' },
  DELETED: { label: 'Record Deleted', icon: AlertTriangle, bg: 'bg-rose-50', border: 'border-rose-200', color: 'text-rose-700' },
  CONFLICT_DETECTED: { label: 'Conflict Detected', icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', color: 'text-amber-700' },
  CONFLICT_RESOLVED: { label: 'Conflict Resolved', icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', color: 'text-emerald-700' },
  SYNCED: { label: 'Synchronized', icon: UploadCloud, bg: 'bg-indigo-50', border: 'border-indigo-200', color: 'text-indigo-700' },
  UPLOADED: { label: 'Uploaded to Cloud', icon: UploadCloud, bg: 'bg-indigo-50', border: 'border-indigo-200', color: 'text-indigo-700' },
  NOTE_ADDED: { label: 'Note Added', icon: FileText, bg: 'bg-purple-50', border: 'border-purple-200', color: 'text-purple-700' },
  PHOTO_ADDED: { label: 'Photo Captured', icon: Camera, bg: 'bg-indigo-50', border: 'border-indigo-200', color: 'text-indigo-700' },
  PHOTO_UPLOADED: { label: 'Photo Uploaded', icon: UploadCloud, bg: 'bg-sky-50', border: 'border-sky-200', color: 'text-sky-700' },
  INSPECTION_OPENED: { label: 'Inspection Opened', icon: FileText, bg: 'bg-zinc-50', border: 'border-zinc-200', color: 'text-zinc-600' },
  INSPECTION_COMPLETED: { label: 'Inspection Completed', icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', color: 'text-emerald-700' },
};

function getEventConfig(action: AuditAction) {
  return EVENT_CONFIGS[action] ?? {
    label: action.replace('_', ' '),
    icon: Clock,
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
    color: 'text-zinc-600',
  };
}

function formatDateTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    second: '2-digit',
  });
}
