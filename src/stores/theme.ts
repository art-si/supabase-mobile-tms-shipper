import { defineStore } from 'pinia'

export const THEME_PRESETS = [
  { id: 'indigo', name: '经典靛蓝', color: '#4f46e5' },
  { id: 'ocean', name: '海洋蓝', color: '#155eef' },
  { id: 'forest', name: '青松绿', color: '#0f766e' }
] as const

export type ThemePresetId = (typeof THEME_PRESETS)[number]['id']

const STORAGE_KEY = 'tms-shipper-theme'

function isThemePresetId(value: unknown): value is ThemePresetId {
  return THEME_PRESETS.some((preset) => preset.id === value)
}

function savedPreset(): ThemePresetId {
  try {
    const value: unknown = uni.getStorageSync(STORAGE_KEY)
    return isThemePresetId(value) ? value : 'indigo'
  } catch {
    return 'indigo'
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ preset: savedPreset() }),
  actions: {
    selectPreset(preset: ThemePresetId): boolean {
      if (this.preset === preset) return true
      this.preset = preset
      try {
        uni.setStorageSync(STORAGE_KEY, preset)
        return true
      } catch {
        return false
      }
    }
  }
})
