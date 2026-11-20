// Copyright 2026 Sanjaykumar Sagadevan Vijayakumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { Theme } from './theme'

export type Palette = 'graphite' | 'harbor' | 'umber' | 'slate' | 'ash'

export const PALETTES: Array<{ id: Palette; label: string }> = [
  { id: 'graphite', label: 'Graphite and sage' },
  { id: 'harbor', label: 'Harbor teal' },
  { id: 'umber', label: 'Umber and brass' },
  { id: 'slate', label: 'Slate and ice' },
  { id: 'ash', label: 'Ash and rose' },
]

/** The colours that differ between palettes, for one theme. */
interface Colours {
  ambient1: string
  ambient2: string
  bg: string
  glass: string
  glassSolid: string
  readerBg: string
  text: string
  muted: string
  accent: string
  soft: string
  error: string
}

const DATA: Record<Palette, Record<Theme, Colours>> = {
  graphite: {
    dark: {
      ambient1: '#2e4f3c', ambient2: '#1d3f47', bg: '#14171a', glass: 'rgba(20, 23, 26, 0.58)',
      glassSolid: '#1a1e22', readerBg: 'rgba(20, 23, 26, 0.92)', text: '#e6eae7', muted: '#a9b3ad',
      accent: '#9cc7a4', soft: 'rgba(156, 199, 164, 0.22)', error: '#f0a093',
    },
    light: {
      ambient1: '#cfe3d3', ambient2: '#d6e6e0', bg: '#eef1ee', glass: 'rgba(238, 241, 238, 0.66)',
      glassSolid: '#e4e9e4', readerBg: 'rgba(251, 252, 251, 0.95)', text: '#1d2420', muted: '#4e5a53',
      accent: '#2f6b45', soft: 'rgba(47, 107, 69, 0.14)', error: '#a3372a',
    },
  },
  harbor: {
    dark: {
      ambient1: '#145a57', ambient2: '#1f3a52', bg: '#0d1a1b', glass: 'rgba(13, 26, 27, 0.58)',
      glassSolid: '#162526', readerBg: 'rgba(13, 26, 27, 0.92)', text: '#d8ebe8', muted: '#9dbdb8',
      accent: '#72d2bf', soft: 'rgba(114, 210, 191, 0.22)', error: '#f29e92',
    },
    light: {
      ambient1: '#c4e5df', ambient2: '#d9e9f0', bg: '#eef5f4', glass: 'rgba(238, 245, 244, 0.66)',
      glassSolid: '#e2eeec', readerBg: 'rgba(251, 253, 253, 0.95)', text: '#13292a', muted: '#3f5f5d',
      accent: '#0d6e62', soft: 'rgba(13, 110, 98, 0.14)', error: '#a33a2e',
    },
  },
  umber: {
    dark: {
      ambient1: '#5c3d18', ambient2: '#3f2a1f', bg: '#17130f', glass: 'rgba(23, 19, 15, 0.58)',
      glassSolid: '#1f1a15', readerBg: 'rgba(23, 19, 15, 0.92)', text: '#efe6d6', muted: '#c2b7a4',
      accent: '#e2b25f', soft: 'rgba(226, 178, 95, 0.22)', error: '#f0937d',
    },
    light: {
      ambient1: '#e9d6b8', ambient2: '#dcd0c0', bg: '#f1eee9', glass: 'rgba(241, 238, 233, 0.66)',
      glassSolid: '#e6e1d9', readerBg: 'rgba(252, 251, 249, 0.95)', text: '#2a221a', muted: '#5a4f43',
      accent: '#8a5a10', soft: 'rgba(138, 90, 16, 0.14)', error: '#a2362b',
    },
  },
  slate: {
    dark: {
      ambient1: '#203f5e', ambient2: '#2e3f55', bg: '#101418', glass: 'rgba(16, 20, 24, 0.58)',
      glassSolid: '#171c21', readerBg: 'rgba(16, 20, 24, 0.92)', text: '#e4edf4', muted: '#a0b2c1',
      accent: '#8ec9ee', soft: 'rgba(142, 201, 238, 0.22)', error: '#f4a09a',
    },
    light: {
      ambient1: '#c9dded', ambient2: '#d8e2ec', bg: '#eef3f7', glass: 'rgba(238, 243, 247, 0.66)',
      glassSolid: '#e2e9ef', readerBg: 'rgba(251, 252, 253, 0.95)', text: '#14212b', muted: '#4b5f6e',
      accent: '#1f5f8b', soft: 'rgba(31, 95, 139, 0.14)', error: '#a33a2e',
    },
  },
  ash: {
    dark: {
      ambient1: '#5a2b3d', ambient2: '#3a2a3f', bg: '#181416', glass: 'rgba(24, 20, 22, 0.58)',
      glassSolid: '#1e1a1c', readerBg: 'rgba(24, 20, 22, 0.92)', text: '#f0e6e8', muted: '#c4b3b8',
      accent: '#e8a1b0', soft: 'rgba(232, 161, 176, 0.22)', error: '#f29a8a',
    },
    light: {
      ambient1: '#eccfd7', ambient2: '#e3d6dc', bg: '#f5eff0', glass: 'rgba(245, 239, 240, 0.66)',
      glassSolid: '#ebe2e4', readerBg: 'rgba(252, 250, 250, 0.95)', text: '#2b1f23', muted: '#6a5258',
      accent: '#9b3a52', soft: 'rgba(155, 58, 82, 0.14)', error: '#a33a2e',
    },
  },
}

/** Border, hover and code tints are neutral per theme, so they are shared by every palette. */
const NEUTRAL: Record<Theme, Record<string, string>> = {
  dark: {
    border: 'rgba(255, 255, 255, 0.12)',
    highlight: 'rgba(255, 255, 255, 0.1)',
    'surface-idle': 'rgba(255, 255, 255, 0.05)',
    'surface-hover': 'rgba(255, 255, 255, 0.08)',
    'code-bg': 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    border: 'rgba(42, 39, 37, 0.12)',
    highlight: 'rgba(255, 255, 255, 0.85)',
    'surface-idle': 'rgba(255, 255, 255, 0.4)',
    'surface-hover': 'rgba(42, 39, 37, 0.06)',
    'code-bg': 'rgba(0, 0, 0, 0.05)',
  },
}

/** Any value that is not a known palette, such as one from an older file, becomes Graphite. */
export function resolvePalette(value: unknown): Palette {
  const known = PALETTES.find((palette) => palette.id === value)
  return known ? known.id : 'graphite'
}

/** The CSS custom properties for one palette and theme. The app sets them on its window. */
export function paletteTokens(palette: Palette, theme: Theme): Record<string, string> {
  const c = DATA[palette][theme]
  return {
    '--ambient-1': c.ambient1,
    '--ambient-2': c.ambient2,
    '--bg-solid': c.bg,
    '--glass': c.glass,
    '--glass-solid': c.glassSolid,
    '--reader-bg': c.readerBg,
    '--text': c.text,
    '--text-muted': c.muted,
    '--accent': c.accent,
    '--accent-text': c.accent,
    '--accent-soft': c.soft,
    '--focus': c.accent,
    '--error': c.error,
    ...Object.fromEntries(Object.entries(NEUTRAL[theme]).map(([name, value]) => [`--${name}`, value])),
  }
}
