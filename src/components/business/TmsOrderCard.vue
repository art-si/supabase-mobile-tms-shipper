<script setup lang="ts">
import type { OrderSummary } from '@/api/types'
import { formatTime, openOrder } from '@/utils/orders'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import TmsStatusTag from './TmsStatusTag.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileRoute from '@mobile-core/components/MobileRoute.vue'

defineOptions({ options: { styleIsolation: 'shared' } })

defineProps<{ order: OrderSummary }>()
</script>

<template>
  <MobileAction class="card shipper-card order-card" @click="openOrder(order.id)">
    <view class="shipper-heading order-card__header">
      <text class="order-card__number" translate="no">{{ order.orderNo || '暂无订单号' }}</text>
      <TmsStatusTag :status="order.status" />
    </view>
    <view class="shipper-heading order-card__route">
      <MobileRoute :origin="order.origin || '发货地待确认'" :destination="order.destination || '收货地待确认'" />
      <MobileIcon class="order-card__chevron" name="chevron" size="24rpx" aria-hidden="true" />
    </view>
    <view class="order-card__foot">
      <view class="shipper-copy order-card__cargo">
        <text class="order-card__cargo-name">{{ order.cargoName || '货物' }}</text>
        <text v-if="order.cargoUnit" class="order-card__quantity">· {{ order.cargoQuantity }} {{ order.cargoUnit }}</text>
      </view>
      <text class="shipper-copy order-card__time">{{ formatTime(order.createdAt) }}</text>
    </view>
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
.order-card__header { align-items: start; }
.order-card__number {
  padding-block: 3px;
  color: var(--mobile-workspace-muted);
  font-size: max(23rpx, 12px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.order-card__route { gap: 8px; }
.order-card__chevron { color: var(--mobile-workspace-muted); }
.order-card__foot {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
  min-width: 0;
  padding-top: 8px;
  border-top: 1px solid var(--mobile-workspace-line);
}
.order-card__cargo { display: flex; gap: 4px; min-width: 0; }
.order-card__cargo-name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
.order-card__quantity { flex: none; max-width: 55%; overflow-wrap: anywhere; }
.order-card__time { font-variant-numeric: tabular-nums; white-space: nowrap; }

@media (hover: hover) {
  .order-card:hover { border-color: var(--mobile-workspace-accent); }
}
</style>
