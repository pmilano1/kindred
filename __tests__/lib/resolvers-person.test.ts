/**
 * GraphQL Resolver Tests - Person
 * Tests: Person queries, mutations, and type resolvers
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

import type { Context } from '@/lib/graphql/context';
import { resolvers } from '@/lib/graphql/resolvers';

const mockedQuery = mockQuery as Mock;

describe('Person Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // QUERY.PERSON TESTS
  // ============================================
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

  // ============================================
  // QUERY.PEOPLELIST TESTS
  // ============================================
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

  // ============================================
  // QUERY.NOTABLEPEOPLE TESTS
  // ============================================
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

  // ============================================
  // QUERY.SEARCH TESTS
  // ============================================
  describe('Query.search', () => {
    it('searches people using PostgreSQL full-text search', async () => {
      const mockPeople = [
        { id: 'p1', name_full: 'René Beauharnais', relevance_score: 1.5 },
        { id: 'p2', name_full: 'Rene Test', relevance_score: 1.2 },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockPeople });

      const result = await resolvers.Query.search(null, { query: 'Rene' });

      expect(result.edges.length).toBe(2);
      expect(result.edges[0].node.id).toBe('p1');
      expect(result.edges[1].node.id).toBe('p2');
      expect(result.pageInfo.totalCount).toBe(2);
    });
  });

  // ============================================
  // QUERY.PEOPLE (CURSOR PAGINATION) TESTS
  // ============================================
  describe('Query.people (cursor pagination)', () => {
    it('returns paginated people with cursor info', async () => {
      mockedQuery.mockReset();
      const mockPeople = [
        { id: 'p1', name_full: 'Person 1' },
        { id: 'p2', name_full: 'Person 2' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: '100' }] });
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

  // ============================================
  // QUERY.RECENTPEOPLE TESTS
  // ============================================
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

  // ============================================
  // QUERY.ANCESTORS TESTS
  // ============================================
  describe('Query.ancestors', () => {
    it('returns nested pedigree tree structure', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', name_full: 'Person 1', sex: 'M' }],
      });
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

  // ============================================
  // QUERY.DESCENDANTS TESTS
  // ============================================
  describe('Query.descendants', () => {
    it('returns nested descendant tree structure', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', name_full: 'Person 1', sex: 'M' }],
      });
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

  // ============================================
  // QUERY.TIMELINE TESTS
  // ============================================
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

      const year1950 = result.find((y: { year: number }) => y.year === 1950);
      const year2020 = result.find((y: { year: number }) => y.year === 2020);

      expect(year1950).toBeDefined();
      expect(year1950.events).toHaveLength(2);
      expect(year2020).toBeDefined();
      expect(year2020.events).toHaveLength(1);
      expect(year2020.events[0].type).toBe('death');
    });
  });

  // ============================================
  // PERSON.PARENTS TYPE RESOLVER TESTS
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

  // ============================================
  // PERSON.SIBLINGS TYPE RESOLVER TESTS
  // ============================================
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

  // ============================================
  // PERSON.SPOUSES TESTS
  // ============================================
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

  // ============================================
  // PERSON.CHILDREN TESTS
  // ============================================
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

  // ============================================
  // PERSON.FAMILIES TESTS
  // ============================================
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

  // ============================================
  // PERSON.LIFEEVENTS TESTS
  // ============================================
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

  // ============================================
  // PERSON.FACTS TESTS
  // ============================================
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

  // ============================================
  // PERSON.SOURCES TESTS
  // ============================================
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

  // ============================================
  // PERSON.MEDIA TESTS
  // ============================================
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

  // ============================================
  // PERSON.COATOFARMS TESTS
  // ============================================
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

  // ============================================
  // PERSON.COMPLETENESS_SCORE TESTS
  // ============================================
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

  // ============================================
  // PERSON.COMPLETENESS_DETAILS TESTS
  // ============================================
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

  // ============================================
  // PERSON.COMMENTS TESTS
  // ============================================
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

  // ============================================
  // COMMENT TYPE RESOLVER TESTS
  // ============================================
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

  // ============================================
  // PERSON.NOTABLERELATIVES TESTS
  // ============================================
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
  // PERSON MUTATION TESTS (ADDITIONAL)
  // ============================================
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

  // ============================================
  // PERSON QUERY TESTS (ADDITIONAL)
  // ============================================
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
});
