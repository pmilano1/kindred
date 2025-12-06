/**
 * Theme Presets using Open Color palette
 * @see https://yeun.github.io/open-color/
 * 
 * Open Color is an open-source color scheme optimized for UI.
 * MIT Licensed - no account required.
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;      // Main brand color (buttons, links)
    primaryDark: string;  // Darker variant (hover states, sidebar)
    secondary: string;    // Accent color (highlights)
    accent: string;       // Additional accent
  };
  preview: string[];      // Array of colors for preview swatches
}

// Open Color palette - https://yeun.github.io/open-color/
const openColor = {
  gray: { 7: '#495057', 8: '#343a40', 9: '#212529' },
  red: { 6: '#fa5252', 7: '#f03e3e', 8: '#e03131' },
  pink: { 5: '#f06595', 6: '#e64980', 7: '#d6336c' },
  grape: { 6: '#ae3ec9', 7: '#9c36b5', 8: '#862e9c' },
  violet: { 5: '#845ef7', 6: '#7950f2', 7: '#7048e8' },
  indigo: { 5: '#5c7cfa', 6: '#4c6ef5', 7: '#4263eb' },
  blue: { 5: '#339af0', 6: '#228be6', 7: '#1c7ed6' },
  cyan: { 5: '#22b8cf', 6: '#15aabf', 7: '#1098ad' },
  teal: { 5: '#20c997', 6: '#12b886', 7: '#0ca678' },
  green: { 6: '#40c057', 7: '#37b24d', 8: '#2f9e44' },
  lime: { 6: '#82c91e', 7: '#74b816', 8: '#66a80f' },
  yellow: { 5: '#fcc419', 6: '#fab005', 7: '#f59f00' },
  orange: { 5: '#ff922b', 6: '#fd7e14', 7: '#f76707' },
};

export const themePresets: ThemePreset[] = [
  {
    id: 'forest',
    name: '🌲 Forest',
    description: 'Deep greens inspired by nature',
    colors: {
      primary: openColor.green[7],
      primaryDark: openColor.green[8],
      secondary: openColor.teal[6],
      accent: openColor.lime[6],
    },
    preview: [openColor.green[7], openColor.green[8], openColor.teal[6], openColor.lime[6]],
  },
  {
    id: 'ocean',
    name: '🌊 Ocean',
    description: 'Calming blues and teals',
    colors: {
      primary: openColor.blue[6],
      primaryDark: openColor.blue[7],
      secondary: openColor.cyan[6],
      accent: openColor.indigo[5],
    },
    preview: [openColor.blue[6], openColor.blue[7], openColor.cyan[6], openColor.indigo[5]],
  },
  {
    id: 'sunset',
    name: '🌅 Sunset',
    description: 'Warm oranges and reds',
    colors: {
      primary: openColor.orange[6],
      primaryDark: openColor.orange[7],
      secondary: openColor.red[6],
      accent: openColor.yellow[5],
    },
    preview: [openColor.orange[6], openColor.orange[7], openColor.red[6], openColor.yellow[5]],
  },
  {
    id: 'royal',
    name: '👑 Royal',
    description: 'Elegant purples and violets',
    colors: {
      primary: openColor.violet[6],
      primaryDark: openColor.violet[7],
      secondary: openColor.grape[6],
      accent: openColor.indigo[5],
    },
    preview: [openColor.violet[6], openColor.violet[7], openColor.grape[6], openColor.indigo[5]],
  },
  {
    id: 'rose',
    name: '🌸 Rose',
    description: 'Soft pinks and magentas',
    colors: {
      primary: openColor.pink[6],
      primaryDark: openColor.pink[7],
      secondary: openColor.grape[6],
      accent: openColor.red[6],
    },
    preview: [openColor.pink[6], openColor.pink[7], openColor.grape[6], openColor.red[6]],
  },
  {
    id: 'slate',
    name: '🪨 Slate',
    description: 'Professional grays',
    colors: {
      primary: openColor.gray[7],
      primaryDark: openColor.gray[8],
      secondary: openColor.blue[6],
      accent: openColor.cyan[5],
    },
    preview: [openColor.gray[7], openColor.gray[8], openColor.blue[6], openColor.cyan[5]],
  },
  {
    id: 'indigo',
    name: '💜 Indigo',
    description: 'Modern indigo tones',
    colors: {
      primary: openColor.indigo[6],
      primaryDark: openColor.indigo[7],
      secondary: openColor.violet[5],
      accent: openColor.blue[5],
    },
    preview: [openColor.indigo[6], openColor.indigo[7], openColor.violet[5], openColor.blue[5]],
  },
  {
    id: 'teal',
    name: '🧊 Teal',
    description: 'Fresh teals and cyans',
    colors: {
      primary: openColor.teal[6],
      primaryDark: openColor.teal[7],
      secondary: openColor.cyan[6],
      accent: openColor.green[6],
    },
    preview: [openColor.teal[6], openColor.teal[7], openColor.cyan[6], openColor.green[6]],
  },
];

export function getPresetById(id: string): ThemePreset | undefined {
  return themePresets.find(p => p.id === id);
}

export function applyThemeColors(colors: ThemePreset['colors']): void {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', colors.primary);
  root.style.setProperty('--primary-dark', colors.primaryDark);
  root.style.setProperty('--secondary-color', colors.secondary);
  root.style.setProperty('--accent-color', colors.accent);
}

