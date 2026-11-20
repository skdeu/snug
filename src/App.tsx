import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { invoke } from '@tauri-apps/api/core'
import LibrarySidebar from './components/LibrarySidebar'
import NotePane from './components/NotePane'
import TabStrip from './components/TabStrip'
import Toolbar from './components/Toolbar'
import Notice from './components/Notice'
import { paletteTokens, resolvePalette } from './lib/palettes'
import {
  discardDraft,
  noDraftIo,
  tauriDocumentIo,
  tauriDraftIo,
  type DocumentIo,
  type DraftIo,
  type LoadedText,
} from './hooks/useDocument'
import { DEFAULT_SETTINGS, getSettings, updateSettings, type AppSettings } from './lib/settings'
import { sessionReducer, type SavedWindow, type SessionState } from './lib/session'
import { basename, dirnameOf, isMarkdownFile, resolveNotePath } from './lib/paths'
import { IS_TAURI, listenTo } from './lib/events'
import { askYesNo } from './lib/dialogs'
import './styles/tabs.css'
import './styles/glass.css'

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

// Inside the installed app, backend errors must surface instead of being replaced by
// sample content. Outside Tauri, keep the browser preview working.
const io: DocumentIo = {
  read: async (path): Promise<LoadedText> => {
    if (IS_TAURI) return tauriDocumentIo.read(path)
    return {
      text: NOTES[path] ?? `# ${path}\n\n(Preview only — install Snug to open real files.)`,
      modified: 0,
    }
  },
  write: async (path, contents, expectedModified) => {
    if (IS_TAURI) return tauriDocumentIo.write(path, contents, expectedModified)
    NOTES[path] = contents
    return 0
  },
}

const drafts: DraftIo = IS_TAURI ? tauriDraftIo : noDraftIo

const queryNote =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('note')

// A window starts with no note, unless it was opened for one (a torn-off tab).
// The browser preview starts with a sample note so the design can be seen.
const initialSession: SessionState = queryNote
  ? { tabs: [{ id: queryNote, path: queryNote, dirty: false }], activeId: queryNote }
  : IS_TAURI
    ? { tabs: [], activeId: '' }
    : {
        tabs: [{ id: 'weekly-notes.md', path: 'weekly-notes.md', dirty: false }],
        activeId: 'weekly-notes.md',
      }

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [files, setFiles] = useState<string[]>(IS_TAURI ? [] : Object.keys(NOTES))
  const [session, dispatch] = useReducer(sessionReducer, initialSession)
  const [windowLabel, setWindowLabel] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  // Becomes true once this window's tabs are restored. Nothing is saved before that.
  const [restored, setRestored] = useState(false)
  const activeTab = session.tabs.find((tab) => tab.id === session.activeId)
  const anyDirty = session.tabs.some((tab) => tab.dirty)

  // Window-level listeners are registered once, so they read the latest values through refs.
  const dirtyRef = useRef(anyDirty)
  dirtyRef.current = anyDirty
  const tabsRef = useRef(session.tabs)
  tabsRef.current = session.tabs
  const closingRef = useRef(false)

  const allowFolder = async (folder: string) => {
    if (!folder || !IS_TAURI) return
    try {
      await invoke('allow_asset_folder', { path: folder })
    } catch (reason) {
      // Images may not load from this folder; reading the note still works.
      console.error('Could not allow images from this folder', reason)
    }
  }

  // Every note opens as a tab in the window, like a browser.
  const openPath = (path: string) => {
    void allowFolder(dirnameOf(path))
    dispatch({ type: 'open', id: path, path })
  }
  const openPathRef = useRef(openPath)
  openPathRef.current = openPath

  useEffect(() => {
    if (IS_TAURI) {
      void currentWindow()
        .then((win) => setWindowLabel(win.label))
        .catch((reason: unknown) => console.error('Could not read the window name', reason))
    }
    if (IS_TAURI) {
      void getSettings()
        .then(async (loaded) => {
          setSettings(loaded)
          if (loaded.last_folder) {
            try {
              setFiles(await invoke<string[]>('list_markdown_files', { folder: loaded.last_folder }))
            } catch (reason) {
              setNotice(errorText(reason))
            }
          }
        })
        .catch((reason: unknown) => setNotice(errorText(reason)))
    }
    if (queryNote) void allowFolder(dirnameOf(queryNote))
  }, [])

  // Reopen the windows and tabs from last time. The main window restores them all, and
  // each other window takes its own. Nothing is saved until this has finished, so an
  // empty start can never overwrite the saved session.
  useEffect(() => {
    if (!IS_TAURI) return
    void (async () => {
      try {
        const label = (await currentWindow()).label
        const saved =
          label === 'main'
            ? await invoke<SavedWindow | null>('restore_session')
            : await invoke<SavedWindow | null>('take_pending_session')
        if (saved) {
          for (const path of saved.tabs) void allowFolder(dirnameOf(path))
          dispatch({ type: 'replace', tabs: saved.tabs, active: saved.active })
        }
        if (label === 'main') {
          // A file the app was launched with opens after the restored tabs.
          const note = await invoke<string | null>('take_launch_note')
          if (note) openPathRef.current(note)
        }
        setRestored(true)
      } catch (reason) {
        setNotice(`Could not restore your last session: ${errorText(reason)}`)
      }
    })()
  }, [])

  // Remember this window's tabs after every change, so the next launch can reopen them.
  useEffect(() => {
    if (!IS_TAURI || !restored) return
    const tabs = session.tabs.map((tab) => tab.path)
    const active = activeTab?.path ?? null
    void invoke('save_session', { tabs, active }).catch((reason: unknown) =>
      console.error('Could not remember the open tabs', reason),
    )
  }, [restored, session.tabs, session.activeId])

  // Settings changed in any Snug window apply here too.
  useEffect(() => listenTo<AppSettings>('snug://settings-changed', setSettings), [])

  // Another window handed this one a note (a dropped tab, or a second launch).
  useEffect(() => listenTo<string>('snug://open-tab', (path) => openPathRef.current(path)), [])

  // Dropping Markdown files on the window opens each as a tab.
  useEffect(
    () =>
      listenTo<{ paths?: string[] }>('tauri://drag-drop', (payload) => {
        for (const path of payload.paths ?? []) {
          if (isMarkdownFile(path)) openPathRef.current(path)
        }
      }),
    [],
  )

  // Closing the window asks first when any tab has unsaved changes. Declining keeps it open.
  useEffect(() => {
    if (!IS_TAURI) return
    let disposed = false
    let stop: (() => void) | undefined
    void currentWindow()
      .then((win) =>
        win.onCloseRequested(async (event) => {
          if (
            dirtyRef.current &&
            !(await askYesNo('Some tabs have unsaved changes. Close the window and discard them?'))
          ) {
            event.preventDefault()
            return
          }
          // A confirmed discard must not come back after a relaunch.
          try {
            for (const tab of tabsRef.current) {
              if (tab.dirty) await discardDraft(tab.path, drafts)
            }
          } catch (reason) {
            setNotice(`Could not discard the unsaved text: ${errorText(reason)}. The window stays open.`)
            event.preventDefault()
            return
          }
          closingRef.current = true
        }),
      )
      .then((unlisten) => {
        if (disposed) unlisten()
        else stop = unlisten
      })
      .catch((reason: unknown) => console.error('Could not handle window close', reason))
    return () => {
      disposed = true
      stop?.()
    }
  }, [])

  // Reloading the page with unsaved changes asks first. A confirmed close skips this.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || closingRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // The window title follows the active tab.
  useEffect(() => {
    if (!IS_TAURI) return
    const title = activeTab ? `Snug — ${basename(activeTab.path)}` : 'Snug'
    document.title = title
    void currentWindow()
      .then((win) => win.setTitle(title))
      .catch((reason: unknown) => console.error('Could not set the window title', reason))
  }, [activeTab?.path])

  const saveSettings = async (partial: Partial<AppSettings>) => {
    if (!IS_TAURI) {
      setSettings((previous) => ({ ...previous, ...partial }))
      return
    }
    try {
      setSettings(await updateSettings(partial))
    } catch (reason) {
      setNotice(errorText(reason))
    }
  }

  const toggleTheme = () =>
    void saveSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })

  const toggleLibrary = () =>
    void saveSettings({ view: settings.view === 'library' ? 'focus' : 'library' })

  const openFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const picked = await open({
        multiple: true,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      })
      const paths = Array.isArray(picked) ? picked : typeof picked === 'string' ? [picked] : []
      for (const path of paths) openPath(path)
    } catch (reason) {
      if (IS_TAURI) setNotice(errorText(reason))
    }
  }

  const openFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const folder = await open({ directory: true })
      if (typeof folder !== 'string') return
      await allowFolder(folder)
      setFiles(await invoke<string[]>('list_markdown_files', { folder }))
      await saveSettings({ last_folder: folder })
    } catch (reason) {
      if (IS_TAURI) setNotice(errorText(reason))
    }
  }

  const closeWindow = async () => {
    closingRef.current = true
    try {
      await (await currentWindow()).destroy()
    } catch (reason) {
      setNotice(errorText(reason))
    }
  }

  const closeTab = async (id: string) => {
    const tab = session.tabs.find((item) => item.id === id)
    if (!tab) return
    if (
      tab.dirty &&
      !(await askYesNo(`"${basename(tab.path)}" has unsaved changes. Close it and discard them?`))
    ) {
      return
    }
    if (tab.dirty) {
      try {
        await discardDraft(tab.path, drafts)
      } catch (reason) {
        setNotice(`Could not discard the unsaved text: ${errorText(reason)}. The tab stays open.`)
        return
      }
    }
    // Closing the last tab closes the window, as in a browser.
    if (session.tabs.length === 1 && IS_TAURI) {
      void closeWindow()
      return
    }
    dispatch({ type: 'close', id, force: true })
  }

  const closeActive = () => {
    if (activeTab) void closeTab(activeTab.id)
    else if (IS_TAURI) void closeWindow()
  }

  // A tab released away from the strip stays, joins another Snug window, or becomes a new window.
  const detachTab = async (id: string) => {
    const tab = session.tabs.find((item) => item.id === id)
    if (!tab || !IS_TAURI || !windowLabel) return
    if (tab.dirty) {
      setNotice('Save this tab before moving it to another window.')
      return
    }
    try {
      await invoke('drop_tab', { origin: windowLabel, path: tab.path })
      if (session.tabs.length === 1) await closeWindow()
      else dispatch({ type: 'close', id, force: true })
    } catch (reason) {
      setNotice(errorText(reason))
    }
  }

  const newWindow = async () => {
    if (!IS_TAURI) return
    try {
      await invoke('new_window')
    } catch (reason) {
      setNotice(errorText(reason))
    }
  }

  // Keyboard shortcuts, as in a browser. Ctrl+S and Esc belong to the active note pane.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      // Reloading would discard every open tab in this window, so the reload keys do nothing.
      if (event.key === 'F5' || (modifier && key === 'r')) {
        event.preventDefault()
      } else if (modifier && (key === 'o' || key === 't')) {
        event.preventDefault()
        void openFile()
      } else if (modifier && key === 'w') {
        event.preventDefault()
        closeActive()
      } else if (modifier && event.key === 'Tab') {
        event.preventDefault()
        dispatch({ type: 'cycle', step: event.shiftKey ? -1 : 1 })
      } else if (modifier && key === 'b') {
        event.preventDefault()
        toggleLibrary()
      } else if (modifier && key === 'f') {
        event.preventDefault()
        setFindOpen(true)
      } else if (modifier && key === 'n') {
        event.preventDefault()
        void newWindow()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div
      className={`theme-${settings.theme} snug-window`}
      style={
        {
          display: 'flex',
          ...paletteTokens(resolvePalette(settings.palette), settings.theme),
        } as CSSProperties
      }
    >
      <div className="snug-frame">
      {settings.view === 'library' && (
        <LibrarySidebar
          files={files}
          selected={
            files.find((file) => resolveNotePath(file, settings.last_folder) === activeTab?.path) ??
            null
          }
          onSelect={(relative) => openPath(resolveNotePath(relative, settings.last_folder))}
          onOpenFolder={() => void openFolder()}
        />
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Toolbar
          libraryOpen={settings.view === 'library'}
          theme={settings.theme}
          onToggleLibrary={toggleLibrary}
          onToggleTheme={toggleTheme}
          onOpen={() => void openFile()}
          palette={resolvePalette(settings.palette)}
          onPalette={(palette) => void saveSettings({ palette })}
        />
        {findOpen && (
          <div className="snug-find">
            <input
              autoFocus
              value={findText}
              placeholder="Find in note (Enter to search, Esc to close)"
              onChange={(event) => setFindText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const find = (window as unknown as { find: (text: string) => boolean }).find
                  find.call(window, findText)
                }
                if (event.key === 'Escape') {
                  // Esc closes only the find box; it must not also leave edit mode.
                  event.stopPropagation()
                  setFindOpen(false)
                }
              }}
            />
          </div>
        )}
        <TabStrip
          tabs={session.tabs}
          activeId={session.activeId}
          onSelect={(id) => dispatch({ type: 'select', id })}
          onClose={(id) => void closeTab(id)}
          onMove={(id, toIndex) => dispatch({ type: 'move', id, toIndex })}
          onDetach={(id) => void detachTab(id)}
          onNew={() => void openFile()}
        />
        {notice && <Notice kind="error" message={notice} onDismiss={() => setNotice(null)} />}
        {session.tabs.length === 0 && (
          <div className="snug-empty">
            <p>No note open.</p>
            <button className="snug-tool-button" onClick={() => void openFile()}>
              Open note…
            </button>
            <button className="snug-tool-button" onClick={() => void openFolder()}>
              Open folder…
            </button>
          </div>
        )}
        {session.tabs.map((tab) => (
          <NotePane
            key={tab.id}
            path={tab.path}
            active={tab.id === session.activeId}
            theme={settings.theme}
            fontSize={settings.font_size}
            io={io}
            drafts={drafts}
            onDirtyChange={(dirty) => dispatch({ type: 'markDirty', id: tab.id, dirty })}
            onOpenNote={openPath}
          />
        ))}
      </div>
      </div>
    </div>
  )
}
