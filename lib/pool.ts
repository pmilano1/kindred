import { Pool } from 'pg';

// Lazy pool initialization - created on first use with runtime env vars
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl) {
      // AWS RDS - use SSL with self-signed cert support
      console.log('[DB] Connecting via DATABASE_URL with SSL');
      _pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
      });
    } else {
      // Local Docker - no SSL
      const host = process.env.DB_HOST || 'shared-data_postgres';
      console.log('[DB] Connecting to', host);
      _pool = new Pool({
        host,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'genealogy',
        user: process.env.DB_USER || 'genealogy',
        password: process.env.DB_PASSWORD || 'GenTree2024!',
      });
    }
  }
  return _pool;
}

// Proxy to defer pool creation until first use (runtime, not build time)
const pool = new Proxy({} as Pool, {
  get(_, prop) {
    const realPool = getPool();
    const value = (realPool as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(realPool) : value;
  }
});

export { pool };

