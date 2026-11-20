import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { isChangedOnDisk, useDocument, type DocumentIo } from '../src/hooks/useDocument'

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
