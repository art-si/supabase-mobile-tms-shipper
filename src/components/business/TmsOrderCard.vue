<script setup lang="ts">
import type { OrderSummary } from '@/api/types'
import { formatTime, openOrder } from '@/utils/orders'
import TmsIcon from './TmsIcon.vue'
import TmsStatusTag from './TmsStatusTag.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileRoute from '@mobile-core/components/MobileRoute.vue'

defineProps<{ order: OrderSummary }>()
</script>

<template>
  <MobileAction class="card shipper-card order-card" @click="openOrder(order.id)">
    <view class="shipper-heading order-card__header">
      <text class="order-card__number" translate="no">{{ order.orderNo || '暂无订单号' }}</text>
      <TmsStatusTag :status="order.status" />
    </view>
    <view class="order-card__route">
      <MobileRoute :origin="order.origin || '发货地待确认'" :destination="order.destination || '收货地待确认'" />
      <TmsIcon class="order-card__chevron" name="chevron" size="24rpx" aria-hidden="true" />
    </view>
    <view class="order-card__foot">
      <text class="shipper-copy order-card__cargo">{{ order.cargoName || '货物' }}<template v-if="order.cargoUnit"> · {{ order.cargoQuantity }} {{ order.cargoUnit }}</template></text>
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
.order-card__route {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 8px;
}
.order-card__chevron { flex: none; color: var(--mobile-workspace-muted); }
.order-card__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 2px 10px;
  min-width: 0;
  padding-top: 8px;
  border-top: 1px solid var(--mobile-workspace-line);
}
.order-card__cargo { min-width: 0; }
.order-card__time { font-variant-numeric: tabular-nums; white-space: nowrap; }

@media (hover: hover) {
  .order-card:hover { border-color: var(--mobile-workspace-accent); }
}
</style>
