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

import { useState } from 'react'
import '../styles/library.css'
import Icon from './Icon'

interface LibrarySidebarProps {
  files: string[]
  selected: string | null
  onSelect: (relativePath: string) => void
  onOpenFolder: () => void
}

export default function LibrarySidebar({
  files,
  selected,
  onSelect,
  onOpenFolder,
}: LibrarySidebarProps) {
  const [query, setQuery] = useState('')
  const visible = files.filter((file) =>
    file.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <aside className="snug-sidebar">
      <button className="snug-open-folder" onClick={onOpenFolder}>
        <Icon name="open" size={14} />
        Open folder…
      </button>
      <div className="snug-search-wrap">
        <Icon name="search" size={14} />
        <input
          className="snug-search"
          aria-label="Search notes"
          placeholder="Search notes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="snug-file-label">MY NOTES</div>
      <ul className="snug-file-list">
        {visible.map((file) => (
          <li key={file}>
            <button
              className={selected === file ? 'selected' : undefined}
              onClick={() => onSelect(file)}
              title={file}
            >
              <Icon name="file" size={14} />
              {file}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
