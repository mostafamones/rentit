import { useColorScheme } from 'react-native'

const light = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  ink: '#152236',
  secondary: '#54667D',
  tertiary: '#8795A8',
  separator: '#DDE3EA',
  fill: '#E9EEF4',
  accent: '#174D9D',
  onAccent: '#FFFFFF',
  accentSoft: '#E3ECF8',
  green: '#1E7A46',
  greenSoft: '#E2F2E8',
  amber: '#8A5A00',
  amberSoft: '#FBF0D9',
  red: '#B3261E',
  redSoft: '#FBE4E2',
}

const dark: typeof light = {
  background: '#0E1520',
  card: '#18212E',
  ink: '#EEF2F7',
  secondary: '#A3B0C2',
  tertiary: '#748296',
  separator: '#2A3646',
  fill: '#232E3D',
  accent: '#6E9FE6',
  onAccent: '#0E1520',
  accentSoft: '#1D2C44',
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
