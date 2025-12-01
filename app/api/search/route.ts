import { NextRequest, NextResponse } from 'next/server';
import { searchPeople } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q') || '';
    if (!query) {
      return NextResponse.json([]);
    }
    const people = await searchPeople(query);
    return NextResponse.json(people);
  } catch (error) {
    console.error('Failed to search:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}

