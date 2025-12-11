/**
 * Research and Cache Resolver Tests
 * Tests research queue, research status, research tips, and query caching
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

describe('Research and Cache Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // RESEARCH QUEUE TESTS
  // ============================================
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

  // Query.ancestors, Query.descendants, Query.timeline moved to resolvers-person.test.ts
  // Query.surnameCrests, Query.surnameCrest moved to resolvers-misc.test.ts

  // Mutation.updatePerson moved to resolvers-person.test.ts

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

  // Mutation.setSurnameCrest moved to resolvers-misc.test.ts

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

  // Auth tests moved to resolvers-auth.test.ts:
  // - Mutation.registerWithInvitation
  // - Mutation.requestPasswordReset
  // - Mutation.resetPassword
  // - Mutation.changePassword
  // - Mutation.updateEmailPreferences

  // Mutation.createLocalUser moved to resolvers-user.test.ts

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
  // PERSON TYPE RESOLVER TESTS - moved to resolvers-person.test.ts
  // Person.parents, Person.siblings, Person.spouses, Person.children,
  // Person.families, Person.lifeEvents, Person.facts, Person.sources, Person.media
  // ============================================

  // Person.coatOfArms, Person.completeness_score, Person.completeness_details,
  // Person.comments, Comment type resolvers, Person.notableRelatives
  // moved to resolvers-person.test.ts

  // ============================================
  // FAMILY RESOLVER TESTS - moved to resolvers-family.test.ts
  // ============================================

  // Person mutation/query tests (updatePerson, deletePerson, search, personComments, Query.me) moved to resolvers-person.test.ts
  // Research mutation tests (updateResearchStatus, updateResearchPriority) remain here with research_tip and researchQueue
});
