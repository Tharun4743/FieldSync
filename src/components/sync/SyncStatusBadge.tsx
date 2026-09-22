import { useSyncStore } from '../../stores/syncStore';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export default function SyncStatusBadge({ compact }: Props) {
  const { status, lastSuccessfulSync, pendingOperations, isSyncing } = useSyncStore();

  const config = {
    ONLINE: {
      label: 'Online',
      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      icon: Wifi,
    },
    OFFLINE: {
      label: 'Offline',
      className: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
      icon: WifiOff,
    },
    SYNCING: {
      label: 'Syncing…',
      className: 'bg-sky-50 text-sky-700 border border-sky-200/80',
      icon: RefreshCw,
    },
    SYNC_ERROR: {
      label: 'Sync Error',
      className: 'bg-rose-50 text-rose-700 border border-rose-200',
      icon: AlertCircle,
    },
  }[status] ?? {
    label: 'Unknown',
    className: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
    icon: WifiOff,
  };

  const Icon = config.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}>
        <Icon size={12} className={isSyncing ? 'animate-spin' : ''} />
        {config.label}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}>
          <Icon size={12} className={isSyncing ? 'animate-spin' : ''} />
          {config.label}
        </span>
        {pendingOperations > 0 && (
          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            {pendingOperations} unsynced
          </span>
        )}
      </div>
      {lastSuccessfulSync && (
        <p className="text-[11px] font-medium text-zinc-500">
          Last sync: {formatTimeAgo(lastSuccessfulSync)}
        </p>
      )}
    </div>
  );
}

function formatTimeAgo(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}
