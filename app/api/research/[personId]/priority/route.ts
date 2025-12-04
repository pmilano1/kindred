import { NextRequest, NextResponse } from 'next/server';
import { updateResearchPriority } from '@/lib/db';

interface RouteParams {
  params: Promise<{ personId: string }>;
}

// PUT /api/research/[personId]/priority - Update research priority
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { personId } = await params;
    const body = await request.json();
    const { priority } = body;

    if (typeof priority !== 'number' || priority < 0 || priority > 10) {
      return NextResponse.json({ error: 'Priority must be a number between 0 and 10' }, { status: 400 });
    }

    await updateResearchPriority(personId, priority);
    return NextResponse.json({ success: true, priority });
  } catch (error) {
    console.error('Failed to update research priority:', error);
    return NextResponse.json({ error: 'Failed to update priority' }, { status: 500 });
  }
}

