import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

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
const crestCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params;
  
  // Check cache first
  const cached = crestCache.get(personId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Return cached base64 image with appropriate headers
    const base64Data = cached.data;
    if (base64Data.startsWith('data:image/')) {
      const [header, data] = base64Data.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
      const buffer = Buffer.from(data, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=86400', // Browser cache for 24 hours
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
    
    // Store in cache
    crestCache.set(personId, { data: base64Data, timestamp: Date.now() });

    // Parse and return as image
    if (base64Data.startsWith('data:image/')) {
      const [header, data] = base64Data.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
      const buffer = Buffer.from(data, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid image data' }, { status: 500 });
  } catch (error) {
    console.error('Failed to fetch coat of arms:', error);
    return NextResponse.json({ error: 'Failed to fetch coat of arms' }, { status: 500 });
  }
}

