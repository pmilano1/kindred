import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Use DATABASE_URL if available (AWS), otherwise fall back to individual env vars (local Docker)
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

export interface TreePerson {
  id: string;
  name: string;
  sex: 'M' | 'F' | null;
  birth_year: number | null;
  death_year: number | null;
  birth_place: string | null;
  death_place: string | null;
  living: boolean;
  familysearch_id: string | null;
  isNotable?: boolean;
  research_status?: string;
  research_priority?: number;
  last_researched?: string;
  hasCoatOfArms?: boolean;
  coatOfArmsUrl?: string | null;
}

export interface TreeFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  marriage_year: number | null;
  marriage_place: string | null;
  children: string[];
}

export interface NotableConnection {
  branchingAncestorId: string;  // e.g., Gaspard
  siblingId: string;            // e.g., Renée (sibling of direct ancestor)
  notablePersonId: string;      // e.g., Josephine
  path: string[];               // IDs from sibling to notable person
}

// Helper to look up person ID by legacy_id
async function getIdByLegacy(legacyId: string): Promise<string | null> {
  const result = await pool.query('SELECT id FROM people WHERE legacy_id = $1', [legacyId]);
  return result.rows[0]?.id || null;
}

export async function GET() {
  try {
    // Get all people with relevant fields for tree (include legacy_id for lookups and research tracking)
    // Only check if coat_of_arms exists (not the full base64 data) - fetch via separate cached endpoint
    const peopleResult = await pool.query(`
      SELECT p.id, p.legacy_id, p.name_full as name, p.sex, p.birth_year, p.death_year,
             p.birth_place, p.death_place, p.living, p.familysearch_id,
             p.research_status, p.research_priority, p.last_researched,
             EXISTS(SELECT 1 FROM facts f WHERE f.person_id = p.id AND f.fact_type = 'coat_of_arms') as has_coat_of_arms
      FROM people p
    `);

    // Get all families with children
    const familiesResult = await pool.query(`
      SELECT f.id, f.husband_id, f.wife_id,
             NULL::int as marriage_year,
             f.marriage_place,
             COALESCE(
               array_agg(c.person_id) FILTER (WHERE c.person_id IS NOT NULL),
               ARRAY[]::varchar[]
             ) as children
      FROM families f
      LEFT JOIN children c ON f.id = c.family_id
      GROUP BY f.id, f.husband_id, f.wife_id, f.marriage_place
    `);

    const people: Record<string, TreePerson> = {};
    const legacyToId: Record<string, string> = {};
    for (const row of peopleResult.rows) {
      people[row.id] = {
        ...row,
        hasCoatOfArms: row.has_coat_of_arms,
        coatOfArmsUrl: row.has_coat_of_arms ? `/api/crest/${row.id}` : null
      };
      if (row.legacy_id) {
        legacyToId[row.legacy_id] = row.id;
      }
    }

    // Mark notable people (by legacy_id)
    const notableLegacyIds = ['josephine-bonaparte', 'alexandre-de-beauharnais', 'francois-de-beauharnais', 'charles-de-beauharnais', 'frank-sinatra-1915'];
    notableLegacyIds.forEach(legacyId => {
      const id = legacyToId[legacyId];
      if (id && people[id]) people[id].isNotable = true;
    });

    const families: TreeFamily[] = familiesResult.rows;

    // Define notable connections using legacy IDs, then resolve to real IDs
    const notableConnectionsLegacy = [
      {
        branchingAncestorId: 'gaspar-le-pays-de-bourjolly',
        siblingId: 'renee-le-pays-de-bourjolly',
        notablePersonId: 'josephine-bonaparte',
        path: ['renee-le-pays-de-bourjolly', 'renee-hardouineau-landaniere', 'francois-de-beauharnais', 'alexandre-de-beauharnais', 'josephine-bonaparte']
      },
      {
        branchingAncestorId: 'genesia-garaventa-1886',
        siblingId: 'dolly-sinatra-1894',
        notablePersonId: 'frank-sinatra-1915',
        path: ['dolly-sinatra-1894', 'frank-sinatra-1915']
      }
    ];

    // Convert legacy IDs to real IDs
    const notableConnections: NotableConnection[] = notableConnectionsLegacy.map(nc => ({
      branchingAncestorId: legacyToId[nc.branchingAncestorId] || nc.branchingAncestorId,
      siblingId: legacyToId[nc.siblingId] || nc.siblingId,
      notablePersonId: legacyToId[nc.notablePersonId] || nc.notablePersonId,
      path: nc.path.map(legacyId => legacyToId[legacyId] || legacyId)
    }));

    return NextResponse.json({ people, families, notableConnections });
  } catch (error) {
    console.error('Failed to fetch tree data:', error);
    return NextResponse.json({ error: 'Failed to fetch tree data' }, { status: 500 });
  }
}

