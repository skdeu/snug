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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const STYLES = join(process.cwd(), 'src', 'styles')
const read = (name: string) => readFileSync(join(STYLES, name), 'utf8')

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
]

function blocks(css: string): Array<{ selectors: string[]; body: string }> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((part) => part.trim()),
    body: match[2],
  }))
}

function tokensFor(css: string, selector: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const block of blocks(css)) {
    if (!block.selectors.includes(selector)) continue
    for (const match of block.body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      tokens[match[1]] = match[2].trim()
    }
  }
  return tokens
}

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

const tokens = read('tokens.css')
const dark = tokensFor(tokens, '.theme-dark')
const light = tokensFor(tokens, '.theme-light')

describe('design tokens', () => {
  it('defines every token in dark and light', () => {
    for (const name of TOKEN_NAMES) {
      expect(dark[name], `dark --${name}`).toBeDefined()
      expect(light[name], `light --${name}`).toBeDefined()
    }
  })

  it('keeps text, muted text, accent and error at 4.5:1 on the solid ground', () => {
    for (const set of [dark, light]) {
      const ground = parse(set['bg-solid'])
      for (const name of ['text', 'text-muted', 'accent-text', 'error']) {
        expect(ratio(parse(set[name]), ground), `--${name}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps chrome text at 4.5:1 over the glass, over each ambient blob', () => {
    for (const set of [dark, light]) {
      for (const blob of ['ambient-1', 'ambient-2']) {
        const glass = over(parse(set.glass), parse(set[blob]))
        expect(ratio(parse(set.text), glass), `text on glass over ${blob}`).toBeGreaterThanOrEqual(4.5)
        expect(ratio(parse(set['text-muted']), glass), `muted on glass over ${blob}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps main text at 4.5:1 on the active tab surface', () => {
    for (const set of [dark, light]) {
      for (const blob of ['ambient-1', 'ambient-2']) {
        const glass = over(parse(set.glass), parse(set[blob]))
        const active = over(parse(set['accent-soft']), glass)
        expect(ratio(parse(set.text), active), `text on active tab over ${blob}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps the reader ground near-opaque', () => {
    for (const set of [dark, light]) {
      expect(parse(set['reader-bg'])[3]).toBeGreaterThanOrEqual(0.92)
    }
  })
})

describe('colour literals', () => {
  it('leaves no old literal palette in the component stylesheets', () => {
    for (const name of ['themes.css', 'base.css', 'tabs.css', 'library.css', 'reader.css']) {
      expect(read(name), name).not.toContain('rgba(127, 127, 160')
    }
  })

  it('never sets muted text on the active tab', () => {
    const active = blocks(read('tabs.css')).find((block) => block.selectors.includes('.snug-tab.active'))
    expect(active).toBeDefined()
    expect(active!.body).not.toMatch(/color:\s*var\(--text-muted\)/)
  })
})
