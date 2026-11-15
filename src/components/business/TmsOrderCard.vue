<script setup lang="ts">
import type { OrderSummary } from '@/api/types'
import { formatTime, openOrder } from '@/utils/orders'
import TmsIcon from './TmsIcon.vue'
import TmsStatusTag from './TmsStatusTag.vue'
import TmsAction from './TmsAction.vue'

defineProps<{ order: OrderSummary }>()
</script>

<template>
  <TmsAction class="card shipper-card order-card" @click="openOrder(order.id)">
    <view class="shipper-heading">
      <text class="order-card__number">{{ order.orderNo }}</text>
      <TmsStatusTag :status="order.status" />
    </view>
    <view class="order-card__route">
      <text>{{ order.origin }}</text>
      <TmsIcon name="route-arrow" size="29rpx" />
      <text>{{ order.destination }}</text>
    </view>
    <view class="order-card__foot">
      <text class="shipper-copy">{{ order.cargoName }}<template v-if="order.cargoUnit"> · {{ order.cargoQuantity }} {{ order.cargoUnit }}</template></text>
      <text class="shipper-copy order-card__time">{{ formatTime(order.createdAt) }}</text>
      <TmsIcon name="arrow-right" size="25rpx" />
    </view>
  </TmsAction>
</template>

<style scoped lang="scss">
.order-card {
  display: grid;
  gap: 18rpx;
  width: 100%;
  background: var(--tms-surface);
  padding: 26rpx;
  border: 1px solid var(--tms-line-subtle);
}
.order-card__number {
  color: var(--tms-muted);
  font-size: max(24rpx, 12px);
  font-weight: 650;
  overflow-wrap: anywhere;
}
.order-card__route {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 16rpx;
  color: var(--tms-text-strong);
  font-size: max(31rpx, 16px);
  font-weight: 750;
}
.order-card__route text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-card__route .tms-icon { color: var(--tms-primary); }
.order-card__foot {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
  color: var(--tms-muted);
}
.order-card__foot text:first-child {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-card__time { white-space: nowrap; }
</style>
