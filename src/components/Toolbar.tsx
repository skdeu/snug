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

import { PALETTES, paletteTokens, type Palette } from '../lib/palettes'
import type { Theme } from '../lib/theme'
import Icon from './Icon'

interface ToolbarProps {
  libraryOpen: boolean
  theme: Theme
  onToggleLibrary: () => void
  onToggleTheme: () => void
  onOpen: () => void
  /** The palette in use. The swatches are shown only when both palette props are given. */
  palette?: Palette
  onPalette?: (palette: Palette) => void
}

/** The window's main actions. Library shows whether the sidebar is open. */
export default function Toolbar({
  libraryOpen,
  theme,
  onToggleLibrary,
  onToggleTheme,
  onOpen,
  palette,
  onPalette,
}: ToolbarProps) {
  // The button names the theme it switches to, as before.
  const switchingToLight = theme === 'dark'
  return (
    <div className="snug-toolbar">
      {palette && onPalette && (
        <div className="snug-swatches" role="group" aria-label="Colour">
          {PALETTES.map((option) => {
            const tokens = paletteTokens(option.id, theme)
            const selected = option.id === palette
            return (
              <button
                key={option.id}
                type="button"
                className="snug-swatch"
                aria-label={option.label}
                aria-pressed={selected}
                title={option.label}
                style={{ background: tokens['--bg-solid'], boxShadow: `inset 0 0 0 5px ${tokens['--accent']}` }}
                onClick={() => onPalette(option.id)}
              />
            )
          })}
        </div>
      )}
      <div className="snug-segment">
        <button
          type="button"
          className="snug-seg-button"
          aria-pressed={libraryOpen}
          onClick={onToggleLibrary}
        >
          <Icon name="library" />
          Library
        </button>
        <button type="button" className="snug-seg-button" onClick={onToggleTheme}>
          <Icon name={switchingToLight ? 'sun' : 'moon'} />
          {switchingToLight ? 'Light' : 'Dark'}
        </button>
        <button type="button" className="snug-seg-button" onClick={onOpen}>
          <Icon name="open" />
          Open
        </button>
      </div>
    </div>
  )
}
