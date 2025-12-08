/**
 * Theme Presets using Open Color palette
 * @see https://yeun.github.io/open-color/
 *
 * MIT Licensed - colors embedded directly as hex values.
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  // Hex color values
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    accent: string;
  };
  // Preview swatches (same as colors for consistency)
  preview: string[];
}

// Curated selection of 8 themes - one best option per category
export const themePresets: ThemePreset[] = [
  // === Nature (Green) ===
  {
    id: 'forest',
    name: 'Forest',
    description: 'Classic woodland green',
    colors: {
      primary: '#37b24d',
      primaryDark: '#2b8a3e',
      secondary: '#12b886',
      accent: '#82c91e',
    },
    preview: ['#37b24d', '#2b8a3e', '#12b886'],
  },
  // === Water (Blue) ===
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calming sea blue',
    colors: {
      primary: '#228be6',
      primaryDark: '#1971c2',
      secondary: '#15aabf',
      accent: '#5c7cfa',
    },
    preview: ['#228be6', '#1971c2', '#15aabf'],
  },
  // === Teal ===
  {
    id: 'teal',
    name: 'Teal',
    description: 'Modern teal',
    colors: {
      primary: '#12b886',
      primaryDark: '#099268',
      secondary: '#15aabf',
      accent: '#40c057',
    },
    preview: ['#12b886', '#099268', '#15aabf'],
  },
  // === Warm (Orange) ===
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange',
    colors: {
      primary: '#fd7e14',
      primaryDark: '#e8590c',
      secondary: '#fa5252',
      accent: '#fcc419',
    },
    preview: ['#fd7e14', '#e8590c', '#fa5252'],
  },
  // === Royal (Purple) ===
  {
    id: 'royal',
    name: 'Royal',
    description: 'Regal purple',
    colors: {
      primary: '#7950f2',
      primaryDark: '#6741d9',
      secondary: '#be4bdb',
      accent: '#5c7cfa',
    },
    preview: ['#7950f2', '#6741d9', '#be4bdb'],
  },
  // === Rose (Pink) ===
  {
    id: 'rose',
    name: 'Rose',
    description: 'Soft pink',
    colors: {
      primary: '#e64980',
      primaryDark: '#c2255c',
      secondary: '#cc5de8',
      accent: '#ff6b6b',
    },
    preview: ['#e64980', '#c2255c', '#cc5de8'],
  },
  // === Earth (Brown) ===
  {
    id: 'espresso',
    name: 'Espresso',
    description: 'Rich brown',
    colors: {
      primary: '#a87c56',
      primaryDark: '#825b3a',
      secondary: '#df8545',
      accent: '#ff922b',
    },
    preview: ['#a87c56', '#825b3a', '#df8545'],
  },
  // === Neutral (Gray) ===
  {
    id: 'slate',
    name: 'Slate',
    description: 'Professional gray',
    colors: {
      primary: '#495057',
      primaryDark: '#212529',
      secondary: '#228be6',
      accent: '#22b8cf',
    },
    preview: ['#495057', '#212529', '#228be6'],
  },
];

export function getPresetById(id: string): ThemePreset | undefined {
  return themePresets.find((p) => p.id === id);
}

export function getPresetByPrimaryColor(
  color: string,
): ThemePreset | undefined {
  return themePresets.find(
    (p) => p.colors.primary.toLowerCase() === color.toLowerCase(),
  );
}

export function applyThemePreset(preset: ThemePreset): void {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', preset.colors.primary);
  root.style.setProperty('--primary-dark', preset.colors.primaryDark);
  root.style.setProperty('--secondary-color', preset.colors.secondary);
  root.style.setProperty('--accent-color', preset.colors.accent);
}
