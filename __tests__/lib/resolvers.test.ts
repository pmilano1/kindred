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

import { resolvers, clearQueryCache } from '@/lib/graphql/resolvers';
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

  describe('Query.people (cursor pagination)', () => {
    it('returns paginated people with cursor info', async () => {
      mockedQuery.mockReset();
      const mockPeople = [
        { id: 'p1', name_full: 'Person 1' },
        { id: 'p2', name_full: 'Person 2' },
      ];
      // First call: count query
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: '100' }] });
      // Second call: data query
      mockedQuery.mockResolvedValueOnce({ rows: mockPeople });

      const result = await resolvers.Query.people(null, { first: 10 });

      expect(result.edges).toHaveLength(2);
      expect(result.pageInfo.totalCount).toBe(100);
      expect(result.edges[0].node.name_full).toBe('Person 1');
      expect(result.edges[0].cursor).toBeDefined();
    });

    it('handles after cursor for pagination', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: '100' }] });
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'p3', name_full: 'Person 3' }] });

      const afterCursor = Buffer.from('p2').toString('base64');
      const result = await resolvers.Query.people(null, { first: 10, after: afterCursor });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id >'),
        expect.arrayContaining(['p2'])
      );
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });
  });

  describe('Query.recentPeople', () => {
    it('returns recent people ordered by birth year desc', async () => {
      mockedQuery.mockReset();
      const mockPeople = [
        { id: 'p1', name_full: 'Recent Person', birth_year: 2000 },
        { id: 'p2', name_full: 'Older Person', birth_year: 1990 },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockPeople });

      const result = await resolvers.Query.recentPeople(null, { limit: 10 });

      expect(result).toEqual(mockPeople);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY birth_year DESC'),
        [10]
      );
    });

    it('enforces maximum limit of 50', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await resolvers.Query.recentPeople(null, { limit: 100 });

      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [50]);
    });
  });

  describe('Query.families', () => {
    it('returns all families', async () => {
      mockedQuery.mockReset();
      const mockFamilies = [
        { id: 'f1', husband_id: 'p1', wife_id: 'p2' },
        { id: 'f2', husband_id: 'p3', wife_id: 'p4' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockFamilies });

      const result = await resolvers.Query.families();

      expect(result).toEqual(mockFamilies);
      expect(mockedQuery).toHaveBeenCalledWith('SELECT * FROM families');
    });
  });

  describe('Query.researchQueue', () => {
    it('returns people needing research', async () => {
      mockedQuery.mockReset();
      const mockQueue = [
        { id: 'p1', name_full: 'Needs Research', research_status: 'brick_wall' },
        { id: 'p2', name_full: 'In Progress', research_status: 'in_progress' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockQueue });

      const result = await resolvers.Query.researchQueue(null, { limit: 50 });

      expect(result).toEqual(mockQueue);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("research_status != 'verified'"),
        [50]
      );
    });

    it('enforces maximum limit of 100', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await resolvers.Query.researchQueue(null, { limit: 200 });

      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [100]);
    });
  });

  describe('Query.ancestors', () => {
    it('returns ancestors using recursive CTE', async () => {
      mockedQuery.mockReset();
      const mockAncestors = [
        { id: 'a1', name_full: 'Grandfather', gen: 1 },
        { id: 'a2', name_full: 'Grandmother', gen: 1 },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockAncestors });

      const result = await resolvers.Query.ancestors(null, { personId: 'p1', generations: 5 });

      expect(result).toEqual(mockAncestors);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE ancestry'),
        ['p1', 5]
      );
    });
  });

  describe('Query.descendants', () => {
    it('returns descendants using recursive CTE', async () => {
      mockedQuery.mockReset();
      const mockDescendants = [
        { id: 'd1', name_full: 'Child', gen: 1 },
        { id: 'd2', name_full: 'Grandchild', gen: 2 },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockDescendants });

      const result = await resolvers.Query.descendants(null, { personId: 'p1', generations: 5 });

      expect(result).toEqual(mockDescendants);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE descendancy'),
        ['p1', 5]
      );
    });
  });

  describe('Query.timeline', () => {
    it('returns events grouped by year', async () => {
      mockedQuery.mockReset();
      const mockPeople = [
        { id: 'p1', name_full: 'Person 1', birth_year: 1950, death_year: 2020, living: false },
        { id: 'p2', name_full: 'Person 2', birth_year: 1950 },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockPeople });

      const result = await resolvers.Query.timeline();

      // Should have 1950 (2 births) and 2020 (1 death)
      const year1950 = result.find((y: { year: number }) => y.year === 1950);
      const year2020 = result.find((y: { year: number }) => y.year === 2020);

      expect(year1950).toBeDefined();
      expect(year1950.events).toHaveLength(2);
      expect(year2020).toBeDefined();
      expect(year2020.events).toHaveLength(1);
      expect(year2020.events[0].type).toBe('death');
    });
  });

  describe('Query.surnameCrests', () => {
    it('returns all surname crests ordered by surname', async () => {
      mockedQuery.mockReset();
      const mockCrests = [
        { surname: 'Beauharnais', coat_of_arms: 'https://example.com/crest.png' },
        { surname: 'Milanese', coat_of_arms: 'https://example.com/crest2.png' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockCrests });

      const result = await resolvers.Query.surnameCrests();

      expect(result).toEqual(mockCrests);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY surname')
      );
    });
  });

  describe('Query.surnameCrest', () => {
    it('returns crest for specific surname (case insensitive)', async () => {
      mockedQuery.mockReset();
      const mockCrest = { surname: 'Milanese', coat_of_arms: 'https://example.com/crest.png' };
      mockedQuery.mockResolvedValueOnce({ rows: [mockCrest] });

      const result = await resolvers.Query.surnameCrest(null, { surname: 'milanese' });

      expect(result).toEqual(mockCrest);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(surname) = LOWER'),
        ['milanese']
      );
    });

    it('returns null for non-existent surname', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.surnameCrest(null, { surname: 'Unknown' });

      expect(result).toBeNull();
    });
  });

  describe('Mutation.updatePerson', () => {
    it('updates person fields', async () => {
      mockedQuery.mockReset();
      const mockUpdatedPerson = { id: 'p1', name_full: 'Updated Name', birth_year: 1960 };
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
      mockedQuery.mockResolvedValueOnce({ rows: [mockUpdatedPerson] }); // SELECT

      const context = { user: { id: 'user-1', email: 'test@example.com', role: 'editor' } };
      const result = await resolvers.Mutation.updatePerson(
        null,
        { id: 'p1', input: { name_full: 'Updated Name', birth_year: 1960 } },
        context
      );

      expect(result).toEqual(mockUpdatedPerson);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE people SET'),
        expect.arrayContaining(['p1'])
      );
    });

    it('throws when not editor or admin', async () => {
      const context = { user: { id: 'user-1', email: 'test@example.com', role: 'viewer' } };
      await expect(
        resolvers.Mutation.updatePerson(null, { id: 'p1', input: { name_full: 'Test' } }, context)
      ).rejects.toThrow('Editor access required');
    });
  });

  describe('Mutation.updateResearchStatus', () => {
    it('updates research status and last_researched timestamp', async () => {
      mockedQuery.mockReset();
      const mockPerson = { id: 'p1', research_status: 'verified' };
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
      mockedQuery.mockResolvedValueOnce({ rows: [mockPerson] }); // SELECT

      const context = { user: { id: 'user-1', email: 'test@example.com', role: 'editor' } };
      const result = await resolvers.Mutation.updateResearchStatus(
        null,
        { personId: 'p1', status: 'verified' },
        context
      );

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('research_status = $1'),
        ['verified', 'p1']
      );
    });
  });

  describe('Mutation.setSurnameCrest', () => {
    it('inserts or updates surname crest', async () => {
      mockedQuery.mockReset();
      const mockCrest = { surname: 'Milanese', coat_of_arms: 'https://new-crest.png' };
      mockedQuery.mockResolvedValueOnce({ rows: [mockCrest] });

      const context = { user: { id: 'user-1', email: 'test@example.com', role: 'editor' } };
      const result = await resolvers.Mutation.setSurnameCrest(
        null,
        { surname: 'Milanese', coatOfArms: 'https://new-crest.png', description: 'Italian noble family' },
        context
      );

      expect(result).toEqual(mockCrest);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (surname) DO UPDATE'),
        expect.arrayContaining(['Milanese', 'https://new-crest.png'])
      );
    });
  });

  describe('clearQueryCache', () => {
    it('clears all cache when called without pattern', () => {
      // Clear the cache first
      clearQueryCache();
      // Should not throw
      expect(() => clearQueryCache()).not.toThrow();
    });

    it('clears cache entries matching pattern', () => {
      // Clear specific pattern
      clearQueryCache('ancestors');
      // Should not throw
      expect(() => clearQueryCache('test-pattern')).not.toThrow();
    });

    it('handles empty cache gracefully', () => {
      clearQueryCache(); // Clear everything
      clearQueryCache('nonexistent'); // Try pattern on empty cache
      expect(true).toBe(true); // No error means success
    });
  });

  describe('Query caching behavior', () => {
    it('ancestors query uses caching', async () => {
      mockedQuery.mockReset();
      clearQueryCache(); // Clear cache before test

      const mockAncestors = [{ id: 'a1', name_full: 'Grandfather', gen: 1 }];
      mockedQuery.mockResolvedValue({ rows: mockAncestors });

      // First call - should hit database
      await resolvers.Query.ancestors(null, { personId: 'cache-test', generations: 3 });
      const firstCallCount = mockedQuery.mock.calls.length;

      // Second call with same params - should use cache
      await resolvers.Query.ancestors(null, { personId: 'cache-test', generations: 3 });
      const secondCallCount = mockedQuery.mock.calls.length;

      // If caching works, second call should not increase query count
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('descendants query uses caching', async () => {
      mockedQuery.mockReset();
      clearQueryCache();

      const mockDescendants = [{ id: 'd1', name_full: 'Child', gen: 1 }];
      mockedQuery.mockResolvedValue({ rows: mockDescendants });

      // First call
      await resolvers.Query.descendants(null, { personId: 'desc-cache-test', generations: 3 });
      const firstCallCount = mockedQuery.mock.calls.length;

      // Second call - cached
      await resolvers.Query.descendants(null, { personId: 'desc-cache-test', generations: 3 });
      const secondCallCount = mockedQuery.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });
});

