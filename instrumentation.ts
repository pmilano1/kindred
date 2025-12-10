/**
 * Next.js Instrumentation Hook
 *
 * IMPORTANT: This file is NOT called automatically by Next.js on AWS App Runner.
 * Instead, it is explicitly called by scripts/start.sh before the server starts.
 *
 * Why we use explicit execution:
 * - Next.js instrumentation hooks don't work reliably on all deployment platforms
 * - AWS App Runner doesn't trigger the instrumentation hook automatically
 * - Explicit execution guarantees migrations run before server starts
 *
 * How it works:
 * 1. Docker builds the app with Next.js standalone output
 * 2. scripts/start.sh explicitly calls register() from this file
 * 3. Migrations run and complete (or fail and prevent server start)
 * 4. Server starts only after migrations succeed
 *
 * This ensures the database schema is always up-to-date when a new
 * version is deployed, without manual intervention.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server, not during build or on edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting, checking migrations...');

    try {
      // Dynamic import to avoid loading during build
      const { pool } = await import('@/lib/pool');
      const { runMigrations } = await import('@/lib/migrations');

      const result = await runMigrations(pool);

      if (result.success) {
        console.log('[Instrumentation] Migrations complete:', result.message);
      } else {
        console.error('[Instrumentation] Migration failed:', result.message);
      }

      // Bootstrap admin user if INITIAL_ADMIN_PASSWORD is set and no admin exists
      await bootstrapAdminUser(pool);
    } catch (error) {
      // Don't crash the server if migrations fail - log and continue
      // The app may still work for read operations
      console.error('[Instrumentation] Migration error:', error);
    }
  }
}

/**
 * Bootstrap initial admin user from environment variables.
 * Only creates user if:
 * - INITIAL_ADMIN_PASSWORD env var is set
 * - No admin user exists in database
 *
 * Default email: admin@kindred.local (override with INITIAL_ADMIN_EMAIL)
 */
async function bootstrapAdminUser(
  pool: import('pg').Pool,
): Promise<void> {
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initialPassword) {
    return; // No bootstrap requested
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@kindred.local';

  try {
    // Check if any admin exists
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
    );

    if (adminCheck.rows.length > 0) {
      console.log('[Bootstrap] Admin user already exists, skipping bootstrap');
      return;
    }

    // Check if this specific email already exists
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail],
    );

    if (emailCheck.rows.length > 0) {
      console.log('[Bootstrap] User with bootstrap email already exists');
      return;
    }

    // Create admin user
    const bcrypt = await import('bcryptjs');

    const passwordHash = await bcrypt.hash(initialPassword, 12);
    // Use Web Crypto API instead of node:crypto for Edge Runtime compatibility
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const userId = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    await pool.query(
      `INSERT INTO users (id, email, name, role, password_hash, auth_provider, require_password_change, created_at)
       VALUES ($1, $2, $3, 'admin', $4, 'local', true, NOW())`,
      [userId, adminEmail, 'Admin', passwordHash],
    );

    console.log(`[Bootstrap] Created initial admin user: ${adminEmail}`);
    console.log('[Bootstrap] Password change required on first login');
  } catch (error) {
    console.error('[Bootstrap] Failed to create admin user:', error);
  }
}

