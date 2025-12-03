import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
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

export async function GET() {
  try {
    // Get all people with relevant fields for tree
    const peopleResult = await pool.query(`
      SELECT id, name_full as name, sex, birth_year, death_year,
             birth_place, death_place, living, familysearch_id
      FROM people
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
    for (const row of peopleResult.rows) {
      people[row.id] = row;
    }

    // Mark notable people
    const notableIds = ['josephine-bonaparte', 'alexandre-de-beauharnais', 'francois-de-beauharnais', 'charles-de-beauharnais'];
    notableIds.forEach(id => {
      if (people[id]) people[id].isNotable = true;
    });

    const families: TreeFamily[] = familiesResult.rows;

    // Define notable connections (hardcoded for now - Josephine connection)
    const notableConnections: NotableConnection[] = [
      {
        branchingAncestorId: 'gaspar-le-pays-de-bourjolly',
        siblingId: 'renee-le-pays-de-bourjolly',
        notablePersonId: 'josephine-bonaparte',
        path: [
          'renee-le-pays-de-bourjolly',
          'renee-hardouineau-landaniere',
          'francois-de-beauharnais',
          'alexandre-de-beauharnais',
          'josephine-bonaparte'
        ]
      }
    ];

    return NextResponse.json({ people, families, notableConnections });
  } catch (error) {
    console.error('Failed to fetch tree data:', error);
    return NextResponse.json({ error: 'Failed to fetch tree data' }, { status: 500 });
  }
}

