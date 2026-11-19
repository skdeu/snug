/** Resolve a note path from the library into a full path the file commands understand. */
export function resolveNotePath(relative: string, folder: string | null): string {
  if (!folder) return relative
  if (/^[a-zA-Z]:[\\/]/.test(relative) || relative.startsWith('\\\\')) return relative
  const separator = folder.includes('\\') ? '\\' : '/'
  return `${folder.replace(/[\\/]+$/, '')}${separator}${relative}`
}
