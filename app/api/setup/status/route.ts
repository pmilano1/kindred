import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

interface SetupStatus {
  configured: boolean;
  database: {
    connected: boolean;
    tablesExist: boolean;
    error?: string;
  };
  auth: {
    configured: boolean;
    googleClientId: boolean;
    googleClientSecret: boolean;
    nextAuthSecret: boolean;
  };
  admin: {
    exists: boolean;
    email?: string;
  };
}

export async function GET() {
  const status: SetupStatus = {
    configured: false,
    database: {
      connected: false,
      tablesExist: false,
    },
    auth: {
      configured: false,
      googleClientId: !!process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      nextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    },
    admin: {
      exists: false,
    },
  };

  // Check auth configuration
  status.auth.configured =
    status.auth.googleClientId &&
    status.auth.googleClientSecret &&
    status.auth.nextAuthSecret;

  // Check database connection
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    status.database.error = 'DATABASE_URL not configured';
    return NextResponse.json(status);
  }

  let pool: Pool | null = null;
  try {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    await pool.query('SELECT 1');
    status.database.connected = true;

    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('people', 'families', 'users')
    `);
    status.database.tablesExist = tablesResult.rows.length >= 3;

    // Check if admin exists
    if (status.database.tablesExist) {
      const adminResult = await pool.query(`
        SELECT email FROM users WHERE role = 'admin' LIMIT 1
      `);
      if (adminResult.rows.length > 0) {
        status.admin.exists = true;
        status.admin.email = adminResult.rows[0].email;
      }
    }
  } catch (error) {
    status.database.error =
      error instanceof Error ? error.message : 'Unknown error';
  } finally {
    if (pool) await pool.end();
  }

  // Overall configured status
  status.configured =
    status.database.connected &&
    status.database.tablesExist &&
    status.auth.configured &&
    status.admin.exists;

  return NextResponse.json(status);
}
