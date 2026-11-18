<script setup lang="ts">
import type { OrderSummary } from '@/api/types'
import { formatTime, openOrder } from '@/utils/orders'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import TmsStatusTag from './TmsStatusTag.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileRoute from '@mobile-core/components/MobileRoute.vue'
import MobileRouteMeta from '@mobile-core/components/MobileRouteMeta.vue'

defineOptions({ options: { styleIsolation: 'shared' } })

defineProps<{ order: OrderSummary }>()
</script>

<template>
  <MobileAction class="card shipper-card order-card" @click="openOrder(order.id)">
    <view class="mobile-card-identity order-card__header">
      <text class="order-card__number mobile-card-identity__main" translate="no">{{ order.orderNo || '暂无订单号' }}</text>
      <TmsStatusTag :status="order.status" />
    </view>
    <view class="shipper-heading order-card__route">
      <MobileRoute :origin="order.origin || '发货地待确认'" :destination="order.destination || '收货地待确认'" />
      <MobileIcon class="order-card__chevron" name="chevron" size="24rpx" aria-hidden="true" />
    </view>
    <MobileRouteMeta class="order-card__foot">
      <text class="order-card__cargo-name">{{ order.cargoName || '货物' }}</text>
      <text v-if="order.cargoUnit" class="order-card__quantity">{{ order.cargoQuantity }} {{ order.cargoUnit }}</text>
      <text class="order-card__time">{{ formatTime(order.createdAt) }}</text>
    </MobileRouteMeta>
  </MobileAction>
</template>

<style scoped lang="scss">
.order-card {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 13px var(--mobile-workspace-card-padding);
  background: var(--mobile-workspace-surface);
  border: 1px solid var(--mobile-workspace-line);
  border-radius: var(--mobile-workspace-card-radius);
  box-shadow: none;
}
.order-card__number {
  padding-block: 3px;
  color: var(--mobile-workspace-muted);
  font-size: max(23rpx, 12px, .75rem);
  font-weight: 600;
}
.order-card__route { gap: 8px; }
.order-card__chevron { flex: none; color: var(--mobile-workspace-muted); }
.order-card__foot {
  padding-top: 8px;
  border-top: 1px solid var(--mobile-workspace-line);
}

@media (hover: hover) {
  .order-card:hover { border-color: var(--mobile-workspace-accent); }
}
</style>
