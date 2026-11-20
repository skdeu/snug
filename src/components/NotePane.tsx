import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Editor from './Editor'
import Reader from './Reader'
import { isChangedOnDisk, useDocument, type DocumentIo } from '../hooks/useDocument'
import { askYesNo } from '../lib/dialogs'
import { dirnameOf, linkedNotePath } from '../lib/paths'
import type { Theme } from '../lib/theme'

interface NotePaneProps {
  path: string
  active: boolean
  theme: Theme
  fontSize: number
  io: DocumentIo
  onDirtyChange: (dirty: boolean) => void
  /** Open a linked note as a tab in this window. */
  onOpenNote: (path: string) => void
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * One open note. Each tab keeps its own document, so unsaved edits survive switching
 * tabs, and only the active tab responds to Ctrl+S and Esc.
 */
export default function NotePane({
  path,
  active,
  theme,
  fontSize,
  io,
  onDirtyChange,
  onOpenNote,
}: NotePaneProps) {
  const doc = useDocument(path, io)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const dirtyRef = useRef(onDirtyChange)
  dirtyRef.current = onDirtyChange
  useEffect(() => {
    dirtyRef.current(doc.dirty)
  }, [doc.dirty])

  const saveNow = async () => {
    setMessage(null)
    try {
      await doc.save()
    } catch (reason) {
      if (!isChangedOnDisk(reason)) {
        setMessage(errorText(reason))
        return
      }
      const overwrite = await askYesNo(
        'This note changed on disk since you opened it.\n\nOverwrite the changed file with your version?',
      )
      if (!overwrite) {
        setMessage('Not saved: the file changed on disk.')
        return
      }
      try {
        await doc.save(true)
      } catch (again) {
        setMessage(errorText(again))
      }
    }
  }

  const finishEdit = async () => {
    if (await doc.exit()) setEditing(false)
  }

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!editing) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveNow()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        void finishEdit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const followLink = (href: string) => {
    setMessage(null)
    const note = linkedNotePath(dirnameOf(path), href)
    if (note) {
      onOpenNote(note)
      return
    }
    if (/^(https?:|mailto:)/i.test(href)) {
      void (async () => {
        try {
          await invoke('open_external', { url: href })
        } catch (reason) {
          setMessage(errorText(reason))
        }
      })()
      return
    }
    setMessage(`This link does not open in Snug: ${href}`)
  }

  return (
    <div className="snug-pane" style={active ? undefined : { display: 'none' }}>
      {doc.error && <div className="snug-error">{doc.error}</div>}
      {message && <div className="snug-error">{message}</div>}
      {editing && !doc.loading ? (
        <>
          <Editor
            value={doc.source}
            onChange={doc.setSource}
            onSave={() => void saveNow()}
            onExit={finishEdit}
          />
          <div className="snug-editor-status">
            <button className="snug-tool-button" onClick={() => void saveNow()}>
              Save
            </button>
            <span>{doc.dirty ? '● Unsaved' : 'Saved'} · Ctrl+S to save · Esc to exit</span>
          </div>
        </>
      ) : (
        <Reader
          source={doc.source}
          baseDir={dirnameOf(path)}
          theme={theme}
          fontSize={fontSize}
          // A note that is still loading or failed to load must not be edited.
          onEdit={doc.loading || doc.error ? undefined : () => setEditing(true)}
          onLink={followLink}
        />
      )}
    </div>
  )
}
