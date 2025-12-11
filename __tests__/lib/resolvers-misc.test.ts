/**
 * GraphQL Resolver Tests - Misc
 * Tests: Comments, Facts, Events, Sources, Crests, Stats
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

describe('Misc Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const editorContext = {
    user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
  };

  // ============================================
  // QUERY.STATS TESTS
  // ============================================
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

  // ============================================
  // QUERY.SURNAMECRESTS TESTS
  // ============================================
  describe('Query.surnameCrests', () => {
    it('returns all surname crests ordered by surname', async () => {
      mockedQuery.mockReset();
      const mockCrests = [
        {
          surname: 'Beauharnais',
          coat_of_arms: 'https://example.com/crest.png',
        },
        {
          surname: 'Milanese',
          coat_of_arms: 'https://example.com/milanese.png',
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockCrests });

      const result = await resolvers.Query.surnameCrests();

      expect(result).toEqual(mockCrests);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY surname'),
      );
    });
  });

  // ============================================
  // MUTATION.ADDFACT TESTS
  // ============================================
  describe('Mutation.addFact', () => {
    it('adds a fact to a person', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'fact-1',
            person_id: 'p1',
            fact_type: 'occupation',
            fact_value: 'Doctor',
          },
        ],
      });

      const result = await resolvers.Mutation.addFact(
        null,
        {
          personId: 'p1',
          input: { fact_type: 'occupation', fact_value: 'Doctor' },
        },
        editorContext,
      );

      expect(result.fact_type).toBe('occupation');
      expect(result.fact_value).toBe('Doctor');
    });
  });

  // ============================================
  // MUTATION.ADDLIFEEVENT TESTS
  // ============================================
  describe('Mutation.addLifeEvent', () => {
    it('adds a life event to a person', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'event-1',
            person_id: 'p1',
            event_type: 'graduation',
            event_date: '1970-06-15',
          },
        ],
      });

      const result = await resolvers.Mutation.addLifeEvent(
        null,
        {
          personId: 'p1',
          input: { event_type: 'graduation', event_date: '1970-06-15' },
        },
        editorContext,
      );

      expect(result.event_type).toBe('graduation');
    });
  });

  // ============================================
  // MUTATION.ADDSOURCE TESTS
  // ============================================
  describe('Mutation.addSource', () => {
    it('adds a source to a person', async () => {
      mockedQuery.mockReset();
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'src-1',
            person_id: 'p1',
            source_type: 'census',
            source_name: '1900 Census',
          },
        ],
      });

      const result = await resolvers.Mutation.addSource(
        null,
        {
          personId: 'p1',
          input: { source_type: 'census', source_name: '1900 Census' },
        },
        editorContext,
      );

      expect(result.source_type).toBe('census');
      expect(result.source_name).toBe('1900 Census');
    });
  });

  // ============================================
  // SURNAMECREST TYPE RESOLVER TESTS
  // ============================================
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
  // CREST MUTATION TESTS
  // ============================================
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
});
