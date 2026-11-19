import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface DocumentIo {
  read: (path: string) => Promise<string>
  write: (path: string, contents: string) => Promise<void>
}

/** Filesystem-backed IO, wired to the Rust commands. */
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
  error: string | null
}

export function useDocument(initialPath: string, io: DocumentIo = tauriDocumentIo): UseDocument {
  const [source, setSourceState] = useState('')
  const [savedSource, setSavedSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    io.read(initialPath)
      .then((text) => {
        if (cancelled) return
        setSourceState(text)
        setSavedSource(text)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : String(reason))
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
    await io.write(initialPath, source)
    setSavedSource(source)
    setError(null)
  }, [io, initialPath, source])

  const exit = useCallback(() => {
    if (source === savedSource) return true
    if (window.confirm('You have unsaved changes. Discard them?')) {
      setSourceState(savedSource)
      return true
    }
    return false
  }, [source, savedSource])

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
