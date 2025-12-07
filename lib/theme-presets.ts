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

export const themePresets: ThemePreset[] = [
  // === Nature ===
  {
    id: 'forest',
    name: '🌲 Forest',
    description: 'Deep greens inspired by woodland',
    colors: {
      primary: '#37b24d',
      primaryDark: '#2b8a3e',
      secondary: '#12b886',
      accent: '#82c91e',
    },
    preview: ['#37b24d', '#2b8a3e', '#12b886', '#82c91e'],
  },
  {
    id: 'jungle',
    name: '🌴 Jungle',
    description: 'Lush tropical greens',
    colors: {
      primary: '#40c057',
      primaryDark: '#2f9e44',
      secondary: '#51cf66',
      accent: '#94d82d',
    },
    preview: ['#40c057', '#2f9e44', '#51cf66', '#94d82d'],
  },
  {
    id: 'lime',
    name: '🍋 Citrus',
    description: 'Bright and energetic lime',
    colors: {
      primary: '#82c91e',
      primaryDark: '#66a80f',
      secondary: '#40c057',
      accent: '#fcc419',
    },
    preview: ['#82c91e', '#66a80f', '#40c057', '#fcc419'],
  },
  // === Water ===
  {
    id: 'ocean',
    name: '🌊 Ocean',
    description: 'Calming blues of the deep sea',
    colors: {
      primary: '#228be6',
      primaryDark: '#1971c2',
      secondary: '#15aabf',
      accent: '#5c7cfa',
    },
    preview: ['#228be6', '#1971c2', '#15aabf', '#5c7cfa'],
  },
  {
    id: 'teal',
    name: '🧊 Glacier',
    description: 'Cool teals and aqua',
    colors: {
      primary: '#12b886',
      primaryDark: '#099268',
      secondary: '#15aabf',
      accent: '#40c057',
    },
    preview: ['#12b886', '#099268', '#15aabf', '#40c057'],
  },
  {
    id: 'cyan',
    name: '💎 Aquamarine',
    description: 'Crystalline cyan waters',
    colors: {
      primary: '#15aabf',
      primaryDark: '#0c8599',
      secondary: '#12b886',
      accent: '#339af0',
    },
    preview: ['#15aabf', '#0c8599', '#12b886', '#339af0'],
  },
  // === Warm ===
  {
    id: 'sunset',
    name: '🌅 Sunset',
    description: 'Warm oranges of dusk',
    colors: {
      primary: '#fd7e14',
      primaryDark: '#e8590c',
      secondary: '#fa5252',
      accent: '#fcc419',
    },
    preview: ['#fd7e14', '#e8590c', '#fa5252', '#fcc419'],
  },
  {
    id: 'cherry',
    name: '🍒 Cherry',
    description: 'Bold and vibrant reds',
    colors: {
      primary: '#fa5252',
      primaryDark: '#e03131',
      secondary: '#fd7e14',
      accent: '#f06595',
    },
    preview: ['#fa5252', '#e03131', '#fd7e14', '#f06595'],
  },
  {
    id: 'sunshine',
    name: '☀️ Sunshine',
    description: 'Bright golden yellows',
    colors: {
      primary: '#fab005',
      primaryDark: '#f08c00',
      secondary: '#ff922b',
      accent: '#94d82d',
    },
    preview: ['#fab005', '#f08c00', '#ff922b', '#94d82d'],
  },
  // === Royal ===
  {
    id: 'royal',
    name: '👑 Royal',
    description: 'Regal purples and violets',
    colors: {
      primary: '#7950f2',
      primaryDark: '#6741d9',
      secondary: '#be4bdb',
      accent: '#5c7cfa',
    },
    preview: ['#7950f2', '#6741d9', '#be4bdb', '#5c7cfa'],
  },
  {
    id: 'amethyst',
    name: '🔮 Amethyst',
    description: 'Mystical purple hues',
    colors: {
      primary: '#be4bdb',
      primaryDark: '#9c36b5',
      secondary: '#7950f2',
      accent: '#f06595',
    },
    preview: ['#be4bdb', '#9c36b5', '#7950f2', '#f06595'],
  },
  {
    id: 'indigo',
    name: '🌌 Midnight',
    description: 'Deep indigo night sky',
    colors: {
      primary: '#4c6ef5',
      primaryDark: '#3b5bdb',
      secondary: '#845ef7',
      accent: '#339af0',
    },
    preview: ['#4c6ef5', '#3b5bdb', '#845ef7', '#339af0'],
  },
  // === Romantic ===
  {
    id: 'rose',
    name: '🌸 Rose',
    description: 'Soft romantic pinks',
    colors: {
      primary: '#e64980',
      primaryDark: '#c2255c',
      secondary: '#cc5de8',
      accent: '#ff6b6b',
    },
    preview: ['#e64980', '#c2255c', '#cc5de8', '#ff6b6b'],
  },
  // === Earth Tones ===
  {
    id: 'espresso',
    name: '☕ Espresso',
    description: 'Rich coffee browns',
    colors: {
      primary: '#a87c56',
      primaryDark: '#825b3a',
      secondary: '#df8545',
      accent: '#ff922b',
    },
    preview: ['#a87c56', '#825b3a', '#df8545', '#ff922b'],
  },
  {
    id: 'chocolate',
    name: '🍫 Chocolate',
    description: 'Warm cocoa tones',
    colors: {
      primary: '#d46e25',
      primaryDark: '#a45117',
      secondary: '#b78f6d',
      accent: '#ffa94d',
    },
    preview: ['#d46e25', '#a45117', '#b78f6d', '#ffa94d'],
  },
  {
    id: 'desert',
    name: '🏜️ Desert',
    description: 'Sandy warm neutrals',
    colors: {
      primary: '#867c65',
      primaryDark: '#5f5746',
      secondary: '#b78f6d',
      accent: '#ff922b',
    },
    preview: ['#867c65', '#5f5746', '#b78f6d', '#ff922b'],
  },
  {
    id: 'olive',
    name: '🫒 Olive',
    description: 'Military-inspired greens',
    colors: {
      primary: '#808000',
      primaryDark: '#556b2f',
      secondary: '#6b8e23',
      accent: '#b78f6d',
    },
    preview: ['#808000', '#556b2f', '#6b8e23', '#b78f6d'],
  },
  // === Neutral ===
  {
    id: 'slate',
    name: '🪨 Slate',
    description: 'Professional cool grays',
    colors: {
      primary: '#495057',
      primaryDark: '#212529',
      secondary: '#228be6',
      accent: '#22b8cf',
    },
    preview: ['#495057', '#212529', '#228be6', '#22b8cf'],
  },
  {
    id: 'stone',
    name: '⚪ Stone',
    description: 'Clean neutral stone',
    colors: {
      primary: '#7e8282',
      primaryDark: '#50514f',
      secondary: '#12b886',
      accent: '#339af0',
    },
    preview: ['#7e8282', '#50514f', '#12b886', '#339af0'],
  },
];

export function getPresetById(id: string): ThemePreset | undefined {
  return themePresets.find(p => p.id === id);
}

export function getPresetByPrimaryColor(color: string): ThemePreset | undefined {
  return themePresets.find(p => p.colors.primary.toLowerCase() === color.toLowerCase());
}

export function applyThemePreset(preset: ThemePreset): void {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', preset.colors.primary);
  root.style.setProperty('--primary-dark', preset.colors.primaryDark);
  root.style.setProperty('--secondary-color', preset.colors.secondary);
  root.style.setProperty('--accent-color', preset.colors.accent);
}

