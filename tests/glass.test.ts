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

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const STYLES = join(ROOT, 'src', 'styles')
const glass = readFileSync(join(STYLES, 'glass.css'), 'utf8')

describe('in-app glass', () => {
  it('has a solid fallback for browsers without backdrop-filter', () => {
    expect(glass).toContain('@supports not (backdrop-filter')
  })

  it('paints the ambient backdrop on the window, with no motion', () => {
    const rule = glass.match(/\.snug-window\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule![1]).toContain('--ambient-1')
    expect(rule![1]).toContain('--ambient-2')
    expect(rule![1]).not.toMatch(/animation|transition/)
  })

  it('applies the blur to the fixed chrome only', () => {
    for (const file of readdirSync(STYLES).filter((name) => name.endsWith('.css'))) {
      const count = (readFileSync(join(STYLES, file), 'utf8').match(/backdrop-filter\s*:/g) ?? []).length
      if (file === 'glass.css') expect(count).toBeGreaterThan(0)
      else expect(count, file).toBe(0)
    }
    const editor = readFileSync(join(ROOT, 'src', 'components', 'Editor.tsx'), 'utf8')
    expect(editor).not.toContain('backdrop-filter')
  })

  it('has one glass window that the chrome sits on, as in the canvas', () => {
    const frame = glass.match(/\.snug-frame\s*\{([^}]*)\}/)
    expect(frame).not.toBeNull()
    expect(frame![1]).toContain('backdrop-filter')
    const chrome = glass.match(/\.snug-tabbar,[\s\S]*?\{([^}]*)\}/)
    expect(chrome).not.toBeNull()
    expect(chrome![1]).toContain('background: transparent')
  })

  it('is loaded by the app, and the window carries the ambient class', () => {
    const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8')
    expect(app).toContain("'./styles/glass.css'")
    expect(app).toContain('snug-window')
  })
})
