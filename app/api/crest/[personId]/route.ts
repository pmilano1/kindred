import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      host: process.env.DB_HOST || 'shared-data_postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'genealogy',
      user: process.env.DB_USER || 'genealogy',
      password: process.env.DB_PASSWORD || 'GenTree2024!',
    });

// Cache for coat of arms - they don't change often
const crestCache = new Map<string, { data: string; etag: string; timestamp: number }>();
const CACHE_TTL = 86400000; // 24 hours in milliseconds (extended since crests rarely change)

function generateEtag(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex').substring(0, 16);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params;
  const ifNoneMatch = request.headers.get('if-none-match');

  // Check cache first
  const cached = crestCache.get(personId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Check if client has cached version (ETag match)
    if (ifNoneMatch && ifNoneMatch === cached.etag) {
      return new NextResponse(null, { status: 304 });
    }

    const base64Data = cached.data;
    if (base64Data.startsWith('data:image/')) {
      const [header, data] = base64Data.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
      const buffer = Buffer.from(data, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=604800, immutable', // 7 days, immutable (crests don't change)
          'ETag': cached.etag,
        },
      });
    }
  }

  try {
    const result = await pool.query(
      `SELECT fact_value FROM facts WHERE person_id = $1 AND fact_type = 'coat_of_arms' LIMIT 1`,
      [personId]
    );

    if (result.rows.length === 0 || !result.rows[0].fact_value) {
      return NextResponse.json({ error: 'Coat of arms not found' }, { status: 404 });
    }

    const base64Data = result.rows[0].fact_value;
    const etag = generateEtag(base64Data);

    // Store in cache with ETag
    crestCache.set(personId, { data: base64Data, etag, timestamp: Date.now() });

    // Check if client has cached version
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // Parse and return as image
    if (base64Data.startsWith('data:image/')) {
      const [header, data] = base64Data.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
      const buffer = Buffer.from(data, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=604800, immutable', // 7 days, immutable
          'ETag': etag,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid image data' }, { status: 500 });
  } catch (error) {
    console.error('Failed to fetch coat of arms:', error);
    return NextResponse.json({ error: 'Failed to fetch coat of arms' }, { status: 500 });
  }
}

