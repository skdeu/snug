import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Editor from '../src/components/Editor'

describe('Editor', () => {
  it('mounts CodeMirror inside the editor ground', () => {
    const { container } = render(
      <Editor value={'# Title\n'} onChange={() => {}} onSave={() => {}} onExit={() => {}} />,
    )
    const host = container.querySelector('.snug-editor')
    expect(host).not.toBeNull()
    expect(host!.querySelector('.cm-editor')).not.toBeNull()
  })
})
