import { pool } from '../../pool';
import { logAudit } from '../../users';
import { type Context, requireAuth } from './helpers';

export const factResolvers = {
  Mutation: {
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
      const user = requireAuth(context, 'editor');
      const { rows } = await pool.query(
        `INSERT INTO facts (person_id, fact_type, fact_value) VALUES ($1, $2, $3) RETURNING *`,
        [personId, input.fact_type, input.fact_value || null],
      );

      // Audit log
      await logAudit(user.id, 'add_fact', {
        personId,
        factType: input.fact_type,
        factId: rows[0].id,
      });

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
      const user = requireAuth(context, 'editor');

      // Get person_id for audit log
      const { rows: existing } = await pool.query(
        'SELECT person_id FROM facts WHERE id = $1',
        [id],
      );

      const { rows } = await pool.query(
        `UPDATE facts SET fact_type = $2, fact_value = $3 WHERE id = $1 RETURNING *`,
        [id, input.fact_type, input.fact_value || null],
      );

      // Audit log
      await logAudit(user.id, 'update_fact', {
        personId: existing[0]?.person_id,
        factType: input.fact_type,
        factId: id,
      });

      return rows[0] || null;
    },
    deleteFact: async (
      _: unknown,
      { id }: { id: number },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      // Get person_id for audit log
      const { rows: existing } = await pool.query(
        'SELECT person_id, fact_type FROM facts WHERE id = $1',
        [id],
      );

      await pool.query('DELETE FROM facts WHERE id = $1', [id]);

      // Audit log
      await logAudit(user.id, 'delete_fact', {
        personId: existing[0]?.person_id,
        factType: existing[0]?.fact_type,
        factId: id,
      });

      return true;
    },

    // Family mutations,
  },
};
