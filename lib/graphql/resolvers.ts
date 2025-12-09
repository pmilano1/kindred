import crypto from 'node:crypto';
import { sendInviteEmail, verifyEmailForSandbox } from '../email';
import {
  type GedcomFamily,
  type GedcomPerson,
  type GedcomSource,
  generateGedcom,
  parseGedcom,
} from '../gedcom';
import {
  getMigrationStatus,
  runMigrations as runMigrationsFromModule,
} from '../migrations';
import { pool } from '../pool';
import {
  clearSettingsCache,
  getSettings,
  type SiteSettings,
} from '../settings';
import type { Person } from '../types';
import {
  createInvitation,
  deleteInvitation,
  deleteUser,
  getInvitations,
  getUsers,
  linkUserToPerson,
  logAudit,
  updateUserRole,
} from '../users';
import type { Loaders } from './dataloaders';

// ===========================================
// QUERY CACHING
// ===========================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache for expensive queries
const queryCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  queryCache.set(key, { data, timestamp: Date.now() });
  // Limit cache size to prevent memory issues
  if (queryCache.size > 1000) {
    const oldest = queryCache.keys().next().value;
    if (oldest) queryCache.delete(oldest);
  }
}

// Clear cache when data changes (called from mutations)
export function clearQueryCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
    }
  }
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
function requireAuth(
  context: Context,
  requiredRole: 'viewer' | 'editor' | 'admin' = 'viewer',
) {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  if (requiredRole === 'admin' && context.user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  if (
    requiredRole === 'editor' &&
    !['admin', 'editor'].includes(context.user.role)
  ) {
    throw new Error('Editor access required');
  }
  return context.user;
}

// Cursor encoding/decoding
const encodeCursor = (id: string) => Buffer.from(id).toString('base64');
const decodeCursor = (cursor: string) =>
  Buffer.from(cursor, 'base64').toString('utf-8');

// Helper to get a person by ID
async function getPerson(id: string): Promise<Person | null> {
  const { rows } = await pool.query(
    `SELECT *, COALESCE(notes, description) as description FROM people WHERE id = $1`,
    [id],
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
    people: async (
      _: unknown,
      {
        first = 50,
        after,
        last,
        before,
      }: { first?: number; after?: string; last?: number; before?: string },
    ) => {
      const limit = Math.min(first || last || 50, 100);
      const afterId = after ? decodeCursor(after) : null;
      const beforeId = before ? decodeCursor(before) : null;

      // Get total count
      const countResult = await pool.query('SELECT COUNT(*) FROM people');
      const totalCount = parseInt(countResult.rows[0].count, 10);

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
        edges: people.map((p: { id: string }) => ({
          node: p,
          cursor: encodeCursor(p.id),
        })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: !!afterId,
          startCursor: people.length ? encodeCursor(people[0].id) : null,
          endCursor: people.length
            ? encodeCursor(people[people.length - 1].id)
            : null,
          totalCount,
        },
      };
    },

    // Legacy offset-based (for backwards compatibility)
    // Tree component needs all people - allow up to 10000 for tree view
    peopleList: async (
      _: unknown,
      { limit = 100, offset = 0 }: { limit?: number; offset?: number },
    ) => {
      const { rows } = await pool.query(
        `
        SELECT *, COALESCE(notes, description) as description
        FROM people
        ORDER BY birth_year DESC NULLS LAST
        LIMIT $1 OFFSET $2
      `,
        [Math.min(limit, 10000), offset],
      );
      return rows;
    },

    // Recent people (for home page)
    recentPeople: async (_: unknown, { limit = 10 }: { limit?: number }) => {
      const { rows } = await pool.query(
        `
        SELECT *, COALESCE(notes, description) as description
        FROM people
        WHERE birth_year IS NOT NULL
        ORDER BY birth_year DESC
        LIMIT $1
      `,
        [Math.min(limit, 50)],
      );
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

    // Search with pagination using PostgreSQL full-text search
    search: async (
      _: unknown,
      {
        query,
        first = 50,
        after,
      }: { query: string; first?: number; after?: string },
    ) => {
      const limit = Math.min(first, 100);
      const afterId = after ? decodeCursor(after) : null;

      // Prepare search query for PostgreSQL full-text search
      // Split into words and add prefix matching for partial word search
      const searchTerms = query
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0);
      const tsQuery = searchTerms.map((term) => `${term}:*`).join(' & ');

      // Build the query with full-text search and trigram fallback
      let sql: string;
      let params: (string | number)[];

      if (searchTerms.length > 0) {
        // Use full-text search with relevance ranking
        // Combines tsvector search with trigram similarity for fuzzy matching
        sql = `
          WITH search_results AS (
            SELECT *,
              COALESCE(notes, description) as description,
              ts_rank(search_vector, to_tsquery('simple', immutable_unaccent($1))) as fts_rank,
              similarity(immutable_unaccent(name_full), immutable_unaccent($2)) as trgm_rank
            FROM people
            WHERE search_vector @@ to_tsquery('simple', immutable_unaccent($1))
               OR similarity(immutable_unaccent(name_full), immutable_unaccent($2)) > 0.2
          )
          SELECT *, (fts_rank * 2 + trgm_rank) as relevance_score
          FROM search_results
          ORDER BY relevance_score DESC, name_full
        `;
        params = [tsQuery, query];
      } else {
        sql = `SELECT *, COALESCE(notes, description) as description, 0 as relevance_score FROM people ORDER BY name_full`;
        params = [];
      }

      const { rows: allResults } = await pool.query(sql, params);

      // Get total count
      const totalCount = allResults.length;

      // Apply cursor-based pagination
      let startIdx = 0;
      if (afterId) {
        const afterIdx = allResults.findIndex(
          (p: { id: string }) => p.id === afterId,
        );
        if (afterIdx >= 0) startIdx = afterIdx + 1;
      }

      const paginatedPeople = allResults.slice(startIdx, startIdx + limit + 1);
      const hasMore = paginatedPeople.length > limit;
      const people = hasMore
        ? paginatedPeople.slice(0, limit)
        : paginatedPeople;

      return {
        edges: people.map((p: { id: string }) => ({
          node: p,
          cursor: encodeCursor(p.id),
        })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: startIdx > 0,
          startCursor: people.length ? encodeCursor(people[0].id) : null,
          endCursor: people.length
            ? encodeCursor(people[people.length - 1].id)
            : null,
          totalCount,
        },
      };
    },

    families: async () => {
      const { rows } = await pool.query(`SELECT * FROM families`);
      return rows;
    },

    stats: async () => {
      const { rows } = await pool.query(`
        WITH completeness AS (
          SELECT
            p.id,
            (
              CASE WHEN p.name_full IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.birth_date IS NOT NULL THEN 15
                   WHEN p.birth_year IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.birth_place IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.living = true THEN 15
                   WHEN p.death_date IS NOT NULL THEN 15
                   WHEN p.death_year IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.living = true THEN 10
                   WHEN p.death_place IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN EXISTS (SELECT 1 FROM children c JOIN families f ON c.family_id = f.id WHERE c.person_id = p.id) THEN 15 ELSE 0 END +
              CASE WHEN COALESCE(p.source_count, 0) > 0 THEN 15 ELSE 0 END +
              CASE WHEN EXISTS (SELECT 1 FROM media m WHERE m.person_id = p.id) THEN 10 ELSE 0 END
            ) as score
          FROM people p
        )
        SELECT
          (SELECT COUNT(*) FROM people) as total_people,
          (SELECT COUNT(*) FROM families) as total_families,
          (SELECT COUNT(*) FROM people WHERE sex = 'M') as male_count,
          (SELECT COUNT(*) FROM people WHERE sex = 'F') as female_count,
          (SELECT COUNT(*) FROM people WHERE living = true) as living_count,
          (SELECT MIN(birth_year) FROM people WHERE birth_year IS NOT NULL) as earliest_birth,
          (SELECT MAX(birth_year) FROM people WHERE birth_year IS NOT NULL) as latest_birth,
          (SELECT COUNT(*) FROM people WHERE familysearch_id IS NOT NULL) as with_familysearch_id,
          (SELECT COALESCE(AVG(score)::int, 0) FROM completeness) as average_completeness,
          (SELECT COUNT(*) FROM completeness WHERE score >= 80) as complete_count,
          (SELECT COUNT(*) FROM completeness WHERE score >= 50 AND score < 80) as partial_count,
          (SELECT COUNT(*) FROM completeness WHERE score < 50) as incomplete_count
      `);
      return rows[0];
    },

    dashboardStats: async () => {
      const { rows } = await pool.query(`
        WITH completeness AS (
          SELECT
            p.id,
            (
              CASE WHEN p.name_full IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.birth_date IS NOT NULL THEN 15
                   WHEN p.birth_year IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.birth_place IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.living = true THEN 15
                   WHEN p.death_date IS NOT NULL THEN 15
                   WHEN p.death_year IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN p.living = true THEN 10
                   WHEN p.death_place IS NOT NULL THEN 10 ELSE 0 END +
              CASE WHEN EXISTS (SELECT 1 FROM children c JOIN families f ON c.family_id = f.id WHERE c.person_id = p.id) THEN 15 ELSE 0 END +
              CASE WHEN COALESCE(p.source_count, 0) > 0 THEN 15 ELSE 0 END +
              CASE WHEN EXISTS (SELECT 1 FROM media m WHERE m.person_id = p.id) THEN 10 ELSE 0 END
            ) as score
          FROM people p
        )
        SELECT
          (SELECT COUNT(*) FROM people) as total_people,
          (SELECT COUNT(*) FROM families) as total_families,
          (SELECT COUNT(*) FROM sources) as total_sources,
          (SELECT COUNT(*) FROM media) as total_media,
          (SELECT MIN(birth_year) FROM people WHERE birth_year IS NOT NULL) as earliest_birth,
          (SELECT MAX(birth_year) FROM people WHERE birth_year IS NOT NULL) as latest_birth,
          (SELECT COUNT(*) FROM people WHERE living = true) as living_count,
          (SELECT COUNT(*) FROM people WHERE birth_year IS NULL OR birth_place IS NULL) as incomplete_count,
          (SELECT COALESCE(AVG(score)::int, 0) FROM completeness) as average_completeness,
          (SELECT COUNT(*) FROM completeness WHERE score >= 80) as complete_count,
          (SELECT COUNT(*) FROM completeness WHERE score >= 50 AND score < 80) as partial_count
      `);
      return rows[0];
    },

    recentActivity: async (_: unknown, { limit = 10 }: { limit?: number }) => {
      const { rows } = await pool.query(
        `
        SELECT
          al.id,
          al.action,
          al.details::text as details,
          u.name as user_name,
          u.email as user_email,
          al.created_at,
          al.details->>'person_id' as person_id,
          al.details->>'person_name' as person_name
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT $1
        `,
        [Math.min(limit, 50)],
      );
      return rows;
    },

    incompleteProfiles: async (
      _: unknown,
      { limit = 10 }: { limit?: number },
    ) => {
      const { rows } = await pool.query(
        `
        SELECT
          p.*,
          COALESCE(p.notes, p.description) as description,
          CASE
            WHEN p.birth_year IS NULL THEN 'birth_year'
            WHEN p.birth_place IS NULL THEN 'birth_place'
            WHEN p.death_year IS NULL AND p.living = false THEN 'death_year'
            WHEN p.death_place IS NULL AND p.living = false THEN 'death_place'
            ELSE 'parents'
          END as primary_missing
        FROM people p
        WHERE
          p.birth_year IS NULL
          OR p.birth_place IS NULL
          OR (p.living = false AND p.death_year IS NULL)
          OR NOT EXISTS (
            SELECT 1 FROM children c
            JOIN families f ON c.family_id = f.id
            WHERE c.person_id = p.id
          )
        ORDER BY p.research_priority DESC NULLS LAST, p.name_full
        LIMIT $1
        `,
        [Math.min(limit, 20)],
      );

      return rows.map(
        (row: {
          primary_missing: string;
          birth_year: number | null;
          birth_place: string | null;
          death_year: number | null;
          death_place: string | null;
          living: boolean;
        }) => {
          const missingFields: string[] = [];
          if (!row.birth_year) missingFields.push('birth_year');
          if (!row.birth_place) missingFields.push('birth_place');
          if (!row.living && !row.death_year) missingFields.push('death_year');
          if (!row.living && !row.death_place)
            missingFields.push('death_place');

          const suggestions: Record<string, string> = {
            birth_year: 'Add birth year from records',
            birth_place: 'Research birth location',
            death_year: 'Find death records',
            death_place: 'Research death location',
            parents: 'Research and add parents',
          };

          return {
            person: row,
            missing_fields: missingFields,
            suggestion: suggestions[row.primary_missing] || 'Complete profile',
          };
        },
      );
    },

    researchQueue: async (
      _: unknown,
      { first = 50, after }: { first?: number; after?: string },
    ) => {
      const limit = Math.min(first, 100);

      // Get configurable weights from settings
      const settings = await getSettings();
      const wMissingDates = settings.research_weight_missing_core_dates;
      const wMissingPlaces = settings.research_weight_missing_places;
      const wEstimatedDates = settings.research_weight_estimated_dates;
      const wPlaceholderParent = settings.research_weight_placeholder_parent;
      const wLowSources = settings.research_weight_low_sources;
      const wManualPriority = settings.research_weight_manual_priority;

      // Decode cursor: format is "score:id" where score is the auto_score
      let afterScore: number | null = null;
      let afterId: string | null = null;
      if (after) {
        try {
          const decoded = Buffer.from(after, 'base64').toString('utf8');
          const [scoreStr, id] = decoded.split(':');
          afterScore = parseFloat(scoreStr);
          afterId = id;
        } catch {
          // Invalid cursor, ignore
        }
      }

      // Get total count of research queue items
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM people
         WHERE (research_status != 'verified' OR research_status IS NULL)
           AND (is_placeholder = false OR is_placeholder IS NULL)`,
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);

      // Build cursor condition
      const cursorCondition =
        afterScore !== null && afterId
          ? `AND (auto_score < $8 OR (auto_score = $8 AND p.id > $9))`
          : '';

      const params: (number | string)[] = [
        limit + 1, // Fetch one extra to check if there's more
        wMissingDates,
        wMissingPlaces,
        wEstimatedDates,
        wPlaceholderParent,
        wLowSources,
        wManualPriority,
      ];

      if (afterScore !== null && afterId) {
        params.push(afterScore, afterId);
      }

      const { rows } = await pool.query(
        `
        WITH placeholder_parents AS (
          SELECT DISTINCT c.person_id
          FROM children c
          JOIN families f ON c.family_id = f.id
          JOIN people parent ON (parent.id = f.husband_id OR parent.id = f.wife_id)
          WHERE parent.is_placeholder = true
        ),
        scored_people AS (
          SELECT p.*,
            (
              CASE WHEN p.birth_year IS NULL THEN $2 ELSE 0 END +
              CASE WHEN NOT p.living AND p.death_year IS NULL THEN $2 ELSE 0 END +
              CASE WHEN p.birth_place IS NULL OR p.birth_place = '' THEN $3 ELSE 0 END +
              CASE WHEN NOT p.living AND (p.death_place IS NULL OR p.death_place = '') THEN $3 ELSE 0 END +
              CASE WHEN p.birth_date_accuracy IN ('ESTIMATED', 'RANGE') THEN $4 ELSE 0 END +
              CASE WHEN p.death_date_accuracy IN ('ESTIMATED', 'RANGE') THEN $4 ELSE 0 END +
              CASE WHEN pp.person_id IS NOT NULL THEN $5 ELSE 0 END +
              CASE WHEN COALESCE(p.source_count, 0) = 0 THEN $6 ELSE 0 END +
              COALESCE(p.research_priority, 0) * $7
            ) AS auto_score
          FROM people p
          LEFT JOIN placeholder_parents pp ON pp.person_id = p.id
          WHERE (p.research_status != 'verified' OR p.research_status IS NULL)
            AND (p.is_placeholder = false OR p.is_placeholder IS NULL)
        )
        SELECT * FROM scored_people
        WHERE 1=1 ${cursorCondition}
        ORDER BY
          auto_score DESC,
          id ASC
        LIMIT $1
      `,
        params,
      );

      const hasMore = rows.length > limit;
      const people = hasMore ? rows.slice(0, limit) : rows;

      type ScoredPerson = Record<string, unknown> & {
        auto_score: number;
        id: string;
      };

      // Create cursor encoding score and id
      const makeCursor = (row: ScoredPerson) =>
        Buffer.from(`${row.auto_score}:${row.id}`).toString('base64');

      // Convert Date objects to ISO strings for serialization
      const nodes: ScoredPerson[] = people.map((row: ScoredPerson) => ({
        ...row,
        last_researched:
          row.last_researched instanceof Date
            ? row.last_researched.toISOString()
            : row.last_researched,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
        updated_at:
          row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : row.updated_at,
      }));

      return {
        edges: nodes.map((node) => ({
          node,
          cursor: makeCursor(node),
        })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: !!after,
          startCursor: nodes.length ? makeCursor(nodes[0]) : null,
          endCursor: nodes.length ? makeCursor(nodes[nodes.length - 1]) : null,
          totalCount,
        },
      };
    },

    // Build nested pedigree tree structure for ancestor view
    ancestors: async (
      _: unknown,
      { personId, generations = 3 }: { personId: string; generations?: number },
    ) => {
      interface PedigreeNode {
        id: string;
        person: Person;
        father: PedigreeNode | null;
        mother: PedigreeNode | null;
        generation: number;
        hasMoreAncestors: boolean;
      }

      const cacheKey = `pedigree:${personId}:${generations}`;
      const cached = getCached<PedigreeNode>(cacheKey);
      if (cached) return cached;

      // Recursive function to build pedigree node
      const buildPedigreeNode = async (
        pid: string,
        currentGen: number,
        maxGen: number,
      ): Promise<PedigreeNode | null> => {
        if (currentGen > maxGen) return null;

        // Get person data
        const personResult = await pool.query(
          'SELECT * FROM people WHERE id = $1',
          [pid],
        );
        if (personResult.rows.length === 0) return null;

        const person = personResult.rows[0];

        // Get parents
        const parentsResult = await pool.query(
          `SELECT f.husband_id, f.wife_id
           FROM children c
           JOIN families f ON c.family_id = f.id
           WHERE c.person_id = $1
           LIMIT 1`,
          [pid],
        );

        let father = null;
        let mother = null;
        let hasMoreAncestors = false;

        if (parentsResult.rows.length > 0) {
          const { husband_id, wife_id } = parentsResult.rows[0];

          if (currentGen < maxGen) {
            // Recursively build parent nodes
            if (husband_id) {
              father = await buildPedigreeNode(
                husband_id,
                currentGen + 1,
                maxGen,
              );
            }
            if (wife_id) {
              mother = await buildPedigreeNode(wife_id, currentGen + 1, maxGen);
            }
          } else {
            // At max generation - check if there are more ancestors
            hasMoreAncestors = !!(husband_id || wife_id);
          }
        }

        return {
          id: pid,
          person,
          father,
          mother,
          generation: currentGen,
          hasMoreAncestors,
        };
      };

      const result = await buildPedigreeNode(personId, 0, generations);
      setCache(cacheKey, result);
      return result;
    },

    // Build nested descendant tree structure
    descendants: async (
      _: unknown,
      { personId, generations = 3 }: { personId: string; generations?: number },
    ) => {
      interface DescendantNode {
        id: string;
        person: Person;
        spouse: Person | null;
        marriageYear: number | null;
        children: DescendantNode[];
        generation: number;
        hasMoreDescendants: boolean;
      }

      const cacheKey = `descendants:${personId}:${generations}`;
      const cached = getCached<DescendantNode>(cacheKey);
      if (cached) return cached;

      // Recursive function to build descendant node
      const buildDescendantNode = async (
        pid: string,
        currentGen: number,
        maxGen: number,
      ): Promise<DescendantNode | null> => {
        if (currentGen > maxGen) return null;

        // Get person data
        const personResult = await pool.query(
          'SELECT * FROM people WHERE id = $1',
          [pid],
        );
        if (personResult.rows.length === 0) return null;

        const person = personResult.rows[0];

        // Get families where this person is a parent
        const familiesResult = await pool.query(
          `SELECT f.id, f.husband_id, f.wife_id, f.marriage_year
           FROM families f
           WHERE f.husband_id = $1 OR f.wife_id = $1`,
          [pid],
        );

        // For simplicity, use first family (could be extended to handle multiple marriages)
        let spouse = null;
        let marriageYear = null;
        const children: DescendantNode[] = [];
        let hasMoreDescendants = false;

        if (familiesResult.rows.length > 0) {
          const family = familiesResult.rows[0];
          marriageYear = family.marriage_year;

          // Get spouse
          const spouseId =
            family.husband_id === pid ? family.wife_id : family.husband_id;
          if (spouseId) {
            const spouseResult = await pool.query(
              'SELECT * FROM people WHERE id = $1',
              [spouseId],
            );
            if (spouseResult.rows.length > 0) {
              spouse = spouseResult.rows[0];
            }
          }

          // Get children
          const childrenResult = await pool.query(
            `SELECT p.id FROM children c
             JOIN people p ON c.person_id = p.id
             WHERE c.family_id = $1
             ORDER BY c.birth_order`,
            [family.id],
          );

          if (currentGen < maxGen) {
            // Recursively build child nodes
            for (const child of childrenResult.rows) {
              const childNode = await buildDescendantNode(
                child.id,
                currentGen + 1,
                maxGen,
              );
              if (childNode) children.push(childNode);
            }
          } else {
            // At max generation - check if there are more descendants
            hasMoreDescendants = childrenResult.rows.length > 0;
          }
        }

        return {
          id: pid,
          person,
          spouse,
          marriageYear,
          children,
          generation: currentGen,
          hasMoreDescendants,
        };
      };

      const result = await buildDescendantNode(personId, 0, generations);
      setCache(cacheKey, result);
      return result;
    },

    // Timeline - grouped by year
    timeline: async () => {
      const { rows } = await pool.query(`
        SELECT * FROM people WHERE birth_year IS NOT NULL OR death_year IS NOT NULL
      `);

      const events: Map<
        number,
        Array<{ type: string; person: Person }>
      > = new Map();

      for (const person of rows) {
        if (person.birth_year) {
          if (!events.has(person.birth_year)) events.set(person.birth_year, []);
          events.get(person.birth_year)?.push({ type: 'birth', person });
        }
        if (person.death_year && !person.living) {
          if (!events.has(person.death_year)) events.set(person.death_year, []);
          events.get(person.death_year)?.push({ type: 'death', person });
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
        [user.id],
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
      const { rows } = await pool.query(
        `SELECT * FROM surname_crests ORDER BY surname`,
      );
      return rows;
    },

    surnameCrest: async (_: unknown, { surname }: { surname: string }) => {
      const { rows } = await pool.query(
        `SELECT * FROM surname_crests WHERE LOWER(surname) = LOWER($1) LIMIT 1`,
        [surname],
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
          'SELECT key, value, description, category, updated_at FROM settings ORDER BY category, key',
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
      const status = await getMigrationStatus(pool);
      const { rows } = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      const requiredTables = [
        'people',
        'families',
        'children',
        'users',
        'settings',
      ];
      const existingTables = rows.map(
        (r: { table_name: string }) => r.table_name,
      );
      const missingTables = requiredTables.filter(
        (t) => !existingTables.includes(t),
      );
      return {
        tables: existingTables,
        missingTables,
        migrationNeeded: missingTables.length > 0 || status.pendingCount > 0,
        currentVersion: status.currentVersion,
        latestVersion: status.latestVersion,
        pendingMigrations: status.pendingCount,
        appliedMigrations: status.appliedMigrations,
      };
    },

    // Email queries (admin only)
    emailLogs: async (
      _: unknown,
      { limit = 50, offset = 0 }: { limit?: number; offset?: number },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      const { rows } = await pool.query(
        'SELECT id, email_type, recipient, subject, success, error_message, sent_at FROM email_log ORDER BY sent_at DESC LIMIT $1 OFFSET $2',
        [limit, offset],
      );
      return rows;
    },

    emailStats: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      const totals = await pool.query(`
        SELECT
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE success = true) as successful,
          COUNT(*) FILTER (WHERE success = false) as failed
        FROM email_log
      `);
      const byType = await pool.query(`
        SELECT email_type, COUNT(*) as count
        FROM email_log
        GROUP BY email_type
        ORDER BY count DESC
      `);
      return {
        total_sent: parseInt(totals.rows[0].total_sent, 10) || 0,
        successful: parseInt(totals.rows[0].successful, 10) || 0,
        failed: parseInt(totals.rows[0].failed, 10) || 0,
        by_type: byType.rows,
      };
    },

    // Email preferences (current user)
    myEmailPreferences: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      const { rows } = await pool.query(
        'SELECT user_id, research_updates, tree_changes, weekly_digest, birthday_reminders FROM email_preferences WHERE user_id = $1',
        [user.id],
      );
      return rows[0] || null;
    },

    // GEDCOM export
    exportGedcom: async (
      _: unknown,
      {
        includeLiving,
        includeSources,
      }: { includeLiving?: boolean; includeSources?: boolean },
      context: Context,
    ) => {
      requireAuth(context);

      // Fetch all people with sources
      const peopleResult = await pool.query(`
        SELECT p.id, p.name_given, p.name_surname, p.name_full, p.sex,
               p.birth_date, p.birth_place, p.death_date, p.death_place,
               p.burial_date, p.burial_place, p.christening_date, p.christening_place, p.living
        FROM people p ORDER BY p.name_full
      `);

      // Fetch sources for all people
      const sourcesResult = await pool.query(`
        SELECT id, person_id, source_name, source_url, content FROM sources
      `);
      const sourcesByPerson = new Map<string, GedcomSource[]>();
      for (const src of sourcesResult.rows) {
        if (!sourcesByPerson.has(src.person_id))
          sourcesByPerson.set(src.person_id, []);
        sourcesByPerson.get(src.person_id)?.push(src);
      }

      const people: GedcomPerson[] = peopleResult.rows.map((p) => ({
        ...p,
        sources: sourcesByPerson.get(p.id) || [],
      }));

      // Fetch all families with children
      const familiesResult = await pool.query(`
        SELECT f.id, f.husband_id, f.wife_id, f.marriage_date, f.marriage_place
        FROM families f
      `);
      const childrenResult = await pool.query(`
        SELECT family_id, person_id FROM children
      `);
      const childrenByFamily = new Map<string, string[]>();
      for (const c of childrenResult.rows) {
        if (!childrenByFamily.has(c.family_id))
          childrenByFamily.set(c.family_id, []);
        childrenByFamily.get(c.family_id)?.push(c.person_id);
      }

      const families: GedcomFamily[] = familiesResult.rows.map((f) => ({
        ...f,
        children_ids: childrenByFamily.get(f.id) || [],
      }));

      return generateGedcom(people, families, {
        includeLiving: includeLiving ?? false,
        includeSources: includeSources ?? true,
        submitterName: 'Kindred Family Tree',
      });
    },
  },

  Mutation: {
    createPerson: async (
      _: unknown,
      { input }: { input: Record<string, unknown> },
      context: Context,
    ) => {
      requireAuth(context, 'editor');

      // Generate a nanoid-style ID (12 chars alphanumeric)
      const id = crypto
        .randomBytes(9)
        .toString('base64')
        .replace(/[+/=]/g, '')
        .substring(0, 12);

      // Require at least name_full
      if (!input.name_full) {
        throw new Error('name_full is required');
      }

      const fields = Object.keys(input).filter((k) => input[k] !== undefined);
      const columns = ['id', ...fields];
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = [id, ...fields.map((f) => input[f])];

      await pool.query(
        `INSERT INTO people (${columns.join(', ')}) VALUES (${placeholders})`,
        values,
      );

      return getPerson(id);
    },

    updatePerson: async (
      _: unknown,
      { id, input }: { id: string; input: Record<string, unknown> },
      context: Context,
    ) => {
      requireAuth(context, 'editor');

      const fields = Object.keys(input).filter((k) => input[k] !== undefined);
      if (fields.length === 0) return getPerson(id);

      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = fields.map((f) => input[f]);

      await pool.query(`UPDATE people SET ${setClause} WHERE id = $1`, [
        id,
        ...values,
      ]);

      return getPerson(id);
    },

    deletePerson: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin'); // Only admin can delete

      // Check if person exists
      const person = await getPerson(id);
      if (!person) {
        throw new Error('Person not found');
      }

      // Delete related records first (sources, facts, life_events, family links)
      await pool.query('DELETE FROM sources WHERE person_id = $1', [id]);
      await pool.query('DELETE FROM facts WHERE person_id = $1', [id]);
      await pool.query('DELETE FROM life_events WHERE person_id = $1', [id]);
      await pool.query(
        'DELETE FROM children WHERE person_id = $1 OR child_id = $1',
        [id],
      );
      await pool.query(
        'UPDATE families SET husband_id = NULL WHERE husband_id = $1',
        [id],
      );
      await pool.query(
        'UPDATE families SET wife_id = NULL WHERE wife_id = $1',
        [id],
      );

      // Delete the person
      await pool.query('DELETE FROM people WHERE id = $1', [id]);

      return true;
    },

    // Life Event mutations
    addLifeEvent: async (
      _: unknown,
      {
        personId,
        input,
      }: {
        personId: string;
        input: {
          event_type: string;
          event_date?: string;
          event_year?: number;
          event_place?: string;
          event_value?: string;
        };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `INSERT INTO life_events (person_id, event_type, event_date, event_year, event_place, event_value)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          personId,
          input.event_type,
          input.event_date || null,
          input.event_year || null,
          input.event_place || null,
          input.event_value || null,
        ],
      );
      return rows[0];
    },

    updateLifeEvent: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: number;
        input: {
          event_type: string;
          event_date?: string;
          event_year?: number;
          event_place?: string;
          event_value?: string;
        };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `UPDATE life_events SET event_type = $2, event_date = $3, event_year = $4, event_place = $5, event_value = $6 WHERE id = $1 RETURNING *`,
        [
          id,
          input.event_type,
          input.event_date || null,
          input.event_year || null,
          input.event_place || null,
          input.event_value || null,
        ],
      );
      return rows[0] || null;
    },

    deleteLifeEvent: async (
      _: unknown,
      { id }: { id: number },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query('DELETE FROM life_events WHERE id = $1', [id]);
      return true;
    },

    // Fact mutations
    addFact: async (
      _: unknown,
      {
        personId,
        input,
      }: {
        personId: string;
        input: { fact_type: string; fact_value?: string };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `INSERT INTO facts (person_id, fact_type, fact_value) VALUES ($1, $2, $3) RETURNING *`,
        [personId, input.fact_type, input.fact_value || null],
      );
      return rows[0];
    },

    updateFact: async (
      _: unknown,
      {
        id,
        input,
      }: { id: number; input: { fact_type: string; fact_value?: string } },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `UPDATE facts SET fact_type = $2, fact_value = $3 WHERE id = $1 RETURNING *`,
        [id, input.fact_type, input.fact_value || null],
      );
      return rows[0] || null;
    },

    deleteFact: async (
      _: unknown,
      { id }: { id: number },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query('DELETE FROM facts WHERE id = $1', [id]);
      return true;
    },

    // Family mutations
    createFamily: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          husband_id?: string;
          wife_id?: string;
          marriage_date?: string;
          marriage_year?: number;
          marriage_place?: string;
        };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const { rows } = await pool.query(
        `INSERT INTO families (id, husband_id, wife_id, marriage_date, marriage_year, marriage_place)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          id,
          input.husband_id || null,
          input.wife_id || null,
          input.marriage_date || null,
          input.marriage_year || null,
          input.marriage_place || null,
        ],
      );
      return rows[0];
    },

    updateFamily: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          husband_id?: string;
          wife_id?: string;
          marriage_date?: string;
          marriage_year?: number;
          marriage_place?: string;
        };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `UPDATE families SET husband_id = COALESCE($2, husband_id), wife_id = COALESCE($3, wife_id),
         marriage_date = COALESCE($4, marriage_date), marriage_year = COALESCE($5, marriage_year),
         marriage_place = COALESCE($6, marriage_place) WHERE id = $1 RETURNING *`,
        [
          id,
          input.husband_id,
          input.wife_id,
          input.marriage_date,
          input.marriage_year,
          input.marriage_place,
        ],
      );
      return rows[0] || null;
    },

    deleteFamily: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      // Delete children links first
      await pool.query('DELETE FROM children WHERE family_id = $1', [id]);
      await pool.query('DELETE FROM families WHERE id = $1', [id]);
      return true;
    },

    addChildToFamily: async (
      _: unknown,
      { familyId, personId }: { familyId: string; personId: string },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      // Check if already exists
      const { rows: existing } = await pool.query(
        'SELECT 1 FROM children WHERE family_id = $1 AND person_id = $2',
        [familyId, personId],
      );
      if (existing.length > 0) return true;
      await pool.query(
        'INSERT INTO children (family_id, person_id) VALUES ($1, $2)',
        [familyId, personId],
      );
      return true;
    },

    removeChildFromFamily: async (
      _: unknown,
      { familyId, personId }: { familyId: string; personId: string },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query(
        'DELETE FROM children WHERE family_id = $1 AND person_id = $2',
        [familyId, personId],
      );
      return true;
    },

    addSource: async (
      _: unknown,
      {
        personId,
        input,
      }: {
        personId: string;
        input: {
          source_type?: string;
          source_name?: string;
          source_url?: string;
          action: string;
          content?: string;
          confidence?: string;
        };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');

      // Generate a nanoid-style ID (12 chars alphanumeric)
      const id = crypto
        .randomBytes(9)
        .toString('base64')
        .replace(/[+/=]/g, '')
        .substring(0, 12);

      const { rows } = await pool.query(
        `INSERT INTO sources (id, person_id, source_type, source_name, source_url, action, content, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          id,
          personId,
          input.source_type,
          input.source_name,
          input.source_url,
          input.action,
          input.content,
          input.confidence,
        ],
      );
      return rows[0];
    },

    updateSource: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          source_type?: string;
          source_name?: string;
          source_url?: string;
          action?: string;
          content?: string;
          confidence?: string;
        };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `UPDATE sources SET
         source_type = COALESCE($2, source_type),
         source_name = COALESCE($3, source_name),
         source_url = COALESCE($4, source_url),
         action = COALESCE($5, action),
         content = COALESCE($6, content),
         confidence = COALESCE($7, confidence)
         WHERE id = $1 RETURNING *`,
        [
          id,
          input.source_type,
          input.source_name,
          input.source_url,
          input.action,
          input.content,
          input.confidence,
        ],
      );
      return rows[0] || null;
    },

    deleteSource: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query('DELETE FROM sources WHERE id = $1', [id]);
      return true;
    },

    updateResearchStatus: async (
      _: unknown,
      { personId, status }: { personId: string; status: string },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query(
        `UPDATE people SET research_status = $1, last_researched = NOW() WHERE id = $2`,
        [status, personId],
      );
      return getPerson(personId);
    },

    updateResearchPriority: async (
      _: unknown,
      { personId, priority }: { personId: string; priority: number },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query(
        `UPDATE people SET research_priority = $1 WHERE id = $2`,
        [priority, personId],
      );
      return getPerson(personId);
    },

    // Admin mutations
    createInvitation: async (
      _: unknown,
      { email, role }: { email: string; role: string },
      context: Context,
    ) => {
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
          inviterEmail: user.email,
        });
      } catch (error) {
        console.error('Failed to send invite email:', error);
      }

      return invitation;
    },

    deleteInvitation: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');
      await deleteInvitation(id);
      await logAudit(user.id, 'delete_invitation', { invitationId: id });
      return true;
    },

    updateUserRole: async (
      _: unknown,
      { userId, role }: { userId: string; role: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');

      // Prevent removing own admin rights
      if (userId === user.id && role !== 'admin') {
        throw new Error('Cannot demote yourself');
      }

      await updateUserRole(userId, role);
      await logAudit(user.id, 'update_user_role', {
        targetUserId: userId,
        newRole: role,
      });

      // Return updated user
      const users = await getUsers();
      return users.find((u) => u.id === userId);
    },

    linkUserToPerson: async (
      _: unknown,
      { userId, personId }: { userId: string; personId: string | null },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin');

      await linkUserToPerson(userId, personId);
      await logAudit(user.id, 'link_user_to_person', {
        targetUserId: userId,
        personId: personId,
      });

      // Return updated user
      const users = await getUsers();
      return users.find((u) => u.id === userId);
    },

    deleteUser: async (
      _: unknown,
      { userId }: { userId: string },
      context: Context,
    ) => {
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
    setSurnameCrest: async (
      _: unknown,
      {
        surname,
        coatOfArms,
        description,
        origin,
        motto,
      }: {
        surname: string;
        coatOfArms: string;
        description?: string;
        origin?: string;
        motto?: string;
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `INSERT INTO surname_crests (surname, coat_of_arms, description, origin, motto)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (surname) DO UPDATE SET
           coat_of_arms = $2, description = $3, origin = $4, motto = $5, updated_at = NOW()
         RETURNING *`,
        [
          surname,
          coatOfArms,
          description || null,
          origin || null,
          motto || null,
        ],
      );
      return rows[0];
    },

    removeSurnameCrest: async (
      _: unknown,
      { surname }: { surname: string },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query(
        `DELETE FROM surname_crests WHERE LOWER(surname) = LOWER($1)`,
        [surname],
      );
      return true;
    },

    // Person-specific coat of arms override (stored in facts table)
    setPersonCoatOfArms: async (
      _: unknown,
      { personId, coatOfArms }: { personId: string; coatOfArms: string },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query(
        `INSERT INTO facts (person_id, fact_type, fact_value)
         VALUES ($1, 'coat_of_arms', $2)
         ON CONFLICT (person_id, fact_type) DO UPDATE SET fact_value = $2`,
        [personId, coatOfArms],
      );
      return coatOfArms;
    },

    removePersonCoatOfArms: async (
      _: unknown,
      { personId }: { personId: string },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      await pool.query(
        `DELETE FROM facts WHERE person_id = $1 AND fact_type = 'coat_of_arms'`,
        [personId],
      );
      return true;
    },

    // Settings mutations
    updateSettings: async (
      _: unknown,
      { input }: { input: Record<string, string | null> },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      const entries = Object.entries(input).filter(([, v]) => v !== undefined);
      for (const [key, value] of entries) {
        await pool.query(
          `INSERT INTO settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, value],
        );
      }
      clearSettingsCache();
      return getSettings();
    },

    runMigrations: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context, 'admin');
      return runMigrationsFromModule(pool);
    },

    // User profile mutations - allow users to link themselves to a person
    setMyPerson: async (
      _: unknown,
      { personId }: { personId: string | null },
      context: Context,
    ) => {
      const user = requireAuth(context);

      await linkUserToPerson(user.id, personId);
      await logAudit(user.id, 'set_my_person', { personId });

      const users = await getUsers();
      return users.find((u) => u.id === user.id);
    },

    // API Key mutations
    generateApiKey: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      // Generate a secure random API key (64 hex characters)
      const crypto = await import('node:crypto');
      const apiKey = crypto.randomBytes(32).toString('hex');

      await pool.query('UPDATE users SET api_key = $1 WHERE id = $2', [
        apiKey,
        user.id,
      ]);
      await logAudit(user.id, 'generate_api_key', { userId: user.id });

      return apiKey;
    },

    revokeApiKey: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      await pool.query('UPDATE users SET api_key = NULL WHERE id = $1', [
        user.id,
      ]);
      await logAudit(user.id, 'revoke_api_key', { userId: user.id });
      return true;
    },

    // Email preferences mutation
    updateEmailPreferences: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          research_updates?: boolean;
          tree_changes?: boolean;
          weekly_digest?: boolean;
          birthday_reminders?: boolean;
        };
      },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // Upsert preferences
      const { rows } = await pool.query(
        `
        INSERT INTO email_preferences (user_id, research_updates, tree_changes, weekly_digest, birthday_reminders, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          research_updates = COALESCE($2, email_preferences.research_updates),
          tree_changes = COALESCE($3, email_preferences.tree_changes),
          weekly_digest = COALESCE($4, email_preferences.weekly_digest),
          birthday_reminders = COALESCE($5, email_preferences.birthday_reminders),
          updated_at = NOW()
        RETURNING user_id, research_updates, tree_changes, weekly_digest, birthday_reminders
      `,
        [
          user.id,
          input.research_updates ?? true,
          input.tree_changes ?? false,
          input.weekly_digest ?? false,
          input.birthday_reminders ?? false,
        ],
      );

      return rows[0];
    },

    // Admin: Create local user directly (no invitation required)
    createLocalUser: async (
      _: unknown,
      {
        email,
        name,
        role,
        password,
        requirePasswordChange,
      }: {
        email: string;
        name: string;
        role: string;
        password: string;
        requirePasswordChange?: boolean;
      },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      const bcrypt = await import('bcryptjs');
      const crypto = await import('node:crypto');

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email],
      );
      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Validate role
      if (!['admin', 'editor', 'viewer'].includes(role)) {
        throw new Error('Invalid role. Must be admin, editor, or viewer');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      const userId = crypto.randomBytes(8).toString('hex');

      // Create user
      const { rows } = await pool.query(
        `INSERT INTO users (id, email, name, role, password_hash, auth_provider, require_password_change, created_at, last_login)
         VALUES ($1, $2, $3, $4, $5, 'local', $6, NOW(), NULL)
         RETURNING id, email, name, role, created_at`,
        [
          userId,
          email,
          name,
          role,
          passwordHash,
          requirePasswordChange ?? false,
        ],
      );

      return rows[0];
    },

    // Service account mutations
    createServiceAccount: async (
      _: unknown,
      {
        name,
        description,
        role,
      }: { name: string; description?: string; role: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin');
      const crypto = await import('node:crypto');

      // Validate role (service accounts cannot be admin)
      if (!['editor', 'viewer'].includes(role)) {
        throw new Error(
          'Invalid role. Service accounts can only be editor or viewer',
        );
      }

      // Generate unique ID and API key
      const userId = crypto.randomBytes(8).toString('hex');
      const apiKey = crypto.randomBytes(32).toString('hex');

      // Create service account (no email, no password)
      const { rows } = await pool.query(
        `INSERT INTO users (id, email, name, role, account_type, description, api_key, auth_provider, created_at)
         VALUES ($1, $2, $3, $4, 'service', $5, $6, 'api', NOW())
         RETURNING id, email, name, role, account_type, description, created_at`,
        [
          userId,
          `service-${userId}@internal`,
          name,
          role,
          description || null,
          apiKey,
        ],
      );

      return { user: rows[0], apiKey };
    },

    revokeServiceAccount: async (
      _: unknown,
      { userId }: { userId: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin');

      // Verify it's a service account
      const { rows } = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND account_type = $2',
        [userId, 'service'],
      );

      if (rows.length === 0) {
        throw new Error('Service account not found');
      }

      // Delete the service account
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      return true;
    },

    // Local auth mutations
    registerWithInvitation: async (
      _: unknown,
      {
        token,
        password,
        name,
      }: { token: string; password: string; name?: string },
    ) => {
      const bcrypt = await import('bcryptjs');
      const crypto = await import('node:crypto');

      // Find valid invitation
      const invResult = await pool.query(
        `SELECT id, email, role FROM invitations
         WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
        [token],
      );

      if (invResult.rows.length === 0) {
        return { success: false, message: 'Invalid or expired invitation' };
      }

      const invitation = invResult.rows[0];

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [invitation.email],
      );
      if (existingUser.rows.length > 0) {
        return { success: false, message: 'User already exists' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      const userId = crypto.randomBytes(8).toString('hex');

      // Create user
      await pool.query(
        `INSERT INTO users (id, email, name, role, password_hash, auth_provider, invited_at, last_login)
         VALUES ($1, $2, $3, $4, $5, 'local', NOW(), NOW())`,
        [
          userId,
          invitation.email,
          name || invitation.email.split('@')[0],
          invitation.role,
          passwordHash,
        ],
      );

      // Mark invitation as accepted
      await pool.query(
        'UPDATE invitations SET accepted_at = NOW() WHERE id = $1',
        [invitation.id],
      );

      return { success: true, message: 'Account created successfully', userId };
    },

    requestPasswordReset: async (_: unknown, { email }: { email: string }) => {
      const crypto = await import('node:crypto');

      // Find user with local auth
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND auth_provider = $2',
        [email, 'local'],
      );

      // Always return true to prevent email enumeration
      if (userResult.rows.length === 0) {
        return true;
      }

      const user = userResult.rows[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, resetToken, expiresAt],
      );

      // Send email (import dynamically to avoid circular deps)
      try {
        const { sendPasswordResetEmail } = await import('../email');
        await sendPasswordResetEmail(email, resetToken);
      } catch (error) {
        console.error('[Auth] Failed to send password reset email:', error);
      }

      return true;
    },

    resetPassword: async (
      _: unknown,
      { token, newPassword }: { token: string; newPassword: string },
    ) => {
      const bcrypt = await import('bcryptjs');

      // Find valid token
      const tokenResult = await pool.query(
        `SELECT user_id FROM password_reset_tokens
         WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
        [token],
      );

      if (tokenResult.rows.length === 0) {
        return { success: false, message: 'Invalid or expired reset token' };
      }

      const userId = tokenResult.rows[0].user_id;

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
        [passwordHash, userId],
      );

      // Mark token as used
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1',
        [token],
      );

      return { success: true, message: 'Password reset successfully', userId };
    },

    changePassword: async (
      _: unknown,
      {
        currentPassword,
        newPassword,
      }: { currentPassword: string; newPassword: string },
      context: Context,
    ) => {
      const user = requireAuth(context);
      const bcrypt = await import('bcryptjs');

      // Get current password hash
      const userResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1 AND auth_provider = $2',
        [user.id, 'local'],
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].password_hash) {
        throw new Error('Password change not available for this account');
      }

      // Verify current password
      const isValid = await bcrypt.compare(
        currentPassword,
        userResult.rows[0].password_hash,
      );
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash and update new password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        user.id,
      ]);

      return true;
    },

    // GEDCOM import
    importGedcom: async (
      _: unknown,
      { content }: { content: string },
      context: Context,
    ) => {
      requireAuth(context, 'admin');

      const result = parseGedcom(content);
      const errors: string[] = [...result.errors];
      const warnings: string[] = [...result.warnings];

      // Map GEDCOM xrefs to new database IDs
      const xrefToId = new Map<string, string>();

      // Import people
      let peopleImported = 0;
      for (const person of result.people) {
        try {
          const id = crypto
            .randomBytes(9)
            .toString('base64')
            .replace(/[+/=]/g, '')
            .substring(0, 12);
          xrefToId.set(person.xref, id);

          await pool.query(
            `
            INSERT INTO people (id, name_full, name_given, name_surname, sex, birth_date, birth_place, death_date, death_place, burial_date, burial_place, christening_date, christening_place)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `,
            [
              id,
              person.name_full,
              person.name_given,
              person.name_surname,
              person.sex,
              person.birth_date,
              person.birth_place,
              person.death_date,
              person.death_place,
              person.burial_date,
              person.burial_place,
              person.christening_date,
              person.christening_place,
            ],
          );
          peopleImported++;
        } catch (err) {
          errors.push(
            `Failed to import person ${person.name_full}: ${(err as Error).message}`,
          );
        }
      }

      // Import families
      let familiesImported = 0;
      for (const family of result.families) {
        try {
          const id = crypto
            .randomBytes(9)
            .toString('base64')
            .replace(/[+/=]/g, '')
            .substring(0, 12);
          const husbandId = family.husband_xref
            ? xrefToId.get(family.husband_xref)
            : null;
          const wifeId = family.wife_xref
            ? xrefToId.get(family.wife_xref)
            : null;

          await pool.query(
            `
            INSERT INTO families (id, husband_id, wife_id, marriage_date, marriage_place)
            VALUES ($1, $2, $3, $4, $5)
          `,
            [
              id,
              husbandId,
              wifeId,
              family.marriage_date,
              family.marriage_place,
            ],
          );

          // Add children
          for (const childXref of family.children_xrefs) {
            const childId = xrefToId.get(childXref);
            if (childId) {
              await pool.query(
                'INSERT INTO children (family_id, person_id) VALUES ($1, $2)',
                [id, childId],
              );
            } else {
              warnings.push(`Child ${childXref} not found for family`);
            }
          }
          familiesImported++;
        } catch (err) {
          errors.push(`Failed to import family: ${(err as Error).message}`);
        }
      }

      return { peopleImported, familiesImported, errors, warnings };
    },

    // Media mutations
    uploadMedia: async (
      _: unknown,
      {
        personId,
        input,
      }: {
        personId: string;
        input: {
          filename: string;
          original_filename: string;
          mime_type: string;
          file_size: number;
          storage_path: string;
          thumbnail_path?: string;
          media_type: string;
          caption?: string;
          date_taken?: string;
          source_attribution?: string;
        };
      },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');
      const id = crypto
        .randomBytes(9)
        .toString('base64')
        .replace(/[+/=]/g, '')
        .substring(0, 12);

      const { rows } = await pool.query(
        `
        INSERT INTO media (id, person_id, filename, original_filename, mime_type, file_size, storage_path, thumbnail_path, media_type, caption, date_taken, source_attribution, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `,
        [
          id,
          personId,
          input.filename,
          input.original_filename,
          input.mime_type,
          input.file_size,
          input.storage_path,
          input.thumbnail_path || null,
          input.media_type,
          input.caption || null,
          input.date_taken || null,
          input.source_attribution || null,
          user.id,
        ],
      );

      return rows[0];
    },

    updateMedia: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          caption?: string;
          date_taken?: string;
          source_attribution?: string;
          media_type?: string;
        };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (input.caption !== undefined) {
        updates.push(`caption = $${paramIndex++}`);
        values.push(input.caption);
      }
      if (input.date_taken !== undefined) {
        updates.push(`date_taken = $${paramIndex++}`);
        values.push(input.date_taken);
      }
      if (input.source_attribution !== undefined) {
        updates.push(`source_attribution = $${paramIndex++}`);
        values.push(input.source_attribution);
      }
      if (input.media_type !== undefined) {
        updates.push(`media_type = $${paramIndex++}`);
        values.push(input.media_type);
      }

      if (updates.length === 0) {
        const { rows } = await pool.query('SELECT * FROM media WHERE id = $1', [
          id,
        ]);
        return rows[0] || null;
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const { rows } = await pool.query(
        `UPDATE media SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values,
      );
      return rows[0] || null;
    },

    deleteMedia: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const result = await pool.query('DELETE FROM media WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    },
  },

  // Field resolvers - use DataLoaders for batched queries
  Person: {
    parents: async (person: { id: string }, _: unknown, ctx: Context) => {
      const families = await ctx.loaders.familiesAsChildLoader.load(person.id);
      if (families.length === 0) return [];
      const parentIds = families.flatMap((f) =>
        [f.husband_id, f.wife_id].filter(Boolean),
      ) as string[];
      return parentIds.length
        ? (await ctx.loaders.personLoader.loadMany(parentIds)).filter(Boolean)
        : [];
    },
    siblings: async (person: { id: string }, _: unknown, ctx: Context) => {
      const parentFamilies = await ctx.loaders.familiesAsChildLoader.load(
        person.id,
      );
      if (parentFamilies.length === 0) return [];
      const childrenByFamily =
        await ctx.loaders.childrenByFamilyLoader.loadMany(
          parentFamilies.map((f) => f.id),
        );
      const siblingIds = [
        ...new Set(
          childrenByFamily
            .flat()
            .filter(
              (id): id is string => typeof id === 'string' && id !== person.id,
            ),
        ),
      ];
      return siblingIds.length
        ? (await ctx.loaders.personLoader.loadMany(siblingIds)).filter(Boolean)
        : [];
    },
    spouses: async (person: { id: string }, _: unknown, ctx: Context) => {
      const families = await ctx.loaders.familiesAsSpouseLoader.load(person.id);
      const spouseIds = families
        .map((f) => (f.husband_id === person.id ? f.wife_id : f.husband_id))
        .filter(Boolean) as string[];
      return spouseIds.length
        ? (await ctx.loaders.personLoader.loadMany(spouseIds)).filter(Boolean)
        : [];
    },
    children: async (person: { id: string }, _: unknown, ctx: Context) => {
      const families = await ctx.loaders.familiesAsSpouseLoader.load(person.id);
      if (families.length === 0) return [];
      const childrenByFamily =
        await ctx.loaders.childrenByFamilyLoader.loadMany(
          families.map((f) => f.id),
        );
      const childIds = [
        ...new Set(
          childrenByFamily
            .flat()
            .filter((id): id is string => typeof id === 'string'),
        ),
      ];
      return childIds.length
        ? (await ctx.loaders.personLoader.loadMany(childIds)).filter(Boolean)
        : [];
    },
    families: async (person: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.familiesAsSpouseLoader.load(person.id),
    lifeEvents: async (person: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.lifeEventsLoader.load(person.id),
    facts: (person: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.factsLoader.load(person.id),
    sources: (person: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.sourcesLoader.load(person.id),
    media: (person: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.mediaLoader.load(person.id),
    // Coat of arms: check person override first, then surname lookup
    coatOfArms: async (person: { id: string; name_surname?: string }) => {
      // 1. Check for person-specific override in facts table
      const { rows: personRows } = await pool.query(
        `SELECT fact_value FROM facts WHERE person_id = $1 AND fact_type = 'coat_of_arms' LIMIT 1`,
        [person.id],
      );
      if (personRows[0]?.fact_value) return personRows[0].fact_value;

      // 2. Look up by surname
      if (person.name_surname) {
        const { rows: surnameRows } = await pool.query(
          `SELECT coat_of_arms FROM surname_crests WHERE LOWER(surname) = LOWER($1) LIMIT 1`,
          [person.name_surname],
        );
        if (surnameRows[0]?.coat_of_arms) return surnameRows[0].coat_of_arms;
      }

      return null;
    },
    // Notable relatives connected through ancestry (cached for performance)
    notableRelatives: async (person: { id: string }) => {
      const cacheKey = `notable_relatives:${person.id}`;
      const cached =
        getCached<Array<{ person: Person; generation: number }>>(cacheKey);
      if (cached) return cached;

      const { rows } = await pool.query(
        `
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
      `,
        [person.id],
      );

      const result = rows.map((row) => ({
        person: row,
        generation: row.generation,
      }));

      setCache(cacheKey, result);
      return result;
    },

    // Data completeness score (0-100)
    completeness_score: async (
      person: {
        id: string;
        name_full: string | null;
        birth_date: string | null;
        birth_year: number | null;
        birth_place: string | null;
        death_date: string | null;
        death_year: number | null;
        death_place: string | null;
        living: boolean;
        source_count: number | null;
      },
      _: unknown,
      ctx: Context,
    ): Promise<number> => {
      let score = 0;

      // Name (10%)
      if (person.name_full) score += 10;

      // Birth date (15%)
      if (person.birth_date) score += 15;
      else if (person.birth_year) score += 10;

      // Birth place (10%)
      if (person.birth_place) score += 10;

      // Death date (15%) - only if not living
      if (person.living) {
        score += 15; // Living people get full death date credit
      } else if (person.death_date) {
        score += 15;
      } else if (person.death_year) {
        score += 10;
      }

      // Death place (10%) - only if not living
      if (person.living) {
        score += 10;
      } else if (person.death_place) {
        score += 10;
      }

      // At least one parent (15%)
      const families = await ctx.loaders.familiesAsChildLoader.load(person.id);
      if (families.length > 0) score += 15;

      // At least one source (15%)
      if ((person.source_count ?? 0) > 0) score += 15;

      // Photo/media (10%)
      const media = await ctx.loaders.mediaLoader.load(person.id);
      if (media.length > 0) score += 10;

      return score;
    },

    // Detailed completeness breakdown
    completeness_details: async (
      person: {
        id: string;
        name_full: string | null;
        birth_date: string | null;
        birth_year: number | null;
        birth_place: string | null;
        death_date: string | null;
        death_year: number | null;
        death_place: string | null;
        living: boolean;
        source_count: number | null;
      },
      _: unknown,
      ctx: Context,
    ) => {
      const has_name = !!person.name_full;
      const has_birth_date = !!(person.birth_date || person.birth_year);
      const has_birth_place = !!person.birth_place;
      const has_death_date =
        person.living || !!(person.death_date || person.death_year);
      const has_death_place = person.living || !!person.death_place;

      const families = await ctx.loaders.familiesAsChildLoader.load(person.id);
      const has_parents = families.length > 0;

      const has_sources = (person.source_count ?? 0) > 0;

      const media = await ctx.loaders.mediaLoader.load(person.id);
      const has_media = media.length > 0;

      // Calculate score
      let score = 0;
      if (has_name) score += 10;
      if (has_birth_date) score += 15;
      if (has_birth_place) score += 10;
      if (has_death_date) score += 15;
      if (has_death_place) score += 10;
      if (has_parents) score += 15;
      if (has_sources) score += 15;
      if (has_media) score += 10;

      // Build missing fields list
      const missing_fields: string[] = [];
      if (!has_name) missing_fields.push('name');
      if (!has_birth_date) missing_fields.push('birth_date');
      if (!has_birth_place) missing_fields.push('birth_place');
      if (!has_death_date) missing_fields.push('death_date');
      if (!has_death_place) missing_fields.push('death_place');
      if (!has_parents) missing_fields.push('parents');
      if (!has_sources) missing_fields.push('sources');
      if (!has_media) missing_fields.push('media');

      return {
        score,
        has_name,
        has_birth_date,
        has_birth_place,
        has_death_date,
        has_death_place,
        has_parents,
        has_sources,
        has_media,
        missing_fields,
      };
    },

    // Computed research tip based on gaps (Issue #195)
    research_tip: async (
      person: {
        id: string;
        birth_year: number | null;
        birth_place: string | null;
        death_year: number | null;
        death_place: string | null;
        birth_date_accuracy: string | null;
        death_date_accuracy: string | null;
        source_count: number | null;
        living: boolean;
        is_placeholder: boolean;
      },
      _: unknown,
      ctx: Context,
    ): Promise<string | null> => {
      // Don't generate tips for placeholder people
      if (person.is_placeholder) return null;

      // Check for placeholder parents (highest priority)
      const families = await ctx.loaders.familiesAsChildLoader.load(person.id);
      if (families.length > 0) {
        const parentIds = families.flatMap((f) =>
          [f.husband_id, f.wife_id].filter(Boolean),
        ) as string[];
        if (parentIds.length > 0) {
          const parents = (
            await ctx.loaders.personLoader.loadMany(parentIds)
          ).filter(Boolean) as Array<{
            is_placeholder?: boolean;
            sex?: string;
          }>;
          const placeholderParent = parents.find((p) => p.is_placeholder);
          if (placeholderParent) {
            const parentType =
              placeholderParent.sex === 'M' ? 'father' : 'mother';
            return `Identify unknown ${parentType} – current parent is a placeholder`;
          }
        }
      }

      // Missing birth year (high priority)
      if (person.birth_year === null) {
        return 'Find birth record to establish birth year';
      }

      // Missing death year for deceased person
      if (!person.living && person.death_year === null) {
        return 'Find death record to establish death year';
      }

      // Estimated/ranged birth date
      if (
        person.birth_date_accuracy === 'ESTIMATED' ||
        person.birth_date_accuracy === 'RANGE'
      ) {
        return 'Refine estimated birth date using census or vital records';
      }

      // Estimated/ranged death date
      if (
        person.death_date_accuracy === 'ESTIMATED' ||
        person.death_date_accuracy === 'RANGE'
      ) {
        return 'Refine estimated death date using vital records or obituaries';
      }

      // Missing birth place
      if (!person.birth_place) {
        return 'Find birth location from census or vital records';
      }

      // Missing death place for deceased
      if (!person.living && !person.death_place) {
        return 'Find death location from vital records or obituaries';
      }

      // No sources attached
      if ((person.source_count ?? 0) === 0) {
        return 'Attach at least one high-quality source to verify data';
      }

      // All gaps filled - suggest review
      return 'Review existing sources for additional details';
    },
  },

  Family: {
    husband: (
      family: { husband_id: string | null },
      _: unknown,
      ctx: Context,
    ) =>
      family.husband_id
        ? ctx.loaders.personLoader.load(family.husband_id)
        : null,
    wife: (family: { wife_id: string | null }, _: unknown, ctx: Context) =>
      family.wife_id ? ctx.loaders.personLoader.load(family.wife_id) : null,
    children: async (family: { id: string }, _: unknown, ctx: Context) => {
      const childIds = await ctx.loaders.childrenByFamilyLoader.load(family.id);
      return childIds.length
        ? (await ctx.loaders.personLoader.loadMany(childIds)).filter(Boolean)
        : [];
    },
  },

  // User type resolver to properly format dates and resolve linked_person
  User: {
    created_at: (user: { created_at: Date | string | null }) =>
      user.created_at ? new Date(user.created_at).toISOString() : null,
    last_login: (user: { last_login: Date | string | null }) =>
      user.last_login ? new Date(user.last_login).toISOString() : null,
    last_accessed: (user: { last_accessed: Date | string | null }) =>
      user.last_accessed ? new Date(user.last_accessed).toISOString() : null,
    linked_person: async (
      user: { person_id: string | null },
      _: unknown,
      ctx: { loaders: Loaders },
    ) => {
      if (!user.person_id) return null;
      return ctx.loaders.personLoader.load(user.person_id);
    },
  },

  // Invitation type resolver to properly format dates
  Invitation: {
    created_at: (inv: { created_at: Date | string | null }) =>
      inv.created_at ? new Date(inv.created_at).toISOString() : null,
    expires_at: (inv: { expires_at: Date | string | null }) =>
      inv.expires_at ? new Date(inv.expires_at).toISOString() : null,
    accepted_at: (inv: { accepted_at: Date | string | null }) =>
      inv.accepted_at ? new Date(inv.accepted_at).toISOString() : null,
  },

  // Media type resolver
  Media: {
    url: (media: { storage_path: string }) => {
      // Return the storage path as URL - in production this would be an S3 presigned URL
      return `/api/media/${media.storage_path}`;
    },
    created_at: (media: { created_at: Date | string | null }) =>
      media.created_at ? new Date(media.created_at).toISOString() : null,
    date_taken: (media: { date_taken: Date | string | null }) =>
      media.date_taken
        ? new Date(media.date_taken).toISOString().split('T')[0]
        : null,
  },
};
