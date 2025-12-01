import { Pool } from 'pg';
import { Person, Family, Stats } from './types';

const pool = new Pool({
  host: process.env.DB_HOST || 'shared-data_postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'genealogy',
  user: process.env.DB_USER || 'genealogy',
  password: process.env.DB_PASSWORD || 'GenTree2024!',
});

export async function getPeople(): Promise<Person[]> {
  const result = await pool.query(`
    SELECT id, familysearch_id, name_given, name_surname, name_full,
           sex, birth_date, birth_year, birth_place, death_date, death_year, 
           death_place, burial_place, living
    FROM people
    ORDER BY birth_year DESC NULLS LAST
  `);
  return result.rows;
}

export async function getPerson(id: string): Promise<Person | null> {
  const result = await pool.query(
    `SELECT * FROM people WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function searchPeople(query: string): Promise<Person[]> {
  const result = await pool.query(`
    SELECT id, familysearch_id, name_given, name_surname, name_full,
           sex, birth_date, birth_year, birth_place, death_date, death_year, 
           death_place, burial_place, living
    FROM people
    WHERE name_full ILIKE $1 OR birth_place ILIKE $1 OR death_place ILIKE $1
    ORDER BY name_full
  `, [`%${query}%`]);
  return result.rows;
}

export async function getFamilies(): Promise<Family[]> {
  const result = await pool.query(`SELECT * FROM families`);
  return result.rows;
}

export async function getChildren(familyId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT person_id FROM children WHERE family_id = $1`,
    [familyId]
  );
  return result.rows.map(r => r.person_id);
}

export async function getPersonFamilies(personId: string): Promise<{
  asSpouse: Family[];
  asChild: { family: Family; parents: Person[] }[];
}> {
  // Families where person is spouse
  const spouseFamilies = await pool.query(
    `SELECT * FROM families WHERE husband_id = $1 OR wife_id = $1`,
    [personId]
  );
  
  // Family where person is child
  const childFamily = await pool.query(`
    SELECT f.* FROM families f
    JOIN children c ON f.id = c.family_id
    WHERE c.person_id = $1
  `, [personId]);
  
  const asChild = [];
  for (const family of childFamily.rows) {
    const parents = await pool.query(
      `SELECT * FROM people WHERE id IN ($1, $2)`,
      [family.husband_id, family.wife_id]
    );
    asChild.push({ family, parents: parents.rows });
  }
  
  return { asSpouse: spouseFamilies.rows, asChild };
}

export async function getStats(): Promise<Stats> {
  const result = await pool.query(`SELECT * FROM get_statistics()`);
  return result.rows[0];
}

export async function getRecentPeople(limit: number = 10): Promise<Person[]> {
  const result = await pool.query(`
    SELECT id, familysearch_id, name_given, name_surname, name_full,
           sex, birth_date, birth_year, birth_place, death_date, death_year, 
           death_place, burial_place, living
    FROM people
    WHERE birth_year IS NOT NULL
    ORDER BY birth_year DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

export async function getTimeline(): Promise<Array<{year: number; events: Array<{type: string; person: Person}>}>> {
  const result = await pool.query(`
    SELECT * FROM people WHERE birth_year IS NOT NULL OR death_year IS NOT NULL
  `);
  
  const events: Map<number, Array<{type: string; person: Person}>> = new Map();
  
  for (const person of result.rows) {
    if (person.birth_year) {
      if (!events.has(person.birth_year)) events.set(person.birth_year, []);
      events.get(person.birth_year)!.push({ type: 'birth', person });
    }
    if (person.death_year && !person.living) {
      if (!events.has(person.death_year)) events.set(person.death_year, []);
      events.get(person.death_year)!.push({ type: 'death', person });
    }
  }
  
  return Array.from(events.entries())
    .map(([year, evts]) => ({ year, events: evts }))
    .sort((a, b) => b.year - a.year);
}

