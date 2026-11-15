<script setup lang="ts">
import { computed } from 'vue'
import { statusAppearance } from '@/utils/orders'

const props = defineProps<{
  status: string
  batch?: boolean
}>()

const appearance = computed(() => statusAppearance(props.status, Boolean(props.batch)))
</script>

<template>
  <view class="status-tag" :class="`status-tag--${appearance.tone}`">
    <text class="status-tag__dot" />
    {{ appearance.label }}
  </view>
</template>

<style scoped lang="scss">
.status-tag {
  min-width: 96rpx;
  height: 46rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9rpx;
  font-size: max(22rpx, 12px);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.status-tag__dot {
  box-sizing: border-box;
  flex: 0 0 auto;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.88;
}

.status-tag--blue {
  color: var(--tms-primary);
  background: var(--tms-primary-soft);
}

.status-tag--green {
  color: #047857;
  background: var(--tms-green-soft);
}

.status-tag--orange {
  color: #92400e;
  background: var(--tms-orange-soft);
}

.status-tag--red {
  color: var(--tms-red-strong);
  background: var(--tms-red-soft);
}

.status-tag--gray {
  color: var(--tms-text-secondary);
  background: var(--tms-surface-muted);
}
</style>
