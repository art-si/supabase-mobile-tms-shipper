<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { onShow } from '@dcloudio/uni-app'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileThemePicker from '@mobile-core/components/MobileThemePicker.vue'
import type { ThemePresetId } from '@mobile-core/theme'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'

const { theme, themeName } = usePageTheme()
const auth = useAuthStore()
onShow(() => { auth.guard() })

function selectTheme(preset: ThemePresetId) {
  if (!theme.selectPreset(preset)) uni.showToast({ title: '主题已应用，保存失败', icon: 'none' })
}
</script>

<template>
  <MobileWorkspace class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" title="界面设置" :eyebrow="auth.demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <view>
        <text class="mobile-group-title" role="heading" aria-level="2">外观</text>
        <view class="mobile-group">
          <MobileThemePicker :model-value="theme.preset" @update:model-value="selectTheme" />
        </view>
      </view>
    </view>
  </MobileWorkspace>
</template>
