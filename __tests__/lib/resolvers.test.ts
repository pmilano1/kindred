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
    it('returns ancestors using recursive CTE', async () => {
      mockedQuery.mockReset();
      const mockAncestors = [
        { id: 'a1', name_full: 'Grandfather', gen: 1 },
        { id: 'a2', name_full: 'Grandmother', gen: 1 },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockAncestors });

      const result = await resolvers.Query.ancestors(null, {
        personId: 'p1',
        generations: 5,
      });

      expect(result).toEqual(mockAncestors);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE ancestry'),
        ['p1', 5],
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

      const result = await resolvers.Query.descendants(null, {
        personId: 'p1',
        generations: 5,
      });

      expect(result).toEqual(mockDescendants);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE descendancy'),
        ['p1', 5],
      );
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
      mockedQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
      mockedQuery.mockResolvedValueOnce({ rows: [mockUpdatedPerson] }); // SELECT

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
});
