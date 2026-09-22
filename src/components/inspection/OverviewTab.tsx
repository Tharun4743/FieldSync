import type { InspectionRecord, AssetRecord, InspectionResultRecord, ChecklistItemRecord } from '../../types/db.types';
import { MapPin, Calendar, Tag, BarChart3 } from 'lucide-react';
import ResolutionCertificate from './ResolutionCertificate';

interface Props {
  inspection: InspectionRecord;
  asset?: AssetRecord;
  results: InspectionResultRecord[];
  checklistItems: ChecklistItemRecord[];
}

export default function OverviewTab({ inspection, asset, results, checklistItems }: Props) {
  const completedItems = results.filter(r => r.value && r.value !== '').length;
  const totalRequired = checklistItems.filter(i => i.required).length;
  const completedRequired = results.filter(r => {
    const item = checklistItems.find(i => i.id === r.checklistItemId);
    return item?.required && r.value !== '';
  }).length;
  const progress = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Completion</span>
          <span className="text-zinc-900 font-bold text-sm">{progress}%</span>
        </div>
        <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 font-medium mt-2">
          {completedRequired} of {totalRequired} required items completed
          {completedItems !== completedRequired && ` · ${completedItems} total answered`}
        </p>
      </div>

      {/* Resolution Certificate (if resolved) */}
      {(inspection.workflowStage === 'RESOLVED' || inspection.status === 'COMPLETED') && (
        <ResolutionCertificate inspection={inspection} asset={asset} />
      )}

      {/* Customer Issue Details */}
      {(inspection.reportedBy || inspection.customerNotes) && (
        <div className="bg-white border border-amber-200/90 rounded-2xl p-5 shadow-xs bg-gradient-to-r from-amber-50/40 via-white to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
              Customer Complaint
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              Reported by <strong className="text-zinc-900">{inspection.reportedBy || 'Customer'}</strong>
            </span>
          </div>
          {inspection.customerNotes && (
            <p className="text-xs text-zinc-700 bg-white p-3 rounded-xl border border-zinc-200/80 font-medium leading-relaxed">
              "{inspection.customerNotes}"
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-500 font-mono">
            {inspection.customerPhone && <span>Phone: {inspection.customerPhone}</span>}
            {inspection.customerEmail && <span>Email: {inspection.customerEmail}</span>}
          </div>
        </div>
      )}

      {/* Supervisor Coordination Instructions */}
      {inspection.supervisorNotes && (
        <div className="bg-white border border-purple-200 rounded-2xl p-5 shadow-xs bg-gradient-to-r from-purple-50/40 via-white to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
              Supervisor Directives
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              Coordinated by <strong className="text-zinc-900">{inspection.supervisorName || 'Supervisor'}</strong>
            </span>
          </div>
          <p className="text-xs text-zinc-700 bg-white p-3 rounded-xl border border-zinc-200/80 font-medium leading-relaxed">
            "{inspection.supervisorNotes}"
          </p>
        </div>
      )}

      {/* Inspection details */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <h3 className="text-base font-bold text-zinc-900">Inspection Details</h3>

        <div className="grid grid-cols-2 gap-4">
          <InfoRow icon={Tag} label="Status">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(inspection.status)}`}>
              {inspection.status.replace('_', ' ')}
            </span>
          </InfoRow>
          <InfoRow icon={BarChart3} label="Priority">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getPriorityBadge(inspection.priority)}`}>
              {inspection.priority}
            </span>
          </InfoRow>
          <InfoRow icon={MapPin} label="Site">
            <span className="text-zinc-900 font-medium text-sm">{inspection.siteName}</span>
          </InfoRow>
          <InfoRow icon={Calendar} label="Assigned">
            <span className="text-zinc-900 font-medium text-sm">{formatDate(inspection.assignedAt)}</span>
          </InfoRow>
        </div>

        {asset && (
          <>
            <div className="h-px bg-zinc-100" />
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Asset Overview</h4>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow icon={Tag} label="Asset Code">
                <code className="text-indigo-600 font-bold font-mono text-sm bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/60">
                  {asset.assetCode}
                </code>
              </InfoRow>
              <InfoRow icon={MapPin} label="Location">
                <span className="text-zinc-900 font-medium text-sm">{asset.location}</span>
              </InfoRow>
            </div>
          </>
        )}
      </div>

      {/* Sync info */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Sync State & Metadata</h3>
        <div className="flex gap-6 text-xs">
          <div>
            <span className="text-zinc-400 font-medium">Server version</span>
            <p className="text-zinc-900 font-mono font-bold text-sm mt-0.5">{inspection.serverVersion}</p>
          </div>
          <div>
            <span className="text-zinc-400 font-medium">Local version</span>
            <p className={`font-mono font-bold text-sm mt-0.5 ${inspection.localVersion > inspection.serverVersion ? 'text-amber-600' : 'text-zinc-900'}`}>
              {inspection.localVersion}
            </p>
          </div>
          <div>
            <span className="text-zinc-400 font-medium">Last updated</span>
            <p className="text-zinc-900 font-medium mt-0.5">{formatDateTime(inspection.updatedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} />
      </div>
      <div>
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{label}</span>
        {children}
      </div>
    </div>
  );
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'IN_PROGRESS': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'CANCELLED': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'CRITICAL': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'HIGH': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'MEDIUM': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
