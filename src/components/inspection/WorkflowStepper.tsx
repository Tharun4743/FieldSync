import type { Inspection } from '@/types/db';
import {
  AlertCircle,
  ShieldCheck,
  ClipboardList,
  Wrench,
  CheckCircle2,
  CheckCheck,
  Clock
} from 'lucide-react';

interface Props {
  inspection: Inspection;
  className?: string;
}

export default function WorkflowStepper({ inspection, className = '' }: Props) {
  // Determine current active stage index (0 to 5)
  // Stages:
  // 0: RAISED (Customer)
  // 1: ASSIGNED (Admin)
  // 2: COORDINATED (Supervisor)
  // 3: FIELD_WORK (Technician)
  // 4: AWAITING_VERIFICATION (Supervisor to verify)
  // 5: RESOLVED (Customer resolved)

  const stage = inspection.workflowStage ?? (
    inspection.status === 'COMPLETED' ? 'RESOLVED' :
    inspection.status === 'IN_PROGRESS' ? 'FIELD_WORK' :
    (inspection.assignedTo?.length > 0 ? 'ASSIGNED' : 'RAISED')
  );

  const getStageIndex = (): number => {
    switch (stage) {
      case 'RAISED': return 0;
      case 'ASSIGNED': return 1;
      case 'COORDINATED': return 2;
      case 'FIELD_WORK':
      case 'REWORK_REQUESTED': return 3;
      case 'AWAITING_VERIFICATION': return 4;
      case 'RESOLVED': return 5;
      default: return 0;
    }
  };

  const currentIndex = getStageIndex();

  const steps = [
    {
      id: 'RAISED',
      stepNum: 1,
      title: 'Customer Issue',
      actor: 'Customer',
      subtitle: inspection.reportedBy || 'Customer Reported',
      timestamp: inspection.createdAt,
      icon: AlertCircle,
      activeColor: 'text-amber-600 bg-amber-50 border-amber-300',
      doneColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    },
    {
      id: 'ASSIGNED',
      stepNum: 2,
      title: 'Admin Assigned',
      actor: 'Admin',
      subtitle: inspection.assignedTo?.length > 0 
        ? `${inspection.supervisorId ? 'Supervisor + ' : ''}${inspection.assignedTo.length} Tech`
        : 'Pending Admin',
      timestamp: inspection.assignedAt,
      icon: ShieldCheck,
      activeColor: 'text-indigo-600 bg-indigo-50 border-indigo-300',
      doneColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    },
    {
      id: 'COORDINATED',
      stepNum: 3,
      title: 'Supervisor Review',
      actor: 'Supervisor',
      subtitle: inspection.supervisedAt ? 'Coordinated & Ready' : (inspection.supervisorName || 'Awaiting Supervisor'),
      timestamp: inspection.supervisedAt,
      icon: ClipboardList,
      activeColor: 'text-purple-600 bg-purple-50 border-purple-300',
      doneColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    },
    {
      id: 'FIELD_WORK',
      stepNum: 4,
      title: 'Technician Work',
      actor: 'Technician',
      subtitle: stage === 'AWAITING_VERIFICATION' || stage === 'RESOLVED' 
        ? 'Field Work Completed' 
        : 'Inspecting On-Site',
      timestamp: inspection.technicianCompletedAt || inspection.updatedAt,
      icon: Wrench,
      activeColor: 'text-sky-600 bg-sky-50 border-sky-300',
      doneColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    },
    {
      id: 'AWAITING_VERIFICATION',
      stepNum: 5,
      title: 'Verify Completion',
      actor: 'Supervisor',
      subtitle: inspection.verifiedAt ? `Verified by ${inspection.verifiedByName || 'Supervisor'}` : 'Verification Pending',
      timestamp: inspection.verifiedAt,
      icon: CheckCircle2,
      activeColor: 'text-violet-600 bg-violet-50 border-violet-300',
      doneColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    },
    {
      id: 'RESOLVED',
      stepNum: 6,
      title: 'Resolved',
      actor: 'Customer',
      subtitle: stage === 'RESOLVED' ? 'Sign-Off Complete' : 'Awaiting Resolution',
      timestamp: inspection.verifiedAt || inspection.updatedAt,
      icon: CheckCheck,
      activeColor: 'text-emerald-600 bg-emerald-50 border-emerald-300',
      doneColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    },
  ];

  return (
    <div className={`bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-zinc-100 gap-2">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block mb-0.5">
            Operational Lifecycle Flow
          </span>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-zinc-900">
              Customer Complaint to Resolution
            </h4>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
              Step {currentIndex + 1} of 6
            </span>
          </div>
        </div>

        {/* Current Turn Actor Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium">Current Action:</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 shadow-2xs ${
            currentIndex === 0 ? 'bg-amber-50 text-amber-800 border-amber-200' :
            currentIndex === 1 ? 'bg-orange-50 text-orange-800 border-orange-200' :
            currentIndex === 2 ? 'bg-purple-50 text-purple-800 border-purple-200' :
            currentIndex === 3 ? 'bg-sky-50 text-sky-800 border-sky-200' :
            currentIndex === 4 ? 'bg-violet-50 text-violet-800 border-violet-200' :
            'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            <span className="w-2 h-2 rounded-full animate-pulse bg-current" />
            {steps[currentIndex].actor}: {steps[currentIndex].title}
          </span>
        </div>
      </div>

      {/* Stepper Nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {steps.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`relative rounded-xl p-3 border transition-all flex flex-col justify-between ${
                isCurrent
                  ? 'bg-zinc-900 text-white border-zinc-800 shadow-md ring-2 ring-indigo-500/20'
                  : isDone
                  ? 'bg-emerald-50/50 border-emerald-200/80 text-zinc-800'
                  : 'bg-zinc-50/60 border-zinc-200/60 text-zinc-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                        : isDone
                        ? 'bg-emerald-500 text-white border-emerald-400'
                        : 'bg-zinc-200/70 text-zinc-500 border-zinc-300'
                    }`}
                  >
                    {isDone ? <CheckCheck size={13} /> : <Icon size={13} />}
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                      isCurrent
                        ? 'bg-zinc-800 text-indigo-300'
                        : isDone
                        ? 'bg-emerald-100 text-emerald-800 font-bold'
                        : 'text-zinc-400'
                    }`}
                  >
                    0{step.stepNum}
                  </span>
                </div>

                <p
                  className={`text-[11px] font-bold uppercase tracking-wider block mb-0.5 ${
                    isCurrent ? 'text-indigo-400' : isDone ? 'text-emerald-700' : 'text-zinc-400'
                  }`}
                >
                  {step.actor}
                </p>
                <h5
                  className={`text-xs font-bold leading-tight line-clamp-1 ${
                    isCurrent ? 'text-white' : isDone ? 'text-zinc-900' : 'text-zinc-500'
                  }`}
                >
                  {step.title}
                </h5>
              </div>

              <div className="mt-2.5 pt-2 border-t border-zinc-100/10 text-[10px]">
                <p
                  className={`truncate font-medium ${
                    isCurrent ? 'text-zinc-300' : isDone ? 'text-zinc-600' : 'text-zinc-400'
                  }`}
                >
                  {step.subtitle}
                </p>
                {step.timestamp && (
                  <p
                    className={`text-[9px] mt-0.5 flex items-center gap-1 ${
                      isCurrent ? 'text-zinc-400' : 'text-zinc-400'
                    }`}
                  >
                    <Clock size={9} />
                    {new Date(step.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
