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
