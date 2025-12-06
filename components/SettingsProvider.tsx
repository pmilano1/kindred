'use client';

import { createContext, useContext, ReactNode, useCallback } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_SITE_SETTINGS } from '@/lib/graphql/queries';

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

interface SettingsContextValue {
  settings: SiteSettings;
  refetch: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  refetch: () => {},
});

export function useSettings(): SiteSettings {
  return useContext(SettingsContext).settings;
}

export function useSettingsRefetch(): () => void {
  return useContext(SettingsContext).refetch;
}

interface SettingsProviderProps {
  children: ReactNode;
  settings?: SiteSettings;
}

interface SiteSettingsQueryResult {
  siteSettings: SiteSettings;
}

export function SettingsProvider({ children, settings: initialSettings }: SettingsProviderProps) {
  // Fetch settings client-side via GraphQL
  const { data, refetch } = useQuery<SiteSettingsQueryResult>(GET_SITE_SETTINGS, {
    fetchPolicy: 'cache-and-network',
  });

  // Use GraphQL data if available, fall back to SSR initial settings, then defaults
  const settings = data?.siteSettings || initialSettings || DEFAULT_SETTINGS;

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <SettingsContext.Provider value={{ settings, refetch: handleRefetch }}>
      {children}
    </SettingsContext.Provider>
  );
}

