import { useEffect, useReducer, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Reader from './components/Reader'
import Editor from './components/Editor'
import LibrarySidebar from './components/LibrarySidebar'
import { useDocument, tauriDocumentIo, type DocumentIo } from './hooks/useDocument'
import {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings,
  type AppSettings,
} from './lib/settings'
import {
  openIntent,
  sessionReducer,
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

// Use real files when running in Tauri; keep sample notes for browser preview.
const io: DocumentIo = {
  read: async (path) => {
    try {
      return await tauriDocumentIo.read(path)
    } catch {
      return NOTES[path] ?? `# ${path}\n\n(Preview only — install Snug to open real files.)`
    }
  },
  write: async (path, contents) => {
    try {
      await tauriDocumentIo.write(path, contents)
    } catch {
      NOTES[path] = contents
    }
  },
}

const queryNote =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('note')

function dirname(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index >= 0 ? path.slice(0, index) : ''
}

const initialSession: SessionState = {
  tabs: [
    {
      id: queryNote ?? '1',
      path: queryNote ?? 'weekly-notes.md',
      dirty: false,
    },
  ],
  activeId: queryNote ?? '1',
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [files, setFiles] = useState<string[]>(Object.keys(NOTES))
  const [session, dispatch] = useReducer(sessionReducer, initialSession)
  const [editing, setEditing] = useState(false)
  const activeTab = session.tabs.find((tab) => tab.id === session.activeId)
  const doc = useDocument(activeTab?.path ?? '', io)

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch(() => {})
    void invoke<string | null>('get_launch_note')
      .then((note) => {
        if (note) dispatch({ type: 'open', id: note, path: note })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab && activeTab.dirty !== doc.dirty) {
      dispatch({ type: 'markDirty', id: activeTab.id, dirty: doc.dirty })
    }
  }, [doc.dirty, activeTab])

  const finishEdit = () => {
    if (doc.exit()) setEditing(false)
  }

  const openNote = (path: string) => {
    const intent = openIntent(settings.open_mode, path)
    if (intent.kind === 'window') {
      void invoke('open_note_window_cmd', { path }).catch(() => {
        dispatch({ type: 'open', id: path, path })
      })
    } else {
      dispatch({ type: 'open', id: path, path })
    }
  }

  const openFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const folder = await open({ directory: true })
      if (typeof folder !== 'string') return
      const listed = await invoke<string[]>('list_markdown_files', { folder })
      setFiles(listed.length ? listed : Object.keys(NOTES))
      setSettings(await updateSettings({ last_folder: folder }))
    } catch {
      // browser preview: nothing to do
    }
  }

  const openFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const picked = await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      })
      if (typeof picked === 'string') openNote(picked)
    } catch {
      // browser preview: nothing to do
    }
  }

  const toggleTheme = async () => {
    const theme = settings.theme === 'dark' ? 'light' : 'dark'
    try {
      setSettings(await updateSettings({ theme }))
    } catch {
      setSettings({ ...settings, theme })
    }
  }

  const toggleLibrary = async () => {
    const view = settings.view === 'library' ? 'focus' : 'library'
    try {
      setSettings(await updateSettings({ view }))
    } catch {
      setSettings({ ...settings, view })
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        void openFile()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        const find = (window as unknown as { find?: (text: string) => boolean }).find
        find?.call(window, prompt('Find in note:') ?? '')
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        void toggleLibrary()
        return
      }
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

  useEffect(() => {
    let unlisten: (() => void) | undefined
    void import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<{ paths?: string[] }>('tauri://drag-drop', (event) => {
          const path = event.payload.paths?.[0]
          if (path && /\.markdown?$/i.test(path)) openNote(path)
        }).then((fn) => {
          unlisten = fn
        }),
      )
      .catch(() => {})
    return () => unlisten?.()
  })

  const closeTab = (id: string) => {
    if (doc.dirty && id === activeTab?.id && !window.confirm('Discard unsaved changes?')) {
      return
    }
    dispatch({ type: 'close', id })
  }

  return (
    <div className={`theme-${settings.theme}`} style={{ display: 'flex' }}>
      {settings.view === 'library' && (
        <LibrarySidebar
          files={files}
          selected={activeTab?.path ?? null}
          onSelect={(path) => {
            const existing = session.tabs.find((tab) => tab.path === path)
            if (existing) dispatch({ type: 'select', id: existing.id })
            else openNote(path)
          }}
          onOpenFolder={() => void openFolder()}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="snug-toolbar">
          <button className="snug-tool-button" onClick={() => void toggleLibrary()}>
            ▤ Library
          </button>
          <button className="snug-tool-button" onClick={() => void toggleTheme()}>
            {settings.theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
          <button className="snug-tool-button" onClick={() => void openFile()}>
            ⌕ Open
          </button>
        </div>
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
            title="Open in new tab (when tab mode is on)"
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
            baseDir={activeTab ? dirname(activeTab.path) : ''}
            theme={settings.theme}
            fontSize={settings.font_size}
            onEdit={() => setEditing(true)}
          />
        )}
      </div>
    </div>
  )
}
