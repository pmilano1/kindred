import { NextResponse } from 'next/server';
import { getResearchQueue } from '@/lib/db';

// GET /api/research/queue - Get research queue (people needing research)
export async function GET() {
  try {
    const queue = await getResearchQueue();
    return NextResponse.json(queue);
  } catch (error) {
    console.error('Failed to fetch research queue:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}

