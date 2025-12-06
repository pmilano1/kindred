import { pool } from '../pool';
import { Person } from '../types';
import {
  getUsers,
  getInvitations,
  createInvitation,
  deleteInvitation,
  updateUserRole,
  deleteUser,
  logAudit
} from '../users';
import { sendInviteEmail, verifyEmailForSandbox } from '../email';
import { Loaders } from './dataloaders';
import { getSettings, clearSettingsCache, SiteSettings } from '../settings';

// Strip accents from a string for accent-insensitive search
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface Context {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  loaders: Loaders;
}

// Helper to check auth for mutations
function requireAuth(context: Context, requiredRole: 'viewer' | 'editor' | 'admin' = 'viewer') {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  if (requiredRole === 'admin' && context.user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  if (requiredRole === 'editor' && !['admin', 'editor'].includes(context.user.role)) {
    throw new Error('Editor access required');
  }
  return context.user;
}

// Cursor encoding/decoding
const encodeCursor = (id: string) => Buffer.from(id).toString('base64');
const decodeCursor = (cursor: string) => Buffer.from(cursor, 'base64').toString('utf-8');

// Helper to get a person by ID
async function getPerson(id: string): Promise<Person | null> {
  const { rows } = await pool.query(
    `SELECT *, COALESCE(notes, description) as description FROM people WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export const resolvers = {
  Query: {
    // Single lookups
    person: (_: unknown, { id }: { id: string }) => getPerson(id),

    family: async (_: unknown, { id }: { id: string }, ctx: Context) =>
      ctx.loaders.familyLoader.load(id),

    // Cursor-based pagination for people
    people: async (_: unknown, { first = 50, after, last, before }: { first?: number; after?: string; last?: number; before?: string }) => {
      const limit = Math.min(first || last || 50, 100);
      const afterId = after ? decodeCursor(after) : null;
      const beforeId = before ? decodeCursor(before) : null;

      // Get total count
      const countResult = await pool.query('SELECT COUNT(*) FROM people');
      const totalCount = parseInt(countResult.rows[0].count);

      // Build query with cursor
      let query = `SELECT *, COALESCE(notes, description) as description FROM people`;
      const params: (string | number)[] = [];

      if (afterId) {
        query += ` WHERE id > $1`;
        params.push(afterId);
      } else if (beforeId) {
        query += ` WHERE id < $1`;
        params.push(beforeId);
      }

      query += ` ORDER BY id ${beforeId ? 'DESC' : 'ASC'} LIMIT $${params.length + 1}`;
      params.push(limit + 1); // Fetch one extra to check if there's more

      const { rows } = await pool.query(query, params);
      const hasMore = rows.length > limit;
      const people = hasMore ? rows.slice(0, limit) : rows;
      if (beforeId) people.reverse();

      return {
        edges: people.map((p: { id: string }) => ({ node: p, cursor: encodeCursor(p.id) })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: !!afterId,
          startCursor: people.length ? encodeCursor(people[0].id) : null,
          endCursor: people.length ? encodeCursor(people[people.length - 1].id) : null,
          totalCount,
        },
      };
    },

    // Legacy offset-based (for backwards compatibility)
    // Tree component needs all people - allow up to 10000 for tree view
    peopleList: async (_: unknown, { limit = 100, offset = 0 }: { limit?: number; offset?: number }) => {
      const { rows } = await pool.query(`
        SELECT *, COALESCE(notes, description) as description
        FROM people
        ORDER BY birth_year DESC NULLS LAST
        LIMIT $1 OFFSET $2
      `, [Math.min(limit, 10000), offset]);
      return rows;
    },

    // Recent people (for home page)
    recentPeople: async (_: unknown, { limit = 10 }: { limit?: number }) => {
      const { rows } = await pool.query(`
        SELECT *, COALESCE(notes, description) as description
        FROM people
        WHERE birth_year IS NOT NULL
        ORDER BY birth_year DESC
        LIMIT $1
      `, [Math.min(limit, 50)]);
      return rows;
    },

    // Notable people (marked with is_notable = true)
    notablePeople: async () => {
      const { rows } = await pool.query(`
        SELECT *, COALESCE(notes, description) as description
        FROM people
        WHERE is_notable = true
        ORDER BY birth_year ASC NULLS LAST
      `);
      return rows;
    },

    // Search with pagination (accent-insensitive)
    search: async (_: unknown, { query, first = 50, after }: { query: string; first?: number; after?: string }) => {
      const limit = Math.min(first, 100);
      const afterId = after ? decodeCursor(after) : null;

      // Normalize search query for accent-insensitive matching
      const normalizedQuery = stripAccents(query).toLowerCase();

      // Fetch all people and filter in JS for accent-insensitive search
      // This is more reliable than trying to use SQL-level unaccent
      const sql = `SELECT *, COALESCE(notes, description) as description FROM people ORDER BY name_full`;
      const { rows: allPeople } = await pool.query(sql);

      // Filter with accent-insensitive matching
      const matchingPeople = allPeople.filter((p: { name_full: string; birth_place?: string; death_place?: string }) => {
        const nameMatch = stripAccents(p.name_full || '').toLowerCase().includes(normalizedQuery);
        const birthMatch = stripAccents(p.birth_place || '').toLowerCase().includes(normalizedQuery);
        const deathMatch = stripAccents(p.death_place || '').toLowerCase().includes(normalizedQuery);
        return nameMatch || birthMatch || deathMatch;
      });

      // Apply cursor-based pagination
      let startIdx = 0;
      if (afterId) {
        const afterIdx = matchingPeople.findIndex((p: { id: string }) => p.id === afterId);
        if (afterIdx >= 0) startIdx = afterIdx + 1;
      }

      const paginatedPeople = matchingPeople.slice(startIdx, startIdx + limit + 1);
      const hasMore = paginatedPeople.length > limit;
      const people = hasMore ? paginatedPeople.slice(0, limit) : paginatedPeople;

      return {
        edges: people.map((p: { id: string }) => ({ node: p, cursor: encodeCursor(p.id) })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: startIdx > 0,
          startCursor: people.length ? encodeCursor(people[0].id) : null,
          endCursor: people.length ? encodeCursor(people[people.length - 1].id) : null,
          totalCount: matchingPeople.length,
        },
      };
    },

    families: async () => {
      const { rows } = await pool.query(`SELECT * FROM families`);
      return rows;
    },

    stats: async () => {
      const { rows } = await pool.query(`
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
      return rows[0];
    },

    researchQueue: async (_: unknown, { limit = 50 }: { limit?: number }) => {
      const { rows } = await pool.query(`
        SELECT * FROM people
        WHERE research_status != 'verified' OR research_status IS NULL
        ORDER BY
          research_priority DESC NULLS LAST,
          (research_status = 'brick_wall') DESC,
          (research_status = 'in_progress') DESC,
          last_researched NULLS FIRST
        LIMIT $1
      `, [Math.min(limit, 100)]);
      return rows;
    },

    // Optimized ancestry traversal (single recursive CTE)
    ancestors: async (_: unknown, { personId, generations = 5 }: { personId: string; generations?: number }) => {
      const { rows } = await pool.query(`
        WITH RECURSIVE ancestry AS (
          SELECT p.*, 1 as gen FROM people p
          JOIN children c ON c.person_id = $1
          JOIN families f ON c.family_id = f.id
          WHERE p.id = f.husband_id OR p.id = f.wife_id

          UNION ALL

          SELECT p.*, a.gen + 1 FROM ancestry a
          JOIN children c ON c.person_id = a.id
          JOIN families f ON c.family_id = f.id
          JOIN people p ON (p.id = f.husband_id OR p.id = f.wife_id)
          WHERE a.gen < $2
        )
        SELECT DISTINCT ON (id) * FROM ancestry ORDER BY id, gen
      `, [personId, generations]);
      return rows;
    },

    // Optimized descendant traversal (single recursive CTE)
    descendants: async (_: unknown, { personId, generations = 5 }: { personId: string; generations?: number }) => {
      const { rows } = await pool.query(`
        WITH RECURSIVE descendancy AS (
          SELECT p.*, 1 as gen FROM people p
          JOIN children c ON c.person_id = p.id
          JOIN families f ON c.family_id = f.id
          WHERE f.husband_id = $1 OR f.wife_id = $1

          UNION ALL

          SELECT p.*, d.gen + 1 FROM descendancy d
          JOIN families f ON (f.husband_id = d.id OR f.wife_id = d.id)
          JOIN children c ON c.family_id = f.id
          JOIN people p ON p.id = c.person_id
          WHERE d.gen < $2
        )
        SELECT DISTINCT ON (id) * FROM descendancy ORDER BY id, gen
      `, [personId, generations]);
      return rows;
    },

    // Timeline - grouped by year
    timeline: async () => {
      const { rows } = await pool.query(`
        SELECT * FROM people WHERE birth_year IS NOT NULL OR death_year IS NOT NULL
      `);

      const events: Map<number, Array<{type: string; person: Person}>> = new Map();

      for (const person of rows) {
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
    },

    // Current user query
    me: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      const { rows } = await pool.query(
        'SELECT id, email, name, role, created_at, last_login, last_accessed, api_key FROM users WHERE id = $1',
        [user.id]
      );
      return rows[0] || null;
    },

    // Admin queries
    users: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      return getUsers();
    },

    invitations: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      return getInvitations();
    },

    // Surname crests (coat of arms by surname)
    surnameCrests: async () => {
      const { rows } = await pool.query(`SELECT * FROM surname_crests ORDER BY surname`);
      return rows;
    },

    surnameCrest: async (_: unknown, { surname }: { surname: string }) => {
      const { rows } = await pool.query(
        `SELECT * FROM surname_crests WHERE LOWER(surname) = LOWER($1) LIMIT 1`,
        [surname]
      );
      return rows[0] || null;
    },

    // Settings queries
    siteSettings: async (): Promise<SiteSettings> => {
      return getSettings();
    },

    settings: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      try {
        const { rows } = await pool.query(
          'SELECT key, value, description, category, updated_at FROM settings ORDER BY category, key'
        );
        return rows;
      } catch (error) {
        // Table might not exist
        if ((error as { code?: string }).code === '42P01') {
          return [];
        }
        throw error;
      }
    },

    migrationStatus: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      const { rows } = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      const requiredTables = ['people', 'families', 'children', 'users', 'settings'];
      const existingTables = rows.map((r: { table_name: string }) => r.table_name);
      const missingTables = requiredTables.filter(t => !existingTables.includes(t));
      return {
        tables: existingTables,
        missingTables,
        migrationNeeded: missingTables.length > 0
      };
    },
  },

  Mutation: {
    updatePerson: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, context: Context) => {
      requireAuth(context, 'editor');
      
      const fields = Object.keys(input).filter(k => input[k] !== undefined);
      if (fields.length === 0) return getPerson(id);
      
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = fields.map(f => input[f]);
      
      await pool.query(
        `UPDATE people SET ${setClause} WHERE id = $1`,
        [id, ...values]
      );
      
      return getPerson(id);
    },
    
    addSource: async (_: unknown, { personId, input }: { personId: string; input: { source_type?: string; source_name?: string; source_url?: string; action: string; content?: string; confidence?: string } }, context: Context) => {
      requireAuth(context, 'editor');

      const { rows } = await pool.query(
        `INSERT INTO sources (person_id, source_type, source_name, source_url, action, content, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [personId, input.source_type, input.source_name, input.source_url, input.action, input.content, input.confidence]
      );
      return rows[0];
    },
    
    updateResearchStatus: async (_: unknown, { personId, status }: { personId: string; status: string }, context: Context) => {
      requireAuth(context, 'editor');
      await pool.query(
        `UPDATE people SET research_status = $1, last_researched = NOW() WHERE id = $2`,
        [status, personId]
      );
      return getPerson(personId);
    },

    updateResearchPriority: async (_: unknown, { personId, priority }: { personId: string; priority: number }, context: Context) => {
      requireAuth(context, 'editor');
      await pool.query(
        `UPDATE people SET research_priority = $1 WHERE id = $2`,
        [priority, personId]
      );
      return getPerson(personId);
    },

    // Admin mutations
    createInvitation: async (_: unknown, { email, role }: { email: string; role: string }, context: Context) => {
      const user = requireAuth(context, 'admin');

      const invitation = await createInvitation(email, role, user.id);
      await logAudit(user.id, 'create_invitation', { email, role });

      // Generate invitation URL
      const inviteUrl = `${process.env.NEXTAUTH_URL}/login?invite=${invitation.token}`;

      // Verify email for SES sandbox mode
      await verifyEmailForSandbox(email);

      // Send invite email
      try {
        await sendInviteEmail({
          to: email,
          inviteUrl,
          role,
          inviterName: user.email,
          inviterEmail: user.email
        });
      } catch (error) {
        console.error('Failed to send invite email:', error);
      }

      return invitation;
    },

    deleteInvitation: async (_: unknown, { id }: { id: string }, context: Context) => {
      const user = requireAuth(context, 'admin');
      await deleteInvitation(id);
      await logAudit(user.id, 'delete_invitation', { invitationId: id });
      return true;
    },

    updateUserRole: async (_: unknown, { userId, role }: { userId: string; role: string }, context: Context) => {
      const user = requireAuth(context, 'admin');

      // Prevent removing own admin rights
      if (userId === user.id && role !== 'admin') {
        throw new Error('Cannot demote yourself');
      }

      await updateUserRole(userId, role);
      await logAudit(user.id, 'update_user_role', { targetUserId: userId, newRole: role });

      // Return updated user
      const users = await getUsers();
      return users.find(u => u.id === userId);
    },

    deleteUser: async (_: unknown, { userId }: { userId: string }, context: Context) => {
      const user = requireAuth(context, 'admin');

      // Prevent self-deletion
      if (userId === user.id) {
        throw new Error('Cannot delete yourself');
      }

      await deleteUser(userId);
      await logAudit(user.id, 'delete_user', { deletedUserId: userId });
      return true;
    },

    // Surname crest mutations
    setSurnameCrest: async (_: unknown, { surname, coatOfArms, description, origin, motto }: { surname: string; coatOfArms: string; description?: string; origin?: string; motto?: string }, context: Context) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `INSERT INTO surname_crests (surname, coat_of_arms, description, origin, motto)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (surname) DO UPDATE SET
           coat_of_arms = $2, description = $3, origin = $4, motto = $5, updated_at = NOW()
         RETURNING *`,
        [surname, coatOfArms, description || null, origin || null, motto || null]
      );
      return rows[0];
    },

    removeSurnameCrest: async (_: unknown, { surname }: { surname: string }, context: Context) => {
      requireAuth(context, 'editor');
      await pool.query(`DELETE FROM surname_crests WHERE LOWER(surname) = LOWER($1)`, [surname]);
      return true;
    },

    // Person-specific coat of arms override (stored in facts table)
    setPersonCoatOfArms: async (_: unknown, { personId, coatOfArms }: { personId: string; coatOfArms: string }, context: Context) => {
      requireAuth(context, 'editor');
      await pool.query(
        `INSERT INTO facts (person_id, fact_type, fact_value)
         VALUES ($1, 'coat_of_arms', $2)
         ON CONFLICT (person_id, fact_type) DO UPDATE SET fact_value = $2`,
        [personId, coatOfArms]
      );
      return coatOfArms;
    },

    removePersonCoatOfArms: async (_: unknown, { personId }: { personId: string }, context: Context) => {
      requireAuth(context, 'editor');
      await pool.query(`DELETE FROM facts WHERE person_id = $1 AND fact_type = 'coat_of_arms'`, [personId]);
      return true;
    },

    // Settings mutations
    updateSettings: async (_: unknown, { input }: { input: Record<string, string | null> }, context: Context) => {
      requireAuth(context, 'admin');
      const entries = Object.entries(input).filter(([, v]) => v !== undefined);
      for (const [key, value] of entries) {
        await pool.query(
          `INSERT INTO settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, value]
        );
      }
      clearSettingsCache();
      return getSettings();
    },

    runMigrations: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      const results: string[] = [];

      // Check/create settings table
      const settingsCheck = await pool.query(`
        SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings')
      `);

      if (!settingsCheck.rows[0].exists) {
        await pool.query(`
          CREATE TABLE settings (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT,
            description VARCHAR(500),
            category VARCHAR(50) DEFAULT 'general',
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        results.push('Created settings table');

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
        results.push('Inserted default settings');
      } else {
        results.push('Settings table exists');
      }

      return { success: true, results, message: 'Migrations completed' };
    },

    // API Key mutations
    generateApiKey: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      // Generate a secure random API key (64 hex characters)
      const crypto = await import('crypto');
      const apiKey = crypto.randomBytes(32).toString('hex');

      await pool.query('UPDATE users SET api_key = $1 WHERE id = $2', [apiKey, user.id]);
      await logAudit(user.id, 'generate_api_key', { userId: user.id });

      return apiKey;
    },

    revokeApiKey: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      await pool.query('UPDATE users SET api_key = NULL WHERE id = $1', [user.id]);
      await logAudit(user.id, 'revoke_api_key', { userId: user.id });
      return true;
    },
  },

  // Field resolvers - use DataLoaders for batched queries
  Person: {
    parents: async (person: { id: string }, _: unknown, ctx: Context) => {
      const families = await ctx.loaders.familiesAsChildLoader.load(person.id);
      if (families.length === 0) return [];
      const parentIds = families.flatMap(f => [f.husband_id, f.wife_id].filter(Boolean)) as string[];
      return parentIds.length ? (await ctx.loaders.personLoader.loadMany(parentIds)).filter(Boolean) : [];
    },
    siblings: async (person: { id: string }, _: unknown, ctx: Context) => {
      const parentFamilies = await ctx.loaders.familiesAsChildLoader.load(person.id);
      if (parentFamilies.length === 0) return [];
      const childrenByFamily = await ctx.loaders.childrenByFamilyLoader.loadMany(parentFamilies.map(f => f.id));
      const siblingIds = [...new Set(childrenByFamily.flat().filter((id): id is string => typeof id === 'string' && id !== person.id))];
      return siblingIds.length ? (await ctx.loaders.personLoader.loadMany(siblingIds)).filter(Boolean) : [];
    },
    spouses: async (person: { id: string }, _: unknown, ctx: Context) => {
      const families = await ctx.loaders.familiesAsSpouseLoader.load(person.id);
      const spouseIds = families.map(f => f.husband_id === person.id ? f.wife_id : f.husband_id).filter(Boolean) as string[];
      return spouseIds.length ? (await ctx.loaders.personLoader.loadMany(spouseIds)).filter(Boolean) : [];
    },
    children: async (person: { id: string }, _: unknown, ctx: Context) => {
      const families = await ctx.loaders.familiesAsSpouseLoader.load(person.id);
      if (families.length === 0) return [];
      const childrenByFamily = await ctx.loaders.childrenByFamilyLoader.loadMany(families.map(f => f.id));
      const childIds = [...new Set(childrenByFamily.flat().filter((id): id is string => typeof id === 'string'))];
      return childIds.length ? (await ctx.loaders.personLoader.loadMany(childIds)).filter(Boolean) : [];
    },
    families: async (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.familiesAsSpouseLoader.load(person.id),
    lifeEvents: async (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.lifeEventsLoader.load(person.id),
    facts: (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.factsLoader.load(person.id),
    sources: (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.sourcesLoader.load(person.id),
    // Coat of arms: check person override first, then surname lookup
    coatOfArms: async (person: { id: string; name_surname?: string }) => {
      // 1. Check for person-specific override in facts table
      const { rows: personRows } = await pool.query(
        `SELECT fact_value FROM facts WHERE person_id = $1 AND fact_type = 'coat_of_arms' LIMIT 1`,
        [person.id]
      );
      if (personRows[0]?.fact_value) return personRows[0].fact_value;

      // 2. Look up by surname
      if (person.name_surname) {
        const { rows: surnameRows } = await pool.query(
          `SELECT coat_of_arms FROM surname_crests WHERE LOWER(surname) = LOWER($1) LIMIT 1`,
          [person.name_surname]
        );
        if (surnameRows[0]?.coat_of_arms) return surnameRows[0].coat_of_arms;
      }

      return null;
    },
    // Notable relatives connected through ancestry
    notableRelatives: async (person: { id: string }) => {
      const { rows } = await pool.query(`
        WITH RECURSIVE ancestry AS (
          -- Trace direct ancestors up to 15 generations
          SELECT p.id, p.name_full, 0 as generation, ARRAY[p.id]::text[] as path
          FROM people p WHERE p.id = $1
          UNION ALL
          SELECT parent.id, parent.name_full, a.generation + 1, a.path || parent.id::text
          FROM ancestry a
          JOIN children c ON c.person_id = a.id
          JOIN families f ON c.family_id = f.id
          JOIN people parent ON (parent.id = f.husband_id OR parent.id = f.wife_id)
          WHERE a.generation < 15 AND NOT parent.id = ANY(a.path)
        ),
        ancestor_siblings AS (
          -- Find siblings (full and half) of each ancestor
          -- Half-siblings share a parent but may be in different families
          SELECT DISTINCT sibling.id, sibling.name_full, a.generation
          FROM ancestry a
          JOIN children c1 ON c1.person_id = a.id
          JOIN families f1 ON c1.family_id = f1.id
          -- Find other families where the same parent appears
          JOIN families f2 ON (f2.husband_id = f1.husband_id OR f2.wife_id = f1.wife_id
                               OR f2.husband_id = f1.wife_id OR f2.wife_id = f1.husband_id)
          JOIN children c2 ON c2.family_id = f2.id AND c2.person_id != a.id
          JOIN people sibling ON sibling.id = c2.person_id
        ),
        sibling_descendants AS (
          -- Recursively find all descendants of ancestor siblings (up to 6 generations down)
          SELECT s.id, s.name_full, s.generation as ancestor_gen, 0 as desc_gen, ARRAY[s.id]::text[] as path
          FROM ancestor_siblings s
          UNION ALL
          SELECT child.id, child.name_full, sd.ancestor_gen, sd.desc_gen + 1, sd.path || child.id::text
          FROM sibling_descendants sd
          JOIN families f ON (f.husband_id = sd.id OR f.wife_id = sd.id)
          JOIN children c ON c.family_id = f.id
          JOIN people child ON child.id = c.person_id
          WHERE sd.desc_gen < 6 AND NOT child.id = ANY(sd.path)
        ),
        all_relatives AS (
          -- Combine: ancestors, sibling descendants, and their spouses
          SELECT sd.id, sd.name_full, sd.ancestor_gen as generation FROM sibling_descendants sd
          UNION
          SELECT a.id, a.name_full, a.generation FROM ancestry a
          UNION
          SELECT spouse.id, spouse.name_full, sd.ancestor_gen
          FROM sibling_descendants sd
          JOIN families f ON (f.husband_id = sd.id OR f.wife_id = sd.id)
          JOIN people spouse ON (spouse.id = f.husband_id OR spouse.id = f.wife_id) AND spouse.id != sd.id
        )
        SELECT DISTINCT ar.id, ar.name_full, ar.generation,
               p.*, COALESCE(p.notes, p.description) as description
        FROM all_relatives ar
        JOIN people p ON p.id = ar.id
        WHERE p.is_notable = true
        ORDER BY ar.generation
      `, [person.id]);

      return rows.map(row => ({
        person: row,
        generation: row.generation
      }));
    },
  },

  Family: {
    husband: (family: { husband_id: string | null }, _: unknown, ctx: Context) =>
      family.husband_id ? ctx.loaders.personLoader.load(family.husband_id) : null,
    wife: (family: { wife_id: string | null }, _: unknown, ctx: Context) =>
      family.wife_id ? ctx.loaders.personLoader.load(family.wife_id) : null,
    children: async (family: { id: string }, _: unknown, ctx: Context) => {
      const childIds = await ctx.loaders.childrenByFamilyLoader.load(family.id);
      return childIds.length ? (await ctx.loaders.personLoader.loadMany(childIds)).filter(Boolean) : [];
    },
  },
};

