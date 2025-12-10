import { pool } from '../../pool';
import type { Person } from '../../types';
import type { Loaders } from '../dataloaders';

// ===========================================
// TYPES
// ===========================================
export interface Context {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  loaders: Loaders;
}

// ===========================================
// QUERY CACHING
// ===========================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache for expensive queries
const queryCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCached<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  queryCache.set(key, { data, timestamp: Date.now() });
  // Limit cache size to prevent memory issues
  if (queryCache.size > 1000) {
    const oldest = queryCache.keys().next().value;
    if (oldest) queryCache.delete(oldest);
  }
}

// Clear cache when data changes (called from mutations)
export function clearQueryCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
    }
  }
}

// ===========================================
// AUTHENTICATION
// ===========================================
export function requireAuth(
  context: Context,
  requiredRole: 'viewer' | 'editor' | 'admin' = 'viewer',
) {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  if (requiredRole === 'admin' && context.user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  if (
    requiredRole === 'editor' &&
    !['admin', 'editor'].includes(context.user.role)
  ) {
    throw new Error('Editor access required');
  }
  return context.user;
}

// ===========================================
// CURSOR PAGINATION
// ===========================================
export const encodeCursor = (id: string) => Buffer.from(id).toString('base64');
export const decodeCursor = (cursor: string) =>
  Buffer.from(cursor, 'base64').toString('utf-8');

// ===========================================
// DATABASE HELPERS
// ===========================================
export async function getPerson(id: string): Promise<Person | null> {
  const { rows } = await pool.query(
    `SELECT *, COALESCE(notes, description) as description FROM people WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

export async function getFamily(id: string) {
  const { rows } = await pool.query('SELECT * FROM families WHERE id = $1', [
    id,
  ]);
  return rows[0] || null;
}
