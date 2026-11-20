import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

/** Panes that are on screen (the active tab's pane). */
function visiblePanes(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.snug-pane')].filter(
    (pane) => pane.style.display !== 'none',
  )
}

function visibleEditors(): Element[] {
  return visiblePanes().flatMap((pane) => [...pane.querySelectorAll('.snug-editor')])
}

function tabElement(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)
  if (!element) throw new Error(`no tab ${id}`)
  return element
}

async function openFromLibrary(name: string) {
  fireEvent.click(screen.getByText('▤ Library'))
  fireEvent.click(await screen.findByRole('button', { name }))
}

describe('App (browser preview)', () => {
  it('each tab keeps its own edit mode, and a hidden note never shows in the visible pane', async () => {
    render(<App />)
    await screen.findByText(/Weekly reading notes/)

    fireEvent.click(screen.getByText('✎ Edit'))
    expect(visibleEditors()).toHaveLength(1)

    await openFromLibrary('ideas.md')
    await screen.findByText('A place for half-formed thoughts.')
    // The weekly note is still in edit mode, but it is hidden.
    expect(document.querySelectorAll('.snug-editor')).toHaveLength(1)
    expect(visibleEditors()).toHaveLength(0)

    // Back on the weekly note, its editor is still there, with its own state.
    fireEvent.click(tabElement('weekly-notes.md'))
    expect(visibleEditors()).toHaveLength(1)
  })

  it('opening a note that is already open selects its tab instead of adding one', async () => {
    render(<App />)
    await screen.findByText(/Weekly reading notes/)

    fireEvent.click(screen.getByText('▤ Library'))
    fireEvent.click(await screen.findByRole('button', { name: 'ideas.md' }))
    fireEvent.click(await screen.findByRole('button', { name: 'weekly-notes.md' }))

    expect(document.querySelectorAll('[data-tab-id]')).toHaveLength(2)
    expect(tabElement('weekly-notes.md').className).toContain('active')
  })

  it('middle-click closes a tab', async () => {
    render(<App />)
    await screen.findByText(/Weekly reading notes/)
    await openFromLibrary('ideas.md')

    fireEvent(tabElement('ideas.md'), new MouseEvent('auxclick', { bubbles: true, button: 1 }))

    expect(document.querySelector('[data-tab-id="ideas.md"]')).toBeNull()
  })

  it('Ctrl+W closes the active tab and Ctrl+Tab moves to the next one', async () => {
    render(<App />)
    await screen.findByText(/Weekly reading notes/)
    await openFromLibrary('ideas.md')
    expect(tabElement('ideas.md').className).toContain('active')

    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true })
    expect(tabElement('weekly-notes.md').className).toContain('active')

    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    expect(document.querySelector('[data-tab-id="weekly-notes.md"]')).toBeNull()
    expect(tabElement('ideas.md').className).toContain('active')
  })
})
