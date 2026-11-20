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
