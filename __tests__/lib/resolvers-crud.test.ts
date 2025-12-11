/**
 * GraphQL Resolver Tests - CRUD Operations
 * Tests: Comment, Fact, LifeEvent, and Source mutations
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

// ============================================
// CRUD RESOLVER TESTS
// ============================================
describe('CRUD Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // COMMENT MUTATION TESTS
  // ============================================
  describe('Mutation.addComment', () => {
    const commentContext = {
      user: { id: 'user-1', email: 'user@test.com', role: 'viewer' },
    };

    it('adds a comment to a person', async () => {
      mockedQuery.mockReset();
      const mockComment = {
        id: 'new-comment',
        person_id: 'p1',
        content: 'Test comment',
        user_id: 'user-1',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockComment] });

      const result = await resolvers.Mutation.addComment(
        null,
        { personId: 'p1', content: 'Test comment' },
        commentContext,
      );

      expect(result).toEqual(mockComment);
    });

    it('adds a reply to an existing comment', async () => {
      mockedQuery.mockReset();
      const mockReply = {
        id: 'reply-1',
        person_id: 'p1',
        content: 'Reply',
        user_id: 'user-1',
        parent_comment_id: 'c1',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockReply] });

      const result = await resolvers.Mutation.addComment(
        null,
        { personId: 'p1', content: 'Reply', parentCommentId: 'c1' },
        commentContext,
      );

      expect(result).toEqual(mockReply);
    });

    it('throws without authentication', async () => {
      await expect(
        resolvers.Mutation.addComment(
          null,
          { personId: 'p1', content: 'Test' },
          {},
        ),
      ).rejects.toThrow();
    });
  });

  describe('Mutation.updateComment', () => {
    const commentContext = {
      user: { id: 'user-1', email: 'user@test.com', role: 'viewer' },
    };

    it('updates own comment', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'user-1', person_id: 'p1' }],
      });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'c1', content: 'Updated content' }],
      });

      const result = await resolvers.Mutation.updateComment(
        null,
        { id: 'c1', content: 'Updated content' },
        commentContext,
      );

      expect(result.content).toBe('Updated content');
    });

    it('throws when updating others comment as non-admin', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'other-user', person_id: 'p1' }],
      });

      await expect(
        resolvers.Mutation.updateComment(
          null,
          { id: 'c1', content: 'Updated' },
          commentContext,
        ),
      ).rejects.toThrow('You can only edit your own comments');
    });

    it('admin can update any comment', async () => {
      mockedQuery.mockReset();
      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      mockedQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'other-user', person_id: 'p1' }],
      });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'c1', content: 'Admin updated' }],
      });

      const result = await resolvers.Mutation.updateComment(
        null,
        { id: 'c1', content: 'Admin updated' },
        adminContext,
      );

      expect(result.content).toBe('Admin updated');
    });

    it('throws for non-existent comment', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.updateComment(
          null,
          { id: 'nonexistent', content: 'Updated' },
          commentContext,
        ),
      ).rejects.toThrow('Comment not found');
    });
  });

  describe('Mutation.deleteComment', () => {
    const commentContext = {
      user: { id: 'user-1', email: 'user@test.com', role: 'viewer' },
    };

    it('deletes own comment', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'user-1', person_id: 'p1' }],
      });
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await resolvers.Mutation.deleteComment(
        null,
        { id: 'c1' },
        commentContext,
      );

      expect(result).toBe(true);
    });

    it('throws when deleting others comment as non-admin', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'other-user', person_id: 'p1' }],
      });

      await expect(
        resolvers.Mutation.deleteComment(null, { id: 'c1' }, commentContext),
      ).rejects.toThrow('You can only delete your own comments');
    });
  });

  // ============================================
  // FACT MUTATION TESTS
  // ============================================
  describe('Mutation.addFact', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('adds a fact to a person', async () => {
      mockedQuery.mockReset();
      const mockFact = {
        id: 1,
        person_id: 'p1',
        fact_type: 'occupation',
        fact_value: 'Engineer',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockFact] });

      const result = await resolvers.Mutation.addFact(
        null,
        {
          personId: 'p1',
          input: { fact_type: 'occupation', fact_value: 'Engineer' },
        },
        editorContext,
      );

      expect(result).toEqual(mockFact);
    });

    it('throws for viewer role', async () => {
      const viewerContext = {
        user: { id: 'viewer-1', email: 'viewer@test.com', role: 'viewer' },
      };

      await expect(
        resolvers.Mutation.addFact(
          null,
          { personId: 'p1', input: { fact_type: 'occupation' } },
          viewerContext,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Mutation.updateFact', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('updates an existing fact', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ person_id: 'p1' }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 1, fact_type: 'occupation', fact_value: 'Doctor' }],
      });

      const result = await resolvers.Mutation.updateFact(
        null,
        { id: 1, input: { fact_type: 'occupation', fact_value: 'Doctor' } },
        editorContext,
      );

      expect(result.fact_value).toBe('Doctor');
    });
  });

  describe('Mutation.deleteFact', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('deletes a fact', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ person_id: 'p1', fact_type: 'occupation' }],
      });
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await resolvers.Mutation.deleteFact(
        null,
        { id: 1 },
        editorContext,
      );

      expect(result).toBe(true);
    });
  });

  // ============================================
  // LIFE EVENT MUTATION TESTS
  // ============================================
  describe('Mutation.addLifeEvent', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('adds a life event to a person', async () => {
      mockedQuery.mockReset();
      const mockEvent = {
        id: 1,
        person_id: 'p1',
        event_type: 'residence',
        event_place: 'New York',
        event_year: 1990,
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockEvent] });

      const result = await resolvers.Mutation.addLifeEvent(
        null,
        {
          personId: 'p1',
          input: {
            event_type: 'residence',
            event_place: 'New York',
            event_year: 1990,
          },
        },
        editorContext,
      );

      expect(result).toEqual(mockEvent);
    });

    it('handles optional fields', async () => {
      mockedQuery.mockReset();
      const mockEvent = {
        id: 2,
        person_id: 'p1',
        event_type: 'graduation',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockEvent] });

      const result = await resolvers.Mutation.addLifeEvent(
        null,
        { personId: 'p1', input: { event_type: 'graduation' } },
        editorContext,
      );

      expect(result.event_type).toBe('graduation');
    });
  });

  describe('Mutation.updateLifeEvent', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('updates a life event', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ person_id: 'p1' }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 1, event_type: 'residence', event_place: 'Boston' }],
      });

      const result = await resolvers.Mutation.updateLifeEvent(
        null,
        { id: 1, input: { event_type: 'residence', event_place: 'Boston' } },
        editorContext,
      );

      expect(result.event_place).toBe('Boston');
    });
  });

  describe('Mutation.deleteLifeEvent', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('deletes a life event', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ person_id: 'p1', event_type: 'residence' }],
      });
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await resolvers.Mutation.deleteLifeEvent(
        null,
        { id: 1 },
        editorContext,
      );

      expect(result).toBe(true);
    });
  });

  // ============================================
  // SOURCE MUTATION TESTS
  // ============================================
  describe('Mutation.addSource', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('adds a source to a person', async () => {
      mockedQuery.mockReset();
      const mockSource = {
        id: 'src-1',
        person_id: 'p1',
        source_type: 'census',
        source_name: '1900 Census',
        action: 'found',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockSource] });

      const result = await resolvers.Mutation.addSource(
        null,
        {
          personId: 'p1',
          input: {
            source_type: 'census',
            source_name: '1900 Census',
            action: 'found',
          },
        },
        editorContext,
      );

      expect(result).toEqual(mockSource);
    });

    it('adds source with URL and content', async () => {
      mockedQuery.mockReset();
      const mockSource = {
        id: 'src-2',
        person_id: 'p1',
        source_type: 'website',
        source_url: 'https://example.com',
        content: 'Found record',
        action: 'verified',
        confidence: 'high',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockSource] });

      const result = await resolvers.Mutation.addSource(
        null,
        {
          personId: 'p1',
          input: {
            source_type: 'website',
            source_url: 'https://example.com',
            content: 'Found record',
            action: 'verified',
            confidence: 'high',
          },
        },
        editorContext,
      );

      expect(result.confidence).toBe('high');
    });
  });

  describe('Mutation.updateSource', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('updates a source', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ person_id: 'p1' }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'src-1', source_name: 'Updated Census', confidence: 'medium' },
        ],
      });

      const result = await resolvers.Mutation.updateSource(
        null,
        {
          id: 'src-1',
          input: { source_name: 'Updated Census', confidence: 'medium' },
        },
        editorContext,
      );

      expect(result.source_name).toBe('Updated Census');
    });
  });

  describe('Mutation.deleteSource', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('deletes a source', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ person_id: 'p1', source_name: 'Census' }],
      });
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await resolvers.Mutation.deleteSource(
        null,
        { id: 'src-1' },
        editorContext,
      );

      expect(result).toBe(true);
    });
  });
});
