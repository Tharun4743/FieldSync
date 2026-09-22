import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { Inspection } from '@/types/db';

interface SlaCountdownBadgeProps {
  inspection: Inspection;
}

export default function SlaCountdownBadge({ inspection }: SlaCountdownBadgeProps) {
  const [, setTick] = useState(0);

  // Re-render every 30 seconds for live countdown
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const isResolved = inspection.status === 'COMPLETED' || inspection.workflowStage === 'RESOLVED';
  if (isResolved) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
        <CheckCircle2 size={12} /> SLA Met
      </span>
    );
  }

  // Calculate resolution SLA based on priority if deadline not explicitly set
  // Critical: 4h, High: 8h, Medium: 24h, Low: 48h
  const hoursByPriority: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 8,
    MEDIUM: 24,
    LOW: 48,
  };
  const durationHours = hoursByPriority[inspection.priority || 'MEDIUM'] || 24;
  const createdAtMs = new Date(inspection.createdAt).getTime();
  const deadlineMs = inspection.resolutionDeadline
    ? new Date(inspection.resolutionDeadline).getTime()
    : createdAtMs + durationHours * 3600 * 1000;

  const nowMs = Date.now();
  const diffMs = deadlineMs - nowMs;
  const isBreached = diffMs <= 0;

  const hoursRemaining = Math.max(0, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60)));

  if (isBreached) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse shadow-xs">
        <AlertTriangle size={12} className="text-rose-600" />
        SLA Breached ({hoursRemaining}h {minutesRemaining}m overdue)
      </span>
    );
  }

  // At risk if less than 25% or < 2 hours remaining
  const isAtRisk = diffMs < 2 * 3600 * 1000;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${
        isAtRisk
          ? 'bg-amber-50 text-amber-800 border-amber-300'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
      }`}
    >
      {isAtRisk ? <ShieldAlert size={12} className="text-amber-600" /> : <Clock size={12} className="text-emerald-600" />}
      <span>
        SLA: {hoursRemaining}h {minutesRemaining}m left
      </span>
    </span>
  );
}
