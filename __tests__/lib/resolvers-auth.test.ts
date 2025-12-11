/**
 * GraphQL Resolver Tests - Authentication & Authorization
 * Tests: Query.me, API key mutations, password mutations, email preferences
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

describe('Auth Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // QUERY.ME TESTS
  // ============================================
  describe('Query.me', () => {
    it('returns current user when authenticated', async () => {
      mockedQuery.mockReset();
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        api_key: 'abc123',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const context = {
        user: { id: 'user-1', email: 'test@example.com', role: 'admin' },
      };
      const result = await resolvers.Query.me(null, {}, context);

      expect(result).toEqual(mockUser);
    });

    it('throws when not authenticated', async () => {
      const context = {};
      await expect(resolvers.Query.me(null, {}, context)).rejects.toThrow();
    });
  });

  // ============================================
  // MUTATION.GENERATEAPIKEY TESTS
  // ============================================
  describe('Mutation.generateApiKey', () => {
    it('generates a new API key for authenticated user', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const context = {
        user: { id: 'user-1', email: 'test@example.com', role: 'viewer' },
      };
      const result = await resolvers.Mutation.generateApiKey(null, {}, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBe(64);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET api_key'),
        expect.arrayContaining(['user-1']),
      );
    });

    it('throws when not authenticated', async () => {
      const context = {};
      await expect(
        resolvers.Mutation.generateApiKey(null, {}, context),
      ).rejects.toThrow();
    });
  });

  describe('Mutation.revokeApiKey', () => {
    it('revokes API key for authenticated user', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const context = {
        user: { id: 'user-1', email: 'test@example.com', role: 'viewer' },
      };
      const result = await resolvers.Mutation.revokeApiKey(null, {}, context);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET api_key = NULL'),
        ['user-1'],
      );
    });

    it('throws when not authenticated', async () => {
      const context = {};
      await expect(
        resolvers.Mutation.revokeApiKey(null, {}, context),
      ).rejects.toThrow();
    });
  });

  describe('Mutation.registerWithInvitation', () => {
    it('returns error for invalid invitation token', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.registerWithInvitation(null, {
        token: 'invalid-token',
        password: 'Password123!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired invitation');
    });

    it('returns error if user already exists', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'inv-1', email: 'test@example.com', role: 'viewer' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });

      const result = await resolvers.Mutation.registerWithInvitation(null, {
        token: 'valid-token',
        password: 'Password123!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('User already exists');
    });

    it('creates user successfully with valid invitation', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'inv-1', email: 'newuser@example.com', role: 'viewer' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.registerWithInvitation(null, {
        token: 'valid-token',
        password: 'Password123!',
        name: 'New User',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Account created successfully');
      expect(result.userId).toBeDefined();
    });
  });

  describe('Mutation.requestPasswordReset', () => {
    it('returns true even if user does not exist (no enumeration)', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.requestPasswordReset(null, {
        email: 'nonexistent@example.com',
      });

      expect(result).toBe(true);
    });

    it('creates reset token for valid local user', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1' }] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.requestPasswordReset(null, {
        email: 'user@example.com',
      });

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('Mutation.resetPassword', () => {
    it('returns error for invalid/expired token', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.resetPassword(null, {
        token: 'invalid-token',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired reset token');
    });

    it('resets password successfully with valid token', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.resetPassword(null, {
        token: 'valid-token',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset successfully');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('Mutation.changePassword', () => {
    const mockContext = {
      user: { id: 'user-1', email: 'user@test.com', role: 'admin' },
    };

    it('throws error for non-local auth users', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.changePassword(
          null,
          { currentPassword: 'old', newPassword: 'new' },
          mockContext,
        ),
      ).rejects.toThrow('Password change not available for this account');
    });

    it('throws error for incorrect current password', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ password_hash: '$2a$12$invalidhash' }],
      });

      await expect(
        resolvers.Mutation.changePassword(
          null,
          { currentPassword: 'wrongpassword', newPassword: 'NewPassword123!' },
          mockContext,
        ),
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('Mutation.updateEmailPreferences', () => {
    const mockContext = {
      user: { id: 'user-1', email: 'user@test.com', role: 'admin' },
    };

    it('updates email preferences for authenticated user', async () => {
      const mockPrefs = {
        user_id: 'user-1',
        research_updates: true,
        tree_changes: false,
        weekly_digest: true,
        birthday_reminders: false,
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockPrefs] });

      const result = await resolvers.Mutation.updateEmailPreferences(
        null,
        { input: { research_updates: true, weekly_digest: true } },
        mockContext,
      );

      expect(result.user_id).toBe('user-1');
      expect(result.research_updates).toBe(true);
      expect(result.weekly_digest).toBe(true);
    });
  });
});
