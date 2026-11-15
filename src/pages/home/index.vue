<script setup lang="ts">
import { computed } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { openOrders, openShipmentForm } from '@/utils/orders'
import { openWorkspace } from '@/utils/workspace'
import type { OrderGroup } from '@/api/types'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsAction from '@/components/business/TmsAction.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsMetricGrid from '@/components/business/TmsMetricGrid.vue'
import TmsOrderCard from '@/components/business/TmsOrderCard.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'

const { themeName } = usePageTheme()
const { auth, dashboard, demo } = useShipper()
const { data, error, load } = usePageResource(async () => {
  if (!auth.staff) return dashboard()
  await auth.loadStaffAccess()
  return null
}, '工作台加载失败，请重新加载。')
const metrics = computed(() => {
  const counts = data.value?.counts
  if (!counts) return []
  return [
    { key: 'pending' as OrderGroup, label: '待发运', value: counts.pending },
    { key: 'in_progress' as OrderGroup, label: '履约中', value: counts.in_progress },
    { key: 'signed' as OrderGroup, label: '已签收', value: counts.signed }
  ]
})

function refresh() { return auth.guard() ? load() : Promise.resolve() }
function settings() { uni.navigateTo({ url: '/pages/settings/index' }) }
onShow(refresh)
onPullDownRefresh(async () => { await refresh(); uni.stopPullDownRefresh() })
</script>

<template>
  <view class="page shipper-page home-page" :class="themeName">
    <view class="shipper-hero home-hero">
      <view class="shipper-heading">
        <view class="home-hero__kicker">
          <view class="home-hero__dot" />
          <text>TMS 货主端</text>
        </view>
        <view class="home-hero__actions">
          <text v-if="demo" class="demo-label">演示模式</text>
          <TmsAction class="home-hero__settings" aria-label="界面设置" @click="settings">
            <TmsIcon name="settings" size="36rpx" />
          </TmsAction>
        </view>
      </view>
      <text class="shipper-hero__title" role="heading" aria-level="1">{{ auth.staff ? '物流业务工作台' : '发货工作台' }}</text>
      <text v-if="data" class="shipper-hero__meta">{{ data.profile.customerName }}</text>
    </view>

    <view class="shipper-content shipper-content--tabbed home-content" role="main">
      <template v-if="auth.staff && !error">
        <view class="card shipper-card home-create">
          <view class="home-create__intro">
            <view class="home-create__icon"><TmsIcon name="waybill" size="50rpx" /></view>
            <view class="home-create__copy">
              <text class="section-title">运输业务</text>
              <text class="shipper-copy">查看待配载运输单、已配载运单与运输状态。</text>
            </view>
          </view>
          <wd-button type="primary" block custom-class="tms-primary-action" @click="openOrders()">查看运单</wd-button>
          <wd-button
            v-if="auth.permits('open')" block custom-class="tms-secondary-action" @click="openWorkspace('open')"
          >发货开单</wd-button>
        </view>
      </template>
      <template v-else-if="data">
        <view class="card shipper-card home-create">
          <view class="home-create__intro">
            <view class="home-create__icon"><TmsIcon name="box" size="50rpx" /></view>
            <view class="home-create__copy">
              <text class="section-title">发货委托</text>
              <text class="shipper-copy">填写收发货地址和货物，交由服务商安排运输。</text>
            </view>
          </view>
          <wd-button block type="primary" custom-class="tms-primary-action" @click="openShipmentForm">
            <TmsIcon name="add" size="32rpx" /> 我要发货
          </wd-button>
        </view>

        <view class="card shipper-card home-metrics">
          <text class="section-title" role="heading" aria-level="2">订单概览</text>
          <TmsMetricGrid :items="metrics" @select="openOrders" />
        </view>

        <view class="shipper-stack">
          <view class="shipper-heading home-heading">
            <text class="section-title" role="heading" aria-level="2">最近订单</text>
            <TmsAction class="shipper-inline" @click="openOrders()">
              全部订单 <TmsIcon name="arrow-right" size="25rpx" />
            </TmsAction>
          </view>
          <TmsOrderCard v-for="order in data.recent" :key="order.id" :order="order" />
          <view v-if="!data.recent.length" class="card shipper-empty">
            <view class="shipper-empty__icon"><TmsIcon name="waybill" size="46rpx" /></view>
            <text class="section-title">暂无订单</text>
            <text class="shipper-copy">提交发货委托后，可在这里查看运输进度。</text>
          </view>
        </view>
      </template>
      <TmsPageSkeleton v-else label="正在加载工作台…" :error="error" @retry="refresh" />
    </view>

    <TmsBottomNav active="home" />
  </view>
</template>

<style scoped lang="scss">
.home-hero { padding-top: calc(30rpx + env(safe-area-inset-top)); }
/* #ifdef MP-WEIXIN */
.home-hero { padding-top: max(132rpx, calc(80rpx + env(safe-area-inset-top))); }
/* #endif */
.home-hero__kicker,
.home-hero__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12rpx;
  font-size: max(24rpx, 12px);
  font-weight: 700;
}
.home-hero__dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #86efac;
  box-shadow: 0 0 0 6rpx rgba(134,239,172,.13);
}
.home-hero__settings {
  width: var(--tms-control-height);
  height: var(--tms-control-height);
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 50%;
  padding: 0;
  background: rgba(255,255,255,.12);
  color: #fff;
  display: grid;
  place-items: center;
}
.home-hero__settings:focus-visible { outline-color: white; }
.home-content { margin-top: -65rpx; position: relative; }
.home-create { display: grid; gap: 25rpx; }
.home-create__intro { display: flex; gap: 22rpx; align-items: center; }
.home-create__icon {
  display: grid;
  place-items: center;
  flex: 0 0 98rpx;
  height: 98rpx;
  color: var(--tms-primary);
  border-radius: 28rpx;
  background: linear-gradient(140deg, var(--tms-primary-soft), var(--tms-primary-soft-strong));
}
.home-create__copy { min-width: 0; display: grid; gap: 8rpx; }
.home-metrics { display: grid; gap: 23rpx; }
.home-heading { margin: -6rpx 4rpx -5rpx; }
</style>
