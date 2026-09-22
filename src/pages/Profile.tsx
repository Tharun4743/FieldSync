import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  Smartphone,
  Mail,
  LogOut,
  Database,
  Wifi,
} from 'lucide-react';

export default function Profile() {
  const { user, deviceId, signOut } = useAuthStore();
  const { status, pendingOperations, pendingMedia } = useSyncStore();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5">
          <User className="text-indigo-600" />
          Account Profile
        </h1>
        <p className="text-zinc-500 text-xs sm:text-sm font-medium mt-1">
          Identity, device binding, and active synchronization state.
        </p>
      </div>

      <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* User Badge */}
        <div className="flex items-center gap-4 pb-6 border-b border-zinc-100">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-2xl font-black shadow-xs">
            {user?.fullName?.charAt(0) ?? 'U'}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-zinc-900 truncate">{user?.fullName ?? 'Field User'}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {user?.role ?? 'TECHNICIAN'}
              </span>
              <span className="text-xs font-medium text-zinc-500 flex items-center gap-1">
                <Mail size={12} className="text-zinc-400" /> {user?.email}
              </span>
            </div>
          </div>
        </div>

        {/* Device Information */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Device & Session Diagnostics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 font-semibold flex items-center gap-1.5 mb-1">
                <Smartphone size={14} className="text-zinc-400" /> Bound Device ID
              </span>
              <span className="font-mono text-zinc-900 font-bold break-all">
                {deviceId ?? 'device-local'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 font-semibold flex items-center gap-1.5 mb-1">
                <Wifi size={14} className="text-zinc-400" /> Network Status
              </span>
              <span className="font-bold text-zinc-900">{status}</span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 font-semibold flex items-center gap-1.5 mb-1">
                <Database size={14} className="text-zinc-400" /> Unsynced Cache
              </span>
              <span className="font-bold text-zinc-900 font-mono">
                {pendingOperations} ops · {pendingMedia} photos
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-zinc-500 font-semibold flex items-center gap-1.5 mb-1">
                <Shield size={14} className="text-zinc-400" /> Authorization Role
              </span>
              <span className="font-bold text-zinc-900">{user?.role ?? 'TECHNICIAN'}</span>
            </div>
          </div>
        </div>

        {/* Logout Action */}
        <div className="pt-2 border-t border-zinc-100 space-y-4">
          <button
            onClick={() => void handleSignOut()}
            className="w-full h-11 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={16} /> Sign Out of FieldSync
          </button>

          <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs font-medium">
            <img src="/logo.jpeg" alt="FieldSync" className="w-4 h-4 rounded-md object-cover" />
            <span>FieldSync Offline-First Platform · Academic Release</span>
          </div>
        </div>
      </div>
    </div>
  );
}
