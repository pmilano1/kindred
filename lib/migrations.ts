import type { Pool } from 'pg';

interface Migration {
  version: number;
  name: string;
  up: (pool: Pool) => Promise<string[]>;
}

// Migration lock to prevent concurrent runs
const MIGRATION_LOCK_ID = 12345; // Arbitrary unique lock ID for advisory lock
let migrationPromise: Promise<{
  success: boolean;
  results: string[];
  message: string;
}> | null = null;

// Define all migrations in order
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'settings_table',
    up: async (pool: Pool) => {
      const results: string[] = [];
      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT,
          description VARCHAR(500),
          category VARCHAR(50) DEFAULT 'general',
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query(`
        INSERT INTO settings (key, value, description, category) VALUES
          ('site_name', 'Family Tree', 'Site name', 'branding'),
          ('family_name', 'Family', 'Family name', 'branding'),
          ('site_tagline', 'Preserving our heritage', 'Tagline', 'branding'),
          ('theme_color', '#4F46E5', 'Theme color', 'branding'),
          ('logo_url', NULL, 'Logo URL', 'branding'),
          ('require_login', 'true', 'Require login', 'privacy'),
          ('show_living_details', 'false', 'Show living details', 'privacy'),
          ('living_cutoff_years', '100', 'Living cutoff years', 'privacy'),
          ('date_format', 'MDY', 'Date format', 'display'),
          ('default_tree_generations', '4', 'Default generations', 'display'),
          ('show_coats_of_arms', 'true', 'Show coats of arms', 'display'),
          ('admin_email', NULL, 'Admin email', 'contact'),
          ('footer_text', NULL, 'Footer text', 'contact')
        ON CONFLICT DO NOTHING
      `);
      results.push('Created settings table with defaults');
      return results;
    },
  },
  {
    version: 2,
    name: 'email_tables',
    up: async (pool: Pool) => {
      const results: string[] = [];
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_log (
          id SERIAL PRIMARY KEY,
          email_type VARCHAR(50) NOT NULL,
          recipient VARCHAR(255) NOT NULL,
          subject VARCHAR(500),
          success BOOLEAN DEFAULT false,
          error_message TEXT,
          sent_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON email_log(recipient)',
      );
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at)',
      );
      results.push('Created email_log table');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_preferences (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          research_updates BOOLEAN DEFAULT true,
          tree_changes BOOLEAN DEFAULT false,
          weekly_digest BOOLEAN DEFAULT false,
          birthday_reminders BOOLEAN DEFAULT false,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created email_preferences table');
      return results;
    },
  },
  {
    version: 3,
    name: 'tree_indexes',
    up: async (pool: Pool) => {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_children_person_id ON children(person_id)',
        'CREATE INDEX IF NOT EXISTS idx_children_family_id ON children(family_id)',
        'CREATE INDEX IF NOT EXISTS idx_children_composite ON children(family_id, person_id)',
        'CREATE INDEX IF NOT EXISTS idx_families_husband_id ON families(husband_id)',
        'CREATE INDEX IF NOT EXISTS idx_families_wife_id ON families(wife_id)',
        'CREATE INDEX IF NOT EXISTS idx_families_parents ON families(husband_id, wife_id)',
        'CREATE INDEX IF NOT EXISTS idx_people_is_notable ON people(is_notable) WHERE is_notable = true',
        'CREATE INDEX IF NOT EXISTS idx_people_surname ON people(name_surname)',
        'CREATE INDEX IF NOT EXISTS idx_people_living ON people(living)',
      ];
      for (const sql of indexes) {
        try {
          await pool.query(sql);
        } catch {
          /* ignore */
        }
      }
      return ['Created tree traversal indexes'];
    },
  },
  {
    version: 4,
    name: 'local_auth',
    up: async (pool: Pool) => {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'google',
        ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
        ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,
        ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN DEFAULT false
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token)',
      );
      return ['Added local auth columns and password_reset_tokens table'];
    },
  },
  {
    version: 5,
    name: 'full_text_search',
    up: async (pool: Pool) => {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await pool.query('CREATE EXTENSION IF NOT EXISTS unaccent');
      await pool.query(`
        CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text AS $$
          SELECT unaccent('unaccent', $1)
        $$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE
      `);
      // Check if column exists
      const check = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'people' AND column_name = 'search_vector'
      `);
      if (check.rows.length === 0) {
        await pool.query(
          'ALTER TABLE people ADD COLUMN search_vector tsvector',
        );
      }
      await pool.query(`
        CREATE OR REPLACE FUNCTION people_search_vector_update() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector :=
            setweight(to_tsvector('simple', immutable_unaccent(COALESCE(NEW.name_full, ''))), 'A') ||
            setweight(to_tsvector('simple', immutable_unaccent(COALESCE(NEW.name_given, ''))), 'A') ||
            setweight(to_tsvector('simple', immutable_unaccent(COALESCE(NEW.name_surname, ''))), 'A') ||
            setweight(to_tsvector('simple', immutable_unaccent(COALESCE(NEW.birth_place, ''))), 'B') ||
            setweight(to_tsvector('simple', immutable_unaccent(COALESCE(NEW.death_place, ''))), 'B') ||
            setweight(to_tsvector('simple', immutable_unaccent(COALESCE(NEW.description, ''))), 'C') ||
            setweight(to_tsvector('simple', immutable_unaccent(COALESCE(NEW.notes, ''))), 'C');
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql
      `);
      await pool.query(
        'DROP TRIGGER IF EXISTS people_search_vector_trigger ON people',
      );
      await pool.query(`
        CREATE TRIGGER people_search_vector_trigger
          BEFORE INSERT OR UPDATE ON people
          FOR EACH ROW EXECUTE FUNCTION people_search_vector_update()
      `);
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_people_search_vector ON people USING GIN(search_vector)',
      );
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_people_name_trgm ON people USING GIN(immutable_unaccent(name_full) gin_trgm_ops)',
      );
      await pool.query(`
        UPDATE people SET search_vector =
          setweight(to_tsvector('simple', immutable_unaccent(COALESCE(name_full, ''))), 'A') ||
          setweight(to_tsvector('simple', immutable_unaccent(COALESCE(name_given, ''))), 'A') ||
          setweight(to_tsvector('simple', immutable_unaccent(COALESCE(name_surname, ''))), 'A') ||
          setweight(to_tsvector('simple', immutable_unaccent(COALESCE(birth_place, ''))), 'B') ||
          setweight(to_tsvector('simple', immutable_unaccent(COALESCE(death_place, ''))), 'B') ||
          setweight(to_tsvector('simple', immutable_unaccent(COALESCE(description, ''))), 'C') ||
          setweight(to_tsvector('simple', immutable_unaccent(COALESCE(notes, ''))), 'C')
        WHERE search_vector IS NULL
      `);
      return ['Created full-text search infrastructure'];
    },
  },
  {
    version: 6,
    name: 'estimated_dates_and_placeholders',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Add date accuracy columns (EXACT, ESTIMATED, RANGE, UNKNOWN)
      await pool.query(`
        ALTER TABLE people
        ADD COLUMN IF NOT EXISTS birth_date_accuracy VARCHAR(20) DEFAULT 'UNKNOWN',
        ADD COLUMN IF NOT EXISTS death_date_accuracy VARCHAR(20) DEFAULT 'UNKNOWN'
      `);
      results.push('Added birth_date_accuracy and death_date_accuracy columns');

      // Add year range columns for estimated/ranged dates
      await pool.query(`
        ALTER TABLE people
        ADD COLUMN IF NOT EXISTS birth_year_min INT,
        ADD COLUMN IF NOT EXISTS birth_year_max INT,
        ADD COLUMN IF NOT EXISTS death_year_min INT,
        ADD COLUMN IF NOT EXISTS death_year_max INT
      `);
      results.push('Added birth/death year min/max range columns');

      // Add placeholder flag for unknown parents
      await pool.query(`
        ALTER TABLE people
        ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN NOT NULL DEFAULT false
      `);
      results.push('Added is_placeholder column');

      // Create index for placeholder filtering
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_people_is_placeholder
        ON people(is_placeholder) WHERE is_placeholder = true
      `);
      results.push('Created index for placeholder people');

      // Add research scoring weight settings
      const weightSettings = [
        [
          'research_weight_missing_core_dates',
          '30',
          'Weight for missing birth/death years',
          'research',
        ],
        [
          'research_weight_missing_places',
          '15',
          'Weight for missing birth/death places',
          'research',
        ],
        [
          'research_weight_estimated_dates',
          '20',
          'Weight for estimated/ranged dates',
          'research',
        ],
        [
          'research_weight_placeholder_parent',
          '40',
          'Weight for having placeholder parents',
          'research',
        ],
        [
          'research_weight_low_sources',
          '25',
          'Weight for zero or low source count',
          'research',
        ],
        [
          'research_weight_manual_priority',
          '10',
          'Multiplier for manual research_priority',
          'research',
        ],
      ];

      for (const [key, value, description, category] of weightSettings) {
        await pool.query(
          `INSERT INTO settings (key, value, description, category)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (key) DO NOTHING`,
          [key, value, description, category],
        );
      }
      results.push('Added research scoring weight settings');

      return results;
    },
  },
  {
    version: 7,
    name: 'user_person_link',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Add person_id to users table to link users to their person record
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS person_id VARCHAR(12) REFERENCES people(id) ON DELETE SET NULL
      `);
      results.push('Added person_id column to users table');

      // Create index for efficient lookup
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_person_id ON users(person_id)
      `);
      results.push('Created index on users.person_id');

      return results;
    },
  },
  {
    version: 8,
    name: 'families_marriage_year',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Add marriage_year column to families table
      await pool.query(`
        ALTER TABLE families
        ADD COLUMN IF NOT EXISTS marriage_year INT
      `);
      results.push('Added marriage_year column to families table');

      // Populate marriage_year from marriage_date where possible
      await pool.query(`
        UPDATE families
        SET marriage_year = CAST(SUBSTRING(marriage_date FROM 1 FOR 4) AS INT)
        WHERE marriage_date IS NOT NULL
          AND marriage_date ~ '^[0-9]{4}'
          AND marriage_year IS NULL
      `);
      results.push('Populated marriage_year from existing marriage_date values');

      return results;
    },
  },
];

// Get current database version
async function getCurrentVersion(pool: Pool): Promise<number> {
  // Ensure schema_migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
  const { rows } = await pool.query(
    'SELECT MAX(version) as version FROM schema_migrations',
  );
  return rows[0]?.version || 0;
}

// Run pending migrations with advisory lock
export async function runMigrations(
  pool: Pool,
): Promise<{ success: boolean; results: string[]; message: string }> {
  const results: string[] = [];

  try {
    // Try to acquire advisory lock (non-blocking)
    const lockResult = await pool.query(
      'SELECT pg_try_advisory_lock($1) as acquired',
      [MIGRATION_LOCK_ID],
    );
    const lockAcquired = lockResult.rows[0]?.acquired;

    if (!lockAcquired) {
      results.push('Another migration is in progress, waiting...');
      // Wait and retry with blocking lock
      await pool.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    }

    try {
      const currentVersion = await getCurrentVersion(pool);
      results.push(`Current schema version: ${currentVersion}`);

      const pendingMigrations = migrations.filter(
        (m) => m.version > currentVersion,
      );

      if (pendingMigrations.length === 0) {
        results.push('Database is up to date');
        return { success: true, results, message: 'No pending migrations' };
      }

      results.push(`Found ${pendingMigrations.length} pending migration(s)`);

      for (const migration of pendingMigrations) {
        results.push(
          `Running migration ${migration.version}: ${migration.name}`,
        );
        const migrationResults = await migration.up(pool);
        results.push(...migrationResults);

        // Record migration
        await pool.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name],
        );
        results.push(`Completed migration ${migration.version}`);
      }

      return { success: true, results, message: 'Migrations completed' };
    } finally {
      // Always release the lock
      await pool.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    }
  } catch (error) {
    results.push(`Migration failed: ${(error as Error).message}`);
    return { success: false, results, message: (error as Error).message };
  }
}

/**
 * Ensure migrations are run on startup.
 * This is idempotent and safe to call multiple times.
 * Uses a singleton promise to prevent concurrent runs within the same process.
 */
export async function ensureMigrations(
  pool: Pool,
): Promise<{ success: boolean; results: string[]; message: string }> {
  // Return existing promise if migration is already in progress
  if (migrationPromise) {
    return migrationPromise;
  }

  // Start migration and cache the promise
  migrationPromise = runMigrations(pool);

  try {
    const result = await migrationPromise;
    // Log migration results for visibility
    if (result.results.length > 0) {
      console.log('[Migrations]', result.message, result.results.join(' | '));
    }
    return result;
  } catch (error) {
    console.error('[Migrations] Failed:', error);
    throw error;
  }
}

// Get migration status
export async function getMigrationStatus(pool: Pool): Promise<{
  currentVersion: number;
  latestVersion: number;
  pendingCount: number;
  appliedMigrations: { version: number; name: string; applied_at: Date }[];
}> {
  const currentVersion = await getCurrentVersion(pool);
  const latestVersion = Math.max(...migrations.map((m) => m.version), 0);

  const { rows } = await pool.query(
    'SELECT version, name, applied_at FROM schema_migrations ORDER BY version',
  );

  return {
    currentVersion,
    latestVersion,
    pendingCount: migrations.filter((m) => m.version > currentVersion).length,
    appliedMigrations: rows,
  };
}
