import { NextResponse } from 'next/server';
import { getPeople } from '@/lib/db';

export async function GET() {
  try {
    const people = await getPeople();
    return NextResponse.json(people);
  } catch (error) {
    console.error('Failed to fetch people:', error);
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
  }
}

