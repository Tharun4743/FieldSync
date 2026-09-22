import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db/database';
import { useAuthStore } from '../stores/authStore';
import { Search, MapPin, Clock, AlertTriangle } from 'lucide-react';
import type { InspectionStatus, Inspection, Asset, Conflict } from '@/types/db';

type FilterStatus = InspectionStatus | 'ALL';

export default function InspectionsPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  const inspections = useLiveQuery(() => db.inspections.toArray(), []);
  const assets = useLiveQuery(() => db.assets.toArray(), []);
  const conflictCounts = useLiveQuery(async () => {
    const conflicts = await db.conflicts.where('status').equals('PENDING').toArray();
    const counts: Record<string, number> = {};
    conflicts.forEach((c: Conflict) => {
      counts[c.inspectionId] = (counts[c.inspectionId] ?? 0) + 1;
    });
    return counts;
  }, []);

  const assetMap = Object.fromEntries(assets?.map((a: Asset) => [a.id, a]) ?? []);

  const filtered = inspections?.filter((i: Inspection) => {
    const matchesSearch =
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.siteName.toLowerCase().includes(search.toLowerCase()) ||
      assetMap[i.assetId]?.assetCode?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    const matchesUser =
      user?.role === 'ADMIN' ||
      user?.role === 'SUPERVISOR' ||
      i.assignedTo.includes(user?.id ?? '');
    return matchesSearch && matchesStatus && matchesUser;
  });

  const statusOptions: { value: FilterStatus; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Inspections</h1>
        <p className="text-zinc-500 text-xs sm:text-sm font-medium mt-1">
          {filtered?.length ?? 0} inspection{filtered?.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="w-full h-11 pl-10 pr-4 bg-white rounded-xl border border-zinc-200 text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            placeholder="Search inspections, sites, assets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="input-search-inspections"
          />
        </div>

        <div className="flex gap-1 bg-white p-1 rounded-xl border border-zinc-200 shadow-2xs">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inspection List */}
      <div className="space-y-3">
        {filtered?.length === 0 && (
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-12 text-center shadow-sm">
            <p className="text-sm font-semibold text-zinc-500">No inspections found matching criteria.</p>
          </div>
        )}

        {filtered?.map((inspection: Inspection) => {
          const asset = assetMap[inspection.assetId];
          const conflicts = conflictCounts?.[inspection.id] ?? 0;
          const hasUnsynced = inspection.localVersion > inspection.serverVersion;

          return (
            <Link
              key={inspection.id}
              to={`/inspections/${inspection.id}`}
              className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all block group"
              id={`inspection-${inspection.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityBadge(inspection.priority)}`}>
                      {inspection.priority}
                    </span>
                    {hasUnsynced && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Unsynced
                      </span>
                    )}
                    {conflicts > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <AlertTriangle size={10} />
                        {conflicts} conflict{conflicts > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-zinc-900 text-base group-hover:text-indigo-600 transition-colors">
                    {inspection.title}
                  </h3>
                  {asset && (
                    <p className="text-zinc-500 text-xs mt-0.5 font-mono">{asset.assetCode} — {asset.name}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${getStatusBadge(inspection.status)}`}>
                  {inspection.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-zinc-400" />
                  {inspection.siteName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-zinc-400" />
                  {formatDate(inspection.assignedAt)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
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

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
