/**
 * GraphQL Resolver Tests - Media
 * Tests: Media mutations and type resolvers
 */
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// vi.hoisted ensures mocks are available before vi.mock hoisting
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

// Mock the database pool
vi.mock('@/lib/pool', () => ({
  pool: {
    query: mockQuery,
  },
}));

// Mock email functions
vi.mock('@/lib/email', () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  verifyEmailForSandbox: vi.fn().mockResolvedValue(true),
}));

// Mock users functions
vi.mock('@/lib/users', () => ({
  getUsers: vi.fn().mockResolvedValue([]),
  getInvitations: vi.fn().mockResolvedValue([]),
  createInvitation: vi.fn().mockResolvedValue({ id: 'inv-1', token: 'abc123' }),
  deleteInvitation: vi.fn().mockResolvedValue(undefined),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  deleteUser: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

// Mock settings
vi.mock('@/lib/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({
    site_name: 'Test Family Tree',
    family_name: 'Test',
    theme_color: '#2c5530',
  }),
  clearSettingsCache: vi.fn(),
}));

import { resolvers } from '@/lib/graphql/resolvers';

const mockedQuery = mockQuery as Mock;

describe('Media Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const editorContext = {
    user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
  };

  // ============================================
  // MUTATION.UPLOADMEDIA TESTS
  // ============================================
  describe('Mutation.uploadMedia', () => {
    it('uploads media for a person', async () => {
      mockedQuery.mockReset();
      const mockMedia = {
        id: 'media-1',
        person_id: 'p1',
        filename: 'photo.jpg',
        original_filename: 'family-photo.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        storage_path: 's3://bucket/photo.jpg',
        media_type: 'photo',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockMedia] });

      const result = await resolvers.Mutation.uploadMedia(
        null,
        {
          personId: 'p1',
          input: {
            filename: 'photo.jpg',
            original_filename: 'family-photo.jpg',
            mime_type: 'image/jpeg',
            file_size: 1024,
            storage_path: 's3://bucket/photo.jpg',
            media_type: 'photo',
          },
        },
        editorContext,
      );

      expect(result).toEqual(mockMedia);
    });

    it('handles optional caption and date_taken', async () => {
      mockedQuery.mockReset();
      const mockMedia = {
        id: 'media-2',
        person_id: 'p1',
        filename: 'doc.pdf',
        media_type: 'document',
        caption: 'Birth certificate',
        date_taken: '1950-01-15',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockMedia] });

      const result = await resolvers.Mutation.uploadMedia(
        null,
        {
          personId: 'p1',
          input: {
            filename: 'doc.pdf',
            original_filename: 'birth-cert.pdf',
            mime_type: 'application/pdf',
            file_size: 2048,
            storage_path: 's3://bucket/doc.pdf',
            media_type: 'document',
            caption: 'Birth certificate',
            date_taken: '1950-01-15',
          },
        },
        editorContext,
      );

      expect(result.caption).toBe('Birth certificate');
    });
  });

  // ============================================
  // MUTATION.UPDATEMEDIA TESTS
  // ============================================
  describe('Mutation.updateMedia', () => {
    it('updates media caption', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ person_id: 'p1', filename: 'photo.jpg' }],
      });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'media-1', caption: 'Updated caption' }],
      });

      const result = await resolvers.Mutation.updateMedia(
        null,
        { id: 'media-1', input: { caption: 'Updated caption' } },
        editorContext,
      );

      expect(result.caption).toBe('Updated caption');
    });

    it('returns existing media when no updates provided', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ person_id: 'p1', filename: 'photo.jpg' }],
      });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'media-1', caption: 'Original' }],
      });

      const result = await resolvers.Mutation.updateMedia(
        null,
        { id: 'media-1', input: {} },
        editorContext,
      );

      expect(result).toBeDefined();
    });
  });

  describe('Mutation.deleteMedia', () => {
    it('deletes media', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ person_id: 'p1', filename: 'photo.jpg' }],
      });
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await resolvers.Mutation.deleteMedia(
        null,
        { id: 'media-1' },
        editorContext,
      );

      expect(result).toBe(true);
    });

    it('returns false when media not found', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await resolvers.Mutation.deleteMedia(
        null,
        { id: 'nonexistent' },
        editorContext,
      );

      expect(result).toBe(false);
    });
  });

  describe('Media type resolvers', () => {
    it('generates URL from storage path', () => {
      const media = { storage_path: 'people/p1/photo.jpg' };
      const result = resolvers.Media.url(media);
      expect(result).toBe('/api/media/people/p1/photo.jpg');
    });

    it('formats created_at as ISO string', () => {
      const media = { created_at: new Date('2024-01-15T12:00:00Z') };
      const result = resolvers.Media.created_at(media);
      expect(result).toBe('2024-01-15T12:00:00.000Z');
    });

    it('returns null for null created_at', () => {
      const media = { created_at: null };
      const result = resolvers.Media.created_at(media);
      expect(result).toBeNull();
    });

    it('formats date_taken as date only', () => {
      const media = { date_taken: new Date('2024-01-15T12:00:00Z') };
      const result = resolvers.Media.date_taken(media);
      expect(result).toBe('2024-01-15');
    });

    it('returns null for null date_taken', () => {
      const media = { date_taken: null };
      const result = resolvers.Media.date_taken(media);
      expect(result).toBeNull();
    });
  });
});
