import { useState } from 'react'
import Reader from './components/Reader'
import type { Theme } from './lib/theme'

const SAMPLE = `# Welcome to Snug

A **cozy home** for your notes. This is how your Markdown looks when Snug renders it.

## What you get

- A calm, dark reading view by default
- Clean headings, tables and code blocks
- An edit mode when you need to change something

> Presentation is the product.
`

export default function App() {
  const [theme] = useState<Theme>('dark')

  return <Reader source={SAMPLE} baseDir="" theme={theme} fontSize={18} />
}
