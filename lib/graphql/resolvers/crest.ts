import { pool } from '../../pool';
import { type Context, requireAuth } from './helpers';

export const crestResolvers = {
  Query: {
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

    // Comments queries (Issue #181 - Phase 1),
  },
  Mutation: {
    setSurnameCrest: async (
      _: unknown,
      {
        surname,
        coatOfArms,
        description,
        origin,
        motto,
        blazon,
        sourceUrl,
      }: {
        surname: string;
        coatOfArms: string;
        description?: string;
        origin?: string;
        motto?: string;
        blazon?: string;
        sourceUrl?: string;
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `INSERT INTO surname_crests (surname, coat_of_arms, description, origin, motto, blazon, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (surname) DO UPDATE SET
           coat_of_arms = $2, description = $3, origin = $4, motto = $5, blazon = $6, source_url = $7, updated_at = NOW()
         RETURNING *`,
        [
          surname,
          coatOfArms,
          description || null,
          origin || null,
          motto || null,
          blazon || null,
          sourceUrl || null,
        ],
      );
      return rows[0];
    },
    updateSurnameCrest: async (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          surname?: string;
          coat_of_arms?: string;
          description?: string;
          origin?: string;
          motto?: string;
          blazon?: string;
          source_url?: string;
        };
      },
      context: Context,
    ) => {
      requireAuth(context, 'editor');

      // Build dynamic UPDATE query based on provided fields
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (input.surname !== undefined) {
        updates.push(`surname = $${paramIndex++}`);
        values.push(input.surname);
      }
      if (input.coat_of_arms !== undefined) {
        updates.push(`coat_of_arms = $${paramIndex++}`);
        values.push(input.coat_of_arms);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(input.description || null);
      }
      if (input.origin !== undefined) {
        updates.push(`origin = $${paramIndex++}`);
        values.push(input.origin || null);
      }
      if (input.motto !== undefined) {
        updates.push(`motto = $${paramIndex++}`);
        values.push(input.motto || null);
      }
      if (input.blazon !== undefined) {
        updates.push(`blazon = $${paramIndex++}`);
        values.push(input.blazon || null);
      }
      if (input.source_url !== undefined) {
        updates.push(`source_url = $${paramIndex++}`);
        values.push(input.source_url || null);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const { rows } = await pool.query(
        `UPDATE surname_crests SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values,
      );

      if (rows.length === 0) {
        throw new Error('Surname crest not found');
      }

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

    // Person-specific coat of arms override (stored in facts table),
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

    // Settings mutations,
  },
};
