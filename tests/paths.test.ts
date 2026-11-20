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
import {
  basename,
  dirnameOf,
  isMarkdownFile,
  linkedNotePath,
  resolveNotePath,
} from '../src/lib/paths'

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

describe('isMarkdownFile', () => {
  it('accepts .md and .markdown in any letter case', () => {
    expect(isMarkdownFile('C:\\notes\\a.md')).toBe(true)
    expect(isMarkdownFile('/home/me/b.MARKDOWN')).toBe(true)
  })

  it('rejects other files and near-miss extensions', () => {
    expect(isMarkdownFile('c.txt')).toBe(false)
    expect(isMarkdownFile('d.markdow')).toBe(false)
    expect(isMarkdownFile('e.mdx')).toBe(false)
  })
})

describe('basename and dirnameOf', () => {
  it('splits Windows and POSIX paths', () => {
    expect(basename('C:\\notes\\a.md')).toBe('a.md')
    expect(basename('/notes/a.md')).toBe('a.md')
    expect(basename('a.md')).toBe('a.md')
    expect(dirnameOf('C:\\notes\\a.md')).toBe('C:\\notes')
    expect(dirnameOf('a.md')).toBe('')
  })
})

describe('linkedNotePath', () => {
  it('resolves a relative note link against the note folder', () => {
    expect(linkedNotePath('C:\\notes', 'other.md')).toBe('C:\\notes\\other.md')
    expect(linkedNotePath('C:/notes', 'sub/x.md')).toBe('C:/notes/sub/x.md')
  })

  it('drops a #fragment and decodes percent-encoding', () => {
    expect(linkedNotePath('C:\\notes', 'My%20note.md#intro')).toBe('C:\\notes\\My note.md')
  })

  it('keeps a bare relative name when no folder is known', () => {
    expect(linkedNotePath('', 'other.md')).toBe('other.md')
  })

  it('never treats web, file, script, absolute or non-note links as notes', () => {
    expect(linkedNotePath('C:\\notes', 'https://example.com/a.md')).toBeNull()
    expect(linkedNotePath('C:\\notes', 'file:///C:/secret.md')).toBeNull()
    expect(linkedNotePath('C:\\notes', 'javascript:alert(1)')).toBeNull()
    expect(linkedNotePath('C:\\notes', 'C:\\other\\a.md')).toBeNull()
    expect(linkedNotePath('C:\\notes', '/etc/a.md')).toBeNull()
    expect(linkedNotePath('C:\\notes', 'picture.png')).toBeNull()
    expect(linkedNotePath('C:\\notes', '#intro')).toBeNull()
  })
})
