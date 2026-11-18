import { useEffect, useReducer, useState } from 'react'
import Reader from './components/Reader'
import Editor from './components/Editor'
import LibrarySidebar from './components/LibrarySidebar'
import type { Theme } from './lib/theme'
import { useDocument, type DocumentIo } from './hooks/useDocument'
import {
  openIntent,
  sessionReducer,
  type OpenMode,
  type SessionState,
} from './lib/session'
import './styles/tabs.css'

const NOTES: Record<string, string> = {
  'weekly-notes.md': `# Weekly reading notes

The whole point of a quiet reading space is that the text gets out of the way and lets you think.

## What worked well

- Clean headings and generous spacing
- Code blocks that stay readable
- No clutter competing for attention

> Presentation is the product.
`,
  'ideas.md': '# Ideas\n\nA place for half-formed thoughts.\n',
  'reading-list.md': '# Reading list\n\n- [ ] The Art of Reading\n- [ ] Deep Work\n',
}

// Temporary in-memory IO until the Rust file commands land in Task 2.
const sampleIo: DocumentIo = {
  read: async (path) => NOTES[path] ?? '',
  write: async () => {},
}

const initialSession: SessionState = {
  tabs: [{ id: '1', path: 'weekly-notes.md', dirty: false }],
  activeId: '1',
}

export default function App() {
  const [theme] = useState<Theme>('dark')
  const [session, dispatch] = useReducer(sessionReducer, initialSession)
  const [editing, setEditing] = useState(false)
  const activeTab = session.tabs.find((tab) => tab.id === session.activeId)
  const doc = useDocument(activeTab?.path ?? '', sampleIo)
  const openMode: OpenMode = 'window' // becomes a persisted setting in Task 5

  useEffect(() => {
    if (activeTab && activeTab.dirty !== doc.dirty) {
      dispatch({ type: 'markDirty', id: activeTab.id, dirty: doc.dirty })
    }
  }, [doc.dirty, activeTab])

  const finishEdit = () => {
    if (doc.exit()) setEditing(false)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!editing) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void doc.save()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        finishEdit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const openNote = (path: string) => {
    const intent = openIntent(openMode, path)
    // TODO(Task 8 backend): window intent opens a WebviewWindow via Rust.
    // Until the Rust side lands, both intents open a tab in this window.
    void intent
    dispatch({ type: 'open', id: String(Date.now()), path })
  }

  const closeTab = (id: string) => {
    if (doc.dirty && id === activeTab?.id && !window.confirm('Discard unsaved changes?')) {
      return
    }
    dispatch({ type: 'close', id })
  }

  return (
    <div className={`theme-${theme}`} style={{ display: 'flex' }}>
      <LibrarySidebar
        files={Object.keys(NOTES)}
        selected={activeTab?.path ?? null}
        onSelect={(path) => {
          const existing = session.tabs.find((tab) => tab.path === path)
          if (existing) dispatch({ type: 'select', id: existing.id })
          else openNote(path)
        }}
        onOpenFolder={() => {
          /* wired to the Rust folder picker in a later task */
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="snug-tabbar">
          {session.tabs.map((tab) => (
            <button
              key={tab.id}
              className={`snug-tab ${tab.id === session.activeId ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'select', id: tab.id })}
            >
              {tab.path}
              <span
                className="snug-tab-close"
                role="button"
                aria-label={`Close ${tab.path}`}
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
              >
                ×
              </span>
            </button>
          ))}
          <button
            className="snug-new-tab"
            onClick={() => openNote('ideas.md')}
            title="Open in new tab"
          >
            + New tab
          </button>
        </div>
        {editing ? (
          <>
            <Editor
              key={activeTab?.id}
              value={doc.source}
              onChange={doc.setSource}
              onSave={() => void doc.save()}
              onExit={finishEdit}
            />
            <div className="snug-editor-status">
              {doc.dirty ? '● Unsaved' : 'Saved'} · Ctrl+S to save · Esc to exit
            </div>
          </>
        ) : (
          <Reader
            source={doc.source}
            baseDir=""
            theme={theme}
            fontSize={18}
            onEdit={() => setEditing(true)}
          />
        )}
      </div>
    </div>
  )
}
