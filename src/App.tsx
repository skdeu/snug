import { useEffect, useState } from 'react'
import Reader from './components/Reader'
import Editor from './components/Editor'
import LibrarySidebar from './components/LibrarySidebar'
import type { Theme } from './lib/theme'
import { useDocument, type DocumentIo } from './hooks/useDocument'

const NOTES: Record<string, string> = {
  'weekly-notes.md': `# Weekly reading notes

The whole point of a quiet reading space is that the text gets out of the way and lets you think.

## What worked well

- Clean headings and generous spacing
- Code blocks that stay readable
- No clutter competing for attention

> Presentation is the product.
`,
  'ideas.md': '# Ideas\n\nA place for half-formed thoughts.\n',
  'reading-list.md': '# Reading list\n\n- [ ] The Art of Reading\n- [ ] Deep Work\n',
}

// Temporary in-memory IO until the Rust file commands land in Task 2.
const sampleIo: DocumentIo = {
  read: async (path) => NOTES[path] ?? '',
  write: async () => {},
}

export default function App() {
  const [theme] = useState<Theme>('dark')
  const [selected, setSelected] = useState('weekly-notes.md')
  const [editing, setEditing] = useState(false)
  const doc = useDocument(selected, sampleIo)

  const finishEdit = () => {
    if (doc.exit()) setEditing(false)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!editing) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void doc.save()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        finishEdit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className={`theme-${theme}`} style={{ display: 'flex' }}>
      <LibrarySidebar
        files={Object.keys(NOTES)}
        selected={selected}
        onSelect={setSelected}
        onOpenFolder={() => {
          /* wired to the Rust folder picker in a later task */
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <>
            <Editor
              key={selected}
              value={doc.source}
              onChange={doc.setSource}
              onSave={() => void doc.save()}
              onExit={finishEdit}
            />
            <div className="snug-editor-status">
              {doc.dirty ? '● Unsaved' : 'Saved'} · Ctrl+S to save · Esc to exit
            </div>
          </>
        ) : (
          <Reader
            source={doc.source}
            baseDir=""
            theme={theme}
            fontSize={18}
            onEdit={() => setEditing(true)}
          />
        )}
      </div>
    </div>
  )
}
