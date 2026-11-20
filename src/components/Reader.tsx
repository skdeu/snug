// Copyright 2026 Sanjaykumar Sagadevan Vijayakumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { useMemo, type CSSProperties, type MouseEvent } from 'react'
import { renderMarkdown } from '../lib/markdown'
import { assetUrl } from '../lib/assets'
import type { Theme } from '../lib/theme'
import Icon from './Icon'
import '../styles/tokens.css'
import '../styles/themes.css'
import '../styles/reader.css'

interface ReaderProps {
  source: string
  baseDir: string
  theme: Theme
  fontSize: number
  onEdit?: () => void
  /** Called with the link's href. The reader never follows links itself. */
  onLink?: (href: string) => void
}

export default function Reader({ source, baseDir, theme, fontSize, onEdit, onLink }: ReaderProps) {
  const html = useMemo(
    () =>
      renderMarkdown(source, {
        baseDir,
        resolveAsset: (reference) => assetUrl(baseDir, reference),
      }),
    [source, baseDir],
  )

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const link = target.closest?.('a')
    if (!link || !event.currentTarget.contains(link)) return
    // A link must never navigate the window away from Snug, so every click is handled here.
    event.preventDefault()
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('#')) {
      let id = href.slice(1)
      try {
        id = decodeURIComponent(id)
      } catch {
        // keep the raw id
      }
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
      return
    }
    onLink?.(href)
  }

  return (
    <div
      className={`theme-${theme} snug-reader-pane`}
      style={{ '--reader-font-size': `${fontSize}px` } as CSSProperties}
    >
      {onEdit && (
        <div className="snug-toolbar">
          <button className="snug-tool-button" onClick={onEdit} title="Edit this note">
            <Icon name="edit" />Edit
          </button>
        </div>
      )}
      <article
        className="snug-reader"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
