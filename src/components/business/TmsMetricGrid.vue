<script setup lang="ts">
import type { OrderGroup } from '@/api/types'
import TmsAction from './TmsAction.vue'

interface MetricItem {
  key: OrderGroup
  label: string
  value: number
}

defineProps<{
  items: MetricItem[]
}>()
defineEmits<{ select: [group: OrderGroup] }>()
</script>

<template>
  <view class="metric-grid">
    <TmsAction
      v-for="item in items"
      :key="item.key"
      class="shipper-button metric-grid__item"
      :aria-label="`${item.label} ${item.value} 单`"
      @click="$emit('select', item.key)"
    >
      <view class="metric-grid__value">
        <text>{{ item.value }}</text>
      </view>
      <text class="metric-grid__label">{{ item.label }}</text>
    </TmsAction>
  </view>
</template>

<style scoped lang="scss">
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.metric-grid__item {
  position: relative;
  min-width: 0;
  width: 100%;
  min-height: 136rpx;
  padding: 22rpx 14rpx;
  overflow: hidden;
  border: 1rpx solid var(--tms-line);
  border-radius: 20rpx;
  background: linear-gradient(150deg, var(--tms-surface) 0%, var(--tms-primary-soft) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13rpx;
}

.metric-grid__item::before {
  position: absolute;
  top: 0;
  left: 22rpx;
  right: 22rpx;
  height: 5rpx;
  content: '';
  border-radius: 0 0 999rpx 999rpx;
  background: linear-gradient(90deg, var(--tms-primary), var(--tms-primary-bright));
  opacity: 0.72;
}

.metric-grid__label {
  min-width: 0;
  max-width: 100%;
  color: var(--tms-muted);
  font-size: max(24rpx, 12px);
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: anywhere;
}

.metric-grid__value {
  color: var(--tms-text-strong);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  font-size: 34rpx;
  font-weight: 700;
  display: flex;
  align-items: flex-end;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.metric-grid__item::after {
  border: 0;
}
</style>
