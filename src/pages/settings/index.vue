<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'
import { THEME_PRESETS, type ThemePresetId } from '@mobile-core/theme'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'

const { theme, themeName } = usePageTheme()
const auth = useAuthStore()
onShow(() => { auth.guard() })

function setPreset(preset: ThemePresetId) {
  if (!theme.selectPreset(preset)) uni.showToast({ title: '主题已应用，保存失败', icon: 'none' })
}
</script>

<template>
  <view class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" title="界面设置" :eyebrow="auth.demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <view class="card shipper-card shipper-stack" role="group" aria-label="主题颜色">
        <text class="section-title" role="heading" aria-level="2">主题颜色</text>
        <button
          v-for="preset in THEME_PRESETS" :key="preset.id" class="shipper-button theme-option"
          :aria-pressed="theme.preset === preset.id" @click="setPreset(preset.id)"
        >
          <view class="theme-option__swatch" :style="{ background: preset.color }" />
          <text>{{ preset.name }}</text>
          <TmsIcon v-if="theme.preset === preset.id" name="check" size="35rpx" />
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.theme-option {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--tms-control-height);
  padding: 12rpx 20rpx;
  gap: 19rpx;
  color: var(--tms-primary);
  border-radius: var(--tms-control-radius);
  background: var(--tms-surface-soft);
  font-size: max(29rpx, 15px);
}
.theme-option text { flex: 1; color: var(--tms-text); font-weight: 650; }
.theme-option__swatch { width: 47rpx; height: 47rpx; border-radius: 50%; }
</style>
