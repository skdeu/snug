import { invoke } from '@tauri-apps/api/core'
import type { Palette } from './palettes'

export type Theme = 'dark' | 'light'
export type View = 'focus' | 'library'

export interface AppSettings {
  theme: Theme
  view: View
  font_size: number
  last_folder: string | null
  palette: Palette
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  view: 'focus',
  font_size: 18,
  last_folder: null,
  palette: 'graphite',
}

export interface SettingsIo {
  load: () => Promise<Partial<AppSettings> | null>
  /** Saves only the given keys and returns the complete, saved settings. */
  update: (partial: Partial<AppSettings>) => Promise<AppSettings>
}

export const tauriSettingsIo: SettingsIo = {
  load: () => invoke<Partial<AppSettings>>('load_settings'),
  update: (partial) => invoke<AppSettings>('update_settings', { partial }),
}

export async function getSettings(io: SettingsIo = tauriSettingsIo): Promise<AppSettings> {
  const stored = await io.load()
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export function updateSettings(
  partial: Partial<AppSettings>,
  io: SettingsIo = tauriSettingsIo,
): Promise<AppSettings> {
  return io.update(partial)
}
