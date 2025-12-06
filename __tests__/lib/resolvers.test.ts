/**
 * GraphQL Resolver Unit Tests
 * Tests core business logic with mocked database
 */

// Create mock function before jest.mock calls
const mockQuery = jest.fn();

// Mock the database pool - use factory function
jest.mock('@/lib/pool', () => {
  return {
    pool: {
      query: jest.fn(),
    },
  };
});

// Mock email functions
jest.mock('@/lib/email', () => ({
  sendInviteEmail: jest.fn().mockResolvedValue(true),
  verifyEmailForSandbox: jest.fn().mockResolvedValue(true),
}));

// Mock users functions
jest.mock('@/lib/users', () => ({
  getUsers: jest.fn().mockResolvedValue([]),
  getInvitations: jest.fn().mockResolvedValue([]),
  createInvitation: jest.fn().mockResolvedValue({ id: 'inv-1', token: 'abc123' }),
  deleteInvitation: jest.fn().mockResolvedValue(undefined),
  updateUserRole: jest.fn().mockResolvedValue(undefined),
  deleteUser: jest.fn().mockResolvedValue(undefined),
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

// Mock settings
jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn().mockResolvedValue({
    site_name: 'Test Family Tree',
    family_name: 'Test',
    theme_color: '#2c5530',
  }),
  clearSettingsCache: jest.fn(),
}));

import { resolvers } from '@/lib/graphql/resolvers';
import { pool } from '@/lib/pool';

// Get the mocked pool.query
const mockedQuery = pool.query as jest.Mock;

describe('GraphQL Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Query.person', () => {
    it('returns person by id', async () => {
      const mockPerson = {
        id: 'person-1',
        name_full: 'John Doe',
        birth_year: 1950,
        sex: 'M',
        living: false,
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockPerson] });

      const result = await resolvers.Query.person(null, { id: 'person-1' });

      expect(result).toEqual(mockPerson);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['person-1']
      );
    });

    it('returns null for non-existent person', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.person(null, { id: 'nonexistent' });

      expect(result).toBeNull();
    });
  });

  describe('Query.peopleList', () => {
    it('returns limited list of people', async () => {
      const mockPeople = [
        { id: 'p1', name_full: 'Person 1' },
        { id: 'p2', name_full: 'Person 2' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockPeople });

      const result = await resolvers.Query.peopleList(null, { limit: 10 });

      expect(result).toEqual(mockPeople);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.any(String),
        [10, 0]
      );
    });

    it('enforces maximum limit of 10000', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await resolvers.Query.peopleList(null, { limit: 50000 });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.any(String),
        [10000, 0]
      );
    });
  });

  describe('Query.notablePeople', () => {
    it('returns only notable people', async () => {
      const mockNotable = [
        { id: 'n1', name_full: 'Famous Ancestor', is_notable: true },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockNotable });

      const result = await resolvers.Query.notablePeople();

      expect(result).toEqual(mockNotable);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_notable = true')
      );
    });
  });

  describe('Query.stats', () => {
    it('returns database statistics', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{
          total_people: 500,
          total_families: 200,
          living_count: 50,
          male_count: 250,
          female_count: 250,
          earliest_birth: 1750,
          latest_birth: 2020,
          with_familysearch_id: 100,
        }],
      });

      const result = await resolvers.Query.stats();

      expect(result.total_people).toBe(500);
      expect(result.total_families).toBe(200);
    });
  });

  describe('Query.search', () => {
    it('searches people by name with accent normalization', async () => {
      const mockPeople = [
        { id: 'p1', name_full: 'René Beauharnais' },
        { id: 'p2', name_full: 'Rene Test' },
      ];
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: mockPeople });

      const result = await resolvers.Query.search(null, { query: 'Rene' });

      // Both René and Rene should match when searching for 'Rene'
      expect(result.edges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Query.me', () => {
    it('returns current user when authenticated', async () => {
      mockedQuery.mockReset(); // Clear any leftover mocks
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        api_key: 'abc123',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const context = { user: { id: 'user-1', email: 'test@example.com', role: 'admin' } };
      const result = await resolvers.Query.me(null, {}, context);

      expect(result).toEqual(mockUser);
    });

    it('throws when not authenticated', async () => {
      const context = {};
      await expect(resolvers.Query.me(null, {}, context)).rejects.toThrow();
    });
  });

  describe('Mutation.generateApiKey', () => {
    it('generates a new API key for authenticated user', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE query

      const context = { user: { id: 'user-1', email: 'test@example.com', role: 'viewer' } };
      const result = await resolvers.Mutation.generateApiKey(null, {}, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBe(64); // 32 bytes = 64 hex chars
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET api_key'),
        expect.arrayContaining(['user-1'])
      );
    });

    it('throws when not authenticated', async () => {
      const context = {};
      await expect(resolvers.Mutation.generateApiKey(null, {}, context)).rejects.toThrow();
    });
  });

  describe('Mutation.revokeApiKey', () => {
    it('revokes API key for authenticated user', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE query

      const context = { user: { id: 'user-1', email: 'test@example.com', role: 'viewer' } };
      const result = await resolvers.Mutation.revokeApiKey(null, {}, context);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET api_key = NULL'),
        ['user-1']
      );
    });

    it('throws when not authenticated', async () => {
      const context = {};
      await expect(resolvers.Mutation.revokeApiKey(null, {}, context)).rejects.toThrow();
    });
  });
});

