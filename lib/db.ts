import { Pool } from 'pg';
import { Person, Family, Stats, Residence, Occupation, Event, Fact, Source, ResearchQueueItem } from './types';

// Lazy pool initialization - created on first use with runtime env vars
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl) {
      // AWS RDS - use SSL with self-signed cert support
      console.log('[DB] Connecting via DATABASE_URL with SSL');
      _pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
      });
    } else {
      // Local Docker - no SSL
      const host = process.env.DB_HOST || 'shared-data_postgres';
      console.log('[DB] Connecting to', host);
      _pool = new Pool({
        host,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'genealogy',
        user: process.env.DB_USER || 'genealogy',
        password: process.env.DB_PASSWORD || 'GenTree2024!',
      });
    }
  }
  return _pool;
}

// Proxy to defer pool creation until first use (runtime, not build time)
const pool = new Proxy({} as Pool, {
  get(_, prop) {
    const realPool = getPool();
    const value = (realPool as any)[prop];
    return typeof value === 'function' ? value.bind(realPool) : value;
  }
});

export { pool };

export async function getPeople(): Promise<Person[]> {
  const result = await pool.query(`
    SELECT id, familysearch_id, name_given, name_surname, name_full,
           sex, birth_date, birth_year, birth_place, death_date, death_year,
           death_place, burial_date, burial_place, christening_date, christening_place,
           immigration_date, immigration_place, naturalization_date, naturalization_place,
           religion, COALESCE(notes, description) as description, living, source_count
    FROM people
    ORDER BY birth_year DESC NULLS LAST
  `);
  return result.rows;
}

export async function getPerson(id: string): Promise<Person | null> {
  const result = await pool.query(
    `SELECT *, COALESCE(notes, description) as description FROM people WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getPersonResidences(personId: string): Promise<Residence[]> {
  const result = await pool.query(
    `SELECT * FROM residences WHERE person_id = $1 ORDER BY residence_year NULLS LAST`,
    [personId]
  );
  return result.rows;
}

export async function getPersonOccupations(personId: string): Promise<Occupation[]> {
  const result = await pool.query(
    `SELECT * FROM occupations WHERE person_id = $1 ORDER BY occupation_date NULLS LAST`,
    [personId]
  );
  return result.rows;
}

export async function getPersonEvents(personId: string): Promise<Event[]> {
  const result = await pool.query(
    `SELECT * FROM events WHERE person_id = $1 ORDER BY event_date NULLS LAST`,
    [personId]
  );
  return result.rows;
}

export async function getPersonFacts(personId: string): Promise<Fact[]> {
  const result = await pool.query(
    `SELECT * FROM facts WHERE person_id = $1 ORDER BY fact_type`,
    [personId]
  );
  return result.rows;
}

export async function searchPeople(query: string): Promise<Person[]> {
  const result = await pool.query(`
    SELECT id, familysearch_id, name_given, name_surname, name_full,
           sex, birth_date, birth_year, birth_place, death_date, death_year,
           death_place, burial_date, burial_place, christening_date, christening_place,
           immigration_date, immigration_place, naturalization_date, naturalization_place,
           religion, COALESCE(notes, description) as description, living, source_count
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

export async function getSiblings(personId: string): Promise<Person[]> {
  // Find siblings by getting other children of the same family
  const result = await pool.query(`
    SELECT DISTINCT p.*
    FROM people p
    JOIN children c1 ON c1.person_id = p.id
    JOIN children c2 ON c2.family_id = c1.family_id
    WHERE c2.person_id = $1
      AND p.id != $1
    ORDER BY p.birth_year NULLS LAST, p.name_full
  `, [personId]);
  return result.rows;
}

export async function getStats(): Promise<Stats> {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM people) as total_people,
      (SELECT COUNT(*) FROM families) as total_families,
      (SELECT COUNT(*) FROM people WHERE sex = 'M') as male_count,
      (SELECT COUNT(*) FROM people WHERE sex = 'F') as female_count,
      (SELECT COUNT(*) FROM people WHERE living = true) as living_count,
      (SELECT MIN(birth_year) FROM people WHERE birth_year IS NOT NULL) as earliest_birth,
      (SELECT MAX(birth_year) FROM people WHERE birth_year IS NOT NULL) as latest_birth,
      (SELECT COUNT(*) FROM people WHERE familysearch_id IS NOT NULL) as with_familysearch_id
  `);
  return result.rows[0];
}

export async function getRecentPeople(limit: number = 10): Promise<Person[]> {
  const result = await pool.query(`
    SELECT id, familysearch_id, name_given, name_surname, name_full,
           sex, birth_date, birth_year, birth_place, death_date, death_year,
           death_place, burial_date, burial_place, christening_date, christening_place,
           immigration_date, immigration_place, naturalization_date, naturalization_place,
           religion, description, living, source_count
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

// NOTE: getPersonSources removed - sources migrated to research_log table
// Use getResearchLog() instead which includes all sources as 'found' entries

// Notable relatives - finds famous/notable people connected through ancestors
export interface NotableRelative {
  person: Person;
  relationship: string;
  connectionPath: string[];
}

export async function getNotableRelatives(personId: string): Promise<NotableRelative[]> {
  // List of notable person IDs to look for
  const notableIds = [
    'josephine-bonaparte',
    'alexandre-de-beauharnais',
    'francois-de-beauharnais',
    'charles-de-beauharnais'
  ];

  try {
    // Simpler approach: trace ancestry to find common ancestors, then check for notable descendants
    const result = await pool.query(`
      WITH RECURSIVE ancestry AS (
        -- Start with the target person
        SELECT p.id, p.name_full, 0 as generation, ARRAY[p.id]::text[] as path
        FROM people p WHERE p.id = $1

        UNION ALL

        -- Get parents
        SELECT parent.id, parent.name_full, a.generation + 1, a.path || parent.id::text
        FROM ancestry a
        JOIN children c ON c.person_id = a.id
        JOIN families f ON c.family_id = f.id
        JOIN people parent ON (parent.id = f.husband_id OR parent.id = f.wife_id)
        WHERE a.generation < 15 AND NOT parent.id = ANY(a.path)
      ),
      -- Find siblings of ancestors (collateral relatives)
      ancestor_siblings AS (
        SELECT DISTINCT sibling.id, sibling.name_full, a.generation
        FROM ancestry a
        JOIN children c1 ON c1.person_id = a.id
        JOIN children c2 ON c2.family_id = c1.family_id AND c2.person_id != a.id
        JOIN people sibling ON sibling.id = c2.person_id
      ),
      -- Find descendants of those siblings (non-recursive, just a few levels)
      sibling_children AS (
        SELECT s.id, s.name_full, s.generation, 'sibling' as rel_type FROM ancestor_siblings s
        UNION ALL
        SELECT child.id, child.name_full, s.generation, 'child of sibling' as rel_type
        FROM ancestor_siblings s
        JOIN families f ON (f.husband_id = s.id OR f.wife_id = s.id)
        JOIN children c ON c.family_id = f.id
        JOIN people child ON child.id = c.person_id
      ),
      -- Get grandchildren
      sibling_grandchildren AS (
        SELECT sc.id, sc.name_full, sc.generation, sc.rel_type FROM sibling_children sc
        UNION ALL
        SELECT gc.id, gc.name_full, sc.generation, 'grandchild' as rel_type
        FROM sibling_children sc
        JOIN families f ON (f.husband_id = sc.id OR f.wife_id = sc.id)
        JOIN children c ON c.family_id = f.id
        JOIN people gc ON gc.id = c.person_id
        WHERE sc.rel_type = 'child of sibling'
      ),
      -- Get great-grandchildren
      all_descendants AS (
        SELECT sg.id, sg.name_full, sg.generation, sg.rel_type FROM sibling_grandchildren sg
        UNION ALL
        SELECT ggc.id, ggc.name_full, sg.generation, 'great-grandchild' as rel_type
        FROM sibling_grandchildren sg
        JOIN families f ON (f.husband_id = sg.id OR f.wife_id = sg.id)
        JOIN children c ON c.family_id = f.id
        JOIN people ggc ON ggc.id = c.person_id
        WHERE sg.rel_type = 'grandchild'
      ),
      -- Also include spouses of descendants
      with_spouses AS (
        SELECT ad.id, ad.name_full, ad.generation FROM all_descendants ad
        UNION
        SELECT spouse.id, spouse.name_full, ad.generation
        FROM all_descendants ad
        JOIN families f ON (f.husband_id = ad.id OR f.wife_id = ad.id)
        JOIN people spouse ON (spouse.id = f.husband_id OR spouse.id = f.wife_id) AND spouse.id != ad.id
      )
      SELECT DISTINCT ws.id, ws.name_full, ws.generation
      FROM with_spouses ws
      WHERE ws.id = ANY($2::text[])
    `, [personId, notableIds]);

    if (result.rows.length === 0) return [];

    // Get full person details for notable relatives
    const notableRelatives: NotableRelative[] = [];
    for (const row of result.rows) {
      const personResult = await pool.query(`SELECT * FROM people WHERE id = $1`, [row.id]);
      if (personResult.rows[0]) {
        notableRelatives.push({
          person: personResult.rows[0],
          relationship: `Connected through ${row.generation} generations`,
          connectionPath: []
        });
      }
    }

    return notableRelatives;
  } catch (error) {
    console.error('Error fetching notable relatives:', error);
    return [];
  }
}

// ============================================
// RESEARCH TRACKING FUNCTIONS
// ============================================

export async function getSources(personId: string): Promise<Source[]> {
  const result = await pool.query(
    `SELECT * FROM sources WHERE person_id = $1 ORDER BY created_at DESC`,
    [personId]
  );
  return result.rows;
}

export async function addSource(
  personId: string,
  action: string,
  content: string,
  sourceType?: string,
  sourceName?: string,
  sourceUrl?: string,
  confidence?: string
): Promise<Source> {
  const id = Math.random().toString(36).substring(2, 14);
  const result = await pool.query(
    `INSERT INTO sources (id, person_id, action, content, source_type, source_name, source_url, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, personId, action, content, sourceType || null, sourceName || null, sourceUrl || null, confidence || null]
  );

  // Update last_researched and source_count on person
  await pool.query(
    `UPDATE people SET last_researched = NOW(), source_count = (SELECT COUNT(*) FROM sources WHERE person_id = $1) WHERE id = $1`,
    [personId]
  );

  return result.rows[0];
}

// Legacy alias - keep for backwards compatibility
export async function addResearchLog(
  personId: string,
  actionType: string,
  content: string,
  sourceChecked?: string,
  confidence?: string,
  externalUrl?: string
): Promise<Source> {
  return addSource(personId, actionType, content, sourceChecked, undefined, externalUrl, confidence);
}

export async function updateResearchStatus(personId: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE people SET research_status = $1, last_researched = NOW() WHERE id = $2`,
    [status, personId]
  );
}

export async function updateResearchPriority(personId: string, priority: number): Promise<void> {
  await pool.query(
    `UPDATE people SET research_priority = $1 WHERE id = $2`,
    [priority, personId]
  );
}

export async function getResearchQueue(): Promise<ResearchQueueItem[]> {
  const result = await pool.query(`SELECT * FROM research_queue LIMIT 100`);
  return result.rows;
}

export async function getPersonResearchInfo(personId: string): Promise<{
  status: string;
  priority: number;
  lastResearched: Date | null;
  logCount: number;
}> {
  const result = await pool.query(
    `SELECT p.research_status, p.research_priority, p.last_researched,
            (SELECT COUNT(*) FROM research_log WHERE person_id = p.id) as log_count
     FROM people p WHERE p.id = $1`,
    [personId]
  );
  const row = result.rows[0];
  return {
    status: row?.research_status || 'not_started',
    priority: row?.research_priority || 0,
    lastResearched: row?.last_researched || null,
    logCount: parseInt(row?.log_count || '0')
  };
}
