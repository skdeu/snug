import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onExit: () => void
}

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
        // Save/Exit are handled once by App's window-level shortcuts.
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handlers.current.onChange(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '16px' },
        }),
      ],
    })
    const view = new EditorView({ state, parent: host.current })
    return () => view.destroy()
    // Mount once per note; App remounts via key when the path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="snug-editor" ref={host} />
}
