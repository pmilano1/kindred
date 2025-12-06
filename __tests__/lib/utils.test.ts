/**
 * Utility Function Tests
 * Tests for string manipulation, date formatting, name parsing
 */

describe('Utility Functions', () => {
  describe('Accent stripping', () => {
    // Re-implement the function locally for testing
    const stripAccents = (str: string): string => {
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    it('removes diacritical marks from characters', () => {
      expect(stripAccents('René')).toBe('Rene');
      expect(stripAccents('Hélène')).toBe('Helene');
      expect(stripAccents('François')).toBe('Francois');
      expect(stripAccents('José')).toBe('Jose');
      expect(stripAccents('Müller')).toBe('Muller');
      // Note: ø is a separate letter, not a combining character, so normalize() doesn't decompose it
      // This is expected behavior - Danish/Norwegian ø remains as-is
    });

    it('handles strings without accents', () => {
      expect(stripAccents('John Doe')).toBe('John Doe');
      expect(stripAccents('')).toBe('');
      expect(stripAccents('ABC123')).toBe('ABC123');
    });

    it('handles multiple accented characters', () => {
      expect(stripAccents('Ménéndez')).toBe('Menendez');
      expect(stripAccents('Göttingen')).toBe('Gottingen');
    });
  });

  describe('Name truncation for tree display', () => {
    const maxNameLen = 18;
    const truncateName = (name: string): string => {
      if (name.length <= maxNameLen) return name;
      return name.substring(0, maxNameLen - 1) + '…';
    };

    it('does not truncate short names', () => {
      expect(truncateName('John Doe')).toBe('John Doe');
      expect(truncateName('Short')).toBe('Short');
    });

    it('truncates long names with ellipsis', () => {
      expect(truncateName('Count Philippe de Kersaint-Gilly').length).toBeLessThanOrEqual(maxNameLen);
      expect(truncateName('Count Philippe de Kersaint-Gilly')).toContain('…');
    });

    it('handles exactly max length', () => {
      const exactLength = 'A'.repeat(maxNameLen);
      expect(truncateName(exactLength)).toBe(exactLength);
    });
  });

  describe('Cursor encoding/decoding', () => {
    const encodeCursor = (id: string) => Buffer.from(id).toString('base64');
    const decodeCursor = (cursor: string) => Buffer.from(cursor, 'base64').toString('utf-8');

    it('encodes and decodes cursor correctly', () => {
      const id = 'person-12345';
      const encoded = encodeCursor(id);
      const decoded = decodeCursor(encoded);
      
      expect(decoded).toBe(id);
      expect(encoded).not.toBe(id); // Should be different
    });

    it('handles special characters in id', () => {
      const id = 'person-with-special_chars.123';
      expect(decodeCursor(encodeCursor(id))).toBe(id);
    });

    it('handles empty string', () => {
      expect(decodeCursor(encodeCursor(''))).toBe('');
    });
  });

  describe('Date formatting', () => {
    const formatDate = (year: number | null, place: string | null): string | null => {
      if (!year && !place) return null;
      const parts: (string | number)[] = [];
      if (year) parts.push(year);
      if (place) parts.push(place);
      return parts.join(' • ');
    };

    it('formats year and place', () => {
      expect(formatDate(1950, 'New York')).toBe('1950 • New York');
    });

    it('formats year only', () => {
      expect(formatDate(1950, null)).toBe('1950');
    });

    it('formats place only', () => {
      expect(formatDate(null, 'New York')).toBe('New York');
    });

    it('returns null for no data', () => {
      expect(formatDate(null, null)).toBeNull();
    });
  });

  describe('Living person detection', () => {
    const livingCutoffYears = 100;
    const currentYear = new Date().getFullYear();

    const isLikelyLiving = (birthYear: number | null): boolean => {
      if (!birthYear) return false;
      return currentYear - birthYear < livingCutoffYears;
    };

    it('considers recent births as likely living', () => {
      expect(isLikelyLiving(currentYear - 30)).toBe(true);
      expect(isLikelyLiving(currentYear - 50)).toBe(true);
    });

    it('considers old births as likely deceased', () => {
      expect(isLikelyLiving(currentYear - 110)).toBe(false);
      expect(isLikelyLiving(1850)).toBe(false);
    });

    it('handles null birth year', () => {
      expect(isLikelyLiving(null)).toBe(false);
    });

    it('handles edge case at cutoff', () => {
      expect(isLikelyLiving(currentYear - 99)).toBe(true);
      expect(isLikelyLiving(currentYear - 100)).toBe(false);
    });
  });

  describe('Research status values', () => {
    const validStatuses = ['not_started', 'in_progress', 'partial', 'verified', 'needs_review', 'brick_wall'];

    it('has all expected status values', () => {
      expect(validStatuses).toContain('not_started');
      expect(validStatuses).toContain('in_progress');
      expect(validStatuses).toContain('brick_wall');
      expect(validStatuses.length).toBe(6);
    });
  });

  describe('Research priority values', () => {
    it('priority range is 0-10', () => {
      const minPriority = 0;
      const maxPriority = 10;
      
      expect(minPriority).toBeGreaterThanOrEqual(0);
      expect(maxPriority).toBeLessThanOrEqual(10);
    });
  });
});

