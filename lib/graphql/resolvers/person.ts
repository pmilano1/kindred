import { pool } from '../../pool';
import type { Person } from '../../types';
import { logAudit } from '../../users';
import {
  type Context,
  getCached,
  getPerson,
  requireAuth,
  setCache,
} from './helpers';

export const personResolvers = {
  Query: {
    person: (_: unknown, { id }: { id: string }) => getPerson(id),
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

    // Recent people (for home page),
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

    // Notable people (marked with is_notable = true),
    notablePeople: async () => {
      const { rows } = await pool.query(`
        SELECT *, COALESCE(notes, description) as description
        FROM people
        WHERE is_notable = true
        ORDER BY birth_year ASC NULLS LAST
      `);
      return rows;
    },

    // Search with pagination using PostgreSQL full-text search,
  },
  Mutation: {
    updatePerson: async (
      _: unknown,
      { id, input }: { id: string; input: Record<string, unknown> },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      const fields = Object.keys(input).filter((k) => input[k] !== undefined);
      if (fields.length === 0) return getPerson(id);

      // Get person name for audit log
      const person = await getPerson(id);

      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = fields.map((f) => input[f]);

      await pool.query(`UPDATE people SET ${setClause} WHERE id = $1`, [
        id,
        ...values,
      ]);

      // Audit log
      await logAudit(user.id, 'update_person', {
        personId: id,
        personName: person?.name_full,
        fields: fields,
      });

      return getPerson(id);
    },
    deletePerson: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'admin'); // Only admin can delete

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

      // Audit log
      await logAudit(user.id, 'delete_person', {
        personId: id,
        personName: person.name_full,
      });

      return true;
    },

    // Life Event mutations,
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

    // Admin mutations,
  },
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

    // Comments (Issue #181 - Phase 1)
    comments: async (person: { id: string }) => {
      const { rows } = await pool.query(
        `SELECT * FROM person_comments WHERE person_id = $1 ORDER BY created_at ASC`,
        [person.id],
      );
      return rows;
    },
  },

  // Comment type resolver (Issue #181 - Phase 1)
  Comment: {
    user: async (comment: { user_id: string }) => {
      const { rows } = await pool.query(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [comment.user_id],
      );
      return rows[0] || null;
    },
    replies: async (comment: { id: string }) => {
      const { rows } = await pool.query(
        `SELECT * FROM person_comments WHERE parent_comment_id = $1 ORDER BY created_at ASC`,
        [comment.id],
      );
      return rows;
    },
  },
};
