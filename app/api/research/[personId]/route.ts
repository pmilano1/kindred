import { NextRequest, NextResponse } from 'next/server';
import { getSources, addSource, getPersonResearchInfo } from '@/lib/db';

interface RouteParams {
  params: Promise<{ personId: string }>;
}

// GET /api/research/[personId] - Get sources/research for a person
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { personId } = await params;
    const [sources, info] = await Promise.all([
      getSources(personId),
      getPersonResearchInfo(personId)
    ]);
    return NextResponse.json({ sources, ...info });
  } catch (error) {
    console.error('Failed to fetch sources:', error);
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}

// POST /api/research/[personId] - Add a source entry
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { personId } = await params;
    const body = await request.json();
    const { action, content, sourceType, sourceName, sourceUrl, confidence } = body;

    if (!action || !content) {
      return NextResponse.json({ error: 'action and content are required' }, { status: 400 });
    }

    const entry = await addSource(personId, action, content, sourceType, sourceName, sourceUrl, confidence);
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Failed to add source:', error);
    return NextResponse.json({ error: 'Failed to add source' }, { status: 500 });
  }
}

