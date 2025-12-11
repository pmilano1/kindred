/**
 * GraphQL Resolver Unit Tests
 * Tests core business logic with mocked database
 */
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// vi.hoisted ensures mocks are available before vi.mock hoisting
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

// Mock the database pool - use factory function
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

import { clearQueryCache, resolvers } from '@/lib/graphql/resolvers';

// Use the mock we created above
const mockedQuery = mockQuery as Mock;

describe('GraphQL Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        ['person-1'],
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
      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [10, 0]);
    });

    it('enforces maximum limit of 10000', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await resolvers.Query.peopleList(null, { limit: 50000 });

      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [10000, 0]);
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
        expect.stringContaining('is_notable = true'),
      );
    });
  });

  describe('Query.stats', () => {
    it('returns database statistics', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            total_people: 500,
            total_families: 200,
            living_count: 50,
            male_count: 250,
            female_count: 250,
            earliest_birth: 1750,
            latest_birth: 2020,
            with_familysearch_id: 100,
          },
        ],
      });

      const result = await resolvers.Query.stats();

      expect(result.total_people).toBe(500);
      expect(result.total_families).toBe(200);
    });
  });

  describe('Query.search', () => {
    it('searches people using PostgreSQL full-text search', async () => {
      const mockPeople = [
        { id: 'p1', name_full: 'René Beauharnais', relevance_score: 1.5 },
        { id: 'p2', name_full: 'Rene Test', relevance_score: 1.2 },
      ];
      // New search uses a single query with full-text search
      mockedQuery.mockResolvedValueOnce({ rows: mockPeople });

      const result = await resolvers.Query.search(null, { query: 'Rene' });

      // Results should be returned with pagination info
      expect(result.edges.length).toBe(2);
      expect(result.edges[0].node.id).toBe('p1');
      expect(result.edges[1].node.id).toBe('p2');
      expect(result.pageInfo.totalCount).toBe(2);
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

  describe('Mutation.generateApiKey', () => {
    it('generates a new API key for authenticated user', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE query

      const context = {
        user: { id: 'user-1', email: 'test@example.com', role: 'viewer' },
      };
      const result = await resolvers.Mutation.generateApiKey(null, {}, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBe(64); // 32 bytes = 64 hex chars
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
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE query

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
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p3', name_full: 'Person 3' }],
      });

      const afterCursor = Buffer.from('p2').toString('base64');
      const result = await resolvers.Query.people(null, {
        first: 10,
        after: afterCursor,
      });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id >'),
        expect.arrayContaining(['p2']),
      );
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('handles before cursor for backward pagination', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: '100' }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', name_full: 'Person 1' }],
      });

      const beforeCursor = Buffer.from('p2').toString('base64');
      const result = await resolvers.Query.people(null, {
        last: 10,
        before: beforeCursor,
      });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id <'),
        expect.arrayContaining(['p2']),
      );
      expect(result.edges).toBeDefined();
    });

    it('handles default pagination without cursors', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: '50' }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', name_full: 'Person 1' }],
      });

      const result = await resolvers.Query.people(null, {});

      expect(result.pageInfo.hasNextPage).toBeDefined();
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });
  });

  describe('Query.users (admin)', () => {
    it('returns users list for admin', async () => {
      const context = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      const result = await resolvers.Query.users(null, {}, context);
      expect(result).toEqual([]);
    });

    it('throws for non-admin', async () => {
      const context = {
        user: { id: 'user-1', email: 'user@test.com', role: 'viewer' },
      };
      await expect(resolvers.Query.users(null, {}, context)).rejects.toThrow(
        'Admin access required',
      );
    });
  });

  describe('Query.invitations (admin)', () => {
    it('returns invitations list for admin', async () => {
      const context = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      const result = await resolvers.Query.invitations(null, {}, context);
      expect(result).toEqual([]);
    });

    it('throws for non-admin', async () => {
      const context = {
        user: { id: 'user-1', email: 'user@test.com', role: 'editor' },
      };
      await expect(
        resolvers.Query.invitations(null, {}, context),
      ).rejects.toThrow('Admin access required');
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
        [10],
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
    it('returns cursor-paginated people needing research with automatic scoring', async () => {
      mockedQuery.mockReset();
      const mockQueue = [
        {
          id: 'p1',
          name_full: 'Needs Research',
          research_status: 'brick_wall',
          auto_score: 70,
        },
        {
          id: 'p2',
          name_full: 'In Progress',
          research_status: 'in_progress',
          auto_score: 30,
        },
      ];
      // First call: count query, Second call: data query
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: mockQueue });

      const result = await resolvers.Query.researchQueue(null, { first: 50 });

      // Returns PersonConnection structure
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('pageInfo');
      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].node.id).toBe('p1');
      expect(result.edges[0].cursor).toBeDefined();
      expect(result.pageInfo.totalCount).toBe(100);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('enforces maximum limit of 100', async () => {
      mockedQuery.mockReset();
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await resolvers.Query.researchQueue(null, { first: 200 });

      // Limit should be capped at 101 (100 + 1 for hasNextPage check)
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.arrayContaining([101]),
      );
    });

    it('uses configurable weights from settings', async () => {
      mockedQuery.mockReset();
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await resolvers.Query.researchQueue(null, { first: 50 });

      // Data query should include scoring with weight parameters
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('auto_score'),
        expect.any(Array),
      );
      // Should have 7 params: limit + 6 weights
      const callArgs = mockedQuery.mock.calls[1][1];
      expect(callArgs.length).toBe(7);
    });

    it('supports cursor-based pagination with after parameter', async () => {
      mockedQuery.mockReset();
      const mockQueue = [
        { id: 'p3', name_full: 'Third Person', auto_score: 50 },
      ];
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: mockQueue });

      // Cursor format: base64("score:id")
      const cursor = Buffer.from('70:p2').toString('base64');
      const result = await resolvers.Query.researchQueue(null, {
        first: 10,
        after: cursor,
      });

      expect(result.edges).toHaveLength(1);
      expect(result.pageInfo.hasPreviousPage).toBe(true);
      // Query should include cursor condition
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('auto_score'),
        expect.arrayContaining([70, 'p2']), // decoded cursor values
      );
    });
  });

  describe('Query.ancestors', () => {
    it('returns nested pedigree tree structure', async () => {
      mockedQuery.mockReset();

      // Mock person query
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', name_full: 'Person 1', sex: 'M' }],
      });

      // Mock parents query (no parents)
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.ancestors(null, {
        personId: 'p1',
        generations: 3,
      });

      expect(result).toMatchObject({
        id: 'p1',
        person: { id: 'p1', name_full: 'Person 1' },
        generation: 0,
        hasMoreAncestors: false,
      });
    });
  });

  describe('Query.descendants', () => {
    it('returns nested descendant tree structure', async () => {
      mockedQuery.mockReset();

      // Mock person query
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', name_full: 'Person 1', sex: 'M' }],
      });

      // Mock families query (no families)
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.descendants(null, {
        personId: 'p1',
        generations: 3,
      });

      expect(result).toMatchObject({
        id: 'p1',
        person: { id: 'p1', name_full: 'Person 1' },
        generation: 0,
        children: [],
        hasMoreDescendants: false,
      });
    });
  });

  describe('Query.timeline', () => {
    it('returns events grouped by year', async () => {
      mockedQuery.mockReset();
      const mockPeople = [
        {
          id: 'p1',
          name_full: 'Person 1',
          birth_year: 1950,
          death_year: 2020,
          living: false,
        },
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
        {
          surname: 'Beauharnais',
          coat_of_arms: 'https://example.com/crest.png',
        },
        { surname: 'Milanese', coat_of_arms: 'https://example.com/crest2.png' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockCrests });

      const result = await resolvers.Query.surnameCrests();

      expect(result).toEqual(mockCrests);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY surname'),
      );
    });
  });

  describe('Query.surnameCrest', () => {
    it('returns crest for specific surname (case insensitive)', async () => {
      mockedQuery.mockReset();
      const mockCrest = {
        surname: 'Milanese',
        coat_of_arms: 'https://example.com/crest.png',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockCrest] });

      const result = await resolvers.Query.surnameCrest(null, {
        surname: 'milanese',
      });

      expect(result).toEqual(mockCrest);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(surname) = LOWER'),
        ['milanese'],
      );
    });

    it('returns null for non-existent surname', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.surnameCrest(null, {
        surname: 'Unknown',
      });

      expect(result).toBeNull();
    });
  });

  describe('Mutation.updatePerson', () => {
    it('updates person fields', async () => {
      mockedQuery.mockReset();
      const mockUpdatedPerson = {
        id: 'p1',
        name_full: 'Updated Name',
        birth_year: 1960,
      };
      // updatePerson calls getPerson twice (before and after update) + 1 UPDATE
      mockedQuery.mockResolvedValueOnce({ rows: [mockUpdatedPerson] }); // SELECT for audit log (getPerson)
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE people
      mockedQuery.mockResolvedValueOnce({ rows: [mockUpdatedPerson] }); // SELECT for return (getPerson)

      const context = {
        user: { id: 'user-1', email: 'test@example.com', role: 'editor' },
      };
      const result = await resolvers.Mutation.updatePerson(
        null,
        { id: 'p1', input: { name_full: 'Updated Name', birth_year: 1960 } },
        context,
      );

      expect(result).toEqual(mockUpdatedPerson);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE people SET'),
        expect.arrayContaining(['p1']),
      );
    });

    it('throws when not editor or admin', async () => {
      const context = {
        user: { id: 'user-1', email: 'test@example.com', role: 'viewer' },
      };
      await expect(
        resolvers.Mutation.updatePerson(
          null,
          { id: 'p1', input: { name_full: 'Test' } },
          context,
        ),
      ).rejects.toThrow('Editor access required');
    });
  });

  describe('Mutation.updateResearchStatus', () => {
    it('updates research status and last_researched timestamp', async () => {
      mockedQuery.mockReset();
      const mockPerson = { id: 'p1', research_status: 'verified' };
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
      mockedQuery.mockResolvedValueOnce({ rows: [mockPerson] }); // SELECT

      const context = {
        user: { id: 'user-1', email: 'test@example.com', role: 'editor' },
      };
      await resolvers.Mutation.updateResearchStatus(
        null,
        { personId: 'p1', status: 'verified' },
        context,
      );

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('research_status = $1'),
        ['verified', 'p1'],
      );
    });
  });

  describe('Mutation.setSurnameCrest', () => {
    it('inserts or updates surname crest', async () => {
      mockedQuery.mockReset();
      const mockCrest = {
        surname: 'Milanese',
        coat_of_arms: 'https://new-crest.png',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockCrest] });

      const context = {
        user: { id: 'user-1', email: 'test@example.com', role: 'editor' },
      };
      const result = await resolvers.Mutation.setSurnameCrest(
        null,
        {
          surname: 'Milanese',
          coatOfArms: 'https://new-crest.png',
          description: 'Italian noble family',
        },
        context,
      );

      expect(result).toEqual(mockCrest);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (surname) DO UPDATE'),
        expect.arrayContaining(['Milanese', 'https://new-crest.png']),
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
      await resolvers.Query.ancestors(null, {
        personId: 'cache-test',
        generations: 3,
      });
      const firstCallCount = mockedQuery.mock.calls.length;

      // Second call with same params - should use cache
      await resolvers.Query.ancestors(null, {
        personId: 'cache-test',
        generations: 3,
      });
      const secondCallCount = mockedQuery.mock.calls.length;

      // If caching works, second call should not increase query count
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('different parameters bypass cache', async () => {
      mockedQuery.mockReset();
      clearQueryCache();

      const mockAncestors = [{ id: 'a1', name_full: 'Grandfather', gen: 1 }];
      mockedQuery.mockResolvedValue({ rows: mockAncestors });

      await resolvers.Query.ancestors(null, {
        personId: 'person-a',
        generations: 3,
      });
      const firstCallCount = mockedQuery.mock.calls.length;

      // Different person - should hit database again
      await resolvers.Query.ancestors(null, {
        personId: 'person-b',
        generations: 3,
      });
      const secondCallCount = mockedQuery.mock.calls.length;

      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });

    it('descendants query uses caching', async () => {
      mockedQuery.mockReset();
      clearQueryCache();

      const mockDescendants = [{ id: 'd1', name_full: 'Child', gen: 1 }];
      mockedQuery.mockResolvedValue({ rows: mockDescendants });

      // First call
      await resolvers.Query.descendants(null, {
        personId: 'desc-cache-test',
        generations: 3,
      });
      const firstCallCount = mockedQuery.mock.calls.length;

      // Second call - cached
      await resolvers.Query.descendants(null, {
        personId: 'desc-cache-test',
        generations: 3,
      });
      const secondCallCount = mockedQuery.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('Mutation.registerWithInvitation', () => {
    it('returns error for invalid invitation token', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // No valid invitation

      const result = await resolvers.Mutation.registerWithInvitation(null, {
        token: 'invalid-token',
        password: 'Password123!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired invitation');
    });

    it('returns error if user already exists', async () => {
      // Valid invitation
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'inv-1', email: 'test@example.com', role: 'viewer' }],
      });
      // User already exists
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });

      const result = await resolvers.Mutation.registerWithInvitation(null, {
        token: 'valid-token',
        password: 'Password123!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('User already exists');
    });

    it('creates user successfully with valid invitation', async () => {
      // Valid invitation
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'inv-1', email: 'newuser@example.com', role: 'viewer' }],
      });
      // No existing user
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Create user
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Mark invitation as accepted
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
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // No user found

      const result = await resolvers.Mutation.requestPasswordReset(null, {
        email: 'nonexistent@example.com',
      });

      expect(result).toBe(true);
    });

    it('creates reset token for valid local user', async () => {
      // User exists
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1' }] });
      // Insert token
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
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // No valid token

      const result = await resolvers.Mutation.resetPassword(null, {
        token: 'invalid-token',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired reset token');
    });

    it('resets password successfully with valid token', async () => {
      // Valid token
      mockedQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] });
      // Update password
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Mark token used
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
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // No local auth user

      await expect(
        resolvers.Mutation.changePassword(
          null,
          { currentPassword: 'old', newPassword: 'new' },
          mockContext,
        ),
      ).rejects.toThrow('Password change not available for this account');
    });

    it('throws error for incorrect current password', async () => {
      // User with password hash (bcrypt hash of 'correctpassword')
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

  describe('Mutation.createLocalUser', () => {
    const adminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('creates a new local user when admin', async () => {
      mockedQuery.mockReset();
      // No existing user
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Insert user
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
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.any(Array),
      );
    });

    it('throws when user already exists', async () => {
      mockedQuery.mockReset();
      // Existing user found
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
      // No existing user
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
      // No existing user
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Insert user
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
      // Verify the INSERT was called with requirePasswordChange = true
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('require_password_change'),
        expect.arrayContaining([true]),
      );
    });
  });

  describe('Person.research_tip', () => {
    const mockContext = {
      loaders: {
        familiesAsChildLoader: {
          load: vi.fn(),
        },
        personLoader: {
          loadMany: vi.fn(),
        },
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns null for placeholder people', async () => {
      const person = {
        id: 'p1',
        is_placeholder: true,
        birth_year: null,
        birth_place: null,
        death_year: null,
        death_place: null,
        birth_date_accuracy: null,
        death_date_accuracy: null,
        source_count: 0,
        living: false,
      };

      const result = await resolvers.Person.research_tip(
        person,
        {},
        mockContext,
      );
      expect(result).toBeNull();
    });

    it('suggests identifying placeholder parent when present', async () => {
      const person = {
        id: 'p1',
        is_placeholder: false,
        birth_year: 1900,
        birth_place: 'New York',
        death_year: 1980,
        death_place: 'Boston',
        birth_date_accuracy: 'EXACT',
        death_date_accuracy: 'EXACT',
        source_count: 5,
        living: false,
      };

      mockContext.loaders.familiesAsChildLoader.load.mockResolvedValue([
        { id: 'f1', husband_id: 'father1', wife_id: 'mother1' },
      ]);
      mockContext.loaders.personLoader.loadMany.mockResolvedValue([
        { id: 'father1', is_placeholder: true, sex: 'M' },
        { id: 'mother1', is_placeholder: false, sex: 'F' },
      ]);

      const result = await resolvers.Person.research_tip(
        person,
        {},
        mockContext,
      );
      expect(result).toContain('Identify unknown father');
    });

    it('suggests finding birth record when birth year is missing', async () => {
      const person = {
        id: 'p1',
        is_placeholder: false,
        birth_year: null,
        birth_place: 'New York',
        death_year: 1980,
        death_place: 'Boston',
        birth_date_accuracy: null,
        death_date_accuracy: 'EXACT',
        source_count: 5,
        living: false,
      };

      mockContext.loaders.familiesAsChildLoader.load.mockResolvedValue([]);

      const result = await resolvers.Person.research_tip(
        person,
        {},
        mockContext,
      );
      expect(result).toContain('birth record');
    });

    it('suggests finding death record when death year is missing for deceased', async () => {
      const person = {
        id: 'p1',
        is_placeholder: false,
        birth_year: 1900,
        birth_place: 'New York',
        death_year: null,
        death_place: null,
        birth_date_accuracy: 'EXACT',
        death_date_accuracy: null,
        source_count: 5,
        living: false,
      };

      mockContext.loaders.familiesAsChildLoader.load.mockResolvedValue([]);

      const result = await resolvers.Person.research_tip(
        person,
        {},
        mockContext,
      );
      expect(result).toContain('death record');
    });

    it('suggests refining estimated birth date', async () => {
      const person = {
        id: 'p1',
        is_placeholder: false,
        birth_year: 1900,
        birth_place: 'New York',
        death_year: 1980,
        death_place: 'Boston',
        birth_date_accuracy: 'ESTIMATED',
        death_date_accuracy: 'EXACT',
        source_count: 5,
        living: false,
      };

      mockContext.loaders.familiesAsChildLoader.load.mockResolvedValue([]);

      const result = await resolvers.Person.research_tip(
        person,
        {},
        mockContext,
      );
      expect(result).toContain('Refine estimated birth date');
    });

    it('suggests attaching sources when source_count is 0', async () => {
      const person = {
        id: 'p1',
        is_placeholder: false,
        birth_year: 1900,
        birth_place: 'New York',
        death_year: 1980,
        death_place: 'Boston',
        birth_date_accuracy: 'EXACT',
        death_date_accuracy: 'EXACT',
        source_count: 0,
        living: false,
      };

      mockContext.loaders.familiesAsChildLoader.load.mockResolvedValue([]);

      const result = await resolvers.Person.research_tip(
        person,
        {},
        mockContext,
      );
      expect(result).toContain('Attach at least one high-quality source');
    });

    it('suggests review when all gaps are filled', async () => {
      const person = {
        id: 'p1',
        is_placeholder: false,
        birth_year: 1900,
        birth_place: 'New York',
        death_year: 1980,
        death_place: 'Boston',
        birth_date_accuracy: 'EXACT',
        death_date_accuracy: 'EXACT',
        source_count: 5,
        living: false,
      };

      mockContext.loaders.familiesAsChildLoader.load.mockResolvedValue([]);

      const result = await resolvers.Person.research_tip(
        person,
        {},
        mockContext,
      );
      expect(result).toContain('Review existing sources');
    });
  });

  // ============================================
  // PERSON TYPE RESOLVER TESTS
  // ============================================
  describe('Person.parents', () => {
    const mockLoaders = {
      familiesAsChildLoader: { load: vi.fn() },
      personLoader: { loadMany: vi.fn() },
    };

    it('returns parents from families', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([
        { id: 'fam-1', husband_id: 'father-1', wife_id: 'mother-1' },
      ]);
      mockLoaders.personLoader.loadMany.mockResolvedValueOnce([
        { id: 'father-1', name_full: 'Father' },
        { id: 'mother-1', name_full: 'Mother' },
      ]);

      const result = await resolvers.Person.parents({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toHaveLength(2);
      expect(mockLoaders.familiesAsChildLoader.load).toHaveBeenCalledWith(
        'person-1',
      );
    });

    it('returns empty array when no families', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([]);

      const result = await resolvers.Person.parents({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toEqual([]);
    });

    it('filters out null parents', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([
        { id: 'fam-1', husband_id: 'father-1', wife_id: null },
      ]);
      mockLoaders.personLoader.loadMany.mockResolvedValueOnce([
        { id: 'father-1', name_full: 'Father' },
        null,
      ]);

      const result = await resolvers.Person.parents({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toHaveLength(1);
    });
  });

  describe('Person.siblings', () => {
    const mockLoaders = {
      familiesAsChildLoader: { load: vi.fn() },
      childrenByFamilyLoader: { loadMany: vi.fn() },
      personLoader: { loadMany: vi.fn() },
    };

    it('returns siblings from same family', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([
        { id: 'fam-1' },
      ]);
      mockLoaders.childrenByFamilyLoader.loadMany.mockResolvedValueOnce([
        ['person-1', 'sibling-1', 'sibling-2'],
      ]);
      mockLoaders.personLoader.loadMany.mockResolvedValueOnce([
        { id: 'sibling-1', name_full: 'Sibling 1' },
        { id: 'sibling-2', name_full: 'Sibling 2' },
      ]);

      const result = await resolvers.Person.siblings({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no families', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([]);

      const result = await resolvers.Person.siblings({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toEqual([]);
    });
  });

  describe('Person.spouses', () => {
    const mockLoaders = {
      familiesAsSpouseLoader: { load: vi.fn() },
      personLoader: { loadMany: vi.fn() },
    };

    it('returns spouses from families', async () => {
      mockLoaders.familiesAsSpouseLoader.load.mockResolvedValueOnce([
        { id: 'fam-1', husband_id: 'person-1', wife_id: 'spouse-1' },
      ]);
      mockLoaders.personLoader.loadMany.mockResolvedValueOnce([
        { id: 'spouse-1', name_full: 'Spouse' },
      ]);

      const result = await resolvers.Person.spouses({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('spouse-1');
    });

    it('returns empty array when no families', async () => {
      mockLoaders.familiesAsSpouseLoader.load.mockResolvedValueOnce([]);

      const result = await resolvers.Person.spouses({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toEqual([]);
    });
  });

  describe('Person.children', () => {
    const mockLoaders = {
      familiesAsSpouseLoader: { load: vi.fn() },
      childrenByFamilyLoader: { loadMany: vi.fn() },
      personLoader: { loadMany: vi.fn() },
    };

    it('returns children from families', async () => {
      mockLoaders.familiesAsSpouseLoader.load.mockResolvedValueOnce([
        { id: 'fam-1' },
      ]);
      mockLoaders.childrenByFamilyLoader.loadMany.mockResolvedValueOnce([
        ['child-1', 'child-2'],
      ]);
      mockLoaders.personLoader.loadMany.mockResolvedValueOnce([
        { id: 'child-1', name_full: 'Child 1' },
        { id: 'child-2', name_full: 'Child 2' },
      ]);

      const result = await resolvers.Person.children({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no families', async () => {
      mockLoaders.familiesAsSpouseLoader.load.mockResolvedValueOnce([]);

      const result = await resolvers.Person.children({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toEqual([]);
    });
  });

  describe('Person.families', () => {
    const mockLoaders = {
      familiesAsSpouseLoader: { load: vi.fn() },
    };

    it('returns families via loader', async () => {
      const mockFamilies = [{ id: 'fam-1' }, { id: 'fam-2' }];
      mockLoaders.familiesAsSpouseLoader.load.mockResolvedValueOnce(
        mockFamilies,
      );

      const result = await resolvers.Person.families({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toEqual(mockFamilies);
    });
  });

  describe('Person.lifeEvents', () => {
    const mockLoaders = {
      lifeEventsLoader: { load: vi.fn() },
    };

    it('returns life events via loader', async () => {
      const mockEvents = [
        { id: 'e1', event_type: 'birth' },
        { id: 'e2', event_type: 'marriage' },
      ];
      mockLoaders.lifeEventsLoader.load.mockResolvedValueOnce(mockEvents);

      const result = await resolvers.Person.lifeEvents(
        { id: 'person-1' },
        null,
        { loaders: mockLoaders } as unknown as Context,
      );

      expect(result).toEqual(mockEvents);
    });
  });

  describe('Person.facts', () => {
    const mockLoaders = {
      factsLoader: { load: vi.fn() },
    };

    it('returns facts via loader', async () => {
      const mockFacts = [{ id: 'f1', fact_type: 'occupation' }];
      mockLoaders.factsLoader.load.mockResolvedValueOnce(mockFacts);

      const result = await resolvers.Person.facts({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toEqual(mockFacts);
    });
  });

  describe('Person.sources', () => {
    const mockLoaders = {
      sourcesLoader: { load: vi.fn() },
    };

    it('returns sources via loader', async () => {
      const mockSources = [{ id: 's1', source_type: 'census' }];
      mockLoaders.sourcesLoader.load.mockResolvedValueOnce(mockSources);

      const result = await resolvers.Person.sources({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toEqual(mockSources);
    });
  });

  describe('Person.media', () => {
    const mockLoaders = {
      mediaLoader: { load: vi.fn() },
    };

    it('returns media via loader', async () => {
      const mockMedia = [{ id: 'm1', media_type: 'photo' }];
      mockLoaders.mediaLoader.load.mockResolvedValueOnce(mockMedia);

      const result = await resolvers.Person.media({ id: 'person-1' }, null, {
        loaders: mockLoaders,
      } as unknown as Context);

      expect(result).toEqual(mockMedia);
    });
  });

  describe('Person.coatOfArms', () => {
    it('returns coat of arms from person facts', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ fact_value: 'https://example.com/crest.png' }],
      });

      const result = await resolvers.Person.coatOfArms({
        id: 'person-1',
        name_surname: 'Smith',
      });

      expect(result).toBe('https://example.com/crest.png');
    });

    it('falls back to surname lookup', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // No person fact
      mockedQuery.mockResolvedValueOnce({
        rows: [{ coat_of_arms: 'https://example.com/surname-crest.png' }],
      });

      const result = await resolvers.Person.coatOfArms({
        id: 'person-1',
        name_surname: 'Smith',
      });

      expect(result).toBe('https://example.com/surname-crest.png');
    });

    it('returns null when no coat of arms found', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Person.coatOfArms({
        id: 'person-1',
        name_surname: 'Smith',
      });

      expect(result).toBeNull();
    });

    it('returns null when no surname', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Person.coatOfArms({
        id: 'person-1',
        name_surname: undefined,
      });

      expect(result).toBeNull();
    });
  });

  describe('Person.completeness_score', () => {
    const mockLoaders = {
      familiesAsChildLoader: { load: vi.fn() },
      mediaLoader: { load: vi.fn() },
    };

    it('calculates full score for complete person', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([
        { id: 'fam-1' },
      ]);
      mockLoaders.mediaLoader.load.mockResolvedValueOnce([{ id: 'media-1' }]);

      const result = await resolvers.Person.completeness_score(
        {
          id: 'person-1',
          name_full: 'John Doe',
          birth_date: '1950-01-01',
          birth_year: 1950,
          birth_place: 'New York',
          death_date: '2020-12-31',
          death_year: 2020,
          death_place: 'Boston',
          living: false,
          source_count: 5,
        },
        null,
        { loaders: mockLoaders } as unknown as Context,
      );

      expect(result).toBe(100);
    });

    it('gives living people full death credit', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([]);
      mockLoaders.mediaLoader.load.mockResolvedValueOnce([]);

      const result = await resolvers.Person.completeness_score(
        {
          id: 'person-1',
          name_full: 'John Doe',
          birth_date: null,
          birth_year: null,
          birth_place: null,
          death_date: null,
          death_year: null,
          death_place: null,
          living: true,
          source_count: 0,
        },
        null,
        { loaders: mockLoaders } as unknown as Context,
      );

      // Name (10) + living death credit (15+10) = 35
      expect(result).toBe(35);
    });

    it('gives partial credit for birth_year without birth_date', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([]);
      mockLoaders.mediaLoader.load.mockResolvedValueOnce([]);

      const result = await resolvers.Person.completeness_score(
        {
          id: 'person-1',
          name_full: 'John Doe',
          birth_date: null,
          birth_year: 1950,
          birth_place: null,
          death_date: null,
          death_year: 2020,
          death_place: null,
          living: false,
          source_count: 0,
        },
        null,
        { loaders: mockLoaders } as unknown as Context,
      );

      // Name (10) + birth_year (10) + death_year (10) = 30
      expect(result).toBe(30);
    });
  });

  describe('Person.completeness_details', () => {
    const mockLoaders = {
      familiesAsChildLoader: { load: vi.fn() },
      mediaLoader: { load: vi.fn() },
    };

    it('returns detailed completeness breakdown', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([]);
      mockLoaders.mediaLoader.load.mockResolvedValueOnce([]);

      const result = await resolvers.Person.completeness_details(
        {
          id: 'person-1',
          name_full: 'John Doe',
          birth_date: '1950-01-01',
          birth_year: 1950,
          birth_place: null,
          death_date: null,
          death_year: null,
          death_place: null,
          living: false,
          source_count: 0,
        },
        null,
        { loaders: mockLoaders } as unknown as Context,
      );

      expect(result.has_name).toBe(true);
      expect(result.has_birth_date).toBe(true);
      expect(result.has_birth_place).toBe(false);
      expect(result.has_death_date).toBe(false);
      expect(result.has_parents).toBe(false);
      expect(result.missing_fields).toContain('birth_place');
      expect(result.missing_fields).toContain('death_date');
    });

    it('marks living person death fields as complete', async () => {
      mockLoaders.familiesAsChildLoader.load.mockResolvedValueOnce([]);
      mockLoaders.mediaLoader.load.mockResolvedValueOnce([]);

      const result = await resolvers.Person.completeness_details(
        {
          id: 'person-1',
          name_full: 'John Doe',
          birth_date: null,
          birth_year: null,
          birth_place: null,
          death_date: null,
          death_year: null,
          death_place: null,
          living: true,
          source_count: 0,
        },
        null,
        { loaders: mockLoaders } as unknown as Context,
      );

      expect(result.has_death_date).toBe(true);
      expect(result.has_death_place).toBe(true);
      expect(result.missing_fields).not.toContain('death_date');
      expect(result.missing_fields).not.toContain('death_place');
    });
  });

  describe('Person.comments', () => {
    it('returns comments for person', async () => {
      mockedQuery.mockReset();
      const mockComments = [
        { id: 'c1', person_id: 'person-1', content: 'Comment 1' },
        { id: 'c2', person_id: 'person-1', content: 'Comment 2' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockComments });

      const result = await resolvers.Person.comments({ id: 'person-1' });

      expect(result).toEqual(mockComments);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('person_comments'),
        ['person-1'],
      );
    });
  });

  describe('Comment type resolvers', () => {
    describe('Comment.user', () => {
      it('returns user for comment', async () => {
        mockedQuery.mockReset();
        const mockUser = {
          id: 'u1',
          email: 'test@test.com',
          name: 'Test',
          role: 'editor',
        };
        mockedQuery.mockResolvedValueOnce({ rows: [mockUser] });

        const result = await resolvers.Comment.user({ user_id: 'u1' });

        expect(result).toEqual(mockUser);
      });

      it('returns null for non-existent user', async () => {
        mockedQuery.mockReset();
        mockedQuery.mockResolvedValueOnce({ rows: [] });

        const result = await resolvers.Comment.user({ user_id: 'nonexistent' });

        expect(result).toBeNull();
      });
    });

    describe('Comment.replies', () => {
      it('returns replies for comment', async () => {
        mockedQuery.mockReset();
        const mockReplies = [
          { id: 'r1', parent_comment_id: 'c1', content: 'Reply 1' },
        ];
        mockedQuery.mockResolvedValueOnce({ rows: mockReplies });

        const result = await resolvers.Comment.replies({ id: 'c1' });

        expect(result).toEqual(mockReplies);
      });
    });
  });

  describe('Person.notableRelatives', () => {
    it('returns notable relatives with caching', async () => {
      mockedQuery.mockReset();
      const mockNotable = [
        {
          id: 'notable-1',
          name_full: 'Famous Ancestor',
          is_notable: true,
          generation: 2,
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockNotable });

      const result = await resolvers.Person.notableRelatives({
        id: 'person-1',
      });

      expect(result).toHaveLength(1);
      expect(result[0].person.id).toBe('notable-1');
      expect(result[0].generation).toBe(2);
    });

    it('returns empty array when no notable relatives', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Person.notableRelatives({
        id: 'person-2',
      });

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // FAMILY RESOLVER TESTS
  // ============================================
  describe('Query.family', () => {
    it('returns family by id via loaders', async () => {
      const mockFamily = {
        id: 'family-1',
        husband_id: 'person-1',
        wife_id: 'person-2',
        marriage_date: '1975-06-15',
        marriage_year: 1975,
        marriage_place: 'New York, NY',
      };

      // Query.family uses ctx.loaders.familyLoader.load(id)
      const familyMockContext = {
        loaders: {
          familyLoader: {
            load: vi.fn().mockResolvedValue(mockFamily),
          },
        },
      };

      const result = await resolvers.Query.family(
        null,
        { id: 'family-1' },
        familyMockContext,
      );

      expect(result).toEqual(mockFamily);
      expect(familyMockContext.loaders.familyLoader.load).toHaveBeenCalledWith(
        'family-1',
      );
    });

    it('returns null for non-existent family', async () => {
      const familyMockContext = {
        loaders: {
          familyLoader: {
            load: vi.fn().mockResolvedValue(null),
          },
        },
      };

      const result = await resolvers.Query.family(
        null,
        { id: 'nonexistent' },
        familyMockContext,
      );

      expect(result).toBeNull();
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
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM families'),
      );
    });
  });

  describe('Query.checkDuplicates', () => {
    it('returns duplicate matches by exact name', async () => {
      mockedQuery.mockReset();
      const mockMatches = [
        {
          id: 'p1',
          name_full: 'John Smith',
          birth_year: 1950,
          death_year: null,
          living: true,
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockMatches });
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // surname+year query
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // similar name query

      const result = await resolvers.Query.checkDuplicates(null, {
        nameFull: 'John Smith',
      });

      expect(result).toHaveLength(1);
      expect(result[0].matchReason).toBe('exact_name');
    });

    it('returns empty array when no duplicates found', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.checkDuplicates(null, {
        nameFull: 'Unique Person Name',
      });

      expect(result).toEqual([]);
    });
  });

  describe('Mutation.createFamily', () => {
    const familyAdminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('creates family with all fields', async () => {
      mockedQuery.mockReset();
      const mockFamily = {
        id: expect.any(String),
        husband_id: 'person-1',
        wife_id: 'person-2',
        marriage_date: '1975-06-15',
        marriage_year: 1975,
        marriage_place: 'New York',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      const result = await resolvers.Mutation.createFamily(
        null,
        {
          input: {
            husband_id: 'person-1',
            wife_id: 'person-2',
            marriage_date: '1975-06-15',
            marriage_year: 1975,
            marriage_place: 'New York',
          },
        },
        familyAdminContext,
      );

      expect(result.husband_id).toBe('person-1');
      expect(result.wife_id).toBe('person-2');
    });

    it('creates family with only husband', async () => {
      mockedQuery.mockReset();
      const mockFamily = {
        id: 'fam-1',
        husband_id: 'person-1',
        wife_id: null,
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      const result = await resolvers.Mutation.createFamily(
        null,
        { input: { husband_id: 'person-1' } },
        familyAdminContext,
      );

      expect(result.husband_id).toBe('person-1');
      expect(result.wife_id).toBeNull();
    });

    it('throws for viewer role', async () => {
      mockedQuery.mockReset();
      const viewerContext = {
        user: { id: 'u1', email: 'viewer@test.com', role: 'viewer' },
      };

      await expect(
        resolvers.Mutation.createFamily(
          null,
          { input: { husband_id: 'p1' } },
          viewerContext,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Mutation.updateFamily', () => {
    const updateFamilyAdminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('updates family fields', async () => {
      mockedQuery.mockReset();
      const mockFamily = {
        id: 'family-1',
        husband_id: 'person-1',
        wife_id: 'person-2',
        marriage_place: 'Updated Place',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      const result = await resolvers.Mutation.updateFamily(
        null,
        { id: 'family-1', input: { marriage_place: 'Updated Place' } },
        updateFamilyAdminContext,
      );

      expect(result.marriage_place).toBe('Updated Place');
    });

    it('returns null for non-existent family', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.updateFamily(
        null,
        { id: 'nonexistent', input: { marriage_place: 'Place' } },
        updateFamilyAdminContext,
      );

      expect(result).toBeNull();
    });
  });

  describe('Mutation.deleteFamily', () => {
    const deleteFamilyAdminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('deletes family and children links', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // DELETE children
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // DELETE family

      const result = await resolvers.Mutation.deleteFamily(
        null,
        { id: 'family-1' },
        deleteFamilyAdminContext,
      );

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        'DELETE FROM children WHERE family_id = $1',
        ['family-1'],
      );
    });

    it('throws for non-admin role', async () => {
      mockedQuery.mockReset();
      const editorContext = {
        user: { id: 'u1', email: 'editor@test.com', role: 'editor' },
      };

      await expect(
        resolvers.Mutation.deleteFamily(
          null,
          { id: 'family-1' },
          editorContext,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Mutation.addChildToFamily', () => {
    const childFamilyAdminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('adds child to family', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // Check existing
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // INSERT

      const result = await resolvers.Mutation.addChildToFamily(
        null,
        { familyId: 'family-1', personId: 'child-1' },
        childFamilyAdminContext,
      );

      expect(result).toBe(true);
    });

    it('returns true if child already exists', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Already exists

      const result = await resolvers.Mutation.addChildToFamily(
        null,
        { familyId: 'family-1', personId: 'child-1' },
        childFamilyAdminContext,
      );

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledTimes(1); // Only check, no insert
    });
  });

  describe('Mutation.removeChildFromFamily', () => {
    const removeChildAdminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('removes child from family', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.removeChildFromFamily(
        null,
        { familyId: 'family-1', personId: 'child-1' },
        removeChildAdminContext,
      );

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        'DELETE FROM children WHERE family_id = $1 AND person_id = $2',
        ['family-1', 'child-1'],
      );
    });
  });

  describe('Mutation.addSpouse', () => {
    const addSpouseAdminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('creates family with correct husband/wife based on sex', async () => {
      mockedQuery.mockReset();
      // Get both people
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'person-1', sex: 'M' },
          { id: 'person-2', sex: 'F' },
        ],
      });
      // Create family
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'fam-1',
            husband_id: 'person-1',
            wife_id: 'person-2',
          },
        ],
      });

      const result = await resolvers.Mutation.addSpouse(
        null,
        {
          personId: 'person-1',
          spouseId: 'person-2',
          marriageYear: 1980,
        },
        addSpouseAdminContext,
      );

      expect(result.husband_id).toBe('person-1');
      expect(result.wife_id).toBe('person-2');
    });

    it('throws if person not found', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'person-1', sex: 'M' }],
      });

      await expect(
        resolvers.Mutation.addSpouse(
          null,
          { personId: 'person-1', spouseId: 'nonexistent' },
          addSpouseAdminContext,
        ),
      ).rejects.toThrow('Person or spouse not found');
    });
  });

  describe('Mutation.removeSpouse', () => {
    const removeSpouseAdminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('deletes family between spouses', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'family-1' }] }); // Find family
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Check children
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // Delete family

      const result = await resolvers.Mutation.removeSpouse(
        null,
        { personId: 'person-1', spouseId: 'person-2' },
        removeSpouseAdminContext,
      );

      expect(result).toBe(true);
    });

    it('throws if family has children', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'family-1' }] });
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await expect(
        resolvers.Mutation.removeSpouse(
          null,
          { personId: 'person-1', spouseId: 'person-2' },
          removeSpouseAdminContext,
        ),
      ).rejects.toThrow('Cannot remove spouse from family with children');
    });

    it('throws if family not found', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.removeSpouse(
          null,
          { personId: 'person-1', spouseId: 'person-2' },
          removeSpouseAdminContext,
        ),
      ).rejects.toThrow('Family not found');
    });
  });

  // ============================================
  // ADDITIONAL PERSON RESOLVER TESTS
  // ============================================
  describe('Mutation.updatePerson extended', () => {
    const updateAdminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('updates multiple fields', async () => {
      mockedQuery.mockReset();
      const mockPerson = {
        id: 'person-1',
        name_full: 'Updated Name',
        birth_year: 1950,
        description: 'New description',
      };
      // getPerson call for audit log
      mockedQuery.mockResolvedValueOnce({ rows: [mockPerson] });
      // UPDATE query
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // getPerson call at the end to return updated person
      mockedQuery.mockResolvedValueOnce({ rows: [mockPerson] });

      const result = await resolvers.Mutation.updatePerson(
        null,
        {
          id: 'person-1',
          input: {
            name_full: 'Updated Name',
            birth_year: 1950,
            description: 'New description',
          },
        },
        updateAdminContext,
      );

      expect(result.name_full).toBe('Updated Name');
      expect(result.description).toBe('New description');
    });

    it('returns null for non-existent person', async () => {
      mockedQuery.mockReset();
      // getPerson call for audit log returns null
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // UPDATE query
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // getPerson call at the end returns null
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Mutation.updatePerson(
        null,
        { id: 'nonexistent', input: { name_full: 'Test' } },
        updateAdminContext,
      );

      expect(result).toBeNull();
    });
  });

  describe('Query.search', () => {
    it('searches people by query', async () => {
      mockedQuery.mockReset();
      // The search resolver makes a single query and processes results
      const mockPeople = [
        {
          id: 'p1',
          name_full: 'John Smith',
          birth_year: 1950,
          relevance_score: 1,
        },
        {
          id: 'p2',
          name_full: 'John Johnson',
          birth_year: 1960,
          relevance_score: 0.5,
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockPeople });

      const result = await resolvers.Query.search(null, {
        query: 'John',
        first: 10,
      });

      expect(result.edges).toHaveLength(2);
      expect(result.pageInfo.totalCount).toBe(2);
    });

    it('returns empty results for no matches', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.search(null, {
        query: 'ZZZZZ',
        first: 10,
      });

      expect(result.edges).toEqual([]);
      expect(result.pageInfo.totalCount).toBe(0);
    });
  });

  // ============================================
  // COMMENT RESOLVER TESTS
  // ============================================
  describe('Query.personComments', () => {
    it('returns comments for a person', async () => {
      mockedQuery.mockReset();
      const mockComments = [
        { id: 'c1', person_id: 'p1', content: 'Comment 1', user_id: 'u1' },
        { id: 'c2', person_id: 'p1', content: 'Comment 2', user_id: 'u2' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockComments });

      const result = await resolvers.Query.personComments(null, {
        personId: 'p1',
      });

      expect(result).toEqual(mockComments);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('person_comments'),
        ['p1'],
      );
    });

    it('returns empty array for person with no comments', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.personComments(null, {
        personId: 'p1',
      });

      expect(result).toEqual([]);
    });
  });

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
  // FACT RESOLVER TESTS
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
  // LIFE EVENT RESOLVER TESTS
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
  // SOURCE RESOLVER TESTS
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

  // ============================================
  // MEDIA RESOLVER TESTS
  // ============================================
  describe('Mutation.uploadMedia', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

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

  describe('Mutation.updateMedia', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

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
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

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

  describe('SurnameCrest type resolvers', () => {
    it('returns peopleCount for a surname', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: '15' }] });

      const crest = { surname: 'Smith' };
      const result = await resolvers.SurnameCrest.peopleCount(crest);

      expect(result).toBe(15);
    });

    it('returns storage path URL for coat of arms', () => {
      const crest = { coat_of_arms: null, storage_path: 'crests/smith.png' };
      const result = resolvers.SurnameCrest.coat_of_arms(crest);
      expect(result).toBe('/api/media/crests/smith.png');
    });

    it('falls back to base64 coat of arms', () => {
      const crest = {
        coat_of_arms: 'data:image/png;base64,ABC',
        storage_path: null,
      };
      const result = resolvers.SurnameCrest.coat_of_arms(crest);
      expect(result).toBe('data:image/png;base64,ABC');
    });
  });

  // ============================================
  // Person Query resolvers (additional coverage)
  // ============================================
  describe('Query.recentPeople', () => {
    it('returns recent people ordered by birth year', async () => {
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
        [10],
      );
    });

    it('enforces maximum limit of 50', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await resolvers.Query.recentPeople(null, { limit: 100 });

      expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [50]);
    });
  });

  describe('Query.notablePeople', () => {
    it('returns notable people', async () => {
      mockedQuery.mockReset();
      const mockNotable = [
        { id: 'p1', name_full: 'Notable Person', is_notable: true },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockNotable });

      const result = await resolvers.Query.notablePeople(null, {});

      expect(result).toEqual(mockNotable);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_notable = true'),
      );
    });
  });

  describe('Mutation.deletePerson', () => {
    const adminContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('deletes person and related records', async () => {
      mockedQuery.mockReset();
      // First query: get person
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', name_full: 'Delete Me' }],
      });
      // Subsequent queries: delete related records
      mockedQuery.mockResolvedValue({ rows: [] });

      const result = await resolvers.Mutation.deletePerson(
        null,
        { id: 'p1' },
        adminContext,
      );

      expect(result).toBe(true);
      // Should have multiple delete queries
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sources'),
        ['p1'],
      );
    });

    it('throws error for non-existent person', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.deletePerson(
          null,
          { id: 'nonexistent' },
          adminContext,
        ),
      ).rejects.toThrow('Person not found');
    });

    it('requires admin role', async () => {
      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      await expect(
        resolvers.Mutation.deletePerson(null, { id: 'p1' }, editorContext),
      ).rejects.toThrow();
    });
  });

  describe('Mutation.updateResearchStatus', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('updates research status', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // update
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', research_status: 'verified' }],
      });

      const result = await resolvers.Mutation.updateResearchStatus(
        null,
        { personId: 'p1', status: 'verified' },
        editorContext,
      );

      expect(result).toEqual({ id: 'p1', research_status: 'verified' });
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('research_status'),
        ['verified', 'p1'],
      );
    });
  });

  describe('Mutation.updateResearchPriority', () => {
    const editorContext = {
      user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
    };

    it('updates research priority', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // update
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', research_priority: 5 }],
      });

      const result = await resolvers.Mutation.updateResearchPriority(
        null,
        { personId: 'p1', priority: 5 },
        editorContext,
      );

      expect(result).toEqual({ id: 'p1', research_priority: 5 });
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('research_priority'),
        [5, 'p1'],
      );
    });
  });

  // ============================================
  // Admin Query resolvers
  // ============================================
  describe('Query.me', () => {
    it('returns current user info', async () => {
      mockedQuery.mockReset();
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        name: 'Test User',
        role: 'editor',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const context = {
        user: { id: 'user-1', email: 'user@test.com', role: 'editor' },
      };
      const result = await resolvers.Query.me(null, {}, context);

      expect(result).toEqual(mockUser);
    });
  });

  describe('Query.users', () => {
    it('returns all users for admin', async () => {
      mockedQuery.mockReset();
      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };

      // getUsers is mocked to return []
      const result = await resolvers.Query.users(null, {}, adminContext);

      expect(result).toEqual([]);
    });

    it('throws for non-admin', async () => {
      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      await expect(
        resolvers.Query.users(null, {}, editorContext),
      ).rejects.toThrow();
    });
  });

  describe('Query.invitations', () => {
    it('returns all invitations for admin', async () => {
      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };

      const result = await resolvers.Query.invitations(null, {}, adminContext);

      expect(result).toEqual([]);
    });
  });

  describe('Query.siteSettings', () => {
    it('returns site settings', async () => {
      const result = await resolvers.Query.siteSettings(null, {});

      expect(result).toEqual({
        site_name: 'Test Family Tree',
        family_name: 'Test',
        theme_color: '#2c5530',
      });
    });
  });

  describe('Query.settings', () => {
    it('returns settings list for admin', async () => {
      mockedQuery.mockReset();
      const mockSettings = [
        { key: 'site_name', value: 'Test', category: 'general' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockSettings });

      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      const result = await resolvers.Query.settings(null, {}, adminContext);

      expect(result).toEqual(mockSettings);
    });

    it('returns empty array if table does not exist', async () => {
      mockedQuery.mockReset();
      const error = new Error('relation does not exist');
      (error as NodeJS.ErrnoException).code = '42P01';
      mockedQuery.mockRejectedValueOnce(error);

      const adminContext = {
        user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      };
      const result = await resolvers.Query.settings(null, {}, adminContext);

      expect(result).toEqual([]);
    });
  });

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

  // ============================================
  // Admin Mutation resolvers
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
  // Crest resolvers
  // ============================================
  describe('Query.surnameCrests', () => {
    it('returns all surname crests', async () => {
      mockedQuery.mockReset();
      const mockCrests = [
        { id: '1', surname: 'Smith', coat_of_arms: 'url' },
        { id: '2', surname: 'Jones', coat_of_arms: 'url2' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockCrests });

      const result = await resolvers.Query.surnameCrests(null, {});

      expect(result).toEqual(mockCrests);
    });
  });

  describe('Query.surnameCrest', () => {
    it('returns crest for surname', async () => {
      mockedQuery.mockReset();
      const mockCrest = { id: '1', surname: 'Smith', coat_of_arms: 'url' };
      mockedQuery.mockResolvedValueOnce({ rows: [mockCrest] });

      const result = await resolvers.Query.surnameCrest(null, {
        surname: 'Smith',
      });

      expect(result).toEqual(mockCrest);
    });

    it('returns null for unknown surname', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await resolvers.Query.surnameCrest(null, {
        surname: 'Unknown',
      });

      expect(result).toBeNull();
    });
  });

  describe('Mutation.setSurnameCrest', () => {
    it('creates or updates surname crest', async () => {
      mockedQuery.mockReset();
      const mockCrest = {
        id: '1',
        surname: 'Smith',
        coat_of_arms: 'url',
        description: 'A crest',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockCrest] });

      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      const result = await resolvers.Mutation.setSurnameCrest(
        null,
        { surname: 'Smith', coatOfArms: 'url', description: 'A crest' },
        editorContext,
      );

      expect(result).toEqual(mockCrest);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array),
      );
    });
  });

  describe('Mutation.updateSurnameCrest', () => {
    it('updates surname crest fields', async () => {
      mockedQuery.mockReset();
      const mockCrest = {
        id: '1',
        surname: 'Smith',
        description: 'Updated description',
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockCrest] });

      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      const result = await resolvers.Mutation.updateSurnameCrest(
        null,
        { id: '1', input: { description: 'Updated description' } },
        editorContext,
      );

      expect(result).toEqual(mockCrest);
    });

    it('throws if no fields to update', async () => {
      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      await expect(
        resolvers.Mutation.updateSurnameCrest(
          null,
          { id: '1', input: {} },
          editorContext,
        ),
      ).rejects.toThrow('No fields to update');
    });

    it('throws if crest not found', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      await expect(
        resolvers.Mutation.updateSurnameCrest(
          null,
          { id: '1', input: { description: 'test' } },
          editorContext,
        ),
      ).rejects.toThrow('Surname crest not found');
    });
  });

  describe('Mutation.removeSurnameCrest', () => {
    it('removes surname crest', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      const result = await resolvers.Mutation.removeSurnameCrest(
        null,
        { surname: 'Smith' },
        editorContext,
      );

      expect(result).toBe(true);
    });
  });

  describe('Mutation.setPersonCoatOfArms', () => {
    it('sets coat of arms for a person', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      const result = await resolvers.Mutation.setPersonCoatOfArms(
        null,
        { personId: 'p1', coatOfArms: 'crest-url' },
        editorContext,
      );

      expect(result).toBe('crest-url');
    });
  });

  describe('Mutation.removePersonCoatOfArms', () => {
    it('removes coat of arms from a person', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const editorContext = {
        user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
      };

      const result = await resolvers.Mutation.removePersonCoatOfArms(
        null,
        { personId: 'p1' },
        editorContext,
      );

      expect(result).toBe(true);
    });
  });

  // ============================================
  // Dashboard resolvers
  // ============================================
  describe('Query.stats', () => {
    it('returns dashboard statistics', async () => {
      mockedQuery.mockReset();
      const mockStats = {
        total_people: '100',
        total_families: '40',
        male_count: '50',
        female_count: '50',
        living_count: '30',
        earliest_birth: 1800,
        latest_birth: 2020,
        average_completeness: 65,
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await resolvers.Query.stats(null, {});

      expect(result).toEqual(mockStats);
    });
  });

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
  // FAMILY TYPE RESOLVERS
  // ============================================
  describe('Family type resolvers', () => {
    const mockLoaders = {
      personLoader: {
        load: vi.fn(),
        loadMany: vi.fn(),
      },
      childrenByFamilyLoader: {
        load: vi.fn(),
      },
    };

    describe('Family.husband', () => {
      it('returns husband via personLoader', async () => {
        const mockPerson = { id: 'husband-1', name_full: 'John Doe' };
        mockLoaders.personLoader.load.mockResolvedValueOnce(mockPerson);

        const result = await resolvers.Family.husband(
          { husband_id: 'husband-1' },
          null,
          { loaders: mockLoaders } as unknown as Context,
        );

        expect(result).toEqual(mockPerson);
        expect(mockLoaders.personLoader.load).toHaveBeenCalledWith('husband-1');
      });

      it('returns null when no husband_id', async () => {
        const result = await resolvers.Family.husband(
          { husband_id: null },
          null,
          { loaders: mockLoaders } as unknown as Context,
        );

        expect(result).toBeNull();
      });
    });

    describe('Family.wife', () => {
      it('returns wife via personLoader', async () => {
        const mockPerson = { id: 'wife-1', name_full: 'Jane Doe' };
        mockLoaders.personLoader.load.mockResolvedValueOnce(mockPerson);

        const result = await resolvers.Family.wife(
          { wife_id: 'wife-1' },
          null,
          { loaders: mockLoaders } as unknown as Context,
        );

        expect(result).toEqual(mockPerson);
        expect(mockLoaders.personLoader.load).toHaveBeenCalledWith('wife-1');
      });

      it('returns null when no wife_id', async () => {
        const result = await resolvers.Family.wife({ wife_id: null }, null, {
          loaders: mockLoaders,
        } as unknown as Context);

        expect(result).toBeNull();
      });
    });

    describe('Family.children', () => {
      it('returns children via loaders', async () => {
        const mockChildren = [
          { id: 'child-1', name_full: 'Child One' },
          { id: 'child-2', name_full: 'Child Two' },
        ];
        mockLoaders.childrenByFamilyLoader.load.mockResolvedValueOnce([
          'child-1',
          'child-2',
        ]);
        mockLoaders.personLoader.loadMany.mockResolvedValueOnce(mockChildren);

        const result = await resolvers.Family.children(
          { id: 'family-1' },
          null,
          { loaders: mockLoaders } as unknown as Context,
        );

        expect(result).toEqual(mockChildren);
        expect(mockLoaders.childrenByFamilyLoader.load).toHaveBeenCalledWith(
          'family-1',
        );
      });

      it('returns empty array when no children', async () => {
        mockLoaders.childrenByFamilyLoader.load.mockResolvedValueOnce([]);

        const result = await resolvers.Family.children(
          { id: 'family-1' },
          null,
          { loaders: mockLoaders } as unknown as Context,
        );

        expect(result).toEqual([]);
      });

      it('filters out null values from loadMany', async () => {
        mockLoaders.childrenByFamilyLoader.load.mockResolvedValueOnce([
          'child-1',
          'child-2',
        ]);
        mockLoaders.personLoader.loadMany.mockResolvedValueOnce([
          { id: 'child-1', name_full: 'Child One' },
          null,
        ]);

        const result = await resolvers.Family.children(
          { id: 'family-1' },
          null,
          { loaders: mockLoaders } as unknown as Context,
        );

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('child-1');
      });
    });
  });

  // ============================================
  // MUTATION.ADDCHILD TESTS
  // ============================================
  describe('Mutation.addChild', () => {
    const addChildContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('adds child to existing family with both parents', async () => {
      mockedQuery.mockReset();
      // Get person's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      // Check for existing family with both parents
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'family-1', husband_id: 'person-1', wife_id: 'person-2' }],
      });
      // Check if child already exists
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Insert child
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Get family for return
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'family-1', husband_id: 'person-1', wife_id: 'person-2' }],
      });

      const result = await resolvers.Mutation.addChild(
        null,
        { personId: 'person-1', childId: 'child-1', otherParentId: 'person-2' },
        addChildContext,
      );

      expect(result.id).toBe('family-1');
    });

    it('creates new family when no existing family with parents', async () => {
      mockedQuery.mockReset();
      // Get person's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      // Check for existing family - none found
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Get other parent's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'F' }] });
      // Create new family
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Check if child exists
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Insert child
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Get family for return
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'new-family', husband_id: 'person-1', wife_id: 'person-2' },
        ],
      });

      const result = await resolvers.Mutation.addChild(
        null,
        { personId: 'person-1', childId: 'child-1', otherParentId: 'person-2' },
        addChildContext,
      );

      expect(result).toBeDefined();
    });

    it('handles single parent (no otherParentId)', async () => {
      mockedQuery.mockReset();
      // Get person's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'F' }] });
      // Check for existing single-parent family - none found
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Create new single-parent family
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Check if child exists
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Insert child
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Get family for return
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'single-parent-family', wife_id: 'person-1', husband_id: null },
        ],
      });

      const result = await resolvers.Mutation.addChild(
        null,
        { personId: 'person-1', childId: 'child-1' },
        addChildContext,
      );

      expect(result.wife_id).toBe('person-1');
      expect(result.husband_id).toBeNull();
    });

    it('throws when person not found', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.addChild(
          null,
          { personId: 'nonexistent', childId: 'child-1' },
          addChildContext,
        ),
      ).rejects.toThrow('Person not found');
    });

    it('skips insert if child already in family', async () => {
      mockedQuery.mockReset();
      // Get person's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      // Check for existing family
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'family-1' }],
      });
      // Child already exists in family
      mockedQuery.mockResolvedValueOnce({ rows: [{ family_id: 'family-1' }] });
      // Get family for return
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'family-1' }] });

      const result = await resolvers.Mutation.addChild(
        null,
        { personId: 'person-1', childId: 'child-1', otherParentId: 'person-2' },
        addChildContext,
      );

      expect(result.id).toBe('family-1');
    });
  });

  // ============================================
  // MUTATION.REMOVECHILD TESTS
  // ============================================
  describe('Mutation.removeChild', () => {
    const removeChildContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('removes child from family', async () => {
      mockedQuery.mockReset();
      // Find families where personId is parent
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'family-1' }] });
      // Delete child from family
      mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await resolvers.Mutation.removeChild(
        null,
        { personId: 'person-1', childId: 'child-1' },
        removeChildContext,
      );

      expect(result).toBe(true);
    });

    it('throws when no families found for person', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.removeChild(
          null,
          { personId: 'person-1', childId: 'child-1' },
          removeChildContext,
        ),
      ).rejects.toThrow('No families found for this person');
    });

    it('throws when child not found in any family', async () => {
      mockedQuery.mockReset();
      // Find families
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'family-1' }] });
      // Delete returns 0 affected rows
      mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        resolvers.Mutation.removeChild(
          null,
          { personId: 'person-1', childId: 'nonexistent-child' },
          removeChildContext,
        ),
      ).rejects.toThrow('Child not found in any family');
    });
  });

  // ============================================
  // MUTATION.CREATEANDADDSPOUSE TESTS
  // ============================================
  describe('Mutation.createAndAddSpouse', () => {
    const createSpouseContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('creates person and family with spouse', async () => {
      mockedQuery.mockReset();
      // checkDuplicates - exact match
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // checkDuplicates - surname/year match (no surname provided)
      // checkDuplicates - similar name
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Create new person
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-spouse', name_full: 'Jane Doe', sex: 'F' }],
      });
      // Get original person's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      // Create family
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'new-family', husband_id: 'person-1', wife_id: 'new-spouse' },
        ],
      });

      const result = await resolvers.Mutation.createAndAddSpouse(
        null,
        {
          personId: 'person-1',
          newPerson: { name_full: 'Jane Doe', sex: 'F' },
          marriageYear: 1990,
        },
        createSpouseContext,
      );

      expect(result.person.name_full).toBe('Jane Doe');
      expect(result.family.husband_id).toBe('person-1');
      expect(result.duplicatesSkipped).toBe(false);
    });

    it('throws when duplicates found', async () => {
      mockedQuery.mockReset();
      // checkDuplicates - exact name match returns duplicate
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'dup-1',
            name_full: 'Jane Doe',
            birth_year: 1960,
            death_year: null,
            living: false,
          },
        ],
      });
      // checkDuplicates - similar name query (for surname 'Doe')
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.createAndAddSpouse(
          null,
          {
            personId: 'person-1',
            newPerson: { name_full: 'Jane Doe' },
          },
          createSpouseContext,
        ),
      ).rejects.toThrow('DUPLICATES_FOUND');
    });

    it('skips duplicate check when skipDuplicateCheck is true', async () => {
      mockedQuery.mockReset();
      // Create new person (no duplicate check)
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-spouse', name_full: 'Jane Doe', sex: 'F' }],
      });
      // Get original person's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      // Create family
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-family' }],
      });

      const result = await resolvers.Mutation.createAndAddSpouse(
        null,
        {
          personId: 'person-1',
          newPerson: { name_full: 'Jane Doe', sex: 'F' },
          skipDuplicateCheck: true,
        },
        createSpouseContext,
      );

      expect(result.duplicatesSkipped).toBe(true);
    });
  });

  // ============================================
  // MUTATION.CREATEANDADDCHILD TESTS
  // ============================================
  describe('Mutation.createAndAddChild', () => {
    const createChildContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('creates child and adds to existing family', async () => {
      mockedQuery.mockReset();
      // checkDuplicates - exact match
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // checkDuplicates - similar name
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Create new child
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-child', name_full: 'Child Name' }],
      });
      // Get parent's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      // Check for existing family with both parents
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-family' }],
      });
      // Add child to family
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Get family for return
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-family' }],
      });

      const result = await resolvers.Mutation.createAndAddChild(
        null,
        {
          personId: 'person-1',
          newPerson: { name_full: 'Child Name' },
          otherParentId: 'person-2',
        },
        createChildContext,
      );

      expect(result.person.name_full).toBe('Child Name');
      expect(result.family.id).toBe('existing-family');
    });

    it('creates single-parent family when no otherParentId', async () => {
      mockedQuery.mockReset();
      // checkDuplicates
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Create new child
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-child', name_full: 'Child Name' }],
      });
      // Get parent's sex
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'F' }] });
      // Check for existing single-parent family - none
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Create single-parent family
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Add child
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      // Get family
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'single-family', wife_id: 'person-1', husband_id: null }],
      });

      const result = await resolvers.Mutation.createAndAddChild(
        null,
        {
          personId: 'person-1',
          newPerson: { name_full: 'Child Name' },
        },
        createChildContext,
      );

      expect(result.family.wife_id).toBe('person-1');
    });

    it('throws when duplicates found', async () => {
      mockedQuery.mockReset();
      // checkDuplicates - exact name match returns duplicate
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'dup-1',
            name_full: 'Child Name',
            birth_year: null,
            death_year: null,
            living: false,
          },
        ],
      });
      // checkDuplicates - similar name query
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolvers.Mutation.createAndAddChild(
          null,
          {
            personId: 'person-1',
            newPerson: { name_full: 'Child Name' },
          },
          createChildContext,
        ),
      ).rejects.toThrow('DUPLICATES_FOUND');
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

  // ============================================
  // ADDSPOUSE EDGE CASES
  // ============================================
  describe('Mutation.addSpouse edge cases', () => {
    const addSpouseContext = {
      user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
    };

    it('handles female person with male spouse', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'person-1', sex: 'F' },
          { id: 'person-2', sex: 'M' },
        ],
      });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'fam-1', husband_id: 'person-2', wife_id: 'person-1' }],
      });

      const result = await resolvers.Mutation.addSpouse(
        null,
        { personId: 'person-1', spouseId: 'person-2' },
        addSpouseContext,
      );

      expect(result.husband_id).toBe('person-2');
      expect(result.wife_id).toBe('person-1');
    });

    it('handles same-sex couple (both male)', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'person-1', sex: 'M' },
          { id: 'person-2', sex: 'M' },
        ],
      });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'fam-1', husband_id: 'person-1', wife_id: 'person-2' }],
      });

      const result = await resolvers.Mutation.addSpouse(
        null,
        { personId: 'person-1', spouseId: 'person-2' },
        addSpouseContext,
      );

      // When both male, first is husband, second is wife
      expect(result.husband_id).toBe('person-1');
    });

    it('handles unknown sex', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'person-1', sex: null },
          { id: 'person-2', sex: 'F' },
        ],
      });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'fam-1', husband_id: 'person-2', wife_id: 'person-1' }],
      });

      const result = await resolvers.Mutation.addSpouse(
        null,
        { personId: 'person-1', spouseId: 'person-2' },
        addSpouseContext,
      );

      expect(result).toBeDefined();
    });
  });
});
