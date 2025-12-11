/**
 * GraphQL Resolver Tests - Admin
 * Tests: Admin queries, user management, invitations, settings
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

describe('Admin Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const adminContext = {
    user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
  };

  const viewerContext = {
    user: { id: 'user-1', email: 'user@test.com', role: 'viewer' },
  };

  // ============================================
  // QUERY.USERS TESTS
  // ============================================
  describe('Query.users', () => {
    it('returns users list for admin', async () => {
      const result = await resolvers.Query.users(null, {}, adminContext);
      expect(result).toEqual([]);
    });

    it('throws for non-admin', async () => {
      await expect(
        resolvers.Query.users(null, {}, viewerContext),
      ).rejects.toThrow('Admin access required');
    });
  });

  // ============================================
  // QUERY.INVITATIONS TESTS
  // ============================================
  describe('Query.invitations', () => {
    it('returns invitations list for admin', async () => {
      const result = await resolvers.Query.invitations(null, {}, adminContext);
      expect(result).toEqual([]);
    });

    it('throws for non-admin', async () => {
      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };
      await expect(
        resolvers.Query.invitations(null, {}, editorContext),
      ).rejects.toThrow('Admin access required');
    });
  });

  // ============================================
  // QUERY.SITESETTINGS TESTS
  // ============================================
  describe('Query.siteSettings', () => {
    it('returns site settings', async () => {
      const result = await resolvers.Query.siteSettings();
      expect(result).toEqual({
        site_name: 'Test Family Tree',
        family_name: 'Test',
        theme_color: '#2c5530',
      });
    });
  });

  // ============================================
  // QUERY.SETTINGS TESTS
  // ============================================
  describe('Query.settings', () => {
    it('returns all settings for admin', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { key: 'site_name', value: 'Test Site' },
          { key: 'theme_color', value: '#2c5530' },
        ],
      });

      const result = await resolvers.Query.settings(null, {}, adminContext);

      expect(result).toEqual([
        { key: 'site_name', value: 'Test Site' },
        { key: 'theme_color', value: '#2c5530' },
      ]);
    });
  });

  // ============================================
  // DASHBOARD RESOLVER TESTS
  // ============================================
  describe('Query.dashboardStats', () => {
    it('returns detailed dashboard statistics', async () => {
      mockedQuery.mockReset();
      const mockStats = {
        total_people: '200',
        total_families: '80',
        total_sources: '500',
        total_media: '150',
        living_count: '60',
        incomplete_count: '40',
        average_completeness: 70,
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await resolvers.Query.dashboardStats(null, {});

      expect(result).toEqual(mockStats);
    });
  });

  describe('Query.recentActivity', () => {
    it('returns recent audit log activity', async () => {
      mockedQuery.mockReset();
      const mockActivity = [
        {
          id: '1',
          action: 'update_person',
          user_name: 'Test User',
          created_at: '2024-01-01',
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockActivity });

      const result = await resolvers.Query.recentActivity(null, { limit: 10 });

      expect(result).toEqual(mockActivity);
      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [10]);
    });

    it('enforces maximum limit of 50', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await resolvers.Query.recentActivity(null, { limit: 100 });

      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [50]);
    });
  });

  // ============================================
  // EMAIL RESOLVER TESTS
  // ============================================
  describe('Query.emailLogs', () => {
    it('returns email logs for admin', async () => {
      mockedQuery.mockReset();
      const mockLogs = [
        { id: '1', email_type: 'invite', recipient: 'user@test.com' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockLogs });

      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      const result = await resolvers.Query.emailLogs(
        null,
        { limit: 10, offset: 0 },
        adminContext,
      );

      expect(result).toEqual(mockLogs);
    });
  });

  describe('Query.emailStats', () => {
    it('returns email statistics', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ total_sent: '10', successful: '8', failed: '2' }],
      });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ email_type: 'invite', count: '5' }],
      });

      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      const result = await resolvers.Query.emailStats(null, {}, adminContext);

      expect(result).toEqual({
        total_sent: 10,
        successful: 8,
        failed: 2,
        by_type: [{ email_type: 'invite', count: '5' }],
      });
    });
  });

  describe('Query.myEmailPreferences', () => {
    it('returns email preferences for current user', async () => {
      mockedQuery.mockReset();
      const mockPrefs = {
        user_id: 'user-1',
        research_updates: true,
        weekly_digest: false,
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockPrefs] });

      const context = {
        user: { id: 'user-1', email: 'user@test.com', role: 'viewer' },
      };
      const result = await resolvers.Query.myEmailPreferences(
        null,
        {},
        context,
      );

      expect(result).toEqual(mockPrefs);
    });

    it('returns null if no preferences exist', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const context = {
        user: { id: 'user-1', email: 'user@test.com', role: 'viewer' },
      };
      const result = await resolvers.Query.myEmailPreferences(
        null,
        {},
        context,
      );

      expect(result).toBeNull();
    });
  });

  // ============================================
  // CLIENT ERROR RESOLVER TESTS
  // ============================================
  describe('Query.clientErrors', () => {
    it('returns client errors for admin', async () => {
      mockedQuery.mockReset();
      const mockErrors = [
        { id: '1', error_message: 'Test error', url: '/test' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockErrors });

      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      const result = await resolvers.Query.clientErrors(
        null,
        { limit: 10, offset: 0 },
        adminContext,
      );

      expect(result).toEqual(mockErrors);
    });
  });

  describe('Query.clientErrorStats', () => {
    it('returns client error statistics', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            total: '100',
            last_24_hours: '10',
            last_7_days: '50',
            unique_errors: '5',
          },
        ],
      });

      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      const result = await resolvers.Query.clientErrorStats(
        null,
        {},
        adminContext,
      );

      expect(result).toEqual({
        total: 100,
        last24Hours: 10,
        last7Days: 50,
        uniqueErrors: 5,
      });
    });
  });
});
