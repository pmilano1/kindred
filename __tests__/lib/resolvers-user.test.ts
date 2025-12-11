/**
 * User Resolver Tests
 * Tests user management, invitations, and type resolvers
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

describe('User Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // MUTATION.CREATELOCALUSER TESTS
  // ============================================
  describe('Mutation.createLocalUser', () => {
    const adminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('creates a new local user when admin', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'new-user-id',
            email: 'newuser@test.com',
            name: 'New User',
            role: 'viewer',
            created_at: new Date(),
          },
        ],
      });

      const result = await resolvers.Mutation.createLocalUser(
        null,
        {
          email: 'newuser@test.com',
          name: 'New User',
          role: 'viewer',
          password: 'SecurePass123!',
        },
        adminContext,
      );

      expect(result.email).toBe('newuser@test.com');
      expect(result.name).toBe('New User');
      expect(result.role).toBe('viewer');
    });

    it('throws when user already exists', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      await expect(
        resolvers.Mutation.createLocalUser(
          null,
          {
            email: 'existing@test.com',
            name: 'Existing',
            role: 'viewer',
            password: 'Pass123!',
          },
          adminContext,
        ),
      ).rejects.toThrow('User with this email already exists');
    });

    it('throws when role is invalid', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.createLocalUser(
          null,
          {
            email: 'new@test.com',
            name: 'New',
            role: 'superadmin',
            password: 'Pass123!',
          },
          adminContext,
        ),
      ).rejects.toThrow('Invalid role');
    });

    it('throws when not admin', async () => {
      await expect(
        resolvers.Mutation.createLocalUser(
          null,
          {
            email: 'new@test.com',
            name: 'New',
            role: 'viewer',
            password: 'Pass123!',
          },
          editorContext,
        ),
      ).rejects.toThrow('Admin access required');
    });

    it('throws when not authenticated', async () => {
      await expect(
        resolvers.Mutation.createLocalUser(
          null,
          {
            email: 'new@test.com',
            name: 'New',
            role: 'viewer',
            password: 'Pass123!',
          },
          {},
        ),
      ).rejects.toThrow('Authentication required');
    });

    it('creates user with requirePasswordChange flag', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'new-id',
            email: 'temp@test.com',
            name: 'Temp User',
            role: 'viewer',
            created_at: new Date(),
          },
        ],
      });

      const result = await resolvers.Mutation.createLocalUser(
        null,
        {
          email: 'temp@test.com',
          name: 'Temp User',
          role: 'viewer',
          password: 'TempPass!',
          requirePasswordChange: true,
        },
        adminContext,
      );

      expect(result.email).toBe('temp@test.com');
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('require_password_change'),
        expect.arrayContaining([true]),
      );
    });
  });

  // ============================================
  // MUTATION.CREATEINVITATION TESTS
  // ============================================
  describe('Mutation.createInvitation', () => {
    it('creates an invitation', async () => {
      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };

      const result = await resolvers.Mutation.createInvitation(
        null,
        { email: 'new@test.com', role: 'editor' },
        adminContext,
      );

      expect(result).toEqual({ id: 'inv-1', token: 'abc123' });
    });
  });

  // ============================================
  // MUTATION.DELETEINVITATION TESTS
  // ============================================
  describe('Mutation.deleteInvitation', () => {
    it('deletes an invitation', async () => {
      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };

      const result = await resolvers.Mutation.deleteInvitation(
        null,
        { id: 'inv-1' },
        adminContext,
      );

      expect(result).toBe(true);
    });
  });

  // ============================================
  // MUTATION.UPDATEUSERROLE TESTS
  // ============================================
  describe('Mutation.updateUserRole', () => {
    it('updates user role', async () => {
      const { getUsers } = await import('@/lib/users');
      (getUsers as Mock).mockResolvedValueOnce([
        { id: 'user-1', role: 'editor' },
      ]);

      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };

      const result = await resolvers.Mutation.updateUserRole(
        null,
        { userId: 'user-1', role: 'editor' },
        adminContext,
      );

      expect(result).toEqual({ id: 'user-1', role: 'editor' });
    });

    it('prevents admin from demoting themselves', async () => {
      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };

      await expect(
        resolvers.Mutation.updateUserRole(
          null,
          { userId: 'admin-1', role: 'viewer' },
          adminContext,
        ),
      ).rejects.toThrow('Cannot demote yourself');
    });
  });

  // ============================================
  // MUTATION.DELETEUSER TESTS
  // ============================================
  describe('Mutation.deleteUser', () => {
    it('deletes a user', async () => {
      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };

      const result = await resolvers.Mutation.deleteUser(
        null,
        { userId: 'user-1' },
        adminContext,
      );

      expect(result).toBe(true);
    });

    it('prevents admin from deleting themselves', async () => {
      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };

      await expect(
        resolvers.Mutation.deleteUser(
          null,
          { userId: 'admin-1' },
          adminContext,
        ),
      ).rejects.toThrow('Cannot delete yourself');
    });
  });

  // ============================================
  // USER TYPE RESOLVER TESTS
  // ============================================
  describe('User type resolvers', () => {
    const mockLoaders = {
      personLoader: {
        load: vi.fn(),
      },
    };

    it('formats created_at as ISO string', () => {
      const result = resolvers.User.created_at({
        created_at: new Date('2024-01-15T10:30:00Z'),
      });
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('returns null for null created_at', () => {
      const result = resolvers.User.created_at({ created_at: null });
      expect(result).toBeNull();
    });

    it('formats last_login as ISO string', () => {
      const result = resolvers.User.last_login({
        last_login: '2024-01-15T10:30:00Z',
      });
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('formats last_accessed as ISO string', () => {
      const result = resolvers.User.last_accessed({
        last_accessed: new Date('2024-01-15T10:30:00Z'),
      });
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('returns linked_person via loader', async () => {
      const mockPerson = { id: 'person-1', name_full: 'Test Person' };
      mockLoaders.personLoader.load.mockResolvedValueOnce(mockPerson);

      const result = await resolvers.User.linked_person(
        { person_id: 'person-1' },
        null,
        { loaders: mockLoaders },
      );

      expect(result).toEqual(mockPerson);
    });

    it('returns null for linked_person when no person_id', async () => {
      const result = await resolvers.User.linked_person(
        { person_id: null },
        null,
        { loaders: mockLoaders },
      );

      expect(result).toBeNull();
    });
  });

  // ============================================
  // INVITATION TYPE RESOLVER TESTS
  // ============================================
  describe('Invitation type resolvers', () => {
    it('formats created_at as ISO string', () => {
      const result = resolvers.Invitation.created_at({
        created_at: new Date('2024-01-15T10:30:00Z'),
      });
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('formats expires_at as ISO string', () => {
      const result = resolvers.Invitation.expires_at({
        expires_at: '2024-01-20T10:30:00Z',
      });
      expect(result).toBe('2024-01-20T10:30:00.000Z');
    });

    it('formats accepted_at as ISO string', () => {
      const result = resolvers.Invitation.accepted_at({
        accepted_at: new Date('2024-01-16T10:30:00Z'),
      });
      expect(result).toBe('2024-01-16T10:30:00.000Z');
    });

    it('returns null for null dates', () => {
      expect(resolvers.Invitation.created_at({ created_at: null })).toBeNull();
      expect(resolvers.Invitation.expires_at({ expires_at: null })).toBeNull();
      expect(
        resolvers.Invitation.accepted_at({ accepted_at: null }),
      ).toBeNull();
    });
  });
});
