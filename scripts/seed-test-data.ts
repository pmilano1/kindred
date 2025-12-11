/**
 * Seed script for CI/Playwright testing
 * Creates anonymized test data for E2E tests
 */
import { pool } from '../lib/pool';

async function seedTestData() {
  console.log('[Seed] Starting test data seeding...');

  try {
    // Create test admin user
    await pool.query(`
      INSERT INTO users (id, email, name, role, auth_provider, created_at)
      VALUES ('testadmin001', 'admin@test.local', 'Test Admin', 'admin', 'local', NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('[Seed] Created test admin user');

    // Create test viewer user
    await pool.query(`
      INSERT INTO users (id, email, name, role, auth_provider, created_at)
      VALUES ('testviewer01', 'viewer@test.local', 'Test Viewer', 'viewer', 'local', NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('[Seed] Created test viewer user');

    // Create anonymized test people
    const people = [
      { id: 'person000001', given: 'John', surname: 'Smith', sex: 'M', birthYear: 1950, deathYear: null },
      { id: 'person000002', given: 'Jane', surname: 'Smith', sex: 'F', birthYear: 1952, deathYear: null },
      { id: 'person000003', given: 'Robert', surname: 'Smith', sex: 'M', birthYear: 1975, deathYear: null },
      { id: 'person000004', given: 'Emily', surname: 'Smith', sex: 'F', birthYear: 1978, deathYear: null },
      { id: 'person000005', given: 'Michael', surname: 'Smith', sex: 'M', birthYear: 2000, deathYear: null },
      { id: 'person000006', given: 'Sarah', surname: 'Smith', sex: 'F', birthYear: 2002, deathYear: null },
      { id: 'person000007', given: 'William', surname: 'Jones', sex: 'M', birthYear: 1920, deathYear: 1990 },
      { id: 'person000008', given: 'Mary', surname: 'Jones', sex: 'F', birthYear: 1925, deathYear: 1995 },
      { id: 'person000009', given: 'David', surname: 'Brown', sex: 'M', birthYear: 1945, deathYear: 2020 },
      { id: 'person000010', given: 'Elizabeth', surname: 'Brown', sex: 'F', birthYear: 1948, deathYear: null },
    ];

    for (const p of people) {
      await pool.query(`
        INSERT INTO people (id, name_given, name_surname, name_full, sex, birth_year, death_year, living, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        p.id,
        p.given,
        p.surname,
        `${p.given} ${p.surname}`,
        p.sex,
        p.birthYear,
        p.deathYear,
        p.deathYear === null,
      ]);
    }
    console.log(`[Seed] Created ${people.length} test people`);

    // Create test families
    const families = [
      { id: 'family000001', husbandId: 'person000007', wifeId: 'person000008' }, // Grandparents
      { id: 'family000002', husbandId: 'person000001', wifeId: 'person000002' }, // Parents
      { id: 'family000003', husbandId: 'person000003', wifeId: 'person000004' }, // Current gen
    ];

    for (const f of families) {
      await pool.query(`
        INSERT INTO families (id, husband_id, wife_id, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [f.id, f.husbandId, f.wifeId]);
    }
    console.log(`[Seed] Created ${families.length} test families`);

    // Create children relationships
    const children = [
      { familyId: 'family000001', personId: 'person000001', order: 1 }, // John is child of William/Mary
      { familyId: 'family000002', personId: 'person000003', order: 1 }, // Robert is child of John/Jane
      { familyId: 'family000002', personId: 'person000004', order: 2 }, // Emily married into family
      { familyId: 'family000003', personId: 'person000005', order: 1 }, // Michael is child of Robert/Emily
      { familyId: 'family000003', personId: 'person000006', order: 2 }, // Sarah is child of Robert/Emily
    ];

    for (const c of children) {
      await pool.query(`
        INSERT INTO children (family_id, person_id, birth_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (family_id, person_id) DO NOTHING
      `, [c.familyId, c.personId, c.order]);
    }
    console.log(`[Seed] Created ${children.length} child relationships`);

    console.log('[Seed] ✓ Test data seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] ✗ Failed:', (error as Error).message);
    process.exit(1);
  }
}

seedTestData();

