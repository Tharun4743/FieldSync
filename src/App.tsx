import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import AppShell from '@/components/layout/AppShell';
import RequireRole from '@/components/auth/RequireRole';
import LoginPage from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import InspectionList from '@/pages/InspectionList';
import InspectionDetail from '@/pages/InspectionDetail';
import ConflictCenter from '@/pages/ConflictCenter';
import SyncCenter from '@/pages/SyncCenter';
import AuditHistory from '@/pages/AuditHistory';
import AdminPanel from '@/pages/AdminPanel';
import Profile from '@/pages/Profile';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Loading FieldSync...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const initSync = useSyncStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
    initSync();
  }, [initialize, initSync]);

  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="inspections" element={<InspectionList />} />
            <Route path="inspections/:id" element={<InspectionDetail />} />
            <Route path="inspections/:id/history" element={<AuditHistory />} />
            <Route path="conflicts" element={<ConflictCenter />} />
            <Route path="sync" element={<SyncCenter />} />
            <Route path="admin" element={
              <RequireRole roles={['ADMIN']}>
                <AdminPanel />
              </RequireRole>
            } />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
