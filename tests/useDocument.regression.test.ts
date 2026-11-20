import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDocument, type DocumentIo } from '../src/hooks/useDocument'

function makeIo(files: Record<string, string>) {
  const writes: Array<[string, string]> = []
  const io: DocumentIo = {
    read: vi.fn(async (path: string) => {
      if (!(path in files)) throw new Error(`File not found: ${path}`)
      return { text: files[path], modified: 1 }
    }),
    write: vi.fn(async (path: string, contents: string) => {
      writes.push([path, contents])
      files[path] = contents
      return 2
    }),
  }
  return { io, writes }
}

describe('useDocument regressions', () => {
  it('never shows the previous note text while a new note loads', async () => {
    const { io } = makeIo({ 'a.md': '# A', 'b.md': '# B' })
    const { result, rerender } = renderHook(({ path }) => useDocument(path, io), {
      initialProps: { path: 'a.md' },
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ path: 'b.md' })

    expect(result.current.source).not.toBe('# A')
    await waitFor(() => expect(result.current.source).toBe('# B'))
  })

  it('refuses to save a note that failed to load, so the file is never overwritten', async () => {
    const { io, writes } = makeIo({})
    const { result } = renderHook(() => useDocument('missing.md', io))
    await waitFor(() => expect(result.current.error).not.toBeNull())

    await act(async () => {
      await expect(result.current.save()).rejects.toThrow()
    })
    expect(writes).toEqual([])
  })
})
