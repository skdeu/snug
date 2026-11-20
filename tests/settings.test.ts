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

import { describe, expect, it, vi } from 'vitest'
import { getSettings, updateSettings, type AppSettings, type SettingsIo } from '../src/lib/settings'

describe('settings', () => {
  it('get_settings_fills_missing_keys_with_defaults', async () => {
    const io: SettingsIo = {
      load: vi.fn(async () => ({ theme: 'light' as const })),
      update: vi.fn(),
    }
    const result = await getSettings(io)
    expect(result).toEqual({
      theme: 'light',
      view: 'focus',
      font_size: 18,
      last_folder: null,
      palette: 'graphite',
    })
  })

  it('update_settings_sends_only_the_changes_and_returns_the_saved_settings', async () => {
    const saved: AppSettings = {
      theme: 'light',
      view: 'focus',
      font_size: 18,
      last_folder: null,
      palette: 'graphite',
    }
    const io: SettingsIo = {
      load: async () => null,
      update: vi.fn(async () => saved),
    }
    const result = await updateSettings({ theme: 'light' }, io)
    expect(io.update).toHaveBeenCalledWith({ theme: 'light' })
    expect(result).toEqual(saved)
  })
})
