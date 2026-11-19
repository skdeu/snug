import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDocument, type DocumentIo } from '../src/hooks/useDocument'

function makeIo(initial = 'a') {
  return {
    read: vi.fn(async (_path: string) => initial),
    write: vi.fn(async (_path: string, _contents: string) => {}),
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
    expect(io.write).toHaveBeenCalledWith('note.md', 'b')
    expect(result.current.dirty).toBe(false)
  })

  it('save_writes_to_current_path_after_switching_notes', async () => {
    const io = makeIo('a')
    const { result, rerender } = renderHook(
      ({ path }) => useDocument(path, io),
      { initialProps: { path: 'a.md' } },
    )
    await waitFor(() => expect(result.current.source).toBe('a'))
    rerender({ path: 'b.md' })
    await waitFor(() => expect(io.read).toHaveBeenCalledWith('b.md'))

    await act(async () => {
      await result.current.save()
    })
    expect(io.write).toHaveBeenCalledWith('b.md', 'a')
  })

  it('exit_discard_restores_saved_source', async () => {
    const io = makeIo('saved')
    const { result } = renderHook(() => useDocument('note.md', io))
    await waitFor(() => expect(result.current.source).toBe('saved'))

    act(() => result.current.setSource('changed'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let exited = false
    act(() => {
      exited = result.current.exit()
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
      write: async () => {},
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
    act(() => {
      exited = result.current.exit()
    })
    expect(exited).toBe(false)
    vi.restoreAllMocks()
  })
})
