import {
  getPeople,
  getPerson,
  getFamilies,
  updateResearchStatus,
  updateResearchPriority,
  getStats,
  getResearchQueue,
  getTimeline,
  pool
} from '../db';
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

    // Timeline - grouped by year
    timeline: async () => {
      const data = await getTimeline();
      return data.map(({ year, events }) => ({
        year,
        events: events.map(e => ({ type: e.type, person: e.person }))
      }));
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
      await updateResearchStatus(personId, status);
      return getPerson(personId);
    },
    
    updateResearchPriority: async (_: unknown, { personId, priority }: { personId: string; priority: number }, context: Context) => {
      requireAuth(context, 'editor');
      await updateResearchPriority(personId, priority);
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
          SELECT DISTINCT sibling.id, sibling.name_full, a.generation
          FROM ancestry a
          JOIN children c1 ON c1.person_id = a.id
          JOIN children c2 ON c2.family_id = c1.family_id AND c2.person_id != a.id
          JOIN people sibling ON sibling.id = c2.person_id
        ),
        sibling_children AS (
          SELECT s.id, s.name_full, s.generation, 'sibling' as rel_type FROM ancestor_siblings s
          UNION ALL
          SELECT child.id, child.name_full, s.generation, 'child' as rel_type
          FROM ancestor_siblings s
          JOIN families f ON (f.husband_id = s.id OR f.wife_id = s.id)
          JOIN children c ON c.family_id = f.id
          JOIN people child ON child.id = c.person_id
        ),
        sibling_grandchildren AS (
          SELECT sc.id, sc.name_full, sc.generation, sc.rel_type FROM sibling_children sc
          UNION ALL
          SELECT gc.id, gc.name_full, sc.generation, 'grandchild' as rel_type
          FROM sibling_children sc
          JOIN families f ON (f.husband_id = sc.id OR f.wife_id = sc.id)
          JOIN children c ON c.family_id = f.id
          JOIN people gc ON gc.id = c.person_id
          WHERE sc.rel_type = 'child'
        ),
        all_relatives AS (
          SELECT sg.id, sg.name_full, sg.generation FROM sibling_grandchildren sg
          UNION
          SELECT a.id, a.name_full, a.generation FROM ancestry a
          UNION
          SELECT spouse.id, spouse.name_full, sg.generation
          FROM sibling_grandchildren sg
          JOIN families f ON (f.husband_id = sg.id OR f.wife_id = sg.id)
          JOIN people spouse ON (spouse.id = f.husband_id OR spouse.id = f.wife_id) AND spouse.id != sg.id
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

