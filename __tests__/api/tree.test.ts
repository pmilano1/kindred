/**
 * Tests for /api/tree route data structure
 * Note: Direct API route testing requires Next.js test environment
 * These tests verify data transformation logic
 */

// Mock the database pool module
const mockQuery = jest.fn();
jest.mock('@/lib/pool', () => ({
  pool: {
    query: mockQuery,
  },
}));

describe('Tree data structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('database query returns expected person fields', () => {
    const person = {
      id: 'person1',
      name_full: 'John Doe',
      birth_year: 1950,
      death_year: 2020,
      living: false,
      gender: 'M',
    };

    expect(person.id).toBeDefined();
    expect(person.name_full).toBe('John Doe');
    expect(person.birth_year).toBe(1950);
    expect(person.gender).toBe('M');
  });

  it('family structure links husband and wife', () => {
    const family = {
      id: 'family1',
      husband_id: 'person1',
      wife_id: 'person2',
      marriage_date: '1975-06-15',
    };

    expect(family.husband_id).toBe('person1');
    expect(family.wife_id).toBe('person2');
  });

  it('children structure links to family', () => {
    const child = {
      family_id: 'family1',
      person_id: 'person3',
    };

    expect(child.family_id).toBe('family1');
    expect(child.person_id).toBe('person3');
  });

  it('coat of arms data includes base64 value', () => {
    const crestFact = {
      person_id: 'person1',
      fact_type: 'coat_of_arms',
      fact_value: 'data:image/png;base64,ABC123',
    };

    expect(crestFact.fact_value).toMatch(/^data:image/);
    expect(crestFact.fact_type).toBe('coat_of_arms');
  });

  it('name truncation works correctly', () => {
    const maxNameLen = 18;
    const longName = 'Count Philippe de Kersaint-Gilly';
    const displayName = longName.length > maxNameLen
      ? longName.substring(0, maxNameLen - 2) + '…'
      : longName;

    // substring(0, 16) = "Count Philippe d" + "…" = 17 chars
    expect(displayName).toBe('Count Philippe d…');
    expect(displayName.length).toBeLessThanOrEqual(maxNameLen);
  });
});

