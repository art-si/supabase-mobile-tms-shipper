import { createUsePageTheme } from '@mobile-core/theme'
import { useThemeStore } from '@/stores/theme'

// Shipper pages apply the preset class directly to their root view.
export const usePageTheme = createUsePageTheme(useThemeStore, 'tms-theme')
