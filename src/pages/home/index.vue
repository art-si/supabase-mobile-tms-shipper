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
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileSectionHeading from '@mobile-core/components/MobileSectionHeading.vue'
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
    { key: 'pending', label: '待发运', value: counts.pending },
    { key: 'in_progress', label: '履约中', value: counts.in_progress },
    { key: 'signed', label: '已签收', value: counts.signed }
  ] satisfies { key: OrderGroup; label: string; value: number }[]
})

function selectMetric(index: number) {
  const metric = metrics.value[index]
  if (metric) openOrders(metric.key)
}

function refresh() { return auth.guard() ? load() : Promise.resolve() }
function settings() { uni.navigateTo({ url: '/pages/settings/index' }) }
onShow(refresh)
onPullDownRefresh(async () => { await refresh(); uni.stopPullDownRefresh() })
</script>

<template>
  <MobileWorkspace :container-class="['page shipper-page shipper-home-page', themeName]">
    <MobileTopBar
      capsule="always"
      :title="auth.staff ? '物流工作台' : '发货工作台'"
      :eyebrow="demo ? '演示模式' : undefined"
      :subtitle="data?.profile.customerName"
      show-menu menu-icon="settings" menu-label="界面设置" @menu="settings"
    />

    <view class="shipper-content shipper-content--tabbed home-content" role="main">
      <template v-if="auth.staff && !error">
        <view class="mobile-group">
          <view class="home-next">
            <MobileSectionHeading title="运输业务" description="查看待配载运输单和在途运单。" />
            <TmsAction class="tms-primary-action" @click="openOrders()">
              <MobileInlineLabel icon="waybill" label="查看运单" />
            </TmsAction>
          </view>
          <TmsAction v-if="auth.permits('open')" class="mobile-row home-secondary" @click="openWorkspace('open')">
            <view class="mobile-row__icon" aria-hidden="true"><MobileIcon name="add" size="19px" /></view>
            <view class="mobile-row__body"><text class="mobile-row__label">发货开单</text></view>
            <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" aria-hidden="true" />
          </TmsAction>
        </view>
      </template>
      <template v-else-if="data">
        <view class="mobile-group">
          <view class="home-next">
            <MobileSectionHeading title="发货委托" description="填写货物与收发信息，跟踪运输进度。" />
            <TmsAction class="tms-primary-action" @click="openShipmentForm">
              <MobileInlineLabel icon="add" label="我要发货" />
            </TmsAction>
          </view>
          <view class="home-overview home-secondary">
            <MobileSectionHeading title="订单概览" action-label="全部订单" @action="openOrders()" />
            <MobileMetricGrid :items="metrics" selectable @select="selectMetric" />
          </view>
        </view>

        <view class="home-section">
          <MobileSectionHeading title="最近订单" />
          <view v-if="data.recent.length" class="shipper-stack">
            <TmsOrderCard v-for="order in data.recent" :key="order.id" :order="order" />
          </view>
          <MobileEmptyState v-else class="shipper-card" icon="waybill" title="暂无订单"
            description="提交发货委托后，可在这里查看运输进度。" />
        </view>
      </template>
      <TmsPageSkeleton v-else label="正在加载工作台…" :error="error" @retry="refresh" />
    </view>

    <TmsBottomNav active="home" />
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.shipper-home-page { --mobile-header-subtitle-wrap: normal; }
.home-content { row-gap: 20px; }
.home-section { display: grid; gap: 8px; min-width: 0; }
.home-next {
  display: grid;
  gap: 12px;
  padding: var(--mobile-workspace-card-padding);
}
.home-secondary { border-top: 1px solid var(--mobile-workspace-line); }
.home-overview {
  --mobile-metric-grid-border: 0;
  --mobile-metric-grid-background: transparent;
  --mobile-metric-grid-radius: 0;
  --mobile-metric-height: 64px;
  padding: 4px var(--mobile-workspace-card-padding) 8px;
}
</style>
