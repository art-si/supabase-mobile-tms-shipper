<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { openOrders, openShipmentForm } from '@/utils/orders'
import { openWorkspace } from '@/utils/workspace'
import type { OrderGroup } from '@/api/types'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsAction from '@mobile-core/components/MobileAction.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
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
  <MobileWorkspace class="page shipper-page" :class="themeName">
    <MobileTopBar
      capsule="always"
      :title="auth.staff ? '物流工作台' : '发货工作台'"
      :eyebrow="demo ? '演示模式' : undefined"
      :subtitle="data?.profile.customerName"
      show-menu menu-icon="settings" menu-label="界面设置" @menu="settings"
    />

    <view class="shipper-content shipper-content--tabbed home-content" role="main">
      <template v-if="auth.staff && !error">
        <view class="home-section">
          <text class="mobile-group-title" role="heading" aria-level="2">运输业务</text>
          <view class="mobile-group">
            <TmsAction class="mobile-row" @click="openOrders()">
              <view class="mobile-row__icon"><TmsIcon name="waybill" size="19px" /></view>
              <view class="mobile-row__body">
                <text class="mobile-row__label">查看运单</text>
                <text class="mobile-row__detail">待配载运输单和在途运单</text>
              </view>
              <TmsIcon class="mobile-row__chevron" name="arrow-right" size="16px" />
            </TmsAction>
            <TmsAction v-if="auth.permits('open')" class="mobile-row" @click="openWorkspace('open')">
              <view class="mobile-row__icon"><TmsIcon name="add" size="19px" /></view>
              <view class="mobile-row__body"><text class="mobile-row__label">发货开单</text></view>
              <TmsIcon class="mobile-row__chevron" name="arrow-right" size="16px" />
            </TmsAction>
          </view>
        </view>
      </template>
      <template v-else-if="data">
        <view class="home-section">
          <view class="shipper-heading home-section__header">
            <text class="mobile-group-title" role="heading" aria-level="2">订单概览</text>
            <TmsAction class="shipper-inline" @click="openOrders()">全部订单 <TmsIcon name="arrow-right" size="14px" /></TmsAction>
          </view>
          <TmsMetricGrid :items="metrics" @select="openOrders" />
        </view>

        <view class="mobile-group">
          <TmsAction class="mobile-row" aria-label="我要发货" @click="openShipmentForm">
            <view class="mobile-row__icon home-shipment__icon"><TmsIcon name="add" size="20px" /></view>
            <view class="mobile-row__body">
              <text class="mobile-row__label">我要发货</text>
              <text class="mobile-row__detail">提交发货委托</text>
            </view>
            <TmsIcon class="mobile-row__chevron" name="arrow-right" size="16px" />
          </TmsAction>
        </view>

        <view class="home-section">
          <text class="mobile-group-title" role="heading" aria-level="2">最近订单</text>
          <view v-if="data.recent.length" class="shipper-stack">
            <TmsOrderCard v-for="order in data.recent" :key="order.id" :order="order" />
          </view>
          <view v-else class="shipper-card shipper-empty">
            <view class="shipper-empty__icon"><TmsIcon name="waybill" size="24px" /></view>
            <text class="section-title">暂无订单</text>
            <text class="shipper-copy">提交发货委托后，可在这里查看运输进度。</text>
          </view>
        </view>
      </template>
      <TmsPageSkeleton v-else label="正在加载工作台…" :error="error" @retry="refresh" />
    </view>

    <TmsBottomNav active="home" />
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.home-content { row-gap: 20px; }
.home-section { display: grid; gap: 9px; min-width: 0; }
.home-section__header .mobile-group-title { margin-block: 0; }
.home-section__header .shipper-inline { padding-inline-end: 2px; }
.home-shipment__icon { background: var(--tms-primary); color: #fff; }
</style>
