// Copyright 2026 Sanjaykumar Sagadevan Vijayakumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  discardDraft,
  isChangedOnDisk,
  useDocument,
  type DocumentIo,
  type Draft,
  type DraftIo,
} from '../src/hooks/useDocument'

describe('isChangedOnDisk', () => {
  it('recognises the backend conflict when it arrives as a plain string', () => {
    expect(isChangedOnDisk('CHANGED_ON_DISK')).toBe(true)
  })

  it('recognises it as an Error too, and ignores other failures', () => {
    expect(isChangedOnDisk(new Error('CHANGED_ON_DISK'))).toBe(true)
    expect(isChangedOnDisk('Could not save file: denied')).toBe(false)
    expect(isChangedOnDisk(undefined)).toBe(false)
  })
})

function makeIo(initial = 'a', modified = 1000) {
  return {
    read: vi.fn(async (_path: string) => ({ text: initial, modified })),
    write: vi.fn(async (_path: string, _contents: string, _expected: number | undefined) => modified + 1),
  }
}

describe('useDocument', () => {
  it('save_clears_dirty', async () => {
    const io = makeIo('a')
    const { result } = renderHook(() => useDocument('note.md', io))
    await waitFor(() => expect(result.current.source).toBe('a'))

    act(() => result.current.setSource('b'))
    expect(result.current.dirty).toBe(true)

    await act(async () => {
      await result.current.save()
    })
    expect(io.write).toHaveBeenCalledWith('note.md', 'b', 1000)
    expect(result.current.dirty).toBe(false)
  })

  it('save_writes_to_current_path_after_switching_notes', async () => {
    const io = makeIo('a')
    const { result, rerender } = renderHook(({ path }) => useDocument(path, io), {
      initialProps: { path: 'a.md' },
    })
    await waitFor(() => expect(result.current.source).toBe('a'))
    rerender({ path: 'b.md' })
    await waitFor(() => expect(io.read).toHaveBeenCalledWith('b.md'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.save()
    })
    expect(io.write).toHaveBeenCalledWith('b.md', 'a', 1000)
  })

  it('save_reports_the_new_modified_time_for_the_next_save', async () => {
    const io = makeIo('a', 1000)
    const { result } = renderHook(() => useDocument('note.md', io))
    await waitFor(() => expect(result.current.source).toBe('a'))

    act(() => result.current.setSource('b'))
    await act(() => result.current.save())
    act(() => result.current.setSource('c'))
    await act(() => result.current.save())

    expect(io.write).toHaveBeenNthCalledWith(1, 'note.md', 'b', 1000)
    expect(io.write).toHaveBeenNthCalledWith(2, 'note.md', 'c', 1001)
  })

  it('overwrite_saves_without_the_modified_check', async () => {
    const io = makeIo('a', 1000)
    const { result } = renderHook(() => useDocument('note.md', io))
    await waitFor(() => expect(result.current.source).toBe('a'))

    act(() => result.current.setSource('mine'))
    await act(() => result.current.save(true))
    expect(io.write).toHaveBeenCalledWith('note.md', 'mine', undefined)
  })

  it('a conflict is reported to the caller and keeps the edits', async () => {
    const io: DocumentIo = {
      read: async () => ({ text: 'a', modified: 1 }),
      write: async () => {
        throw new Error('CHANGED_ON_DISK')
      },
    }
    const { result } = renderHook(() => useDocument('note.md', io))
    await waitFor(() => expect(result.current.source).toBe('a'))

    act(() => result.current.setSource('mine'))
    await act(async () => {
      await expect(result.current.save()).rejects.toThrow('CHANGED_ON_DISK')
    })
    expect(result.current.source).toBe('mine')
    expect(result.current.dirty).toBe(true)
  })

  it('exit_discard_restores_saved_source', async () => {
    const io = makeIo('saved')
    const { result } = renderHook(() => useDocument('note.md', io))
    await waitFor(() => expect(result.current.source).toBe('saved'))

    act(() => result.current.setSource('changed'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let exited = false
    await act(async () => {
      exited = await result.current.exit()
    })
    expect(exited).toBe(true)
    expect(result.current.source).toBe('saved')
    expect(result.current.dirty).toBe(false)
    vi.restoreAllMocks()
  })

  it('read_error_is_reported', async () => {
    const io: DocumentIo = {
      read: async () => {
        throw new Error('File is not valid UTF-8')
      },
      write: async () => 0,
    }
    const { result } = renderHook(() => useDocument('bad.md', io))
    await waitFor(() => expect(result.current.error).toBe('File is not valid UTF-8'))
  })

  it('dirty_exit_requires_confirmation', async () => {
    const io = makeIo('a')
    const { result } = renderHook(() => useDocument('note.md', io))
    await waitFor(() => expect(result.current.source).toBe('a'))

    act(() => result.current.setSource('b'))
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    let exited = true
    await act(async () => {
      exited = await result.current.exit()
    })
    expect(exited).toBe(false)
    vi.restoreAllMocks()
  })
})

/**
 * A fake DraftIo for one note that records every call, in order, into `calls`. Like the real
 * store, read returns what write stored, and remove / keepAside clear it. `disk.draft` can be
 * set directly to simulate another window writing.
 */
function makeDrafts(stored: Draft | null = null, asidePath = 'C:\\drafts\\note.recovered-1.md') {
  const calls: string[] = []
  const disk = { draft: stored }
  const drafts = {
    calls,
    disk,
    read: vi.fn(async (_path: string): Promise<Draft | null> => {
      calls.push('read')
      return disk.draft
    }),
    write: vi.fn(async (path: string, text: string, baseModified: number) => {
      calls.push('write')
      disk.draft = { path, text, base_modified: baseModified }
    }),
    remove: vi.fn(async (_path: string) => {
      calls.push('remove')
      disk.draft = null
    }),
    keepAside: vi.fn(async (_path: string) => {
      calls.push('keepAside')
      disk.draft = null
      return asidePath
    }),
  }
  return drafts satisfies DraftIo & { calls: string[] }
}

/** Lets pending promises and any due fake timers run inside act. */
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('useDocument drafts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores_a_matching_draft_as_unsaved', async () => {
    const path = 'restore.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts({ path, text: 'edited', base_modified: 5 })
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()

    expect(result.current.loading).toBe(false)
    expect(result.current.source).toBe('edited')
    expect(result.current.dirty).toBe(true)
    expect(drafts.remove).not.toHaveBeenCalled()
  })

  it('a_draft_for_a_changed_file_is_kept_aside_and_reported', async () => {
    const path = 'changed.md'
    const io = makeIo('file text', 5)
    const aside = 'C:\\drafts\\changed.recovered-abc.md'
    const drafts = makeDrafts({ path, text: 'old edit', base_modified: 4 }, aside)
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()

    expect(drafts.keepAside).toHaveBeenCalledTimes(1)
    expect(drafts.keepAside).toHaveBeenCalledWith(path)
    expect(result.current.notice).toContain(aside)
    expect(result.current.notice).toBe(
      `Unsaved text from before the file changed on disk was kept in ${aside}.`,
    )
    expect(result.current.source).toBe('file text')
    expect(result.current.dirty).toBe(false)
  })

  it('a_clean_instance_leaves_an_existing_draft_alone', async () => {
    const path = 'clean.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts(null)
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()
    expect(result.current.source).toBe('file text')

    await flush(5000)
    expect(drafts.remove).not.toHaveBeenCalled()
    expect(drafts.write).not.toHaveBeenCalled()
  })

  it('writes_a_draft_1000_ms_after_the_last_change', async () => {
    const path = 'debounce.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts(null)
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()

    act(() => result.current.setSource('a'))
    await flush(999)
    expect(drafts.write).not.toHaveBeenCalled()
    await flush(1)
    expect(drafts.write).toHaveBeenCalledTimes(1)
    expect(drafts.write).toHaveBeenCalledWith(path, 'a', 5)
  })

  it('removes_the_draft_it_wrote_once_saved', async () => {
    const path = 'saved.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts(null)
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()

    act(() => result.current.setSource('a'))
    await flush(1000)
    expect(drafts.write).toHaveBeenCalledTimes(1)

    await act(() => result.current.save())
    await flush()
    expect(result.current.dirty).toBe(false)
    expect(drafts.remove).toHaveBeenCalledTimes(1)
    expect(drafts.remove).toHaveBeenCalledWith(path)
  })

  it('a_discarded_draft_is_not_written_again', async () => {
    const path = 'discarded.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts(null)
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()

    act(() => result.current.setSource('a'))
    await act(() => discardDraft(path, drafts))
    await flush(2000)
    expect(drafts.write).not.toHaveBeenCalled()
  })

  it('reads_the_draft_before_removing_anything', async () => {
    const path = 'order.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts({ path, text: 'edited', base_modified: 5 })
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()
    expect(result.current.source).toBe('edited')

    // R11: a restored draft is not owned; this instance must write before it may remove.
    act(() => result.current.setSource('edited more'))
    await flush(1000)
    await act(() => result.current.save())
    await flush()
    expect(drafts.calls).toContain('remove')
    expect(drafts.calls.indexOf('read')).toBeGreaterThanOrEqual(0)
    expect(drafts.calls.indexOf('read')).toBeLessThan(drafts.calls.indexOf('remove'))
  })

  it('a_restoring_instance_that_saves_without_editing_removes_the_restored_draft', async () => {
    // R13 replaces R11's removal rule: the restored text is still on disk, so save removes it.
    const path = 'r13-restore-save.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts({ path, text: 'edited', base_modified: 5 })
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()
    expect(result.current.source).toBe('edited')

    await flush(2000)
    expect(drafts.write).not.toHaveBeenCalled()

    await act(() => result.current.save())
    await flush(2000)
    expect(result.current.dirty).toBe(false)
    expect(drafts.remove).toHaveBeenCalledTimes(1)
    expect(drafts.write).not.toHaveBeenCalled()
  })

  it('discarding_a_restored_draft_removes_it', async () => {
    const path = 'r13-restore-discard.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts({ path, text: 'edited', base_modified: 5 })
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()
    expect(result.current.source).toBe('edited')

    await act(() => discardDraft(path, drafts))
    await flush()
    expect(drafts.remove).toHaveBeenCalledTimes(1)
    expect(drafts.remove).toHaveBeenCalledWith(path)
  })

  it('discard_then_unmount_still_removes_the_restored_draft', async () => {
    const path = 'r13-discard-unmount.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts({ path, text: 'edited', base_modified: 5 })
    const { result, unmount } = renderHook(() => useDocument(path, io, drafts))
    await flush()
    expect(result.current.source).toBe('edited')

    // Task 6 closes the instance right after discarding, before the queued removal runs.
    const discarding = discardDraft(path, drafts)
    unmount()
    await act(() => discarding)
    await flush()
    expect(drafts.remove).toHaveBeenCalledTimes(1)
  })

  it('another_windows_newer_draft_survives_a_discard', async () => {
    const path = 'r13-newer-elsewhere.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts({ path, text: 'edited', base_modified: 5 })
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()
    expect(result.current.source).toBe('edited')

    // Another window wrote newer text for the same note.
    drafts.disk.draft = { path, text: 'newer from another window', base_modified: 5 }
    await act(() => discardDraft(path, drafts))
    await flush()
    expect(drafts.remove).not.toHaveBeenCalled()
    expect(drafts.disk.draft?.text).toBe('newer from another window')
  })

  it('a_discard_waits_for_an_in_flight_write_before_removing', async () => {
    const path = 'r13-deferred-write.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts(null)
    let finishWrite: () => void = () => {}
    drafts.write.mockImplementationOnce(
      (p: string, text: string, base: number) =>
        new Promise<void>((resolve) => {
          drafts.calls.push('write')
          finishWrite = () => {
            drafts.disk.draft = { path: p, text, base_modified: base }
            resolve()
          }
        }),
    )
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()

    act(() => result.current.setSource('a'))
    await flush(1000)
    expect(drafts.write).toHaveBeenCalledTimes(1)

    let discarded = false
    void discardDraft(path, drafts).then(() => {
      discarded = true
    })
    await flush(2000)
    expect(drafts.remove).not.toHaveBeenCalled()
    expect(discarded).toBe(false)

    await act(async () => {
      finishWrite()
    })
    await flush()
    expect(drafts.remove).toHaveBeenCalledTimes(1)
    expect(discarded).toBe(true)
    expect(drafts.calls.lastIndexOf('write')).toBeLessThan(drafts.calls.indexOf('remove'))
    expect(drafts.disk.draft).toBeNull()
  })

  it('a_draft_is_never_applied_when_the_file_time_is_unknown', async () => {
    const path = 'r13-modified-zero.md'
    const io = makeIo('file text', 0)
    const drafts = makeDrafts({ path, text: 'edited', base_modified: 0 })
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()

    expect(drafts.keepAside).toHaveBeenCalledTimes(1)
    expect(result.current.source).toBe('file text')
    expect(result.current.dirty).toBe(false)
    expect(result.current.notice).toContain('note.recovered-1.md')
  })

  it('restore_then_edit_then_save_writes_once_and_removes_once', async () => {
    const path = 'r11-restore-edit-save.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts({ path, text: 'edited', base_modified: 5 })
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()

    act(() => result.current.setSource('edited more'))
    await flush(1000)
    expect(drafts.write).toHaveBeenCalledTimes(1)
    expect(drafts.write).toHaveBeenCalledWith(path, 'edited more', 5)
    expect(drafts.remove).not.toHaveBeenCalled()

    await act(() => result.current.save())
    await flush()
    expect(drafts.remove).toHaveBeenCalledTimes(1)
    expect(drafts.remove).toHaveBeenCalledWith(path)
    expect(drafts.write).toHaveBeenCalledTimes(1)
  })

  it('no_draft_is_written_after_keep_aside_fails', async () => {
    const path = 'r12-keepaside-fails.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts({ path, text: 'old edit', base_modified: 4 })
    drafts.keepAside.mockRejectedValueOnce('Could not keep the draft aside: denied')
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()
    expect(result.current.source).toBe('file text')

    act(() => result.current.setSource('new edit'))
    await flush(2000)
    expect(drafts.write).not.toHaveBeenCalled()
  })

  it('no_draft_is_written_after_reading_the_draft_fails', async () => {
    const path = 'r12-read-fails.md'
    const io = makeIo('file text', 5)
    const drafts = makeDrafts(null)
    drafts.read.mockRejectedValueOnce('Could not read draft')
    const { result } = renderHook(() => useDocument(path, io, drafts))
    await flush()
    expect(result.current.source).toBe('file text')

    act(() => result.current.setSource('new edit'))
    await flush(2000)
    expect(drafts.write).not.toHaveBeenCalled()
  })
})
