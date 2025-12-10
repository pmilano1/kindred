import { NextResponse } from 'next/server';
import { pool } from '@/lib/pool';

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT value FROM settings WHERE key = 'enable_error_logging'`,
    );

    const enabled = result.rows[0]?.value === 'true';

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Failed to check error logging setting:', error);
    // Default to disabled if we can't check
    return NextResponse.json({ enabled: false });
  }
}
