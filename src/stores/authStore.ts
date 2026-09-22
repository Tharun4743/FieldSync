import { create } from 'zustand';
import { supabase } from '@/lib/auth/supabaseClient';
import { db } from '@/lib/db/schema';
import { bootstrapDevice } from '@/lib/db/device';
import { LogicalClock } from '@/lib/db/logicalClock';
import { syncManager } from '@/lib/sync/syncManager';
import { connectivity } from '@/lib/connectivity/healthCheck';
import { ensureDefaultUsers } from '@/lib/db/seed';
import { ensureLocalSeedIfEmpty, syncFromSupabase } from '@/lib/sync/cloudSync';
import type { UserRecord, UserRole } from '@/types/db';

export function resolveUserRole(email?: string, metaRole?: string): UserRole {
  const normalized = (metaRole ?? '').toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'SUPERVISOR' || normalized === 'TECHNICIAN' || normalized === 'CUSTOMER') {
    return normalized as UserRole;
  }
  // If no explicit database metadata role, check standard role keywords in email
  const em = (email ?? '').toLowerCase();
  if (em.includes('admin')) return 'ADMIN';
  if (em.includes('supervisor')) return 'SUPERVISOR';
  if (em.includes('customer') || em.includes('client')) return 'CUSTOMER';
  return 'TECHNICIAN';
}

interface AuthState {
  user: UserRecord | null;
  session: { access_token: string; expires_at?: number } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  deviceId: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
}

/**
 * Auth store — manages Supabase session and offline user state.
 *
 * Offline behavior:
 *   - Session is cached in localStorage by Supabase SDK
 *   - User profile is cached in IndexedDB (this store reads from there)
 *   - If session expires while offline, we continue with cached user
 *   - Auth refresh is only attempted when online
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  deviceId: null,

  initialize: async () => {
    set({ isLoading: true });

    try {
      // 0. Ensure default users and real sample inspections exist in local DB
      await ensureDefaultUsers();
      await ensureLocalSeedIfEmpty();

      // 1. Bootstrap device ID (once per installation)
      const deviceId = await bootstrapDevice();

      // 2. Initialize logical clock
      await LogicalClock.initialize();

      // 3. Check for existing Supabase session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Load or cache user profile
        const user = await loadOrCacheUserProfile(session.user.id, session.access_token);

        set({
          user,
          session: {
            access_token: session.access_token,
            expires_at: session.expires_at,
          },
          isAuthenticated: true,
          deviceId,
          isLoading: false,
        });

        // Sync live data from Supabase in background
        void syncFromSupabase();

        // Start sync manager with auth token
        syncManager.setAuthToken(session.access_token);
        connectivity.start();
        syncManager.start();
      } else {
        // Check if we have a cached user in IndexedDB (for offline-after-logout)
        const cachedUser = await loadCachedUser();
        if (cachedUser) {
          // Ensure role is consistent
          const resolvedRole = resolveUserRole(cachedUser.email, cachedUser.role);
          if (cachedUser.role !== resolvedRole) {
            cachedUser.role = resolvedRole;
            await db.users.put(cachedUser);
          }
          set({
            user: cachedUser,
            session: null,
            isAuthenticated: false, // No valid session — UI will prompt re-login
            deviceId,
            isLoading: false,
          });
        } else {
          set({ isLoading: false, deviceId });
        }
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const user = await loadOrCacheUserProfile(session.user.id, session.access_token);
          set({
            user,
            session: { access_token: session.access_token, expires_at: session.expires_at },
            isAuthenticated: true,
          });
          void syncFromSupabase();
          syncManager.setAuthToken(session.access_token);
          await syncManager.syncNow();
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, session: null, isAuthenticated: false });
          syncManager.setAuthToken(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          set({ session: { access_token: session.access_token, expires_at: session.expires_at } });
          syncManager.setAuthToken(session.access_token);
        }
      });
    } catch (err) {
      console.error('[AuthStore] Initialization error:', err);
      set({ isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('No session returned');

      const user = await loadOrCacheUserProfile(data.user.id, data.session.access_token);
      set({
        user,
        session: { access_token: data.session.access_token, expires_at: data.session.expires_at },
        isAuthenticated: true,
      });

      syncManager.setAuthToken(data.session.access_token);
      void syncManager.syncNow();

      return { error: null };
    } catch (err: unknown) {
      // Offline fallback: check local IndexedDB
      const localUsers = await db.users.where('email').equalsIgnoreCase(email.trim()).toArray();
      if (localUsers.length > 0) {
        const localUser = localUsers[0];
        set({
          user: localUser,
          session: null,
          isAuthenticated: true,
        });
        return { error: null };
      }
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  },

  login: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('No session returned');

      const user = await loadOrCacheUserProfile(data.user.id, data.session.access_token);
      set({
        user,
        session: { access_token: data.session.access_token, expires_at: data.session.expires_at },
        isAuthenticated: true,
      });

      syncManager.setAuthToken(data.session.access_token);
      void syncManager.syncNow();
    } catch (err: unknown) {
      // Offline fallback: check local IndexedDB for matching user
      const localUsers = await db.users.where('email').equalsIgnoreCase(email.trim()).toArray();
      if (localUsers.length > 0) {
        const localUser = localUsers[0];
        console.info('[AuthStore] Logging in as local user:', localUser.fullName, localUser.role);
        set({
          user: localUser,
          session: null,
          isAuthenticated: true,
        });
        return;
      }
      throw err instanceof Error ? err : new Error('Failed to login. Please verify credentials.');
    }
  },

  switchRole: async (newRole: UserRole) => {
    // Look up default seed user for this role
    const matchingUser = await db.users.where('role').equals(newRole).first();
    if (matchingUser) {
      set({ user: matchingUser });
      console.info(`[AuthStore] Switched active user to ${matchingUser.fullName} (${newRole})`);
      return;
    }
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    const updated: UserRecord = {
      ...currentUser,
      role: newRole,
      updatedAt: new Date().toISOString(),
    };
    await db.users.put(updated);
    set({ user: updated });
    console.info(`[AuthStore] Active user role switched to ${newRole}`);
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthStore] Supabase signOut error (likely offline):', err);
    }
    syncManager.setAuthToken(null);
    set({ user: null, session: null, isAuthenticated: false });
  },
}));

// ── Helpers ────────────────────────────────────────────────────

async function loadOrCacheUserProfile(userId: string, _accessToken: string): Promise<UserRecord> {
  // Try local cache first
  const cached = await db.users.get(userId);
  if (cached && cached.email && !cached.email.includes('offline.local')) {
    const expectedRole = resolveUserRole(cached.email, cached.role);
    if (cached.role !== expectedRole) {
      cached.role = expectedRole;
      await db.users.put(cached);
    }
    return cached;
  }

  // Fetch real authenticated user profile from Supabase Auth
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === userId) {
      const email = user.email ?? 'user@fieldsync.io';
      const role = resolveUserRole(email, user.user_metadata?.role as string);
      const profile: UserRecord = {
        id: user.id,
        email,
        fullName: (user.user_metadata?.full_name as string) || (email.split('@')[0] ?? 'User'),
        role,
        createdAt: user.created_at ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.users.put(profile);
      return profile;
    }
  } catch (err) {
    console.warn('[AuthStore] Failed to fetch Supabase user metadata:', err);
  }

  // Fallback if network offline and not yet cached
  const profile: UserRecord = {
    id: userId,
    email: 'user@fieldsync.io',
    fullName: 'Field User',
    role: 'TECHNICIAN' as UserRole,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return profile;
}

async function loadCachedUser(): Promise<UserRecord | undefined> {
  return db.users.toCollection().first();
}
