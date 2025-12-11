/**
 * GraphQL Resolver Tests - Family
 * Tests: Query.family, Query.families, Query.checkDuplicates, all family mutations
 */
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { Context } from '@/lib/graphql/resolvers/helpers';

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

describe('Family Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // QUERY.FAMILY TESTS
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

  // ============================================
  // QUERY.FAMILIES TESTS
  // ============================================
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

  // ============================================
  // QUERY.CHECKDUPLICATES TESTS
  // ============================================
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

  // ============================================
  // MUTATION.CREATEFAMILY TESTS
  // ============================================
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

  // ============================================
  // MUTATION.UPDATEFAMILY TESTS
  // ============================================
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

  // ============================================
  // MUTATION.DELETEFAMILY TESTS
  // ============================================
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

  // ============================================
  // MUTATION.ADDCHILDTOFAMILY TESTS
  // ============================================
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

  // ============================================
  // MUTATION.REMOVECHILDFROMFAMILY TESTS
  // ============================================
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

  // ============================================
  // MUTATION.ADDSPOUSE TESTS
  // ============================================
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

  // ============================================
  // MUTATION.REMOVESPOUSE TESTS
  // ============================================
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
  // FAMILY TYPE RESOLVER TESTS
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
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'family-1', husband_id: 'person-1', wife_id: 'person-2' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
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
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'F' }] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
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
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'F' }] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
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
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'family-1' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [{ family_id: 'family-1' }] });
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
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'family-1' }] });
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
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'family-1' }] });
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
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-spouse', name_full: 'Jane Doe', sex: 'F' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
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
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-spouse', name_full: 'Jane Doe', sex: 'F' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
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
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-child', name_full: 'Child Name' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'M' }] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-family' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
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
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-child', name_full: 'Child Name' }],
      });
      mockedQuery.mockResolvedValueOnce({ rows: [{ sex: 'F' }] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
      mockedQuery.mockResolvedValueOnce({ rows: [] });
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
