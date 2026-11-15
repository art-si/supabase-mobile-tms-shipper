<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import type { OrderCursor, OrderFilter, OrderSummary } from '@/api/types'
import { userMessage } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { useShipper } from '@/composables/useShipper'
import { openShipmentForm, ORDER_FILTERS } from '@/utils/orders'
import { DISPATCH_ACTIONS, openWorkspace, workspace } from '@/utils/workspace'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsDispatchWorkbench from '@/components/business/TmsDispatchWorkbench.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsOrderCard from '@/components/business/TmsOrderCard.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileSearch from '@mobile-core/components/MobileSearch.vue'
import MobileSegmented from '@mobile-core/components/MobileSegmented.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'

const { themeName } = usePageTheme()
const { auth, demo, list } = useShipper()
const filter = ref<OrderFilter>('all')
const search = ref('')
const keyword = ref('')
const orders = ref<OrderSummary[]>([])
const cursor = ref<OrderCursor | null>(null)
const busy = ref(false)
const moreBusy = ref(false)
const error = ref('')
const moreError = ref('')
const staffList = ref<InstanceType<typeof TmsDispatchWorkbench>>()
const actions = computed(() => DISPATCH_ACTIONS.filter((key) => auth.permits(key)))
let requestVersion = 0

onLoad((query) => {
  const option = ORDER_FILTERS.find(({ value }) => value === query?.filter)
  if (option) filter.value = option.value
})
onShow(() => { void refresh() })
onUnload(() => { requestVersion++ })
onPullDownRefresh(async () => { await refresh(); uni.stopPullDownRefresh() })

async function refresh() {
  if (!auth.guard()) return
  if (auth.staff) {
    await staffList.value?.load()
    return
  }
  const version = ++requestVersion
  busy.value = true
  moreBusy.value = false
  error.value = ''
  moreError.value = ''
  orders.value = []
  cursor.value = null
  try {
    const result = await list({ filter: filter.value, keyword: keyword.value, cursor: null })
    if (version !== requestVersion) return
    orders.value = result.items
    cursor.value = result.nextCursor
  } catch (cause) {
    if (version === requestVersion) error.value = userMessage(cause, '订单加载失败，请重新加载。')
  } finally {
    if (version === requestVersion) busy.value = false
  }
}

function selectFilter(value: OrderFilter) {
  if (filter.value === value) return
  filter.value = value
  void refresh()
}

function submitSearch() {
  keyword.value = search.value.trim()
  void refresh()
}

async function loadMore() {
  if (!cursor.value || busy.value || moreBusy.value) return
  const version = requestVersion
  moreBusy.value = true
  moreError.value = ''
  try {
    const result = await list({ filter: filter.value, keyword: keyword.value, cursor: cursor.value })
    if (version !== requestVersion) return
    orders.value = [...orders.value, ...result.items]
    cursor.value = result.nextCursor
  } catch (cause) {
    if (version === requestVersion) moreError.value = userMessage(cause, '加载更多失败，请重试。')
  } finally {
    if (version === requestVersion) moreBusy.value = false
  }
}
</script>

<template>
  <MobileWorkspace class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" title="运单" :eyebrow="demo ? '演示模式' : undefined" />
    <view class="shipper-content shipper-content--tabbed" role="main">
      <template v-if="!auth.staff">
        <view class="shipper-stack">
          <MobileSearch
            v-model="search" class="order-search" name="order-search" label="搜索订单号、站点或货名"
            placeholder="订单号、站点或货名…" @submit="submitSearch" @clear="submitSearch"
          />
          <MobileSegmented :model-value="filter" :options="ORDER_FILTERS" label="订单状态" @update:model-value="selectFilter" />
        </view>

        <TmsPageSkeleton v-if="busy || error" compact label="正在加载订单…" :error="error" @retry="refresh" />
        <view v-else-if="orders.length" class="shipper-stack">
          <view class="shipper-heading order-list-heading">
            <text class="section-title" role="heading" aria-level="2">{{ filter === 'all' && !keyword ? '全部订单' : '筛选结果' }}</text>
            <text class="shipper-copy" role="status">{{ cursor ? '已显示 ' : '共 ' }}{{ orders.length }} 张</text>
          </view>
          <TmsOrderCard v-for="order in orders" :key="order.id" :order="order" />
          <text v-if="moreError" class="shipper-error" role="alert">{{ moreError }}</text>
          <wd-button
            v-if="cursor" block custom-class="tms-secondary-action" :loading="moreBusy" :disabled="moreBusy"
            @click="loadMore"
          >{{ moreError ? '重试加载' : '加载更多' }}</wd-button>
        </view>
        <view v-else class="card shipper-card shipper-empty">
          <view class="shipper-empty__icon" aria-hidden="true"><TmsIcon name="waybill" size="39rpx" /></view>
          <text class="section-title" role="heading" aria-level="2">{{ keyword || filter !== 'all' ? '没有符合条件的订单' : '暂无订单' }}</text>
          <text class="shipper-copy">{{ keyword || filter !== 'all' ? '可更换关键词或切换状态查看。' : '提交发货委托后，可在这里查单。' }}</text>
          <wd-button
            v-if="!keyword && filter === 'all'" type="primary" custom-class="tms-primary-action" @click="openShipmentForm"
          >我要发货</wd-button>
        </view>
      </template>

      <view v-if="actions.length" class="shipper-stack">
        <text class="section-title order-list-heading" role="heading" aria-level="2">调度快捷操作</text>
        <view class="dispatch-actions">
          <MobileAction v-for="key in actions" :key="key" class="dispatch-action" @click="openWorkspace(key)">
            {{ workspace(key).title }} <TmsIcon name="chevron" size="21rpx" aria-hidden="true" />
          </MobileAction>
        </view>
      </view>
      <TmsDispatchWorkbench v-if="auth.staff" ref="staffList" />
    </view>
    <TmsBottomNav active="order" />
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.order-list-heading { margin-inline: 2px; }
.dispatch-actions { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; }
.dispatch-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: var(--mobile-workspace-action-height);
  padding-inline: 6px;
  gap: 5px;
  border: 1px solid var(--mobile-workspace-line);
  border-radius: 12px;
  background: var(--mobile-workspace-surface);
  color: var(--mobile-workspace-accent);
  font-size: max(24rpx, 13px);
  font-weight: 650;
  white-space: nowrap;
}
</style>
