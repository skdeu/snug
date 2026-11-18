import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface DocumentIo {
  read: (path: string) => Promise<string>
  write: (path: string, contents: string) => Promise<void>
}

/** Filesystem-backed IO. Wired to the Rust commands added in Task 2. */
export const tauriDocumentIo: DocumentIo = {
  read: (path) => invoke<string>('read_markdown', { path }),
  write: (path, contents) => invoke('write_markdown', { path, contents }),
}

export interface UseDocument {
  source: string
  setSource: (source: string) => void
  dirty: boolean
  save: () => Promise<void>
  exit: () => boolean
  loading: boolean
}

export function useDocument(initialPath: string, io: DocumentIo = tauriDocumentIo): UseDocument {
  const [path] = useState(initialPath)
  const [source, setSourceState] = useState('')
  const [savedSource, setSavedSource] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    io.read(initialPath)
      .then((text) => {
        if (cancelled) return
        setSourceState(text)
        setSavedSource(text)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setSourceState('')
        setSavedSource('')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialPath, io])

  const setSource = useCallback((next: string) => setSourceState(next), [])

  const save = useCallback(async () => {
    await io.write(path, source)
    setSavedSource(source)
  }, [io, path, source])

  const exit = useCallback(() => {
    if (source === savedSource) return true
    return window.confirm('You have unsaved changes. Discard them?')
  }, [source, savedSource])

  return { source, setSource, dirty: source !== savedSource, save, exit, loading }
}
