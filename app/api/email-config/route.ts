import { NextResponse } from 'next/server';
import { getEmailConfig } from '@/lib/email';
import { auth } from '@/lib/auth';

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

  const config = getEmailConfig();
  
  return NextResponse.json({
    configured: config.configured,
    type: config.type,
    details: config.details,
  });
}

