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
