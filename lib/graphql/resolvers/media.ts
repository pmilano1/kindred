import crypto from 'node:crypto';
import { pool } from '../../pool';
import { logAudit } from '../../users';
import { type Context, requireAuth } from './helpers';

export const mediaResolvers = {
  Mutation: {
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

      // Audit log
      await logAudit(user.id, 'upload_media', {
        personId,
        mediaId: id,
        mediaType: input.media_type,
        filename: input.original_filename,
      });

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
      const user = requireAuth(context, 'editor');

      // Get person_id for audit log
      const { rows: existing } = await pool.query(
        'SELECT person_id, filename FROM media WHERE id = $1',
        [id],
      );

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

      // Audit log
      await logAudit(user.id, 'update_media', {
        personId: existing[0]?.person_id,
        mediaId: id,
        filename: existing[0]?.filename,
      });

      return rows[0] || null;
    },
    deleteMedia: async (
      _: unknown,
      { id }: { id: string },
      context: Context,
    ) => {
      const user = requireAuth(context, 'editor');

      // Get person_id for audit log
      const { rows: existing } = await pool.query(
        'SELECT person_id, filename FROM media WHERE id = $1',
        [id],
      );

      const result = await pool.query('DELETE FROM media WHERE id = $1', [id]);

      // Audit log
      await logAudit(user.id, 'delete_media', {
        personId: existing[0]?.person_id,
        mediaId: id,
        filename: existing[0]?.filename,
      });

      return (result.rowCount ?? 0) > 0;
    },

    // Comment mutations (Issue #181 - Phase 1),
  },
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

  // ActivityEntry type resolver to properly format dates
  ActivityEntry: {
    created_at: (activity: { created_at: Date | string | null }) =>
      activity.created_at ? new Date(activity.created_at).toISOString() : null,
  },

  // SurnameCrest type resolver to add peopleCount field and handle URLs
  SurnameCrest: {
    peopleCount: async (crest: { surname: string }) => {
      const { rows } = await pool.query(
        `SELECT COUNT(*) as count FROM people WHERE LOWER(name_surname) = LOWER($1)`,
        [crest.surname],
      );
      return Number.parseInt(rows[0]?.count || '0', 10);
    },
    // Return URL for coat of arms image
    // If storage_path exists, use it (S3 or local file)
    // Otherwise fall back to base64 data URL
    coat_of_arms: (crest: {
      coat_of_arms: string | null;
      storage_path: string | null;
    }) => {
      if (crest.storage_path) {
        return `/api/media/${crest.storage_path}`;
      }
      // Fall back to base64 (for backwards compatibility during migration)
      return crest.coat_of_arms;
    },
  },
};
