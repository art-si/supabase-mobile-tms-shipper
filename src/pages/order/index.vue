<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import type { OrderCursor, OrderFilter, OrderSummary } from '@/api/types'
import { userMessage } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { useShipper } from '@/composables/useShipper'
import { openShipmentForm, ORDER_FILTERS } from '@/utils/orders'
import { DISPATCH_ACTIONS, openWorkspace, workspace } from '@/utils/workspace'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsDispatchWorkbench from '@/components/business/TmsDispatchWorkbench.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import MobileListFooter from '@mobile-core/components/MobileListFooter.vue'
import TmsOrderCard from '@/components/business/TmsOrderCard.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileSearch from '@mobile-core/components/MobileSearch.vue'
import MobileSegmented from '@mobile-core/components/MobileSegmented.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { watchMobilePageQuery } from '@mobile-core/watchMobilePageQuery'
import { createLatestRequest } from '@mobile-core/latest-request'

const { themeName } = usePageTheme()
const { auth, demo, list, shipmentOwner, shipmentRevision } = useShipper()
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
const requests = createLatestRequest()
let shownRevision = -1

function readFilter(query?: Record<string, unknown>) {
  return ORDER_FILTERS.find(({ value }) => value === query?.filter)?.value || 'all'
}

onLoad((query) => { filter.value = readFilter(query) })
watchMobilePageQuery('/pages/order/index', (query) => {
  selectFilter(readFilter(query))
})
onShow(() => {
  if (shownRevision !== shipmentRevision.value) void refresh()
  else auth.guard()
})
onUnload(requests.invalidate)
onPullDownRefresh(async () => { await refresh(); uni.stopPullDownRefresh() })
watch(shipmentOwner, () => {
  requests.invalidate()
  busy.value = false
  clearResults()
  shownRevision = -1
}, { flush: 'sync' })

function clearResults() {
  moreBusy.value = false
  error.value = ''
  moreError.value = ''
  orders.value = []
  cursor.value = null
}

async function refresh() {
  if (!auth.guard()) return
  shownRevision = shipmentRevision.value
  if (auth.staff) {
    await staffList.value?.load()
    return
  }
  const isCurrent = requests.start()
  busy.value = true
  clearResults()
  try {
    const result = await list({ filter: filter.value, keyword: keyword.value, cursor: null })
    if (!isCurrent()) return
    orders.value = result.items
    cursor.value = result.nextCursor
  } catch (cause) {
    if (isCurrent()) error.value = userMessage(cause, '订单加载失败，请重新加载。')
  } finally {
    if (isCurrent()) busy.value = false
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
  const isCurrent = requests.snapshot()
  moreBusy.value = true
  moreError.value = ''
  try {
    const result = await list({ filter: filter.value, keyword: keyword.value, cursor: cursor.value })
    if (!isCurrent()) return
    orders.value = [...orders.value, ...result.items]
    cursor.value = result.nextCursor
  } catch (cause) {
    if (isCurrent()) moreError.value = userMessage(cause, '加载更多失败，请重试。')
  } finally {
    if (isCurrent()) moreBusy.value = false
  }
}
</script>

<template>
  <MobileWorkspace :container-class="['page shipper-page', themeName]">
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
          <MobileListFooter
            :loading="moreBusy" :can-load-more="Boolean(cursor)" :error="moreError"
            error-title="无法加载更多订单" retry-text="重试加载" @more="loadMore"
          />
        </view>
        <MobileEmptyState
          v-else class="shipper-card" icon="waybill"
          :title="keyword || filter !== 'all' ? '没有符合条件的订单' : '暂无订单'"
          :description="keyword || filter !== 'all' ? '可更换关键词或切换状态查看。' : '提交发货委托后，可在这里查单。'"
        >
          <MobileAction
            v-if="!keyword && filter === 'all'" class="tms-primary-action" @click="openShipmentForm"
          >我要发货</MobileAction>
        </MobileEmptyState>
      </template>

      <view v-if="actions.length" class="shipper-stack">
        <text class="section-title order-list-heading" role="heading" aria-level="2">调度快捷操作</text>
        <view class="dispatch-actions">
          <MobileAction v-for="key in actions" :key="key" class="shipper-inline dispatch-action" @click="openWorkspace(key)">
            <MobileInlineLabel :label="workspace(key).title" icon="chevron" icon-position="end" />
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
.dispatch-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(76px, 1fr)); gap: 8px; }
.mobile-action.dispatch-action {
  --mobile-inline-pair-gap: 4px;
  padding-inline: 4px;
  border: 1px solid var(--mobile-workspace-line);
  border-radius: 12px;
  background: var(--mobile-workspace-surface);
  white-space: normal;
}
</style>
