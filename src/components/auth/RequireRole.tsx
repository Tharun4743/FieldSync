import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/db';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RequireRoleProps {
  /** Roles that are permitted to access this route */
  roles: UserRole[];
  children: React.ReactNode;
}

/**
 * RequireRole — wraps protected routes.
 *
 * If the current user's role is NOT in the allowed list,
 * renders a styled 403 Access Denied page instead of the children.
 *
 * Usage:
 *   <RequireRole roles={['ADMIN']}>
 *     <AdminPanel />
 *   </RequireRole>
 */
export default function RequireRole({ roles, children }: RequireRoleProps) {
  const { user, isLoading, isAuthenticated } = useAuthStore();

  // Still initializing — don't flash a 403 prematurely
  if (isLoading) return null;

  // Not authenticated at all — redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Role is in the allowed list — render normally
  if (roles.includes(user.role)) {
    return <>{children}</>;
  }

  // Role not allowed — render 403 page
  return <AccessDeniedPage userRole={user.role} allowedRoles={roles} />;
}

// ── 403 Access Denied page ──────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'Customer',
  TECHNICIAN: 'Field Technician',
  SUPERVISOR: 'Site Supervisor',
  ADMIN: 'System Administrator',
};

const ROLE_COLORS: Record<UserRole, string> = {
  CUSTOMER: 'bg-amber-50 text-amber-800 border-amber-200',
  TECHNICIAN: 'bg-sky-50 text-sky-700 border-sky-200',
  SUPERVISOR: 'bg-purple-50 text-purple-700 border-purple-200',
  ADMIN: 'bg-orange-50 text-orange-700 border-orange-200',
};

function AccessDeniedPage({
  userRole,
  allowedRoles,
}: {
  userRole: UserRole;
  allowedRoles: UserRole[];
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      {/* Icon */}
      <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-6 shadow-sm">
        <ShieldX size={36} className="text-rose-500" />
      </div>

      {/* Heading */}
      <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight mb-2">
        Access Denied
      </h1>
      <p className="text-zinc-500 text-sm font-medium max-w-sm mb-6">
        You don't have permission to view this page. This area requires a higher
        privilege level.
      </p>

      {/* Role info */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 max-w-xs w-full shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-semibold">Your Role</span>
          <span
            className={`px-2.5 py-0.5 rounded-full font-bold border text-xs ${ROLE_COLORS[userRole]}`}
          >
            {ROLE_LABELS[userRole]}
          </span>
        </div>
        <div className="flex items-start justify-between text-xs gap-2">
          <span className="text-zinc-500 font-semibold shrink-0">Required</span>
          <div className="flex flex-wrap gap-1 justify-end">
            {allowedRoles.map((r) => (
              <span
                key={r}
                className={`px-2.5 py-0.5 rounded-full font-bold border ${ROLE_COLORS[r]}`}
              >
                {ROLE_LABELS[r]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-zinc-900 text-white hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer shadow-xs"
        id="btn-access-denied-back"
      >
        <ArrowLeft size={16} />
        Go Back
      </button>
    </div>
  );
}
