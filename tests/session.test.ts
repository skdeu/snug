import { describe, expect, it } from 'vitest'
import {
  openIntent,
  sessionReducer,
  type SessionState,
} from '../src/lib/session'

describe('session', () => {
  it('open_in_window_mode_creates_new_window_action', () => {
    expect(openIntent('window', 'C:/notes/a.md')).toEqual({
      kind: 'window',
      path: 'C:/notes/a.md',
    })
    expect(openIntent('tab', 'C:/notes/b.md')).toEqual({
      kind: 'tab',
      path: 'C:/notes/b.md',
    })
  })

  it('tab_close_blocks_when_dirty', () => {
    const state: SessionState = {
      tabs: [{ id: '1', path: 'a.md', dirty: true }],
      activeId: '1',
    }
    expect(sessionReducer(state, { type: 'close', id: '1' })).toBe(state)
  })

  it('open_adds_tab_and_marks_it_active', () => {
    const state: SessionState = { tabs: [], activeId: '' }
    const next = sessionReducer(state, { type: 'open', id: '2', path: 'b.md' })
    expect(next.tabs).toEqual([{ id: '2', path: 'b.md', dirty: false }])
    expect(next.activeId).toBe('2')
  })
})
