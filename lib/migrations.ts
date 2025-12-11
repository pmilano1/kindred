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
  // Migration #0: Bootstrap core tables (required for fresh databases)
  // This ensures users, people, families, children exist before any migration that references them
  {
    version: 0,
    name: 'bootstrap_core_tables',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Create users table first (no foreign keys)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(12) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          image VARCHAR(500),
          role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
          account_type VARCHAR(20) DEFAULT 'user' CHECK (account_type IN ('user', 'service')),
          description TEXT,
          invited_by VARCHAR(12),
          invited_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          last_login TIMESTAMP
        )
      `);
      results.push('Created users table (bootstrap)');

      // Create people table (no foreign keys)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS people (
          id VARCHAR(12) PRIMARY KEY,
          xref VARCHAR(20),
          familysearch_id VARCHAR(50),
          legacy_id VARCHAR(100),
          name_given VARCHAR(200),
          name_surname VARCHAR(100),
          name_suffix VARCHAR(50),
          name_full VARCHAR(300),
          sex CHAR(1) CHECK (sex IN ('M', 'F', 'U')),
          birth_date VARCHAR(50),
          birth_year INT,
          birth_month INT,
          birth_day INT,
          birth_place VARCHAR(500),
          death_date VARCHAR(50),
          death_year INT,
          death_month INT,
          death_day INT,
          death_place VARCHAR(500),
          burial_date VARCHAR(50),
          burial_place VARCHAR(500),
          christening_date VARCHAR(50),
          christening_place VARCHAR(500),
          immigration_date VARCHAR(50),
          immigration_place VARCHAR(500),
          naturalization_date VARCHAR(50),
          naturalization_place VARCHAR(500),
          religion VARCHAR(100),
          living BOOLEAN DEFAULT FALSE,
          description TEXT,
          notes TEXT,
          occupation VARCHAR(200),
          is_notable BOOLEAN DEFAULT FALSE,
          notable_description TEXT,
          research_status VARCHAR(20) DEFAULT 'not_started',
          research_priority INT DEFAULT 0,
          last_researched TIMESTAMP,
          source_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created people table (bootstrap)');

      // Create families table (references people)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS families (
          id VARCHAR(12) PRIMARY KEY,
          husband_id VARCHAR(12) REFERENCES people(id),
          wife_id VARCHAR(12) REFERENCES people(id),
          marriage_date VARCHAR(50),
          marriage_place VARCHAR(500),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created families table (bootstrap)');

      // Create children junction table (references families and people)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS children (
          family_id VARCHAR(12) REFERENCES families(id) ON DELETE CASCADE,
          person_id VARCHAR(12) REFERENCES people(id) ON DELETE CASCADE,
          birth_order INT,
          PRIMARY KEY (family_id, person_id)
        )
      `);
      results.push('Created children table (bootstrap)');

      return results;
    },
  },
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
          user_id VARCHAR(12) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
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
      results.push(
        'Populated marriage_year from existing marriage_date values',
      );

      return results;
    },
  },
  {
    version: 9,
    name: 'person_comments',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Create person_comments table for collaboration (Issue #181 - Phase 1)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS person_comments (
          id VARCHAR(12) PRIMARY KEY,
          person_id VARCHAR(12) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          parent_comment_id VARCHAR(12) REFERENCES person_comments(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created person_comments table');

      // Create indexes for performance
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_person_comments_person_id
        ON person_comments(person_id)
      `);
      results.push('Created index on person_comments.person_id');

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_person_comments_user_id
        ON person_comments(user_id)
      `);
      results.push('Created index on person_comments.user_id');

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_person_comments_parent_id
        ON person_comments(parent_comment_id)
      `);
      results.push('Created index on person_comments.parent_comment_id');

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_person_comments_created_at
        ON person_comments(created_at DESC)
      `);
      results.push('Created index on person_comments.created_at');

      return results;
    },
  },

  // Migration #10: Core genealogy tables (people, families, children)
  {
    version: 10,
    name: 'core_genealogy_tables',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Create people table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS people (
          id VARCHAR(12) PRIMARY KEY,
          xref VARCHAR(20),
          familysearch_id VARCHAR(50),
          legacy_id VARCHAR(100),
          name_given VARCHAR(200),
          name_surname VARCHAR(100),
          name_suffix VARCHAR(50),
          name_full VARCHAR(300),
          sex CHAR(1) CHECK (sex IN ('M', 'F', 'U')),
          birth_date VARCHAR(50),
          birth_year INT,
          birth_month INT,
          birth_day INT,
          birth_place VARCHAR(500),
          death_date VARCHAR(50),
          death_year INT,
          death_month INT,
          death_day INT,
          death_place VARCHAR(500),
          burial_date VARCHAR(50),
          burial_place VARCHAR(500),
          christening_date VARCHAR(50),
          christening_place VARCHAR(500),
          immigration_date VARCHAR(50),
          immigration_place VARCHAR(500),
          naturalization_date VARCHAR(50),
          naturalization_place VARCHAR(500),
          religion VARCHAR(100),
          living BOOLEAN DEFAULT FALSE,
          description TEXT,
          notes TEXT,
          occupation VARCHAR(200),
          is_notable BOOLEAN DEFAULT FALSE,
          notable_description TEXT,
          research_status VARCHAR(20) DEFAULT 'not_started',
          research_priority INT DEFAULT 0,
          last_researched TIMESTAMP,
          source_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created people table');

      // Create families table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS families (
          id VARCHAR(12) PRIMARY KEY,
          husband_id VARCHAR(12) REFERENCES people(id),
          wife_id VARCHAR(12) REFERENCES people(id),
          marriage_date VARCHAR(50),
          marriage_place VARCHAR(500),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created families table');

      // Create children junction table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS children (
          family_id VARCHAR(12) REFERENCES families(id) ON DELETE CASCADE,
          person_id VARCHAR(12) REFERENCES people(id) ON DELETE CASCADE,
          birth_order INT,
          PRIMARY KEY (family_id, person_id)
        )
      `);
      results.push('Created children table');

      return results;
    },
  },

  // Migration #11: Research tables (sources, facts, life_events, alternate_names)
  {
    version: 11,
    name: 'research_tables',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Create sources table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sources (
          id VARCHAR(12) PRIMARY KEY,
          person_id VARCHAR(12) REFERENCES people(id) ON DELETE CASCADE,
          source_type VARCHAR(50),
          source_name VARCHAR(255),
          source_url VARCHAR(500),
          source_citation TEXT,
          content TEXT,
          confidence VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created sources table');

      // Create facts table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS facts (
          id VARCHAR(12) PRIMARY KEY,
          person_id VARCHAR(12) REFERENCES people(id) ON DELETE CASCADE,
          fact_type VARCHAR(100),
          fact_value TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created facts table');

      // Create life_events table (renamed from events)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS life_events (
          id VARCHAR(12) PRIMARY KEY,
          person_id VARCHAR(12) REFERENCES people(id) ON DELETE CASCADE,
          event_type VARCHAR(100),
          event_date VARCHAR(50),
          event_year INT,
          event_place VARCHAR(500),
          event_value TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created life_events table');

      // Create alternate_names table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS alternate_names (
          id SERIAL PRIMARY KEY,
          person_id VARCHAR(12) REFERENCES people(id) ON DELETE CASCADE,
          name_given VARCHAR(200),
          name_surname VARCHAR(100),
          name_full VARCHAR(300)
        )
      `);
      results.push('Created alternate_names table');

      return results;
    },
  },

  // Migration #12: User/auth tables (users, invitations, audit_log)
  {
    version: 12,
    name: 'user_auth_tables',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Create users table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(12) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          image VARCHAR(500),
          role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
          account_type VARCHAR(20) DEFAULT 'user' CHECK (account_type IN ('user', 'service')),
          description TEXT,
          invited_by VARCHAR(12) REFERENCES users(id),
          invited_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          last_login TIMESTAMP
        )
      `);
      results.push('Created users table');

      // Create invitations table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS invitations (
          id VARCHAR(12) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
          invited_by VARCHAR(12) REFERENCES users(id),
          token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          accepted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created invitations table');

      // Create audit_log table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(12) REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          details JSONB,
          ip_address VARCHAR(45),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created audit_log table');

      return results;
    },
  },

  // Migration #13: Specialized tables (surname_crests, media)
  {
    version: 13,
    name: 'specialized_tables',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Create surname_crests table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS surname_crests (
          id VARCHAR(12) PRIMARY KEY,
          surname VARCHAR(100) NOT NULL,
          coat_of_arms TEXT,
          storage_path VARCHAR(500),
          blazon TEXT,
          source_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created surname_crests table');

      // Create media table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS media (
          id VARCHAR(12) PRIMARY KEY,
          person_id VARCHAR(12) REFERENCES people(id) ON DELETE CASCADE,
          filename VARCHAR(255) NOT NULL,
          original_filename VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          file_size INTEGER NOT NULL,
          storage_path VARCHAR(500) NOT NULL,
          thumbnail_path VARCHAR(500),
          media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('photo', 'document', 'certificate', 'other')),
          caption TEXT,
          date_taken DATE,
          source_attribution TEXT,
          uploaded_by VARCHAR(12) REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created media table');

      return results;
    },
  },

  // Migration #14: Create all indexes
  {
    version: 14,
    name: 'create_indexes',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // People indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_people_birth_year ON people(birth_year);
        CREATE INDEX IF NOT EXISTS idx_people_familysearch ON people(familysearch_id);
        CREATE INDEX IF NOT EXISTS idx_people_legacy_id ON people(legacy_id);
        CREATE INDEX IF NOT EXISTS idx_people_surname ON people(name_surname);
        CREATE INDEX IF NOT EXISTS idx_people_research_priority ON people(research_priority DESC);
        CREATE INDEX IF NOT EXISTS idx_people_research_status ON people(research_status);
      `);
      results.push('Created people indexes');

      // Families indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_families_husband ON families(husband_id);
        CREATE INDEX IF NOT EXISTS idx_families_wife ON families(wife_id);
      `);
      results.push('Created families indexes');

      // Children indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
        CREATE INDEX IF NOT EXISTS idx_children_person ON children(person_id);
      `);
      results.push('Created children indexes');

      // Sources indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sources_person ON sources(person_id);
      `);
      results.push('Created sources indexes');

      // Facts indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_facts_person ON facts(person_id);
      `);
      results.push('Created facts indexes');

      // Life events indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_life_events_person ON life_events(person_id);
      `);
      results.push('Created life_events indexes');

      // Alternate names indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_alternate_names_person ON alternate_names(person_id);
      `);
      results.push('Created alternate_names indexes');

      // Users indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `);
      results.push('Created users indexes');

      // Invitations indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
        CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
      `);
      results.push('Created invitations indexes');

      // Audit log indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      `);
      results.push('Created audit_log indexes');

      // Media indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_media_person_id ON media(person_id);
        CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
      `);
      results.push('Created media indexes');

      // Surname crests indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_surname_crests_surname ON surname_crests(surname);
        CREATE INDEX IF NOT EXISTS idx_surname_crests_storage_path ON surname_crests(storage_path);
      `);
      results.push('Created surname_crests indexes');

      return results;
    },
  },

  // Migration #15: Email configuration settings (Issue #278)
  {
    version: 15,
    name: 'email_settings',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Add email configuration settings to settings table
      const emailSettings = [
        ['email_provider', 'none', 'Email provider (none, ses, smtp)', 'email'],
        ['email_from', null, 'From email address', 'email'],
        ['email_ses_region', 'us-east-1', 'AWS SES region', 'email'],
        ['email_smtp_host', null, 'SMTP server hostname', 'email'],
        ['email_smtp_port', '587', 'SMTP server port', 'email'],
        ['email_smtp_secure', 'false', 'Use TLS/SSL for SMTP', 'email'],
        ['email_smtp_user', null, 'SMTP username', 'email'],
        ['email_smtp_password', null, 'SMTP password', 'email'],
      ];

      for (const [key, value, description, category] of emailSettings) {
        await pool.query(
          `INSERT INTO settings (key, value, description, category)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (key) DO NOTHING`,
          [key, value, description, category],
        );
      }
      results.push('Added email configuration settings');

      return results;
    },
  },

  // Migration #16: Client-side error logging (Issue #295)
  {
    version: 16,
    name: 'client_errors_table',
    up: async (pool: Pool) => {
      const results: string[] = [];

      // Create client_errors table for centralized error logging
      await pool.query(`
        CREATE TABLE IF NOT EXISTS client_errors (
          id VARCHAR(12) PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          error_message TEXT NOT NULL,
          stack_trace TEXT,
          url TEXT,
          user_agent TEXT,
          component_stack TEXT,
          error_info JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes for efficient querying
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_client_errors_created_at ON client_errors(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_client_errors_user_id ON client_errors(user_id);
        CREATE INDEX IF NOT EXISTS idx_client_errors_url ON client_errors(url);
      `);

      // Add setting to enable/disable client-side error logging
      await pool.query(
        `INSERT INTO settings (key, value, description, category)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO NOTHING`,
        [
          'enable_error_logging',
          'true',
          'Enable client-side error logging',
          'system',
        ],
      );

      results.push('Created client_errors table with indexes and settings');
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
  // Return -1 for fresh database so migration 0 (bootstrap) runs
  return rows[0]?.version ?? -1;
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
