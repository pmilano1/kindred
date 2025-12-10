import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEmailConfig } from '@/lib/email';

/**
 * GET /api/email-config
 * Returns email configuration status (admin only)
 */
export async function GET() {
  const session = await auth();

  // Only admins can see email config status
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getEmailConfig();

  return NextResponse.json({
    configured: config.configured,
    type: config.type,
    details: config.details,
  });
}
