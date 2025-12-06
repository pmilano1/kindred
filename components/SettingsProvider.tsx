'use client';

import { createContext, useContext, ReactNode } from 'react';

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

const SettingsContext = createContext<SiteSettings>(DEFAULT_SETTINGS);

export function useSettings() {
  return useContext(SettingsContext);
}

interface SettingsProviderProps {
  children: ReactNode;
  settings?: SiteSettings;
}

export function SettingsProvider({ children, settings }: SettingsProviderProps) {
  return (
    <SettingsContext.Provider value={settings || DEFAULT_SETTINGS}>
      {children}
    </SettingsContext.Provider>
  );
}

