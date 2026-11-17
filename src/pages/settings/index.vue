<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import MobileAppearanceSettings from '@mobile-core/components/MobileAppearanceSettings.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'

const { theme, themeName } = usePageTheme()
const auth = useAuthStore()
onShow(() => { auth.guard() })
</script>

<template>
  <MobileWorkspace :container-class="['page shipper-page', themeName]">
    <MobileTopBar capsule="always" title="界面设置" :eyebrow="auth.demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <MobileAppearanceSettings :model-value="theme.preset" :persist-preset="theme.selectPreset" />
    </view>
  </MobileWorkspace>
</template>
