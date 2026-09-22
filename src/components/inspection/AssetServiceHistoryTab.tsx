import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { History, Wrench, CheckCircle2, Clock, Calendar, ArrowUpRight, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Asset, Inspection } from '@/types/db';

interface AssetServiceHistoryTabProps {
  asset?: Asset;
  currentInspectionId: string;
}

export default function AssetServiceHistoryTab({
  asset,
  currentInspectionId,
}: AssetServiceHistoryTabProps) {
  // Query all past and present inspections for this asset
  const historyInspections = useLiveQuery(
    () =>
      asset?.id
        ? db.inspections
            .where('assetId')
            .equals(asset.id)
            .toArray()
        : [],
    [asset?.id]
  ) as Inspection[] | undefined;

  if (!asset) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-zinc-200 text-zinc-500 text-xs">
        No linked asset record found for this inspection.
      </div>
    );
  }

  // Sort chronologically descending
  const sorted = [...(historyInspections ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const completedCount = sorted.filter(
    (i) => i.status === 'COMPLETED' || i.workflowStage === 'RESOLVED'
  ).length;

  return (
    <div className="space-y-6">
      {/* Asset Technical Card Header */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Cpu size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900">{asset.name}</h3>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {asset.assetCode}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {asset.manufacturer || 'Industrial Spec'} {asset.model ? `• ${asset.model}` : ''} • Location:{' '}
              <span className="font-medium text-zinc-700">{asset.location}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-2xl bg-zinc-50 border border-zinc-200/70 text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Total Service Jobs</span>
            <span className="text-sm font-bold text-zinc-900">{sorted.length} records</span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Resolved</span>
            <span className="text-sm font-bold text-emerald-800">{completedCount} closed</span>
          </div>
        </div>
      </div>

      {/* Service Timeline */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <History size={16} className="text-indigo-600" />
            <h4 className="text-sm font-bold text-zinc-900">Equipment Lifecycle Service History</h4>
          </div>
          <span className="text-xs text-zinc-400">Authoritative audit log</span>
        </div>

        {sorted.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 space-y-1">
            <Wrench size={24} className="mx-auto text-zinc-300 mb-2" />
            <p className="font-semibold text-zinc-600">No previous maintenance logs</p>
            <p className="text-[11px]">This is the initial registered work order for this unit.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-zinc-200 ml-4 space-y-6 pl-6 py-2">
            {sorted.map((item) => {
              const isCurrent = item.id === currentInspectionId;
              const isResolved = item.status === 'COMPLETED' || item.workflowStage === 'RESOLVED';

              return (
                <div key={item.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-[35px] top-1.5 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                      isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-50'
                        : isResolved
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {isResolved ? (
                      <CheckCircle2 size={12} />
                    ) : isCurrent ? (
                      <Wrench size={11} />
                    ) : (
                      <Clock size={11} />
                    )}
                  </div>

                  {/* Card Content */}
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-indigo-50/40 border-indigo-200 shadow-2xs'
                        : 'bg-zinc-50/60 hover:bg-zinc-50 border-zinc-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isResolved
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.workflowStage || item.status}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 bg-white border border-zinc-200 px-1.5 py-0.5 rounded-md">
                            {item.category || 'GENERAL'}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                              Current Ticket
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs sm:text-sm font-bold text-zinc-900">{item.title}</h5>
                      </div>

                      {!isCurrent && (
                        <Link
                          to={`/inspections/${item.id}`}
                          className="w-8 h-8 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors shrink-0"
                          title="Open ticket details"
                        >
                          <ArrowUpRight size={14} />
                        </Link>
                      )}
                    </div>

                    {/* Resolution Summary / Supervisor Notes */}
                    {item.resolutionSummary && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-white border border-zinc-200/70 text-xs text-zinc-700">
                        <span className="text-[10px] font-bold text-emerald-700 block mb-0.5">
                          Remediation Summary:
                        </span>
                        {item.resolutionSummary}
                      </div>
                    )}

                    {/* Metadata Footer */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-200/50 pt-2 flex-wrap gap-2">
                      <span className="flex items-center gap-1 font-medium text-zinc-500">
                        <Calendar size={12} />
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span>
                        Verified by: <strong className="text-zinc-700">{item.verifiedByName || 'Supervisory Team'}</strong>
                      </span>
                      {item.reportedBy && <span>Reported: {item.reportedBy}</span>}
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
