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

import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/lib/markdown'
import { assetUrl } from '../src/lib/assets'

const options = {
  baseDir: 'C:/notes',
  resolveAsset: (reference: string) => 'asset://test/' + reference,
}

describe('renderMarkdown', () => {
  it('renders_common_markdown', () => {
    const source = '# Hi\n\n**bold**\n\n| a | b |\n|---|---|\n| 1 | 2 |'
    const html = renderMarkdown(source, options)
    expect(html).toContain('<h1')
    expect(html).toContain('Hi</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<table>')
  })

  it('renders_task_list_and_footnote', () => {
    const source = '- [ ] todo\n\nHere is a note[^1].\n\n[^1]: The footnote.'
    const html = renderMarkdown(source, options)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('footnote')
  })

  it('sanitizes_script_and_javascript_links', () => {
    const source = '<script>alert(1)</script>\n\n[x](javascript:alert(1))'
    const html = renderMarkdown(source, options)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('href="javascript:')
  })

  it('hostile_image_reference_does_not_throw', () => {
    const throwingOptions = {
      baseDir: 'C:/notes',
      resolveAsset: (reference: string) => {
        if (reference.includes('..')) throw new Error('escape blocked')
        return 'asset://test/' + reference
      },
    }
    const html = renderMarkdown('![x](../../secret.png)', throwingOptions)
    expect(html).toContain('<img')
    expect(html).not.toContain('secret.png')
  })

  it('highlights_fenced_code', () => {
    const html = renderMarkdown('```ts\nconst x: number = 1\n```', options)
    expect(html).toContain('hljs')
  })
})

describe('assetUrl', () => {
  it('rejects_escaping_and_absolute_asset_paths', () => {
    expect(() => assetUrl('C:/notes', '../../secret.png')).toThrow()
    expect(() => assetUrl('C:/notes', 'C:/secret.png')).toThrow()
  })
})
