import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Reader from '../src/components/Reader'

describe('Reader', () => {
  it('applies_dark_theme_by_default', () => {
    const { container } = render(
      <Reader source="# Hello" baseDir="" theme="dark" fontSize={18} />,
    )
    expect(container.querySelector('.snug-reader')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()
    expect(container.querySelector('.theme-dark')).not.toBeNull()
  })
})
