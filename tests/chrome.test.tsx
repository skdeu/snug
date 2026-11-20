import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Icon from '../src/components/Icon'
import TabStrip from '../src/components/TabStrip'
import Toolbar from '../src/components/Toolbar'

describe('Icon', () => {
  it('is hidden from assistive technology when it has no label', () => {
    const { container } = render(<Icon name="library" />)
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('is an image with its label when labelled', () => {
    render(<Icon name="info" label="Information" />)
    expect(screen.getByRole('img', { name: 'Information' })).toBeTruthy()
  })
})

describe('TabStrip', () => {
  const tabs = [
    { id: 'a.md', path: 'C:/notes/a.md', dirty: false },
    { id: 'b.md', path: 'C:/notes/b.md', dirty: true },
  ]

  const strip = (activeId: string) => (
    <TabStrip
      tabs={tabs}
      activeId={activeId}
      onSelect={() => {}}
      onClose={() => {}}
      onMove={() => {}}
      onDetach={() => {}}
      onNew={() => {}}
    />
  )

  it('renders each tab with the tab role, and only the active tab is selected', () => {
    render(strip('b.md'))
    const tabElements = screen.getAllByRole('tab')
    expect(tabElements).toHaveLength(2)
    expect(tabElements.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true'])
  })

  it('shows the unsaved dot on a dirty tab only', () => {
    const { container } = render(strip('a.md'))
    const dots = container.querySelectorAll('.snug-tab-dirty')
    expect(dots).toHaveLength(1)
    expect(dots[0].closest('[data-tab-id]')!.getAttribute('data-tab-id')).toBe('b.md')
  })
})

describe('Toolbar', () => {
  it('marks Library as pressed while the library is open', () => {
    const { rerender } = render(
      <Toolbar
        libraryOpen
        theme="dark"
        onToggleLibrary={() => {}}
        onToggleTheme={() => {}}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Library' }).getAttribute('aria-pressed')).toBe('true')
    rerender(
      <Toolbar
        libraryOpen={false}
        theme="dark"
        onToggleLibrary={() => {}}
        onToggleTheme={() => {}}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Library' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('names the theme button for the theme it switches to', () => {
    render(
      <Toolbar
        libraryOpen={false}
        theme="dark"
        onToggleLibrary={() => {}}
        onToggleTheme={() => {}}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Light' })).toBeTruthy()
  })
})
