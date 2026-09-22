import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * Verify a Supabase JWT from the Authorization header.
 * Returns the authenticated user or throws.
 */
export async function requireAuth(req: VercelRequest): Promise<{
  userId: string;
  email: string;
  role: string;
}> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);

  // Verify token using Supabase anon client with the JWT
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) {
    throw new AuthError('Invalid or expired token', 401);
  }

  const role = (user.user_metadata?.['role'] as string) ?? 'TECHNICIAN';

  return { userId: user.id, email: user.email ?? '', role };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function requireRole(userRole: string, requiredRole: 'TECHNICIAN' | 'SUPERVISOR' | 'ADMIN'): void {
  const hierarchy = { TECHNICIAN: 1, SUPERVISOR: 2, ADMIN: 3 };
  const userLevel = hierarchy[userRole as keyof typeof hierarchy] ?? 0;
  const requiredLevel = hierarchy[requiredRole];

  if (userLevel < requiredLevel) {
    throw new AuthError(`Role ${requiredRole} required, got ${userRole}`, 403);
  }
}

export function handleError(res: VercelResponse, err: unknown): void {
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({ error: err.message, code: 'AUTH_ERROR' });
    return;
  }
  console.error('[API Error]', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
