import { useColorScheme } from 'react-native';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentText: string;
  danger: string;
  link: string;
  warning: string;
  warningBg: string;
}

const light: ThemeColors = {
  background: '#ffffff',
  surface: '#F8F8F8',
  surfaceAlt: '#F1F1F1',
  text: '#111111',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#DDDDDD',
  accent: '#111111',
  accentText: '#ffffff',
  danger: '#DC2626',
  link: '#4F46E5',
  warning: '#92400E',
  warningBg: '#FEF3C7',
};

const dark: ThemeColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  text: '#F2F2F7',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  border: '#3A3A3C',
  accent: '#F2F2F7',
  accentText: '#000000',
  danger: '#F87171',
  link: '#818CF8',
  warning: '#FBBF24',
  warningBg: '#3F2E0A',
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
