import {
  getPeople,
  getPerson,
  getFamilies,
  addResearchLog,
  updateResearchStatus,
  updateResearchPriority,
  getStats,
  getResearchQueue,
  pool
} from '../db';
import { Loaders } from './dataloaders';

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
    peopleList: async (_: unknown, { limit = 100, offset = 0 }: { limit?: number; offset?: number }) => {
      const people = await getPeople();
      return people.slice(offset, offset + Math.min(limit, 100));
    },

    // Search with pagination
    search: async (_: unknown, { query, first = 50, after }: { query: string; first?: number; after?: string }) => {
      const limit = Math.min(first, 100);
      const afterId = after ? decodeCursor(after) : null;

      let sql = `SELECT *, COALESCE(notes, description) as description FROM people
                 WHERE name_full ILIKE $1 OR birth_place ILIKE $1 OR death_place ILIKE $1`;
      const params: (string | number)[] = [`%${query}%`];

      if (afterId) {
        sql += ` AND id > $2`;
        params.push(afterId);
      }

      sql += ` ORDER BY name_full LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const { rows } = await pool.query(sql, params);
      const hasMore = rows.length > limit;
      const people = hasMore ? rows.slice(0, limit) : rows;

      // Get total count for search
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM people WHERE name_full ILIKE $1 OR birth_place ILIKE $1 OR death_place ILIKE $1`,
        [`%${query}%`]
      );

      return {
        edges: people.map((p: { id: string }) => ({ node: p, cursor: encodeCursor(p.id) })),
        pageInfo: {
          hasNextPage: hasMore,
          hasPreviousPage: !!afterId,
          startCursor: people.length ? encodeCursor(people[0].id) : null,
          endCursor: people.length ? encodeCursor(people[people.length - 1].id) : null,
          totalCount: parseInt(countResult.rows[0].count),
        },
      };
    },

    families: () => getFamilies(),
    stats: () => getStats(),

    researchQueue: async (_: unknown, { limit = 50 }: { limit?: number }) => {
      const queue = await getResearchQueue();
      return queue.slice(0, Math.min(limit, 100));
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
    
    addResearchLog: async (_: unknown, { personId, input }: { personId: string; input: { action_type: string; content: string; source_checked?: string; confidence?: string; external_url?: string } }, context: Context) => {
      requireAuth(context, 'editor');
      
      return addResearchLog(
        personId,
        input.action_type,
        input.content,
        input.source_checked,
        input.confidence,
        input.external_url
      );
    },
    
    updateResearchStatus: async (_: unknown, { personId, status }: { personId: string; status: string }, context: Context) => {
      requireAuth(context, 'editor');
      await updateResearchStatus(personId, status);
      return getPerson(personId);
    },
    
    updateResearchPriority: async (_: unknown, { personId, priority }: { personId: string; priority: number }, context: Context) => {
      requireAuth(context, 'editor');
      await updateResearchPriority(personId, priority);
      return getPerson(personId);
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
    residences: (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.residencesLoader.load(person.id),
    occupations: (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.occupationsLoader.load(person.id),
    events: (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.eventsLoader.load(person.id),
    facts: (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.factsLoader.load(person.id),
    researchLog: (person: { id: string }, _: unknown, ctx: Context) => ctx.loaders.researchLogLoader.load(person.id),
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

