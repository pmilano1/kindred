import crypto from 'node:crypto';
import { pool } from '../../pool';
import { logAudit } from '../../users';
import { type Context, requireAuth } from './helpers';

export const sourceResolvers = {
  Mutation: {
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
      const user = requireAuth(context, 'editor');

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

      // Audit log
      await logAudit(user.id, 'add_source', {
        personId,
        sourceId: id,
        sourceType: input.source_type,
        sourceName: input.source_name,
      });

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
      const user = requireAuth(context, 'editor');

      // Get person_id for audit log
      const { rows: existing } = await pool.query(
        'SELECT person_id FROM sources WHERE id = $1',
        [id],
      );

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

      // Audit log
      await logAudit(user.id, 'update_source', {
        personId: existing[0]?.person_id,
        sourceId: id,
        sourceType: input.source_type,
        sourceName: input.source_name,
      });

      return rows[0] || null;
    },
    deleteSource: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      // Get person_id for audit log
      const { rows: existing } = await pool.query(
        'SELECT person_id, source_name FROM sources WHERE id = $1',
        [id],
      );

      await pool.query('DELETE FROM sources WHERE id = $1', [id]);

      // Audit log
      await logAudit(user.id, 'delete_source', {
        personId: existing[0]?.person_id,
        sourceId: id,
        sourceName: existing[0]?.source_name,
      });

      return true;
    },
  },
};
