import { invoke } from '@tauri-apps/api/core'
import type { Theme } from './theme'
import type { OpenMode } from './session'

export type { Theme } from './theme'
export type { OpenMode } from './session'
export type View = 'focus' | 'library'

export interface AppSettings {
  theme: Theme
  view: View
  font_size: number
  last_folder: string | null
  open_mode: OpenMode
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  view: 'focus',
  font_size: 18,
  last_folder: null,
  open_mode: 'window',
}

export interface SettingsIo {
  load: () => Promise<Partial<AppSettings> | null>
  save: (settings: AppSettings) => Promise<void>
}

export const tauriSettingsIo: SettingsIo = {
  load: () => invoke<Partial<AppSettings>>('load_settings'),
  save: (settings) => invoke('save_settings', { settings }),
}

export async function getSettings(io: SettingsIo = tauriSettingsIo): Promise<AppSettings> {
  const stored = await io.load()
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export async function updateSettings(
  partial: Partial<AppSettings>,
  io: SettingsIo = tauriSettingsIo,
): Promise<AppSettings> {
  const current = await getSettings(io)
  const next: AppSettings = { ...current, ...partial }
  await io.save(next)
  return next
}
