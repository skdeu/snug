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
