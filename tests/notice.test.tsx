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

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Notice from '../src/components/Notice'

describe('Notice', () => {
  it('shows an error as an alert with its message', () => {
    render(<Notice kind="error" message="Could not save" onDismiss={() => {}} />)
    expect(screen.getByRole('alert').textContent).toContain('Could not save')
  })

  it('shows information as a status message', () => {
    render(<Notice kind="info" message="Kept as a draft" onDismiss={() => {}} />)
    expect(screen.getByRole('status').textContent).toContain('Kept as a draft')
  })

  it('dismisses once when its × is pressed', () => {
    const onDismiss = vi.fn()
    render(<Notice kind="error" message="Could not save" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses when the card is clicked', () => {
    const onDismiss = vi.fn()
    render(<Notice kind="info" message="Kept as a draft" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('status'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has no dismiss button when it cannot be dismissed', () => {
    render(<Notice kind="error" message="This note did not load" />)
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })
})
