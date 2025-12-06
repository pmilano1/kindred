/**
 * Theme Presets using Open Props
 * @see https://open-props.style/
 *
 * Open Props provides CSS custom properties loaded via CDN.
 * MIT Licensed - no account required.
 *
 * CDN Import in globals.css: @import "https://unpkg.com/open-props";
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  // CSS variable names from Open Props (e.g., '--green-7')
  cssVars: {
    primary: string;
    primaryDark: string;
    secondary: string;
    accent: string;
  };
  // Hex values for preview swatches (Open Props values)
  preview: string[];
}

export const themePresets: ThemePreset[] = [
  {
    id: 'forest',
    name: '🌲 Forest',
    description: 'Deep greens inspired by nature',
    cssVars: {
      primary: 'var(--green-7)',
      primaryDark: 'var(--green-9)',
      secondary: 'var(--teal-6)',
      accent: 'var(--lime-6)',
    },
    preview: ['#37b24d', '#2b8a3e', '#12b886', '#82c91e'],
  },
  {
    id: 'ocean',
    name: '🌊 Ocean',
    description: 'Calming blues and teals',
    cssVars: {
      primary: 'var(--blue-6)',
      primaryDark: 'var(--blue-8)',
      secondary: 'var(--cyan-6)',
      accent: 'var(--indigo-5)',
    },
    preview: ['#228be6', '#1971c2', '#15aabf', '#5c7cfa'],
  },
  {
    id: 'sunset',
    name: '🌅 Sunset',
    description: 'Warm oranges and reds',
    cssVars: {
      primary: 'var(--orange-6)',
      primaryDark: 'var(--orange-8)',
      secondary: 'var(--red-6)',
      accent: 'var(--yellow-5)',
    },
    preview: ['#fd7e14', '#e8590c', '#fa5252', '#fcc419'],
  },
  {
    id: 'royal',
    name: '👑 Royal',
    description: 'Elegant purples and violets',
    cssVars: {
      primary: 'var(--violet-6)',
      primaryDark: 'var(--violet-8)',
      secondary: 'var(--grape-6)',
      accent: 'var(--indigo-5)',
    },
    preview: ['#7950f2', '#6741d9', '#ae3ec9', '#5c7cfa'],
  },
  {
    id: 'rose',
    name: '🌸 Rose',
    description: 'Soft pinks and magentas',
    cssVars: {
      primary: 'var(--pink-6)',
      primaryDark: 'var(--pink-8)',
      secondary: 'var(--grape-6)',
      accent: 'var(--red-5)',
    },
    preview: ['#e64980', '#c2255c', '#ae3ec9', '#ff6b6b'],
  },
  {
    id: 'slate',
    name: '🪨 Slate',
    description: 'Professional grays',
    cssVars: {
      primary: 'var(--gray-7)',
      primaryDark: 'var(--gray-9)',
      secondary: 'var(--blue-6)',
      accent: 'var(--cyan-5)',
    },
    preview: ['#495057', '#212529', '#228be6', '#22b8cf'],
  },
  {
    id: 'indigo',
    name: '💜 Indigo',
    description: 'Modern indigo tones',
    cssVars: {
      primary: 'var(--indigo-6)',
      primaryDark: 'var(--indigo-8)',
      secondary: 'var(--violet-5)',
      accent: 'var(--blue-5)',
    },
    preview: ['#4c6ef5', '#3b5bdb', '#845ef7', '#339af0'],
  },
  {
    id: 'teal',
    name: '🧊 Teal',
    description: 'Fresh teals and cyans',
    cssVars: {
      primary: 'var(--teal-6)',
      primaryDark: 'var(--teal-8)',
      secondary: 'var(--cyan-6)',
      accent: 'var(--green-6)',
    },
    preview: ['#12b886', '#099268', '#15aabf', '#40c057'],
  },
];

export function getPresetById(id: string): ThemePreset | undefined {
  return themePresets.find(p => p.id === id);
}

export function applyThemePreset(preset: ThemePreset): void {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', preset.cssVars.primary);
  root.style.setProperty('--primary-dark', preset.cssVars.primaryDark);
  root.style.setProperty('--secondary-color', preset.cssVars.secondary);
  root.style.setProperty('--accent-color', preset.cssVars.accent);
}

