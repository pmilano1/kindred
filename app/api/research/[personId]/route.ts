import { NextRequest, NextResponse } from 'next/server';
import { getResearchLog, addResearchLog, getPersonResearchInfo } from '@/lib/db';

interface RouteParams {
  params: Promise<{ personId: string }>;
}

// GET /api/research/[personId] - Get research log and status for a person
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { personId } = await params;
    const [log, info] = await Promise.all([
      getResearchLog(personId),
      getPersonResearchInfo(personId)
    ]);
    return NextResponse.json({ log, ...info });
  } catch (error) {
    console.error('Failed to fetch research log:', error);
    return NextResponse.json({ error: 'Failed to fetch research log' }, { status: 500 });
  }
}

// POST /api/research/[personId] - Add a research log entry
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { personId } = await params;
    const body = await request.json();
    const { actionType, content, sourceChecked, confidence, externalUrl } = body;

    if (!actionType || !content) {
      return NextResponse.json({ error: 'actionType and content are required' }, { status: 400 });
    }

    const entry = await addResearchLog(personId, actionType, content, sourceChecked, confidence, externalUrl);
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Failed to add research log:', error);
    return NextResponse.json({ error: 'Failed to add research log' }, { status: 500 });
  }
}

