import { useCallback, useEffect, useRef, useState } from 'react'
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

/** Unsaved text kept while typing, so a crash or forced shutdown does not lose it. */
export interface Draft {
  path: string
  text: string
  /** The note's modified time on disk when the draft was written. */
  base_modified: number
}

export interface DraftIo {
  read: (path: string) => Promise<Draft | null>
  write: (path: string, text: string, baseModified: number) => Promise<void>
  remove: (path: string) => Promise<void>
  /** Moves the draft to a readable .md file and resolves with that file's full path. */
  keepAside: (path: string) => Promise<string>
}

/** Keeps no drafts. Used by default, in the browser preview and in tests. */
export const noDraftIo: DraftIo = {
  read: async () => null,
  write: async () => {},
  remove: async () => {},
  keepAside: async () => '',
}

/** Draft storage, wired to the Rust commands. */
export const tauriDraftIo: DraftIo = {
  read: (path) =>
    invoke<Draft | null>('read_draft', { path }).then((draft) =>
      draft
        ? { path: draft.path, text: draft.text, base_modified: draft.base_modified }
        : null,
    ),
  write: (path, text, baseModified) => invoke<void>('write_draft', { path, text, baseModified }),
  remove: (path) => invoke<void>('delete_draft', { path }),
  keepAside: (path) => invoke<string>('keep_draft_aside', { path }),
}

/** How long typing must pause before the draft is written. */
const DRAFT_DELAY_MS = 1000

/**
 * Path -> the draft text this window last wrote or restored for it (ruling R13). A window
 * removes a draft only when the draft on disk still holds exactly this text, so it never
 * deletes another window's newer draft.
 */
const knownDrafts = new Map<string, string>()

/** Paths whose unsaved text was discarded. A pending debounced write for them is dropped. */
const discarded = new Set<string>()

/**
 * Paths whose draft could not be read or kept aside (ruling R12). An unknown draft may still
 * sit on disk, so no draft is written for them until the note is loaded again.
 */
const blockedDrafts = new Set<string>()

/**
 * Draft writes and removes for one path run one after another, in the order they were
 * asked for. This stops a slow write from landing after the remove that should follow it,
 * which would bring a discarded draft back.
 */
const draftQueue = new Map<string, Promise<void>>()

function queueDraft(path: string, op: () => Promise<void>): Promise<void> {
  const previous = draftQueue.get(path) ?? Promise.resolve()
  const next = previous.then(op).catch(() => {
    // A failed draft write or remove must never break editing; the note itself is unaffected.
  })
  draftQueue.set(path, next)
  void next.then(() => {
    if (draftQueue.get(path) === next) draftQueue.delete(path)
  })
  return next
}

/**
 * Removes the draft for `path` only if the draft on disk holds exactly the text this window
 * last wrote or restored (R13). Runs on the path's queue, so it follows any in-flight write.
 *
 * The known text is taken when the removal is asked for. Every write asked for earlier is
 * already reflected in it (writes record their text when they are queued), and any write asked
 * for later runs after this removal. Taking it now also keeps a discard working when the
 * instance unmounts before the queued job runs (unmount forgets the known text).
 */
function removeOwnDraft(path: string, drafts: DraftIo): Promise<void> {
  const known = knownDrafts.get(path)
  if (known === undefined) return Promise.resolve()
  return queueDraft(path, async () => {
    const onDisk = await drafts.read(path)
    if (onDisk?.text !== known) return
    await drafts.remove(path)
    if (knownDrafts.get(path) === known) knownDrafts.delete(path)
  })
}

/**
 * Called when the user confirms discarding unsaved text. Drops any pending draft write
 * for `path`, and removes the draft if it still holds this window's text.
 */
export function discardDraft(path: string, drafts: DraftIo = tauriDraftIo): Promise<void> {
  discarded.add(path)
  return removeOwnDraft(path, drafts)
}

export function keptAsideNotice(fullPath: string): string {
  return `Unsaved text from before the file changed on disk was kept in ${fullPath}.`
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
  /** A message about drafts the user should see, such as text that was kept aside. */
  notice: string | null
}

interface Loaded {
  path: string
  source: string
  saved: string
  modified: number
  error: string | null
  notice: string | null
}

export function useDocument(
  initialPath: string,
  io: DocumentIo = tauriDocumentIo,
  drafts: DraftIo = noDraftIo,
): UseDocument {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // The draft text this instance last restored or wrote for a path. A draft is written only
  // when the text differs from it, so restoring alone never writes.
  const lastDraft = useRef<{ path: string; text: string } | null>(null)
  // The path this instance put into knownDrafts, so it can forget it on unmount or path change.
  const knownHere = useRef<string | null>(null)

  // Only trust text that was loaded for the path being shown right now. This is
  // what stops one note's text from appearing, or being saved, under another path.
  const current = loaded && loaded.path === initialPath ? loaded : null
  const loading = initialPath !== '' && current === null
  const source = current?.source ?? ''
  const savedSource = current?.saved ?? ''
  const error = current?.error ?? null
  const notice = current?.notice ?? null
  const currentModified = current?.modified ?? 0
  const currentPath = current && !current.error ? current.path : null

  useEffect(() => {
    // An empty path means there is no active note; there is nothing to read.
    if (!initialPath) return
    let cancelled = false
    setLoaded(null)
    lastDraft.current = null
    // Loading the note again starts fresh: earlier discards and blocks no longer apply.
    discarded.delete(initialPath)
    blockedDrafts.delete(initialPath)
    // The draft is read before anything can write or remove one (rule 1). A failed
    // draft read still lets the note open, but blocks draft writes for it (R12).
    const draftRead = drafts.read(initialPath).catch(() => {
      if (!cancelled) blockedDrafts.add(initialPath)
      return null
    })
    Promise.all([io.read(initialPath), draftRead])
      .then(async ([{ text, modified }, draft]) => {
        if (cancelled) return
        let source = text
        let notice: string | null = null
        if (draft && modified !== 0 && draft.base_modified === modified) {
          // The draft was made against this very file: bring it back as unsaved text.
          // It is not written again until the text changes (R11).
          source = draft.text
          lastDraft.current = { path: initialPath, text: draft.text }
          knownDrafts.set(initialPath, draft.text)
          knownHere.current = initialPath
        } else if (draft) {
          // The file changed on disk since the draft was made, or its time is unknown (0).
          // Never apply the draft over it; move it to a readable file and say where it went.
          try {
            const keptAt = await drafts.keepAside(initialPath)
            notice = keptAsideNotice(keptAt)
          } catch {
            // The old draft is still on disk and is not ours: never write over it (R12).
            notice = null
            if (!cancelled) blockedDrafts.add(initialPath)
          }
          if (cancelled) return
        }
        setLoaded({ path: initialPath, source, saved: text, modified, error: null, notice })
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setLoaded({
          path: initialPath,
          source: '',
          saved: '',
          modified: 0,
          error: reason instanceof Error ? reason.message : String(reason),
          notice: null,
        })
      })
    return () => {
      cancelled = true
      // This instance stops tracking the path. The draft stays on disk, so a crash or
      // forced shutdown still brings it back; a queued removal keeps its own copy.
      if (knownHere.current === initialPath) {
        knownDrafts.delete(initialPath)
        knownHere.current = null
      }
    }
  }, [initialPath, io, drafts])

  // Write the draft after a pause in typing; remove it once the text is clean again.
  useEffect(() => {
    // Nothing happens until the note and its draft were read (rule 1).
    if (!currentPath) return
    const path = currentPath
    if (source !== savedSource) {
      const text = source
      const baseModified = currentModified
      const timer = setTimeout(() => {
        // A confirmed discard must not come back, even from a write that was pending.
        if (discarded.has(path)) return
        // An unknown draft may be on disk for this path (R12).
        if (blockedDrafts.has(path)) return
        // Nothing new since the draft this instance restored or last wrote (R11).
        if (lastDraft.current?.path === path && lastDraft.current.text === text) return
        lastDraft.current = { path, text }
        knownDrafts.set(path, text)
        knownHere.current = path
        void queueDraft(path, () => drafts.write(path, text, baseModified))
      }, DRAFT_DELAY_MS)
      return () => clearTimeout(timer)
    }
    // Clean: saved, or the changes were discarded. Remove the draft only if it still holds
    // the text this window wrote or restored (R13).
    lastDraft.current = null
    void removeOwnDraft(path, drafts)
  }, [currentPath, source, savedSource, currentModified, drafts])

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
    notice,
  }
}
