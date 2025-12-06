import DataLoader from 'dataloader';
import { pool } from '../pool';
import { Person, Family, Fact, Source, LifeEvent } from '../types';

// ============================================
// BATCH LOADERS - Single SQL query per batch
// ============================================

async function batchPeople(ids: readonly string[]): Promise<(Person | null)[]> {
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT *, COALESCE(notes, description) as description FROM people WHERE id = ANY($1)`,
    [ids as string[]]
  );
  const map = new Map(rows.map((p: Person) => [p.id, p]));
  return ids.map(id => map.get(id) || null);
}

async function batchFamilies(ids: readonly string[]): Promise<(Family | null)[]> {
  if (!ids.length) return [];
  const { rows } = await pool.query(`SELECT * FROM families WHERE id = ANY($1)`, [ids as string[]]);
  const map = new Map(rows.map((f: Family) => [f.id, f]));
  return ids.map(id => map.get(id) || null);
}

async function batchChildrenByFamily(familyIds: readonly string[]): Promise<string[][]> {
  if (!familyIds.length) return [];
  const { rows } = await pool.query(
    `SELECT family_id, person_id FROM children WHERE family_id = ANY($1) ORDER BY family_id`,
    [familyIds as string[]]
  );
  const map = new Map<string, string[]>();
  for (const { family_id, person_id } of rows) {
    if (!map.has(family_id)) map.set(family_id, []);
    map.get(family_id)!.push(person_id);
  }
  return familyIds.map(id => map.get(id) || []);
}

async function batchFamiliesAsSpouse(personIds: readonly string[]): Promise<Family[][]> {
  if (!personIds.length) return [];
  const { rows } = await pool.query(
    `SELECT * FROM families WHERE husband_id = ANY($1) OR wife_id = ANY($1)`,
    [personIds as string[]]
  );
  const map = new Map<string, Family[]>(personIds.map(id => [id, []]));
  for (const f of rows) {
    if (f.husband_id && map.has(f.husband_id)) map.get(f.husband_id)!.push(f);
    if (f.wife_id && map.has(f.wife_id)) map.get(f.wife_id)!.push(f);
  }
  return personIds.map(id => map.get(id) || []);
}

async function batchFamiliesAsChild(personIds: readonly string[]): Promise<Family[][]> {
  if (!personIds.length) return [];
  const { rows } = await pool.query(
    `SELECT f.*, c.person_id as _child_id FROM families f
     JOIN children c ON c.family_id = f.id WHERE c.person_id = ANY($1)`,
    [personIds as string[]]
  );
  const map = new Map<string, Family[]>(personIds.map(id => [id, []]));
  for (const row of rows) {
    const childId = row._child_id;
    delete row._child_id;
    map.get(childId)!.push(row);
  }
  return personIds.map(id => map.get(id) || []);
}

// Batch load unified life events (combines residences, occupations, events tables)
async function batchLifeEvents(personIds: readonly string[]): Promise<LifeEvent[][]> {
  if (!personIds.length) return [];

  // Query all three tables and unify into LifeEvent format
  const [residences, occupations, events] = await Promise.all([
    pool.query(
      `SELECT id, person_id, 'residence' as event_type, residence_date as event_date,
              residence_year as event_year, residence_place as event_place, NULL as event_value
       FROM residences WHERE person_id = ANY($1)`,
      [personIds as string[]]
    ),
    pool.query(
      `SELECT id, person_id, 'occupation' as event_type, occupation_date as event_date,
              NULL as event_year, occupation_place as event_place, title as event_value
       FROM occupations WHERE person_id = ANY($1)`,
      [personIds as string[]]
    ),
    pool.query(
      `SELECT id, person_id, event_type, event_date, NULL as event_year, event_place, NULL as event_value
       FROM events WHERE person_id = ANY($1)`,
      [personIds as string[]]
    )
  ]);

  const map = new Map<string, LifeEvent[]>(personIds.map(id => [id, []]));

  for (const row of [...residences.rows, ...occupations.rows, ...events.rows]) {
    map.get(row.person_id)!.push(row);
  }

  // Sort by year/date
  for (const events of map.values()) {
    events.sort((a, b) => (a.event_year || 9999) - (b.event_year || 9999));
  }

  return personIds.map(id => map.get(id) || []);
}

// Batch load facts by person IDs
async function batchFacts(personIds: readonly string[]): Promise<Fact[][]> {
  if (!personIds.length) return [];
  const { rows } = await pool.query(
    `SELECT * FROM facts WHERE person_id = ANY($1) ORDER BY fact_type`,
    [personIds as string[]]
  );
  const map = new Map<string, Fact[]>(personIds.map(id => [id, []]));
  for (const f of rows) map.get(f.person_id)!.push(f);
  return personIds.map(id => map.get(id) || []);
}

// Batch load sources by person IDs (unified sources table)
async function batchSources(personIds: readonly string[]): Promise<Source[][]> {
  if (!personIds.length) return [];
  const { rows } = await pool.query(
    `SELECT * FROM sources WHERE person_id = ANY($1) ORDER BY created_at DESC`,
    [personIds as string[]]
  );
  const map = new Map<string, Source[]>(personIds.map(id => [id, []]));
  for (const s of rows) map.get(s.person_id)!.push(s);
  return personIds.map(id => map.get(id) || []);
}

// ============================================
// LOADER FACTORY - Fresh loaders per request
// ============================================

export function createLoaders() {
  return {
    personLoader: new DataLoader(batchPeople, { cache: true }),
    familyLoader: new DataLoader(batchFamilies, { cache: true }),
    childrenByFamilyLoader: new DataLoader(batchChildrenByFamily, { cache: true }),
    familiesAsSpouseLoader: new DataLoader(batchFamiliesAsSpouse, { cache: true }),
    familiesAsChildLoader: new DataLoader(batchFamiliesAsChild, { cache: true }),
    lifeEventsLoader: new DataLoader(batchLifeEvents, { cache: true }),
    factsLoader: new DataLoader(batchFacts, { cache: true }),
    sourcesLoader: new DataLoader(batchSources, { cache: true }),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;

