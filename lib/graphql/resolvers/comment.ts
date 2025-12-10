import crypto from 'node:crypto';
import { pool } from '../../pool';
import { logAudit } from '../../users';
import { type Context, requireAuth } from './helpers';

export const commentResolvers = {
  Query: {
    personComments: async (_: unknown, { personId }: { personId: string }) => {
      const { rows } = await pool.query(
        `SELECT * FROM person_comments WHERE person_id = $1 ORDER BY created_at ASC`,
        [personId],
      );
      return rows;
    },

    // Settings queries,
  },
  Mutation: {
    addComment: async (
      _: unknown,
      {
        personId,
        content,
        parentCommentId,
      }: { personId: string; content: string; parentCommentId?: string },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // Generate ID
      const id = crypto
        .randomBytes(9)
        .toString('base64')
        .replace(/[+/=]/g, '')
        .substring(0, 12);

      const { rows } = await pool.query(
        `INSERT INTO person_comments (id, person_id, user_id, parent_comment_id, content)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, personId, user.id, parentCommentId || null, content],
      );

      // Audit log
      await logAudit(user.id, 'add_comment', {
        commentId: id,
        personId,
        parentCommentId,
        contentLength: content.length,
      });

      return rows[0];
    },
    updateComment: async (
      _: unknown,
      { id, content }: { id: string; content: string },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // Check if user owns the comment
      const { rows: existing } = await pool.query(
        'SELECT user_id, person_id FROM person_comments WHERE id = $1',
        [id],
      );

      if (existing.length === 0) {
        throw new Error('Comment not found');
      }

      if (existing[0].user_id !== user.id && user.role !== 'admin') {
        throw new Error('You can only edit your own comments');
      }

      const { rows } = await pool.query(
        `UPDATE person_comments SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [content, id],
      );

      // Audit log
      await logAudit(user.id, 'update_comment', {
        commentId: id,
        personId: existing[0].person_id,
        contentLength: content.length,
      });

      return rows[0] || null;
    },
    deleteComment: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // Check if user owns the comment
      const { rows: existing } = await pool.query(
        'SELECT user_id, person_id FROM person_comments WHERE id = $1',
        [id],
      );

      if (existing.length === 0) {
        throw new Error('Comment not found');
      }

      if (existing[0].user_id !== user.id && user.role !== 'admin') {
        throw new Error('You can only delete your own comments');
      }

      const result = await pool.query(
        'DELETE FROM person_comments WHERE id = $1',
        [id],
      );

      // Audit log
      await logAudit(user.id, 'delete_comment', {
        commentId: id,
        personId: existing[0].person_id,
      });

      return (result.rowCount ?? 0) > 0;
    },
  },
};
