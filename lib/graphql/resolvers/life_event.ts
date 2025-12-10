import { pool } from '../../pool';
import { logAudit } from '../../users';
import { type Context, requireAuth } from './helpers';

export const life_eventResolvers = {
  Mutation: {
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
      const user = requireAuth(context, 'editor');
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

      // Audit log
      await logAudit(user.id, 'add_life_event', {
        personId,
        eventType: input.event_type,
        eventId: rows[0].id,
      });

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
      const user = requireAuth(context, 'editor');

      // Get person_id for audit log
      const { rows: existing } = await pool.query(
        'SELECT person_id FROM life_events WHERE id = $1',
        [id],
      );

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

      // Audit log
      await logAudit(user.id, 'update_life_event', {
        personId: existing[0]?.person_id,
        eventType: input.event_type,
        eventId: id,
      });

      return rows[0] || null;
    },
    deleteLifeEvent: async (
      _: unknown,
      { id }: { id: number },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      // Get person_id for audit log
      const { rows: existing } = await pool.query(
        'SELECT person_id, event_type FROM life_events WHERE id = $1',
        [id],
      );

      await pool.query('DELETE FROM life_events WHERE id = $1', [id]);

      // Audit log
      await logAudit(user.id, 'delete_life_event', {
        personId: existing[0]?.person_id,
        eventType: existing[0]?.event_type,
        eventId: id,
      });

      return true;
    },

    // Fact mutations,
  },
};
