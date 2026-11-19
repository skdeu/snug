import { describe, expect, it } from 'vitest'
import { resolveNotePath } from '../src/lib/paths'

describe('resolveNotePath', () => {
  it('joins a relative note to its folder', () => {
    expect(resolveNotePath('nested/note.md', 'C:\\notes')).toBe('C:\\notes\\nested/note.md')
  })

  it('keeps an absolute path unchanged', () => {
    expect(resolveNotePath('D:\\other\\a.md', 'C:\\notes')).toBe('D:\\other\\a.md')
  })

  it('returns relative paths unchanged when no folder is known', () => {
    expect(resolveNotePath('nested/note.md', null)).toBe('nested/note.md')
  })
})
