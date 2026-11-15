<script setup lang="ts">
import TmsIcon from './TmsIcon.vue'
import TmsAction from './TmsAction.vue'

const props = withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    subtitle?: string
    showBack?: boolean
    showMenu?: boolean
    confirmBack?: () => Promise<boolean>
  }>(),
  {
    showBack: false,
    showMenu: false
  }
)

const emit = defineEmits<{
  menu: []
}>()

async function back() {
  if (props.confirmBack && !(await props.confirmBack())) return
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: '/pages/home/index' })
}
</script>

<template>
  <view class="top-bar" :class="{ 'top-bar--with-meta': eyebrow || subtitle }">
    <view class="top-bar__glow" />
    <TmsAction
      v-if="showBack"
      class="top-bar__icon"
      aria-label="返回上一页"
      hover-class="top-bar__icon--pressed"
      @click="back"
    >
      <TmsIcon name="back" size="38rpx" />
    </TmsAction>
    <view v-else class="top-bar__spacer" />
    <view class="top-bar__copy">
      <text v-if="eyebrow" class="top-bar__eyebrow">{{ eyebrow }}</text>
      <text class="top-bar__title" role="heading" aria-level="1">{{ title }}</text>
      <text v-if="subtitle" class="top-bar__subtitle">{{ subtitle }}</text>
    </view>
    <TmsAction
      v-if="showMenu"
      class="top-bar__icon"
      aria-label="打开更多操作"
      hover-class="top-bar__icon--pressed"
      @click="emit('menu')"
    >
      <TmsIcon name="menu" size="38rpx" />
    </TmsAction>
    <view v-else class="top-bar__spacer" />
  </view>
</template>

<style scoped lang="scss">
.top-bar {
  position: relative;
  min-height: 176rpx;
  padding: calc(34rpx + env(safe-area-inset-top)) 30rpx 28rpx;
  color: #fff;
  overflow: hidden;
  background: var(--tms-hero-gradient);
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 18rpx;
}

/* #ifdef MP-WEIXIN */
.top-bar {
  min-height: 250rpx;
  padding-top: max(124rpx, calc(68rpx + env(safe-area-inset-top)));
}
/* #endif */

.top-bar::after {
  position: absolute;
  right: -110rpx;
  top: -170rpx;
  width: 390rpx;
  height: 390rpx;
  content: '';
  border: 1rpx solid rgba(255, 255, 255, 0.11);
  border-radius: 50%;
  box-shadow: 0 0 0 58rpx rgba(255, 255, 255, 0.025);
}

.top-bar__glow {
  position: absolute;
  left: 48%;
  bottom: -170rpx;
  width: 420rpx;
  height: 260rpx;
  border-radius: 50%;
  background: rgba(var(--tms-primary-rgb), 0.2);
  filter: blur(72rpx);
  pointer-events: none;
}

.top-bar__copy {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.top-bar__eyebrow {
  margin-bottom: 4rpx;
  font-size: max(22rpx, 12px);
  font-weight: 600;
  opacity: 0.76;
}

.top-bar__title {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.25;
}

.top-bar__subtitle {
  max-width: 100%;
  margin-top: 5rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: max(22rpx, 12px);
  font-weight: 600;
  opacity: 0.7;
}

.top-bar__icon,
.top-bar__spacer {
  position: relative;
  z-index: 1;
  width: 88rpx;
  height: 88rpx;
  min-width: 44px;
  min-height: 44px;
}

.top-bar__icon {
  margin: 0;
  padding: 0;
  color: #fff;
  background: rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(16rpx);
  -webkit-backdrop-filter: blur(16rpx);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  transition:
    transform var(--tms-apple-duration-fast) var(--tms-apple-ease),
    background-color var(--tms-apple-duration-standard) var(--tms-apple-ease),
    border-color var(--tms-apple-duration-standard) var(--tms-apple-ease);
}

.top-bar__icon::after {
  border: 0;
}

.top-bar__icon--pressed {
  background: rgba(255, 255, 255, 0.22);
}

.top-bar__icon:active {
  transform: scale(0.95);
}

.top-bar__icon:focus-visible {
  outline: 4rpx solid rgba(255, 255, 255, 0.84);
  outline-offset: 3rpx;
}

@media (prefers-reduced-transparency: reduce) {
  .top-bar__icon {
    background: rgba(255, 255, 255, 0.28);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
