import { NextResponse } from 'next/server';
import { getTimeline } from '@/lib/db';

export async function GET() {
  try {
    const timeline = await getTimeline();
    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Failed to fetch timeline:', error);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}

