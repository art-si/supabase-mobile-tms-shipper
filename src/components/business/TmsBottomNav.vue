<script setup lang="ts">
import TmsIcon from './TmsIcon.vue'
import type { TmsIconName } from './icon-glyphs'
import { useAuthStore } from '@/stores/auth'
import { openShipmentForm } from '@/utils/orders'
import { openWorkspace } from '@/utils/workspace'

type NavKey = 'home' | 'order' | 'message' | 'mine'

const props = defineProps<{
  active: NavKey
}>()

const auth = useAuthStore()
const items: Array<{ key: NavKey | 'shipment'; label: string; icon: TmsIconName; url?: string }> = [
  { key: 'home', label: '首页', icon: 'home', url: '/pages/home/index' },
  { key: 'order', label: '运单', icon: 'waybill', url: '/pages/order/index' },
  { key: 'shipment', label: '发货', icon: 'add' },
  { key: 'message', label: '消息', icon: 'message', url: '/pages/message/index' },
  { key: 'mine', label: '我的', icon: 'user', url: '/pages/mine/index' }
]

function go(value: string | number) {
  const item = items.find((entry) => entry.key === value)
  if (!item) return
  if (item.key === 'shipment') {
    if (auth.staff) openWorkspace('open')
    else openShipmentForm()
    return
  }
  if (item.key === props.active) return
  if (item.url) uni.reLaunch({ url: item.url })
}
</script>

<template>
  <view class="bottom-nav">
    <wd-tabbar
      :model-value="props.active"
      custom-class="bottom-nav__bar"
      active-color="var(--tms-primary)"
      inactive-color="var(--tms-disabled)"
      role="navigation"
      aria-label="主导航"
      @change="go($event.value)"
    >
      <wd-tabbar-item
        v-for="item in items"
        :key="item.key"
        :name="item.key"
        :custom-class="item.key === props.active ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'"
        :aria-label="item.label"
        :aria-current="item.key === props.active ? 'page' : undefined"
        :role="item.key === 'shipment' ? 'button' : 'link'"
        tabindex="0"
        @keydown.enter="go(item.key)"
        @keydown.space.prevent="go(item.key)"
      >
        <view class="bottom-nav__content">
          <view v-if="item.key === props.active" class="bottom-nav__active-pill" />
          <view class="bottom-nav__icon-box" :class="{
            'bottom-nav__icon-box--active': item.key === props.active,
            'bottom-nav__icon-box--shipment': item.key === 'shipment'
          }">
            <TmsIcon :name="item.icon" size="44rpx" />
          </view>
          <text class="bottom-nav__label" :class="{ 'bottom-nav__label--active': item.key === props.active }">{{ item.label }}</text>
        </view>
      </wd-tabbar-item>
    </wd-tabbar>
  </view>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  left: 18rpx;
  right: 18rpx;
  bottom: calc(14rpx + env(safe-area-inset-bottom));
  z-index: 20;
  height: 132rpx;
  padding: 12rpx 18rpx;
  overflow: hidden;
  background: var(--tms-material-thin);
  border: 1rpx solid rgba(255, 255, 255, 0.7);
  border-radius: 32rpx;
  backdrop-filter: blur(28rpx) saturate(150%);
  -webkit-backdrop-filter: blur(28rpx) saturate(150%);
  display: block;
  box-shadow: var(--tms-shadow-floating), 0 2rpx 0 rgba(255, 255, 255, 0.9) inset;
}

:deep(.bottom-nav__bar) {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: transparent;
}

:deep(.bottom-nav__item) {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 22rpx;
  background: transparent;
  min-width: 0;
  min-height: 44px;
  color: var(--tms-disabled);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  font-size: max(24rpx, 12px);
  font-weight: 600;
  line-height: 1.1;
  touch-action: manipulation;
  transition:
    color var(--tms-apple-duration-fast) var(--tms-apple-ease),
    background-color var(--tms-apple-duration-fast) var(--tms-apple-ease);
}

:deep(.bottom-nav__item)::after {
  border: 0;
}

:deep(.bottom-nav__item--pressed),
:deep(.bottom-nav__item:active) {
  background: rgba(var(--tms-primary-rgb), 0.06);
}

:deep(.bottom-nav__item--active) {
  color: var(--tms-primary);
  font-weight: 700;
}

.bottom-nav__active-pill {
  position: absolute;
  top: 3rpx;
  width: 74rpx;
  height: 60rpx;
  border-radius: 20rpx;
  background: linear-gradient(180deg, var(--tms-primary-soft), var(--tms-primary-soft-strong));
}

.bottom-nav__content {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
}

.bottom-nav__icon-box {
  position: relative;
  z-index: 1;
  width: 62rpx;
  height: 62rpx;
  border-radius: 18rpx;
  color: currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-nav__label {
  color: var(--tms-muted);
}

.bottom-nav__icon-box--active,
.bottom-nav__label--active {
  color: var(--tms-primary);
}

.bottom-nav__icon-box--shipment {
  color: #fff;
  background: var(--tms-primary);
  border-radius: 20rpx;
}
.bottom-nav__label--active {
  font-weight: 700;
}

:deep(.bottom-nav__item--active) .bottom-nav__icon-box {
  background: transparent;
}


:deep(.bottom-nav__item) text {
  position: relative;
  z-index: 1;
}

:deep(.bottom-nav__item):focus-visible {
  outline: 4rpx solid rgba(var(--tms-primary-rgb), 0.36);
  outline-offset: -4rpx;
}

@media (hover: hover) {
  :deep(.bottom-nav__item:hover) {
    color: var(--tms-primary);
    background: rgba(var(--tms-primary-rgb), 0.05);
  }
}

@media screen and (min-width: 520px) {
  .bottom-nav {
    left: 50%;
    right: auto;
    width: min(calc(100vw - 36rpx), 484px);
    transform: translateX(-50%);
  }
}
</style>
