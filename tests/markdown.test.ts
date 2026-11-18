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
