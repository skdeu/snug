import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { askYesNo } from '../lib/dialogs'

/** A note's text and the time it was last changed on disk (ms since 1970, 0 if unknown). */
export interface LoadedText {
  text: string
  modified: number
}

export interface DocumentIo {
  read: (path: string) => Promise<LoadedText>
  /**
   * Saves `contents`. When `expectedModified` is given the save is refused if the file
   * changed since then. Resolves with the file's new modified time.
   */
  write: (path: string, contents: string, expectedModified: number | undefined) => Promise<number>
}

/** The error text the backend uses when a note changed on disk since it was loaded. */
export const CHANGED_ON_DISK = 'CHANGED_ON_DISK'

/**
 * Tauri rejects an invoke with the backend's message as a plain string, not an Error,
 * so both forms must be recognised.
 */
export function isChangedOnDisk(reason: unknown): boolean {
  const text = reason instanceof Error ? reason.message : String(reason)
  return text === CHANGED_ON_DISK
}

/** Filesystem-backed IO, wired to the Rust commands. */
export const tauriDocumentIo: DocumentIo = {
  read: (path) => invoke<{ text: string; modified: number }>('read_markdown', { path }).then(
    (document) => ({ text: document.text, modified: document.modified }),
  ),
  write: (path, contents, expectedModified) =>
    invoke<number>('write_markdown', {
      path,
      contents,
      expectedModified: expectedModified ?? null,
    }),
}

export interface UseDocument {
  source: string
  setSource: (source: string) => void
  dirty: boolean
  /** Saves the note. Throws a CHANGED_ON_DISK error when the file changed elsewhere. */
  save: (overwrite?: boolean) => Promise<void>
  /** Leaves edit mode. Asks first when there are unsaved changes; resolves true when it is safe to leave. */
  exit: () => Promise<boolean>
  loading: boolean
  error: string | null
}

interface Loaded {
  path: string
  source: string
  saved: string
  modified: number
  error: string | null
}

export function useDocument(initialPath: string, io: DocumentIo = tauriDocumentIo): UseDocument {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  // Only trust text that was loaded for the path being shown right now. This is
  // what stops one note's text from appearing, or being saved, under another path.
  const current = loaded && loaded.path === initialPath ? loaded : null
  const loading = initialPath !== '' && current === null
  const source = current?.source ?? ''
  const savedSource = current?.saved ?? ''
  const error = current?.error ?? null

  useEffect(() => {
    // An empty path means there is no active note; there is nothing to read.
    if (!initialPath) return
    let cancelled = false
    setLoaded(null)
    io.read(initialPath)
      .then(({ text, modified }) => {
        if (!cancelled) {
          setLoaded({ path: initialPath, source: text, saved: text, modified, error: null })
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setLoaded({
          path: initialPath,
          source: '',
          saved: '',
          modified: 0,
          error: reason instanceof Error ? reason.message : String(reason),
        })
      })
    return () => {
      cancelled = true
    }
  }, [initialPath, io])

  const setSource = useCallback(
    (next: string) =>
      setLoaded((prev) =>
        prev && prev.path === initialPath && !prev.error ? { ...prev, source: next } : prev,
      ),
    [initialPath],
  )

  const save = useCallback(
    async (overwrite = false) => {
      if (!initialPath) throw new Error('No note is open.')
      // A note that failed to load has no trustworthy text; writing it would destroy the file.
      if (loading || error) throw new Error('This note did not load, so it was not saved.')
      const written = await io.write(
        initialPath,
        source,
        overwrite ? undefined : current?.modified,
      )
      setLoaded((prev) =>
        prev && prev.path === initialPath
          ? { ...prev, saved: source, modified: written }
          : prev,
      )
    },
    [io, initialPath, loading, error, source, current],
  )

  const exit = useCallback(async () => {
    if (source === savedSource) return true
    if (await askYesNo('You have unsaved changes. Discard them?')) {
      setLoaded((prev) =>
        prev && prev.path === initialPath ? { ...prev, source: prev.saved } : prev,
      )
      return true
    }
    return false
  }, [source, savedSource, initialPath])

  return {
    source,
    setSource,
    dirty: source !== savedSource,
    save,
    exit,
    loading,
    error,
  }
}
