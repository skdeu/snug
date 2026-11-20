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
