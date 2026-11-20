export interface Tab {
  id: string
  path: string
  dirty: boolean
}

export interface SessionState {
  tabs: Tab[]
  activeId: string
}

/** A window's tabs as they were saved: note paths, and which one was active. */
export interface SavedWindow {
  tabs: string[]
  active: string | null
}

export type SessionAction =
  | { type: 'open'; id: string; path: string }
  | { type: 'select'; id: string }
  | { type: 'close'; id: string; force?: boolean }
  | { type: 'markDirty'; id: string; dirty: boolean }
  | { type: 'move'; id: string; toIndex: number }
  | { type: 'cycle'; step: 1 | -1 }
  | { type: 'replace'; tabs: string[]; active: string | null }

/**
 * Tabs work like a browser's: a note that is already open is selected rather than
 * opened twice, closing the active tab activates its neighbour, and tabs can be
 * reordered or cycled.
 */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'open': {
      const existing = state.tabs.find((tab) => tab.path === action.path)
      if (existing) return { ...state, activeId: existing.id }
      return {
        tabs: [...state.tabs, { id: action.id, path: action.path, dirty: false }],
        activeId: action.id,
      }
    }
    case 'select':
      return state.tabs.some((tab) => tab.id === action.id)
        ? { ...state, activeId: action.id }
        : state
    case 'close': {
      const index = state.tabs.findIndex((item) => item.id === action.id)
      if (index < 0) return state
      const tab = state.tabs[index]
      if (tab.dirty && !action.force) return state
      const tabs = state.tabs.filter((item) => item.id !== action.id)
      if (state.activeId !== action.id) return { tabs, activeId: state.activeId }
      const neighbour = tabs[index] ?? tabs[index - 1]
      return { tabs, activeId: neighbour?.id ?? '' }
    }
    case 'markDirty': {
      const tab = state.tabs.find((item) => item.id === action.id)
      if (!tab || tab.dirty === action.dirty) return state
      return {
        ...state,
        tabs: state.tabs.map((item) =>
          item.id === action.id ? { ...item, dirty: action.dirty } : item,
        ),
      }
    }
    case 'move': {
      const from = state.tabs.findIndex((item) => item.id === action.id)
      if (from < 0) return state
      const tabs = [...state.tabs]
      const [moved] = tabs.splice(from, 1)
      const to = Math.max(0, Math.min(action.toIndex, tabs.length))
      tabs.splice(to, 0, moved)
      return { ...state, tabs }
    }
    case 'cycle': {
      const count = state.tabs.length
      if (count === 0) return state
      const index = state.tabs.findIndex((tab) => tab.id === state.activeId)
      const next = (Math.max(index, 0) + action.step + count) % count
      return { ...state, activeId: state.tabs[next].id }
    }
    case 'replace': {
      // A restored window: its tabs, in order, with the saved one active.
      const seen = new Set<string>()
      const tabs: Tab[] = []
      for (const path of action.tabs) {
        if (seen.has(path)) continue
        seen.add(path)
        tabs.push({ id: path, path, dirty: false })
      }
      const activeId = action.active && seen.has(action.active) ? action.active : (tabs[0]?.id ?? '')
      return { tabs, activeId }
    }
  }
}
