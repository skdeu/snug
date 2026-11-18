import { describe, expect, it, vi } from 'vitest'
import { updateSettings, type SettingsIo } from '../src/lib/settings'

describe('settings', () => {
  it('update_settings_merges_defaults', async () => {
    const io: SettingsIo = {
      load: vi.fn(async () => null),
      save: vi.fn(async () => {}),
    }
    const result = await updateSettings({ theme: 'light' }, io)
    expect(result.theme).toBe('light')
    expect(result.font_size).toBe(18)
    expect(result.open_mode).toBe('window')
    expect(result.view).toBe('focus')
    expect(result.last_folder).toBeNull()
    expect(io.save).toHaveBeenCalledWith(result)
  })
})
