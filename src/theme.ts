import { useColorScheme } from 'react-native'

// Neutral grayscale chrome; photos carry the colour. Tints only for status.
const light = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  ink: '#111111',
  secondary: '#6C6C70',
  tertiary: '#A1A1A6',
  separator: '#E0E0E3',
  fill: '#E8E8ED',
  accent: '#111111',
  onAccent: '#FFFFFF',
  accentSoft: '#E8E8ED',
  scrim: 'rgba(255,255,255,0.82)',
  green: '#1E7A46',
  greenSoft: '#E2F2E8',
  amber: '#8A5A00',
  amberSoft: '#FBF0D9',
  red: '#B3261E',
  redSoft: '#FBE4E2',
}

const dark: typeof light = {
  background: '#000000',
  card: '#1C1C1E',
  ink: '#F5F5F7',
  secondary: '#A1A1A6',
  tertiary: '#6C6C70',
  separator: '#2C2C2E',
  fill: '#2C2C2E',
  accent: '#F5F5F7',
  onAccent: '#000000',
  accentSoft: '#2C2C2E',
  scrim: 'rgba(28,28,30,0.82)',
  green: '#6FCF97',
  greenSoft: '#173226',
  amber: '#F2C063',
  amberSoft: '#3A2E14',
  red: '#F2918A',
  redSoft: '#3D1E1C',
}

export type Colors = typeof light
export const useColors = () => (useColorScheme() === 'dark' ? dark : light)

// System font throughout; sizes follow the platform text styles.
export const type = {
  title: { fontSize: 22, fontWeight: '700' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16 },
  callout: { fontSize: 15 },
  subheadline: { fontSize: 14 },
  footnote: { fontSize: 13 },
  caption: { fontSize: 12 },
  price: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
} as const
