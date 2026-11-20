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
import { sessionReducer, type SessionState, type Tab } from '../src/lib/session'

const tab = (id: string, dirty = false): Tab => ({ id, path: `${id}.md`, dirty })

function tabsState(ids: string[], activeId: string, dirty: string[] = []): SessionState {
  return { tabs: ids.map((id) => tab(id, dirty.includes(id))), activeId }
}

const ids = (state: SessionState) => state.tabs.map((item) => item.id)

describe('session', () => {
  it('open_adds_a_tab_and_makes_it_active', () => {
    const next = sessionReducer({ tabs: [], activeId: '' }, { type: 'open', id: 'b.md', path: 'b.md' })
    expect(next.tabs).toEqual([{ id: 'b.md', path: 'b.md', dirty: false }])
    expect(next.activeId).toBe('b.md')
  })

  it('open_selects_a_note_that_is_already_open_instead_of_duplicating_it', () => {
    const state = tabsState(['a', 'b'], 'b')
    const next = sessionReducer(state, { type: 'open', id: 'a', path: 'a.md' })
    expect(ids(next)).toEqual(['a', 'b'])
    expect(next.activeId).toBe('a')
  })

  it('tab_close_is_blocked_when_dirty_unless_forced', () => {
    const state = tabsState(['a'], 'a', ['a'])
    expect(sessionReducer(state, { type: 'close', id: 'a' })).toBe(state)
    const forced = sessionReducer(state, { type: 'close', id: 'a', force: true })
    expect(forced.tabs).toHaveLength(0)
    expect(forced.activeId).toBe('')
  })

  it('closing_the_active_tab_activates_its_right_neighbour', () => {
    const next = sessionReducer(tabsState(['a', 'b', 'c'], 'b'), { type: 'close', id: 'b', force: true })
    expect(ids(next)).toEqual(['a', 'c'])
    expect(next.activeId).toBe('c')
  })

  it('closing_the_last_tab_activates_its_left_neighbour', () => {
    const next = sessionReducer(tabsState(['a', 'b', 'c'], 'c'), { type: 'close', id: 'c', force: true })
    expect(next.activeId).toBe('b')
  })

  it('closing_a_background_tab_keeps_the_active_one', () => {
    const next = sessionReducer(tabsState(['a', 'b'], 'a'), { type: 'close', id: 'b', force: true })
    expect(next.activeId).toBe('a')
  })

  it('move_reorders_tabs', () => {
    const state = tabsState(['a', 'b', 'c'], 'a')
    expect(ids(sessionReducer(state, { type: 'move', id: 'a', toIndex: 2 }))).toEqual(['b', 'c', 'a'])
    expect(ids(sessionReducer(state, { type: 'move', id: 'c', toIndex: 0 }))).toEqual(['c', 'a', 'b'])
  })

  it('move_keeps_the_index_inside_the_strip', () => {
    const state = tabsState(['a', 'b'], 'a')
    expect(ids(sessionReducer(state, { type: 'move', id: 'a', toIndex: 99 }))).toEqual(['b', 'a'])
    expect(ids(sessionReducer(state, { type: 'move', id: 'b', toIndex: -5 }))).toEqual(['b', 'a'])
  })

  it('cycle_wraps_in_both_directions', () => {
    const state = tabsState(['a', 'b', 'c'], 'a')
    expect(sessionReducer(state, { type: 'cycle', step: 1 }).activeId).toBe('b')
    expect(sessionReducer(state, { type: 'cycle', step: -1 }).activeId).toBe('c')
  })

  it('markDirty_changes_only_that_tab', () => {
    const next = sessionReducer(tabsState(['a', 'b'], 'a'), { type: 'markDirty', id: 'b', dirty: true })
    expect(next.tabs.map((item) => item.dirty)).toEqual([false, true])
  })
  it('replace_loads_a_restored_window_with_its_saved_active_tab', () => {
    const next = sessionReducer(tabsState(['old'], 'old'), {
      type: 'replace',
      tabs: ['a.md', 'b.md', 'a.md'],
      active: 'b.md',
    })
    expect(ids(next)).toEqual(['a.md', 'b.md'])
    expect(next.activeId).toBe('b.md')
    expect(next.tabs.every((tab) => !tab.dirty)).toBe(true)
  })

  it('replace_falls_back_to_the_first_tab_when_the_saved_active_is_missing', () => {
    const next = sessionReducer({ tabs: [], activeId: '' }, {
      type: 'replace',
      tabs: ['a.md', 'b.md'],
      active: 'gone.md',
    })
    expect(next.activeId).toBe('a.md')
  })

  it('replace_with_no_tabs_leaves_the_window_empty', () => {
    const next = sessionReducer({ tabs: [], activeId: '' }, { type: 'replace', tabs: [], active: null })
    expect(next).toEqual({ tabs: [], activeId: '' })
  })
})
