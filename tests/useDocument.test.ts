import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDocument } from '../src/hooks/useDocument'

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
