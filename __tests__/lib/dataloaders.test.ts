/**
 * DataLoader Unit Tests
 * Tests batch loading functions with mocked database
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

import { createLoaders } from '@/lib/graphql/dataloaders';

const mockedQuery = mockQuery as Mock;

describe('DataLoaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLoaders', () => {
    it('creates all required loaders', () => {
      const loaders = createLoaders();

      expect(loaders.personLoader).toBeDefined();
      expect(loaders.familyLoader).toBeDefined();
      expect(loaders.childrenByFamilyLoader).toBeDefined();
      expect(loaders.familiesAsSpouseLoader).toBeDefined();
      expect(loaders.familiesAsChildLoader).toBeDefined();
      expect(loaders.lifeEventsLoader).toBeDefined();
      expect(loaders.factsLoader).toBeDefined();
      expect(loaders.sourcesLoader).toBeDefined();
      expect(loaders.mediaLoader).toBeDefined();
    });
  });

  describe('personLoader', () => {
    it('batches multiple person loads into single query', async () => {
      const mockPeople = [
        { id: 'p1', name_full: 'Person 1', description: 'Desc 1' },
        { id: 'p2', name_full: 'Person 2', description: 'Desc 2' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockPeople });

      const loaders = createLoaders();
      const results = await Promise.all([
        loaders.personLoader.load('p1'),
        loaders.personLoader.load('p2'),
      ]);

      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(results[0]?.name_full).toBe('Person 1');
      expect(results[1]?.name_full).toBe('Person 2');
    });

    it('returns null for non-existent person', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.personLoader.load('nonexistent');

      expect(result).toBeNull();
    });

    it('handles empty id array', async () => {
      const loaders = createLoaders();
      // DataLoader won't call the batch function with empty array
      // but we can verify the loader exists
      expect(loaders.personLoader).toBeDefined();
    });
  });

  describe('familyLoader', () => {
    it('loads families by id', async () => {
      const mockFamilies = [
        { id: 'f1', husband_id: 'p1', wife_id: 'p2' },
        { id: 'f2', husband_id: 'p3', wife_id: 'p4' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockFamilies });

      const loaders = createLoaders();
      const results = await Promise.all([
        loaders.familyLoader.load('f1'),
        loaders.familyLoader.load('f2'),
      ]);

      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(results[0]?.husband_id).toBe('p1');
      expect(results[1]?.husband_id).toBe('p3');
    });

    it('returns null for non-existent family', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.familyLoader.load('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('childrenByFamilyLoader', () => {
    it('loads children ids by family id', async () => {
      const mockChildren = [
        { family_id: 'f1', person_id: 'c1' },
        { family_id: 'f1', person_id: 'c2' },
        { family_id: 'f2', person_id: 'c3' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockChildren });

      const loaders = createLoaders();
      const results = await Promise.all([
        loaders.childrenByFamilyLoader.load('f1'),
        loaders.childrenByFamilyLoader.load('f2'),
      ]);

      expect(results[0]).toEqual(['c1', 'c2']);
      expect(results[1]).toEqual(['c3']);
    });

    it('returns empty array for family with no children', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.childrenByFamilyLoader.load('f1');

      expect(result).toEqual([]);
    });
  });

  describe('familiesAsSpouseLoader', () => {
    it('loads families where person is spouse', async () => {
      const mockFamilies = [
        { id: 'f1', husband_id: 'p1', wife_id: 'p2' },
        { id: 'f2', husband_id: 'p1', wife_id: 'p3' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockFamilies });

      const loaders = createLoaders();
      const result = await loaders.familiesAsSpouseLoader.load('p1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('f1');
    });

    it('returns empty array for person with no spouse families', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.familiesAsSpouseLoader.load('p1');

      expect(result).toEqual([]);
    });
  });

  describe('familiesAsChildLoader', () => {
    it('loads families where person is child', async () => {
      const mockFamilies = [
        { id: 'f1', husband_id: 'p1', wife_id: 'p2', _child_id: 'c1' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockFamilies });

      const loaders = createLoaders();
      const result = await loaders.familiesAsChildLoader.load('c1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('f1');
    });

    it('returns empty array for person with no parent families', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.familiesAsChildLoader.load('p1');

      expect(result).toEqual([]);
    });
  });

  describe('lifeEventsLoader', () => {
    it('loads life events by person id', async () => {
      const mockEvents = [
        {
          id: 'e1',
          person_id: 'p1',
          event_type: 'residence',
          event_year: 1950,
          event_place: 'New York',
        },
        {
          id: 'e2',
          person_id: 'p1',
          event_type: 'occupation',
          event_value: 'Engineer',
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockEvents });

      const loaders = createLoaders();
      const result = await loaders.lifeEventsLoader.load('p1');

      expect(result).toHaveLength(2);
      expect(result[0].event_type).toBe('residence');
      expect(result[1].event_type).toBe('occupation');
    });

    it('returns empty array for person with no events', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.lifeEventsLoader.load('p1');

      expect(result).toEqual([]);
    });
  });

  describe('factsLoader', () => {
    it('loads facts by person id', async () => {
      const mockFacts = [
        {
          id: 'f1',
          person_id: 'p1',
          fact_type: 'religion',
          fact_value: 'Catholic',
        },
        {
          id: 'f2',
          person_id: 'p1',
          fact_type: 'education',
          fact_value: 'Harvard',
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockFacts });

      const loaders = createLoaders();
      const result = await loaders.factsLoader.load('p1');

      expect(result).toHaveLength(2);
      expect(result[0].fact_type).toBe('religion');
    });

    it('returns empty array for person with no facts', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.factsLoader.load('p1');

      expect(result).toEqual([]);
    });
  });

  describe('sourcesLoader', () => {
    it('loads sources by person id', async () => {
      const mockSources = [
        {
          id: 's1',
          person_id: 'p1',
          source_type: 'census',
          source_name: '1900 Census',
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockSources });

      const loaders = createLoaders();
      const result = await loaders.sourcesLoader.load('p1');

      expect(result).toHaveLength(1);
      expect(result[0].source_type).toBe('census');
    });

    it('returns empty array for person with no sources', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.sourcesLoader.load('p1');

      expect(result).toEqual([]);
    });
  });

  describe('mediaLoader', () => {
    it('loads media by person id', async () => {
      const mockMedia = [
        {
          id: 'm1',
          person_id: 'p1',
          filename: 'photo.jpg',
          media_type: 'photo',
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockMedia });

      const loaders = createLoaders();
      const result = await loaders.mediaLoader.load('p1');

      expect(result).toHaveLength(1);
      expect(result[0].media_type).toBe('photo');
    });

    it('returns empty array for person with no media', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const loaders = createLoaders();
      const result = await loaders.mediaLoader.load('p1');

      expect(result).toEqual([]);
    });
  });

  describe('caching behavior', () => {
    it('caches results within same loader instance', async () => {
      const mockPerson = { id: 'p1', name_full: 'Person 1' };
      mockedQuery.mockResolvedValueOnce({ rows: [mockPerson] });

      const loaders = createLoaders();

      // First load
      const result1 = await loaders.personLoader.load('p1');
      // Second load - should use cache
      const result2 = await loaders.personLoader.load('p1');

      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('does not share cache between loader instances', async () => {
      const mockPerson = { id: 'p1', name_full: 'Person 1' };
      mockedQuery.mockResolvedValue({ rows: [mockPerson] });

      const loaders1 = createLoaders();
      const loaders2 = createLoaders();

      await loaders1.personLoader.load('p1');
      await loaders2.personLoader.load('p1');

      // Each loader instance makes its own query
      expect(mockedQuery).toHaveBeenCalledTimes(2);
    });
  });
});
