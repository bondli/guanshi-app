import { useColorScheme } from 'react-native'
import { useApp } from '@/src/lib/store'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface Palette {
  bg: string
  surface: string
  surface2: string
  fg: string
  muted: string
  muted2: string
  border: string
  borderStrong: string
  brand: string
  brand2: string
  brandSoft: string
  onBrand: string
  ok: string
  okSoft: string
  warn: string
  warnSoft: string
  danger: string
  dangerSoft: string
  seg: string
  tabbar: string
  heroTop: string
  heroBottom: string
  heroText: string
  heroMuted: string
  ringTrack: string
  ringBar: string
  overlay: string
}

export const lightPalette: Palette = {
  bg: '#f4f2ee',
  surface: '#ffffff',
  surface2: '#faf9f6',
  fg: '#18181b',
  muted: '#71717a',
  muted2: '#a1a1aa',
  border: '#e8e5df',
  borderStrong: '#d9d5cd',
  brand: '#c9522a',
  brand2: '#942c0f',
  brandSoft: '#faede7',
  onBrand: '#fffcf8',
  ok: '#15803d',
  okSoft: '#e9f5ec',
  warn: '#b45309',
  warnSoft: '#fef3c7',
  danger: '#b42318',
  dangerSoft: '#fdecea',
  seg: '#e9e7e2',
  tabbar: 'rgba(255,255,255,0.96)',
  heroTop: '#2f1c15',
  heroBottom: '#1a110d',
  heroText: '#f7f3ef',
  heroMuted: 'rgba(247,243,239,0.62)',
  ringTrack: 'rgba(255,255,255,0.16)',
  ringBar: '#f08a59',
  overlay: 'rgba(20,20,22,0.42)',
}

export const darkPalette: Palette = {
  bg: '#131210',
  surface: '#1c1a16',
  surface2: '#24211a',
  fg: '#f4f1e9',
  muted: '#a49d8f',
  muted2: '#756f63',
  border: '#2f2b23',
  borderStrong: '#443d30',
  brand: '#f18d5f',
  brand2: '#ffb08a',
  brandSoft: 'rgba(241,141,95,0.14)',
  onBrand: '#1a120d',
  ok: '#5ecf8c',
  okSoft: '#15301f',
  warn: '#f0b44c',
  warnSoft: '#3a2b12',
  danger: '#f08a7e',
  dangerSoft: '#3a1c18',
  seg: '#2a251d',
  tabbar: 'rgba(28,26,22,0.96)',
  heroTop: '#241612',
  heroBottom: '#120b08',
  heroText: '#f7f3ef',
  heroMuted: 'rgba(247,243,239,0.58)',
  ringTrack: 'rgba(255,255,255,0.14)',
  ringBar: '#f08a59',
  overlay: 'rgba(0,0,0,0.55)',
}

export function usePalette(): Palette {
  const mode = useApp((s) => s.settings.theme)
  const system = useColorScheme()
  const resolved = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode
  return resolved === 'dark' ? darkPalette : lightPalette
}

export const radius = { sm: 8, base: 12, lg: 18, xl: 24, pill: 999 }
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }

export const font = {
  display: 'serif',
  body: undefined as string | undefined,
}

export const shadow = {
  card: {
    shadowColor: '#18181b',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
}
