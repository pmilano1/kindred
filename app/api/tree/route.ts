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
}

export interface TreeFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  marriage_year: number | null;
  marriage_place: string | null;
  children: string[];
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
      SELECT f.id, f.husband_id, f.wife_id, f.marriage_year, f.marriage_place,
             COALESCE(
               array_agg(c.person_id) FILTER (WHERE c.person_id IS NOT NULL),
               ARRAY[]::varchar[]
             ) as children
      FROM families f
      LEFT JOIN children c ON f.id = c.family_id
      GROUP BY f.id, f.husband_id, f.wife_id, f.marriage_year, f.marriage_place
    `);

    const people: Record<string, TreePerson> = {};
    for (const row of peopleResult.rows) {
      people[row.id] = row;
    }

    const families: TreeFamily[] = familiesResult.rows;

    return NextResponse.json({ people, families });
  } catch (error) {
    console.error('Failed to fetch tree data:', error);
    return NextResponse.json({ error: 'Failed to fetch tree data' }, { status: 500 });
  }
}

