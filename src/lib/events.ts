const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Subscribe to a backend event. Returns a function that unsubscribes. Works even when
 * the subscription finishes after the caller has already unsubscribed.
 * Outside Tauri (the browser preview) it does nothing.
 */
export function listenTo<T>(event: string, handler: (payload: T) => void): () => void {
  if (!IN_TAURI) return () => {}
  let disposed = false
  let stop: (() => void) | undefined
  void import('@tauri-apps/api/event')
    .then(({ listen }) => listen<T>(event, (message) => handler(message.payload)))
    .then((unlisten) => {
      if (disposed) unlisten()
      else stop = unlisten
    })
    .catch((reason: unknown) => console.error(`Could not listen for ${event}`, reason))
  return () => {
    disposed = true
    stop?.()
  }
}

export const IS_TAURI = IN_TAURI
