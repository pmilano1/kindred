/**
 * Settings Module Tests
 * Tests caching behavior and default values
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create mock function before vi.mock
const mockQuery = vi.fn();

vi.mock('@/lib/pool', () => ({
  pool: { query: mockQuery },
}));

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Default settings', () => {
    it('has correct default values', async () => {
      // Mock empty settings table
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const { getSettings } = await import('@/lib/settings');
      const settings = await getSettings();

      expect(settings.site_name).toBe('Family Tree');
      expect(settings.family_name).toBe('Family');
      expect(settings.theme_color).toBe('#4F46E5');
      expect(settings.require_login).toBe(true);
      expect(settings.show_living_details).toBe(false);
      expect(settings.living_cutoff_years).toBe(100);
      expect(settings.date_format).toBe('MDY');
      expect(settings.default_tree_generations).toBe(4);
      expect(settings.show_coats_of_arms).toBe(true);
    });
  });

  describe('Settings from database', () => {
    it('overrides defaults with database values', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { key: 'site_name', value: 'Milanese Family' },
          { key: 'family_name', value: 'Milanese' },
          { key: 'theme_color', value: '#2c5530' },
        ],
      });

      const { getSettings } = await import('@/lib/settings');
      const settings = await getSettings();

      expect(settings.site_name).toBe('Milanese Family');
      expect(settings.family_name).toBe('Milanese');
      expect(settings.theme_color).toBe('#2c5530');
      // Non-overridden values should stay default
      expect(settings.require_login).toBe(true);
    });

    it('parses boolean values correctly', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { key: 'require_login', value: 'false' },
          { key: 'show_living_details', value: 'true' },
          { key: 'show_coats_of_arms', value: 'false' },
        ],
      });

      const { getSettings } = await import('@/lib/settings');
      const settings = await getSettings();

      expect(settings.require_login).toBe(false);
      expect(settings.show_living_details).toBe(true);
      expect(settings.show_coats_of_arms).toBe(false);
    });

    it('parses integer values correctly', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { key: 'living_cutoff_years', value: '120' },
          { key: 'default_tree_generations', value: '6' },
        ],
      });

      const { getSettings } = await import('@/lib/settings');
      const settings = await getSettings();

      expect(settings.living_cutoff_years).toBe(120);
      expect(settings.default_tree_generations).toBe(6);
    });
  });

  describe('Date format validation', () => {
    it('accepts valid date formats', async () => {
      const formats = ['MDY', 'DMY', 'ISO'];

      for (const format of formats) {
        vi.resetModules();
        mockQuery.mockResolvedValueOnce({
          rows: [{ key: 'date_format', value: format }],
        });

        const { getSettings } = await import('@/lib/settings');
        const settings = await getSettings();

        expect(settings.date_format).toBe(format);
      }
    });
  });

  describe('formatDate', () => {
    it('formats date as MDY (US format)', async () => {
      const { formatDate } = await import('@/lib/settings');
      expect(formatDate('2024-01-15', 'MDY')).toBe('01/15/2024');
    });

    it('formats date as DMY (European format)', async () => {
      const { formatDate } = await import('@/lib/settings');
      expect(formatDate('2024-01-15', 'DMY')).toBe('15/01/2024');
    });

    it('formats date as ISO', async () => {
      const { formatDate } = await import('@/lib/settings');
      expect(formatDate('2024-01-15', 'ISO')).toBe('2024-01-15');
    });

    it('returns empty string for null date', async () => {
      const { formatDate } = await import('@/lib/settings');
      expect(formatDate(null, 'MDY')).toBe('');
    });

    it('returns original date if cannot parse', async () => {
      const { formatDate } = await import('@/lib/settings');
      expect(formatDate('invalid', 'MDY')).toBe('invalid');
    });

    it('handles single digit month/day with padding', async () => {
      const { formatDate } = await import('@/lib/settings');
      expect(formatDate('2024-1-5', 'ISO')).toBe('2024-01-05');
    });
  });

  describe('clearSettingsCache', () => {
    it('clears cache forcing a refetch', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'site_name', value: 'First Value' }],
      });

      const { getSettings, clearSettingsCache } = await import(
        '@/lib/settings'
      );
      await getSettings();

      // Clear cache
      clearSettingsCache();

      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'site_name', value: 'Second Value' }],
      });

      const settings = await getSettings();

      expect(settings.site_name).toBe('Second Value');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling', () => {
    it('returns defaults on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const { getSettings } = await import('@/lib/settings');
      const settings = await getSettings();

      expect(settings.site_name).toBe('Family Tree');
      expect(settings.theme_color).toBe('#4F46E5');
    });
  });

  describe('Research weight settings', () => {
    it('parses research weight values correctly', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { key: 'research_weight_missing_core_dates', value: '50' },
          { key: 'research_weight_missing_places', value: '25' },
          { key: 'research_weight_placeholder_parent', value: '60' },
        ],
      });

      const { getSettings } = await import('@/lib/settings');
      const settings = await getSettings();

      expect(settings.research_weight_missing_core_dates).toBe(50);
      expect(settings.research_weight_missing_places).toBe(25);
      expect(settings.research_weight_placeholder_parent).toBe(60);
    });
  });
});
