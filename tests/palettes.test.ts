import { describe, expect, it } from 'vitest'
import { PALETTES, paletteTokens, resolvePalette } from '../src/lib/palettes'

type Rgba = [number, number, number, number]

const TOKEN_NAMES = [
  'ambient-1',
  'ambient-2',
  'bg-solid',
  'glass',
  'glass-solid',
  'reader-bg',
  'text',
  'text-muted',
  'accent',
  'accent-text',
  'accent-soft',
  'border',
  'highlight',
  'error',
  'focus',
  'surface-idle',
  'surface-hover',
  'code-bg',
]

function parse(value: string): Rgba {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgba = value.match(/^rgba\(([^)]+)\)$/)
  if (rgba) {
    const [r, g, b, a] = rgba[1].split(',').map((part) => Number(part.trim()))
    return [r, g, b, a]
  }
  throw new Error(`Cannot parse colour: ${value}`)
}

function over(top: Rgba, below: Rgba): Rgba {
  const a = top[3]
  return [top[0] * a + below[0] * (1 - a), top[1] * a + below[1] * (1 - a), top[2] * a + below[2] * (1 - a), 1]
}

function luminance([r, g, b]: Rgba): number {
  const [R, G, B] = [r, g, b].map((channel) => {
    const v = channel / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function ratio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('palettes', () => {
  it('offers the five palettes, Graphite first', () => {
    expect(PALETTES.map((palette) => palette.id)).toEqual(['graphite', 'harbor', 'umber', 'slate', 'ash'])
  })

  it('gives every palette every token in both themes', () => {
    for (const { id } of PALETTES) {
      for (const theme of ['dark', 'light'] as const) {
        const tokens = paletteTokens(id, theme)
        for (const name of TOKEN_NAMES) {
          expect(tokens[`--${name}`], `${id} ${theme} --${name}`).toBeDefined()
        }
      }
    }
  })

  it('keeps text, muted text, accent and error at 4.5:1 on the solid ground, in every palette', () => {
    for (const { id } of PALETTES) {
      for (const theme of ['dark', 'light'] as const) {
        const tokens = paletteTokens(id, theme)
        const ground = parse(tokens['--bg-solid'])
        for (const name of ['text', 'text-muted', 'accent-text', 'error']) {
          expect(ratio(parse(tokens[`--${name}`]), ground), `${id} ${theme} --${name}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('keeps chrome text at 4.5:1 over the glass, and main text on the active tab, in every palette', () => {
    for (const { id } of PALETTES) {
      for (const theme of ['dark', 'light'] as const) {
        const tokens = paletteTokens(id, theme)
        for (const blob of ['--ambient-1', '--ambient-2']) {
          const glass = over(parse(tokens['--glass']), parse(tokens[blob]))
          expect(ratio(parse(tokens['--text']), glass), `${id} ${theme} text on glass`).toBeGreaterThanOrEqual(4.5)
          expect(ratio(parse(tokens['--text-muted']), glass), `${id} ${theme} muted on glass`).toBeGreaterThanOrEqual(4.5)
          const active = over(parse(tokens['--accent-soft']), glass)
          expect(ratio(parse(tokens['--text']), active), `${id} ${theme} text on active tab`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('keeps the reader ground near-opaque in every palette', () => {
    for (const { id } of PALETTES) {
      for (const theme of ['dark', 'light'] as const) {
        expect(parse(paletteTokens(id, theme)['--reader-bg'])[3]).toBeGreaterThanOrEqual(0.92)
      }
    }
  })

  it('falls back to Graphite for an unknown or missing palette', () => {
    expect(resolvePalette('umber')).toBe('umber')
    expect(resolvePalette('neon')).toBe('graphite')
    expect(resolvePalette(undefined)).toBe('graphite')
  })
})
