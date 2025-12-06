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
  // === Nature ===
  {
    id: 'forest',
    name: '🌲 Forest',
    description: 'Deep greens inspired by woodland',
    cssVars: {
      primary: 'var(--green-7)',
      primaryDark: 'var(--green-9)',
      secondary: 'var(--teal-6)',
      accent: 'var(--lime-6)',
    },
    preview: ['#37b24d', '#2b8a3e', '#12b886', '#82c91e'],
  },
  {
    id: 'jungle',
    name: '🌴 Jungle',
    description: 'Lush tropical greens',
    cssVars: {
      primary: 'var(--jungle-6)',
      primaryDark: 'var(--jungle-9)',
      secondary: 'var(--green-6)',
      accent: 'var(--lime-5)',
    },
    preview: ['#9bbb36', '#7a9908', '#40c057', '#94d82d'],
  },
  {
    id: 'lime',
    name: '🍋 Citrus',
    description: 'Bright and energetic lime',
    cssVars: {
      primary: 'var(--lime-6)',
      primaryDark: 'var(--lime-8)',
      secondary: 'var(--green-6)',
      accent: 'var(--yellow-5)',
    },
    preview: ['#82c91e', '#66a80f', '#40c057', '#fcc419'],
  },
  // === Water ===
  {
    id: 'ocean',
    name: '🌊 Ocean',
    description: 'Calming blues of the deep sea',
    cssVars: {
      primary: 'var(--blue-6)',
      primaryDark: 'var(--blue-8)',
      secondary: 'var(--cyan-6)',
      accent: 'var(--indigo-5)',
    },
    preview: ['#228be6', '#1971c2', '#15aabf', '#5c7cfa'],
  },
  {
    id: 'teal',
    name: '🧊 Glacier',
    description: 'Cool teals and aqua',
    cssVars: {
      primary: 'var(--teal-6)',
      primaryDark: 'var(--teal-8)',
      secondary: 'var(--cyan-6)',
      accent: 'var(--green-6)',
    },
    preview: ['#12b886', '#099268', '#15aabf', '#40c057'],
  },
  {
    id: 'cyan',
    name: '💎 Aquamarine',
    description: 'Crystalline cyan waters',
    cssVars: {
      primary: 'var(--cyan-6)',
      primaryDark: 'var(--cyan-8)',
      secondary: 'var(--teal-6)',
      accent: 'var(--blue-5)',
    },
    preview: ['#15aabf', '#0c8599', '#12b886', '#339af0'],
  },
  // === Warm ===
  {
    id: 'sunset',
    name: '🌅 Sunset',
    description: 'Warm oranges of dusk',
    cssVars: {
      primary: 'var(--orange-6)',
      primaryDark: 'var(--orange-8)',
      secondary: 'var(--red-6)',
      accent: 'var(--yellow-5)',
    },
    preview: ['#fd7e14', '#e8590c', '#fa5252', '#fcc419'],
  },
  {
    id: 'cherry',
    name: '🍒 Cherry',
    description: 'Bold and vibrant reds',
    cssVars: {
      primary: 'var(--red-6)',
      primaryDark: 'var(--red-8)',
      secondary: 'var(--orange-6)',
      accent: 'var(--pink-5)',
    },
    preview: ['#fa5252', '#e03131', '#fd7e14', '#f06595'],
  },
  {
    id: 'sunshine',
    name: '☀️ Sunshine',
    description: 'Bright golden yellows',
    cssVars: {
      primary: 'var(--yellow-6)',
      primaryDark: 'var(--yellow-8)',
      secondary: 'var(--orange-5)',
      accent: 'var(--lime-5)',
    },
    preview: ['#fab005', '#f08c00', '#ff922b', '#94d82d'],
  },
  // === Royal ===
  {
    id: 'royal',
    name: '👑 Royal',
    description: 'Regal purples and violets',
    cssVars: {
      primary: 'var(--violet-6)',
      primaryDark: 'var(--violet-8)',
      secondary: 'var(--purple-6)',
      accent: 'var(--indigo-5)',
    },
    preview: ['#7950f2', '#6741d9', '#be4bdb', '#5c7cfa'],
  },
  {
    id: 'amethyst',
    name: '🔮 Amethyst',
    description: 'Mystical purple hues',
    cssVars: {
      primary: 'var(--purple-6)',
      primaryDark: 'var(--purple-8)',
      secondary: 'var(--violet-6)',
      accent: 'var(--pink-5)',
    },
    preview: ['#be4bdb', '#9c36b5', '#7950f2', '#f06595'],
  },
  {
    id: 'indigo',
    name: '🌌 Midnight',
    description: 'Deep indigo night sky',
    cssVars: {
      primary: 'var(--indigo-6)',
      primaryDark: 'var(--indigo-8)',
      secondary: 'var(--violet-5)',
      accent: 'var(--blue-5)',
    },
    preview: ['#4c6ef5', '#3b5bdb', '#845ef7', '#339af0'],
  },
  // === Romantic ===
  {
    id: 'rose',
    name: '🌸 Rose',
    description: 'Soft romantic pinks',
    cssVars: {
      primary: 'var(--pink-6)',
      primaryDark: 'var(--pink-8)',
      secondary: 'var(--purple-5)',
      accent: 'var(--red-5)',
    },
    preview: ['#e64980', '#c2255c', '#cc5de8', '#ff6b6b'],
  },
  // === Earth Tones ===
  {
    id: 'espresso',
    name: '☕ Espresso',
    description: 'Rich coffee browns',
    cssVars: {
      primary: 'var(--brown-6)',
      primaryDark: 'var(--brown-8)',
      secondary: 'var(--choco-5)',
      accent: 'var(--orange-5)',
    },
    preview: ['#a87c56', '#825b3a', '#df8545', '#ff922b'],
  },
  {
    id: 'chocolate',
    name: '🍫 Chocolate',
    description: 'Warm cocoa tones',
    cssVars: {
      primary: 'var(--choco-6)',
      primaryDark: 'var(--choco-8)',
      secondary: 'var(--brown-5)',
      accent: 'var(--orange-4)',
    },
    preview: ['#d46e25', '#a45117', '#b78f6d', '#ffa94d'],
  },
  {
    id: 'desert',
    name: '🏜️ Desert',
    description: 'Sandy warm neutrals',
    cssVars: {
      primary: 'var(--sand-6)',
      primaryDark: 'var(--sand-8)',
      secondary: 'var(--brown-5)',
      accent: 'var(--orange-5)',
    },
    preview: ['#867c65', '#5f5746', '#b78f6d', '#ff922b'],
  },
  {
    id: 'olive',
    name: '🫒 Olive',
    description: 'Military-inspired camo greens',
    cssVars: {
      primary: 'var(--camo-6)',
      primaryDark: 'var(--camo-8)',
      secondary: 'var(--jungle-6)',
      accent: 'var(--brown-5)',
    },
    preview: ['#999621', '#7e7416', '#9bbb36', '#b78f6d'],
  },
  // === Neutral ===
  {
    id: 'slate',
    name: '🪨 Slate',
    description: 'Professional cool grays',
    cssVars: {
      primary: 'var(--gray-7)',
      primaryDark: 'var(--gray-9)',
      secondary: 'var(--blue-6)',
      accent: 'var(--cyan-5)',
    },
    preview: ['#495057', '#212529', '#228be6', '#22b8cf'],
  },
  {
    id: 'stone',
    name: '⚪ Stone',
    description: 'Clean neutral stone',
    cssVars: {
      primary: 'var(--stone-7)',
      primaryDark: 'var(--stone-9)',
      secondary: 'var(--teal-6)',
      accent: 'var(--blue-5)',
    },
    preview: ['#7e8282', '#50514f', '#12b886', '#339af0'],
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

