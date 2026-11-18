export type OpenMode = 'window' | 'tab'

export interface Tab {
  id: string
  path: string
  dirty: boolean
}

export interface SessionState {
  tabs: Tab[]
  activeId: string
}

export type SessionAction =
  | { type: 'open'; id: string; path: string }
  | { type: 'select'; id: string }
  | { type: 'close'; id: string }
  | { type: 'markDirty'; id: string; dirty: boolean }

export interface OpenIntent {
  kind: 'window' | 'tab'
  path: string
}

/** Translate the user's preferred open mode into an action for the app shell. */
export function openIntent(mode: OpenMode, path: string): OpenIntent {
  return { kind: mode, path }
}

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case 'open': {
      if (state.tabs.some((tab) => tab.id === action.id)) {
        return { ...state, activeId: action.id }
      }
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
      const tab = state.tabs.find((item) => item.id === action.id)
      if (!tab || tab.dirty) return state
      const tabs = state.tabs.filter((item) => item.id !== action.id)
      const activeId =
        state.activeId === action.id ? (tabs[0]?.id ?? '') : state.activeId
      return { tabs, activeId }
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
  }
}
