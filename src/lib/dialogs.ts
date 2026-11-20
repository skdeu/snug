import { IS_TAURI } from './events'

/**
 * A yes/no question. Inside Snug this is the native confirm dialog and it waits for the
 * answer. The page's own window.confirm must not be used there: in the Tauri webview it
 * returns a promise, which is always truthy, so every "are you sure?" check silently said yes.
 */
export async function askYesNo(message: string, title = 'Snug'): Promise<boolean> {
  if (!IS_TAURI) return window.confirm(message)
  const { confirm } = await import('@tauri-apps/plugin-dialog')
  return confirm(message, { title, kind: 'warning' })
}
