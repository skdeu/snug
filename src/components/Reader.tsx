import { useMemo, type CSSProperties } from 'react'
import { renderMarkdown } from '../lib/markdown'
import { assetUrl } from '../lib/assets'
import type { Theme } from '../lib/theme'
import '../styles/tokens.css'
import '../styles/themes.css'
import '../styles/reader.css'

interface ReaderProps {
  source: string
  baseDir: string
  theme: Theme
  fontSize: number
  onEdit?: () => void
}

export default function Reader({ source, baseDir, theme, fontSize, onEdit }: ReaderProps) {
  const html = useMemo(
    () =>
      renderMarkdown(source, {
        baseDir,
        resolveAsset: (reference) => assetUrl(baseDir, reference),
      }),
    [source, baseDir],
  )

  return (
    <div
      className={`theme-${theme}`}
      style={{ '--reader-font-size': `${fontSize}px` } as CSSProperties}
    >
      {onEdit && (
        <div className="snug-toolbar">
          <button className="snug-tool-button" onClick={onEdit} title="Edit this note">
            ✎ Edit
          </button>
        </div>
      )}
      <article className="snug-reader" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
