import { useState } from 'react'
import Reader from './components/Reader'
import LibrarySidebar from './components/LibrarySidebar'
import type { Theme } from './lib/theme'

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

export default function App() {
  const [theme] = useState<Theme>('dark')
  const [selected, setSelected] = useState<string>('weekly-notes.md')

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
      <Reader source={NOTES[selected] ?? ''} baseDir="" theme={theme} fontSize={18} />
    </div>
  )
}
