import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const checkDb = url.searchParams.get('db') === 'true';

  if (checkDb) {
    try {
      const result = await pool.query('SELECT NOW() as time, current_database() as db');
      return NextResponse.json({
        status: 'ok',
        database: result.rows[0].db,
        time: result.rows[0].time,
        ssl: process.env.DATABASE_URL ? 'enabled' : 'disabled'
      }, { status: 200 });
    } catch (error) {
      return NextResponse.json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        hasDbUrl: !!process.env.DATABASE_URL
      }, { status: 500 });
    }
  }

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

