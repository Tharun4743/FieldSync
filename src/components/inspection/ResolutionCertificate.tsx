import type { Inspection, Asset } from '@/types/db';
import {
  CheckCircle,
  ShieldCheck,
  Printer,
  MapPin,
  Clock,
  Award
} from 'lucide-react';

interface Props {
  inspection: Inspection;
  asset?: Asset;
}

export default function ResolutionCertificate({ inspection, asset }: Props) {
  const isResolved = inspection.workflowStage === 'RESOLVED' || inspection.status === 'COMPLETED';
  if (!isResolved) return null;

  return (
    <div className="bg-white border-2 border-emerald-500/20 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden print:border-none print:shadow-none print:p-0">
      {/* Decorative certificate watermark/accent */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute right-6 top-6 opacity-10 pointer-events-none">
        <Award size={120} className="text-emerald-700" />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-100 gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle size={10} />
              Issue Formally Resolved &amp; Verified
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            Work Order Resolution &amp; Inspection Certificate
          </h2>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            Certificate ID: <span className="font-mono text-zinc-700 font-bold">{inspection.id.slice(0, 18)}</span>
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="self-start sm:self-auto h-9 px-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 flex items-center gap-2 transition-colors cursor-pointer shadow-2xs print:hidden"
        >
          <Printer size={13} />
          Print / PDF
        </button>
      </div>

      {/* Grid of resolution details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-b border-zinc-100 relative z-10">
        {/* Customer & Issue */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            1. Customer &amp; Defect
          </span>
          <p className="text-sm font-bold text-zinc-900">
            {inspection.reportedBy || 'Customer Reported'}
          </p>
          {inspection.customerPhone && (
            <p className="text-xs text-zinc-500 font-mono">Tel: {inspection.customerPhone}</p>
          )}
          {inspection.customerEmail && (
            <p className="text-xs text-zinc-500 font-mono">{inspection.customerEmail}</p>
          )}
          <p className="text-xs text-zinc-600 mt-2 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 italic">
            "{inspection.customerNotes || inspection.title}"
          </p>
        </div>

        {/* Equipment & Site */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            2. Equipment &amp; Facility
          </span>
          <p className="text-sm font-bold text-zinc-900">
            {asset ? `${asset.name} (${asset.assetCode})` : inspection.title}
          </p>
          <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
            <MapPin size={12} className="text-zinc-400" />
            {inspection.siteName}
          </p>
          {asset && (
            <div className="text-[11px] text-zinc-500 mt-2">
              <span className="block font-medium">Type: {asset.type}</span>
              {asset.location && <span className="block">Loc: {asset.location}</span>}
            </div>
          )}
        </div>

        {/* Verification Sign-Off */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            3. Supervisor Verification
          </span>
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
              <ShieldCheck size={16} className="text-emerald-600" />
              Verified by: {inspection.verifiedByName || 'Authorized Supervisor'}
            </div>
            {inspection.verifiedAt && (
              <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                <Clock size={11} />
                {new Date(inspection.verifiedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            <div className="mt-2 text-[10px] text-emerald-800/80 font-mono">
              Status: CLOSED &amp; OPERATIONAL
            </div>
          </div>
        </div>
      </div>

      {/* Resolution Summary Narrative */}
      <div className="pt-6 relative z-10">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
          Final Engineering Resolution Notes
        </span>
        <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/70 text-xs text-zinc-800 leading-relaxed font-medium">
          {inspection.resolutionSummary ||
            'Work successfully completed, all critical safety parameters tested, and normal operation restored.'}
        </div>
      </div>
    </div>
  );
}
