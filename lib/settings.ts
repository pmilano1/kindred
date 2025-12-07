import { pool } from './pool';

export interface SiteSettings {
  site_name: string;
  family_name: string;
  site_tagline: string;
  theme_color: string;
  logo_url: string | null;
  require_login: boolean;
  show_living_details: boolean;
  living_cutoff_years: number;
  date_format: 'MDY' | 'DMY' | 'ISO';
  default_tree_generations: number;
  show_coats_of_arms: boolean;
  admin_email: string | null;
  footer_text: string | null;
}

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'Family Tree',
  family_name: 'Family',
  site_tagline: 'Preserving our heritage',
  theme_color: '#4F46E5',
  logo_url: null,
  require_login: true,
  show_living_details: false,
  living_cutoff_years: 100,
  date_format: 'MDY',
  default_tree_generations: 4,
  show_coats_of_arms: true,
  admin_email: null,
  footer_text: null,
};

// Cache settings for 5 minutes
let settingsCache: { settings: SiteSettings; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSettings(): Promise<SiteSettings> {
  // Return cached if valid
  if (settingsCache && Date.now() - settingsCache.timestamp < CACHE_TTL) {
    return settingsCache.settings;
  }

  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const dbSettings: Record<string, string> = {};
    for (const row of result.rows) {
      dbSettings[row.key] = row.value;
    }

    const settings: SiteSettings = {
      site_name: dbSettings.site_name || DEFAULT_SETTINGS.site_name,
      family_name: dbSettings.family_name || DEFAULT_SETTINGS.family_name,
      site_tagline: dbSettings.site_tagline || DEFAULT_SETTINGS.site_tagline,
      theme_color: dbSettings.theme_color || DEFAULT_SETTINGS.theme_color,
      logo_url: dbSettings.logo_url || null,
      require_login: dbSettings.require_login !== 'false',
      show_living_details: dbSettings.show_living_details === 'true',
      living_cutoff_years: parseInt(dbSettings.living_cutoff_years) || DEFAULT_SETTINGS.living_cutoff_years,
      date_format: (dbSettings.date_format as SiteSettings['date_format']) || DEFAULT_SETTINGS.date_format,
      default_tree_generations: parseInt(dbSettings.default_tree_generations) || DEFAULT_SETTINGS.default_tree_generations,
      show_coats_of_arms: dbSettings.show_coats_of_arms !== 'false',
      admin_email: dbSettings.admin_email || null,
      footer_text: dbSettings.footer_text || null,
    };

    settingsCache = { settings, timestamp: Date.now() };
    return settings;
  } catch (error) {
    // During build/SSG, database isn't available - this is expected
    const isConnectionError = error instanceof Error &&
      ('code' in error && (error as NodeJS.ErrnoException).code === 'ECONNREFUSED');
    if (!isConnectionError) {
      console.error('Failed to load settings, using defaults:', error);
    }
    return DEFAULT_SETTINGS;
  }
}

// Clear cache when settings are updated
export function clearSettingsCache() {
  settingsCache = null;
}

// Format a date according to site settings
export function formatDate(date: string | null, format: SiteSettings['date_format']): string {
  if (!date) return '';
  
  // Try to parse the date
  const parts = date.match(/(\d+)/g);
  if (!parts || parts.length < 3) return date;
  
  const [year, month, day] = parts.length === 3 && parts[0].length === 4 
    ? parts 
    : [parts[2], parts[0], parts[1]];
  
  switch (format) {
    case 'DMY': return `${day}/${month}/${year}`;
    case 'ISO': return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    case 'MDY':
    default: return `${month}/${day}/${year}`;
  }
}

