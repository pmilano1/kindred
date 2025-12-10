import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/pool';

// Rate limiting: max 10 errors per minute per user/IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 }); // 1 minute
    return true;
  }

  if (limit.count >= 10) {
    return false; // Rate limit exceeded
  }

  limit.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Get user session (if logged in)
    const session = await auth();
    const userId = session?.user?.id || null;

    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateLimitKey = userId || ip;

    // Check rate limit
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 },
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      error_message,
      stack_trace,
      url,
      user_agent,
      component_stack,
      error_info,
    } = body;

    // Validate required fields
    if (!error_message) {
      return NextResponse.json(
        { error: 'error_message is required' },
        { status: 400 },
      );
    }

    // Generate ID
    const id = Math.random().toString(36).substring(2, 14);

    // Insert into database
    await pool.query(
      `INSERT INTO client_errors (
        id, user_id, error_message, stack_trace, url, user_agent, component_stack, error_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        userId,
        error_message.substring(0, 5000), // Limit message length
        stack_trace?.substring(0, 10000), // Limit stack trace length
        url?.substring(0, 500),
        user_agent?.substring(0, 500),
        component_stack?.substring(0, 5000),
        error_info ? JSON.stringify(error_info) : null,
      ],
    );

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Client Error]', {
        user_id: userId,
        message: error_message,
        url,
      });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to log client error:', error);
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 });
  }
}
