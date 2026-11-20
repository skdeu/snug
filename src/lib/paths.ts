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

/** Resolve a note path from the library into a full path the file commands understand. */
export function resolveNotePath(relative: string, folder: string | null): string {
  if (!folder) return relative
  if (/^[a-zA-Z]:[\\/]/.test(relative) || relative.startsWith('\\\\')) return relative
  const separator = folder.includes('\\') ? '\\' : '/'
  return `${folder.replace(/[\\/]+$/, '')}${separator}${relative}`
}

/** True for files Snug can open: .md and .markdown, in any letter case. */
export function isMarkdownFile(path: string): boolean {
  return /\.(md|markdown)$/i.test(path)
}

/** Last part of a path: "C:\\notes\\a.md" becomes "a.md". */
export function basename(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index >= 0 ? path.slice(index + 1) : path
}

/** Folder part of a path, or "" when there is none. */
export function dirnameOf(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index >= 0 ? path.slice(0, index) : ''
}

/**
 * The note a link points to, or null when the link is not a Markdown note.
 * Links are relative to the note's folder; a #fragment and percent-encoding are allowed.
 * Web addresses, absolute paths and other schemes are never notes.
 */
export function linkedNotePath(baseDir: string, href: string): string | null {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href)) return null
  if (href.startsWith('/') || href.startsWith('\\')) return null

  let target: string
  try {
    target = decodeURIComponent(href.split('#')[0])
  } catch {
    return null
  }
  if (!target || !isMarkdownFile(target)) return null
  if (/^[a-zA-Z]:/.test(target)) return null

  const separator = baseDir.includes('\\') ? '\\' : '/'
  const relative = target.replace(/[\\/]+/g, separator)
  if (!baseDir) return relative
  return `${baseDir.replace(/[\\/]+$/, '')}${separator}${relative}`
}
