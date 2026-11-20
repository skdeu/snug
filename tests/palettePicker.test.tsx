import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Toolbar from '../src/components/Toolbar'

const base = {
  libraryOpen: false,
  theme: 'dark' as const,
  onToggleLibrary: () => {},
  onToggleTheme: () => {},
  onOpen: () => {},
}

describe('Colour swatches', () => {
  it('offers all five palettes by name and marks the current one', () => {
    render(<Toolbar {...base} palette="graphite" onPalette={() => {}} />)
    const group = screen.getByRole('group', { name: 'Colour' })
    const swatches = [...group.querySelectorAll('button')]
    expect(swatches.map((swatch) => swatch.getAttribute('aria-label'))).toEqual([
      'Graphite and sage',
      'Harbor teal',
      'Umber and brass',
      'Slate and ice',
      'Ash and rose',
    ])
    expect(screen.getByRole('button', { name: 'Graphite and sage' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Umber and brass' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('reports the palette the user picks', () => {
    const onPalette = vi.fn()
    render(<Toolbar {...base} palette="graphite" onPalette={onPalette} />)
    fireEvent.click(screen.getByRole('button', { name: 'Umber and brass' }))
    expect(onPalette).toHaveBeenCalledWith('umber')
  })

  it('is not shown when no palette handler is given', () => {
    render(<Toolbar {...base} />)
    expect(screen.queryByRole('group', { name: 'Colour' })).toBeNull()
  })

  it('has no native dropdown, which rendered white in the dark window', () => {
    const { container } = render(<Toolbar {...base} palette="graphite" onPalette={() => {}} />)
    expect(container.querySelector('select')).toBeNull()
  })
})
