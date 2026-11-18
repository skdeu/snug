import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LibrarySidebar from '../src/components/LibrarySidebar'

function renderSidebar(files: string[]) {
  return render(
    <LibrarySidebar
      files={files}
      selected={null}
      onSelect={vi.fn()}
      onOpenFolder={vi.fn()}
    />,
  )
}

describe('LibrarySidebar', () => {
  it('filters_files_case_insensitively', () => {
    renderSidebar(['Weekly.md', 'ideas.md', 'READING.md'])
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'read' },
    })
    expect(screen.queryByText('Weekly.md')).toBeNull()
    expect(screen.queryByText('ideas.md')).toBeNull()
    expect(screen.getByText('READING.md')).toBeTruthy()
  })

  it('shows_nested_path', () => {
    renderSidebar(['nested/note.md'])
    expect(screen.getByText('nested/note.md')).toBeTruthy()
  })
})
