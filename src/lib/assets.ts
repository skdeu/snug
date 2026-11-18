import { convertFileSrc } from '@tauri-apps/api/core'

/**
 * Build a Tauri asset URL for a Markdown-relative image reference.
 * Rejects absolute paths, URLs, and any path that climbs above the note's folder.
 */
export function assetUrl(baseDir: string, reference: string): string {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(reference)) {
    throw new Error(`Absolute or URL asset reference is not allowed: ${reference}`)
  }
  if (reference.startsWith('/') || reference.startsWith('\\')) {
    throw new Error(`Absolute asset reference is not allowed: ${reference}`)
  }

  const parts = reference.replace(/\\/g, '/').split('/')
  if (parts.includes('..')) {
    throw new Error(`Asset reference escapes the note folder: ${reference}`)
  }

  const base = baseDir.replace(/\\/g, '/').replace(/\/+$/, '')
  return convertFileSrc(`${base}/${parts.join('/')}`)
}
