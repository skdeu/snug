import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { tags } from '@lezer/highlight'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onExit: () => void
}

/** Markdown syntax colours. They read from the theme tokens, so both themes match. */
const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--accent-text)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: 'var(--accent-text)' },
  { tag: [tags.monospace, tags.quote, tags.meta], color: 'var(--text-muted)' },
])

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '16px',
    color: 'var(--text)',
    backgroundColor: 'transparent',
  },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused': { outline: '2px solid var(--focus)', outlineOffset: '-2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft)',
  },
})

export default function Editor({ value, onChange, onSave, onExit }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const handlers = useRef({ onChange, onSave, onExit })
  handlers.current = { onChange, onSave, onExit }

  useEffect(() => {
    if (!host.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        markdown(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        syntaxHighlighting(markdownHighlight),
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handlers.current.onChange(update.state.doc.toString())
          }
        }),
      ],
    })
    const view = new EditorView({ state, parent: host.current })
    return () => view.destroy()
  }, [])

  return <div className="snug-editor" ref={host} />
}
