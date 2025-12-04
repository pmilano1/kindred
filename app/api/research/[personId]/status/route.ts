import { NextRequest, NextResponse } from 'next/server';
import { updateResearchStatus } from '@/lib/db';

interface RouteParams {
  params: Promise<{ personId: string }>;
}

// PUT /api/research/[personId]/status - Update research status
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { personId } = await params;
    const body = await request.json();
    const { status } = body;

    const validStatuses = ['not_started', 'in_progress', 'partial', 'verified', 'needs_review', 'brick_wall'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await updateResearchStatus(personId, status);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Failed to update research status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

