import { useState } from 'react';
import { db } from '@/lib/db/database';
import { useAuthStore } from '@/stores/authStore';
import { createOperation } from '@/lib/db/repositories/operations';
import { createAuditEvent } from '@/lib/db/repositories/auditEvents';
import { syncManager } from '@/lib/sync/syncManager';
import { Clock, AlertTriangle, ShieldAlert, Flame } from 'lucide-react';
import type { Inspection } from '@/types/db';

interface SlaManagementTabProps {
  inspection: Inspection;
}

export default function SlaManagementTab({ inspection }: SlaManagementTabProps) {
  const { user } = useAuthStore();
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalateSuccess, setEscalateSuccess] = useState(false);

  // Targets by priority
  const targets: Record<string, { responseH: number; resolutionH: number }> = {
    CRITICAL: { responseH: 0.25, resolutionH: 4 },
    HIGH: { responseH: 1, resolutionH: 8 },
    MEDIUM: { responseH: 4, resolutionH: 24 },
    LOW: { responseH: 8, resolutionH: 48 },
  };

  const priority = inspection.priority || 'MEDIUM';
  const currentTarget = targets[priority] || targets.MEDIUM;

  const createdAtMs = new Date(inspection.createdAt).getTime();
  const resolutionDeadlineMs = inspection.resolutionDeadline
    ? new Date(inspection.resolutionDeadline).getTime()
    : createdAtMs + currentTarget.resolutionH * 3600 * 1000;

  const nowMs = Date.now();
  const diffMs = resolutionDeadlineMs - nowMs;
  const isBreached = diffMs <= 0;
  const isResolved = inspection.status === 'COMPLETED' || inspection.workflowStage === 'RESOLVED';

  const hoursRemaining = Math.max(0, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60)));

  const currentLevel = inspection.escalationLevel ?? 0;

  const handleEscalate = async () => {
    if (!user) return;
    setIsEscalating(true);
    try {
      const nextLevel = Math.min(2, currentLevel + 1) as 0 | 1 | 2;
      const now = new Date().toISOString();

      await db.inspections.update(inspection.id, {
        escalationLevel: nextLevel,
        localVersion: (inspection.localVersion ?? 0) + 1,
        updatedAt: now,
        syncStatus: 'PENDING',
      });

      await createOperation({
        userId: user.id,
        inspectionId: inspection.id,
        entityType: 'inspection',
        entityId: inspection.id,
        operationType: 'UPDATE',
        payload: {
          id: inspection.id,
          escalationLevel: nextLevel,
          escalatedBy: user.fullName,
          escalatedAt: now,
        },
      });

      await createAuditEvent({
        userId: user.id,
        userName: user.fullName,
        inspectionId: inspection.id,
        entityType: 'SLA',
        entityId: inspection.id,
        action: 'UPDATED',
        field: 'escalationLevel',
        beforeValue: String(currentLevel),
        afterValue: `Escalated to Tier ${nextLevel} by ${user.fullName}`,
      });

      setEscalateSuccess(true);
      setTimeout(() => setEscalateSuccess(false), 4000);
      void syncManager.syncNow();
    } catch (err) {
      console.error('Failed to escalate ticket:', err);
    } finally {
      setIsEscalating(false);
    }
  };

  const isSupervisorOrAdmin = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-zinc-900">SLA & Escalation Protocol</h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isResolved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isBreached
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {isResolved ? 'SLA MET' : isBreached ? 'BREACHED' : 'ON TRACK'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time compliance monitoring governed by priority & category policy.
          </p>
        </div>

        {isSupervisorOrAdmin && !isResolved && (
          <button
            type="button"
            onClick={handleEscalate}
            disabled={isEscalating || currentLevel >= 2}
            className="px-4 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-200 transition-all cursor-pointer shrink-0"
          >
            <Flame size={15} />
            {isEscalating ? 'Escalating…' : currentLevel >= 2 ? 'Max Tier 2 (Admin) Active' : 'Trigger SLA Escalation'}
          </button>
        )}
      </div>

      {escalateSuccess && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>Ticket escalated! High-priority alerts dispatched to management.</span>
        </div>
      )}

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Resolution SLA */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold">
            <span>Resolution Target</span>
            <Clock size={15} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">
            {isResolved ? (
              <span className="text-emerald-600">Completed</span>
            ) : isBreached ? (
              <span className="text-rose-600">
                +{hoursRemaining}h {minutesRemaining}m
              </span>
            ) : (
              <span>
                {hoursRemaining}h {minutesRemaining}m
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">
            {isResolved
              ? 'Closed within SLA window'
              : isBreached
              ? 'Resolution overdue — priority escalation recommended'
              : `Target: ${currentTarget.resolutionH}h from issue registration`}
          </p>
        </div>

        {/* Card 2: Initial Response SLA */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold">
            <span>Acknowledge / Response</span>
            <ShieldAlert size={15} className="text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">
            {inspection.assignedAt ? (
              <span className="text-emerald-600">Acknowledged</span>
            ) : (
              <span>{currentTarget.responseH * 60}m</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">
            {inspection.assignedAt
              ? `Assigned on ${new Date(inspection.assignedAt).toLocaleTimeString()}`
              : `Target dispatch window: ${currentTarget.responseH * 60} minutes`}
          </p>
        </div>

        {/* Card 3: Active Escalation Level */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold">
            <span>Escalation Tier</span>
            <Flame size={15} className={currentLevel > 0 ? 'text-rose-600' : 'text-zinc-400'} />
          </div>
          <div className="text-2xl font-bold text-zinc-900">
            {currentLevel === 0 ? (
              <span className="text-zinc-700">Tier 0 (Standard)</span>
            ) : currentLevel === 1 ? (
              <span className="text-amber-600">Tier 1 (Supervisor)</span>
            ) : (
              <span className="text-rose-600">Tier 2 (Executive)</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">
            {currentLevel === 0
              ? 'Handled through ordinary dispatch'
              : currentLevel === 1
              ? 'Supervisor notified for urgent field coordination'
              : 'Direct Admin oversight activated'}
          </p>
        </div>
      </div>

      {/* Escalation Hierarchy Chain */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-4">
        <h4 className="text-sm font-bold text-zinc-900">Active Incident Escalation Chain</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Step 1 */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              currentLevel === 0
                ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-100'
                : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Tier 0</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <h5 className="text-xs font-bold text-zinc-900">Field Technician</h5>
            <p className="text-[11px] text-zinc-500 mt-1">
              Direct dispatch & on-site diagnostic testing. Standard checklist resolution.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              currentLevel === 1
                ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-100'
                : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-amber-600 uppercase">Tier 1</span>
              <span className={`w-2.5 h-2.5 rounded-full ${currentLevel >= 1 ? 'bg-amber-500' : 'bg-zinc-300'}`} />
            </div>
            <h5 className="text-xs font-bold text-zinc-900">Supervisor Escalation</h5>
            <p className="text-[11px] text-zinc-500 mt-1">
              Dispatched if technician is impeded, parts unavailable, or 50% SLA elapsed.
            </p>
          </div>

          {/* Step 3 */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              currentLevel >= 2
                ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-100'
                : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-rose-600 uppercase">Tier 2</span>
              <span className={`w-2.5 h-2.5 rounded-full ${currentLevel >= 2 ? 'bg-rose-500 animate-pulse' : 'bg-zinc-300'}`} />
            </div>
            <h5 className="text-xs font-bold text-zinc-900">Executive / Operations Lead</h5>
            <p className="text-[11px] text-zinc-500 mt-1">
              Breach warning or customer escalation. Emergency vendor dispatch or equipment replacement.
            </p>
          </div>
        </div>
      </div>

      {/* Enterprise SLA Policy Matrix Table */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-3">
        <h4 className="text-sm font-bold text-zinc-900">Standard SLA Matrix by Priority</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Priority Level</th>
                <th className="py-2.5 px-3">Target Response</th>
                <th className="py-2.5 px-3">Resolution Window</th>
                <th className="py-2.5 px-3">Escalation Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              <tr className={priority === 'CRITICAL' ? 'bg-rose-50/50 font-bold' : ''}>
                <td className="py-3 px-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  CRITICAL
                </td>
                <td className="py-3 px-3">15 Minutes</td>
                <td className="py-3 px-3">4 Hours</td>
                <td className="py-3 px-3 text-[11px] text-zinc-500">Tier 1 alert at 1h, Tier 2 at 2h</td>
              </tr>
              <tr className={priority === 'HIGH' ? 'bg-amber-50/50 font-bold' : ''}>
                <td className="py-3 px-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  HIGH
                </td>
                <td className="py-3 px-3">1 Hour</td>
                <td className="py-3 px-3">8 Hours</td>
                <td className="py-3 px-3 text-[11px] text-zinc-500">Tier 1 alert at 4h, Tier 2 at 6h</td>
              </tr>
              <tr className={priority === 'MEDIUM' ? 'bg-indigo-50/50 font-bold' : ''}>
                <td className="py-3 px-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  MEDIUM
                </td>
                <td className="py-3 px-3">4 Hours</td>
                <td className="py-3 px-3">24 Hours</td>
                <td className="py-3 px-3 text-[11px] text-zinc-500">Tier 1 alert at 12h, Tier 2 at 18h</td>
              </tr>
              <tr className={priority === 'LOW' ? 'bg-zinc-50 font-bold' : ''}>
                <td className="py-3 px-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-400" />
                  LOW
                </td>
                <td className="py-3 px-3">8 Hours</td>
                <td className="py-3 px-3">48 Hours</td>
                <td className="py-3 px-3 text-[11px] text-zinc-500">Standard ticket monitoring</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
