/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts (not during build)
 *
 * Used to run database migrations automatically on deployment.
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
    } catch (error) {
      // Don't crash the server if migrations fail - log and continue
      // The app may still work for read operations
      console.error('[Instrumentation] Migration error:', error);
    }
  }
}

