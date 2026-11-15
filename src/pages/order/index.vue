<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import type { OrderCursor, OrderFilter, OrderSummary } from '@/api/types'
import { userMessage } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { useShipper } from '@/composables/useShipper'
import { openShipmentForm, ORDER_FILTERS } from '@/utils/orders'
import { DISPATCH_ACTIONS, openWorkspace, workspace } from '@/utils/workspace'
import TmsAction from '@/components/business/TmsAction.vue'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsDispatchWorkbench from '@/components/business/TmsDispatchWorkbench.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsOrderCard from '@/components/business/TmsOrderCard.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'

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

function clearSearch() {
  search.value = ''
  submitSearch()
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
  <view class="page shipper-page" :class="themeName">
    <TmsTopBar title="运单" :eyebrow="demo ? '演示模式' : undefined" />
    <view class="shipper-content shipper-content--tabbed" role="main">
      <view v-if="actions.length" class="card shipper-card shipper-stack">
        <text class="section-title">调度工作台</text>
        <view class="dispatch-actions">
          <TmsAction v-for="key in actions" :key="key" class="dispatch-action" @click="openWorkspace(key)">
            {{ workspace(key).title }} <TmsIcon name="arrow-right" size="24rpx" />
          </TmsAction>
        </view>
      </view>
      <TmsDispatchWorkbench v-if="auth.staff" ref="staffList" />
      <template v-else>
      <text class="section-title customer-orders">我的订单</text>
      <view class="order-search" role="search">
        <input
          v-model="search" class="order-search__field" name="order-search" aria-label="搜索订单号、站点或货名"
          placeholder="订单号、站点或货名…" confirm-type="search" :maxlength="64" @confirm="submitSearch"
        />
        <TmsAction v-if="search" class="order-search__clear" aria-label="清除搜索" @click="clearSearch">
          <TmsIcon name="close" size="30rpx" />
        </TmsAction>
        <TmsAction class="order-search__submit" @click="submitSearch">搜索</TmsAction>
      </view>
      <view class="order-filters" role="group" aria-label="订单状态">
        <TmsAction
          v-for="option in ORDER_FILTERS" :key="option.value" class="shipper-button order-filter"
          :class="{ 'order-filter--active': option.value === filter }"
          :aria-pressed="option.value === filter" @click="selectFilter(option.value)"
        >{{ option.label }}</TmsAction>
      </view>
      </template>

      <TmsPageSkeleton v-if="busy || error" compact label="正在加载订单…" :error="error" @retry="refresh" />
      <template v-else-if="orders.length">
        <TmsOrderCard v-for="order in orders" :key="order.id" :order="order" />
        <text v-if="moreError" class="shipper-error" role="alert">{{ moreError }}</text>
        <wd-button
          v-if="cursor" block custom-class="tms-secondary-action" :loading="moreBusy" :disabled="moreBusy"
          @click="loadMore"
        >{{ moreError ? '重试加载' : '加载更多' }}</wd-button>
      </template>
      <view v-else class="card shipper-empty">
        <view class="shipper-empty__icon"><TmsIcon name="waybill" size="46rpx" /></view>
        <text class="section-title">{{ keyword || filter !== 'all' ? '没有符合条件的订单' : '暂无订单' }}</text>
        <text class="shipper-copy">{{ keyword || filter !== 'all' ? '可更换关键词或切换状态查看。' : '提交发货委托后，可在这里查单。' }}</text>
        <wd-button
          v-if="!keyword && filter === 'all'" type="primary" custom-class="tms-primary-action" @click="openShipmentForm"
        >我要发货</wd-button>
      </view>
    </view>
    <TmsBottomNav active="order" />
  </view>
</template>

<style scoped lang="scss">
.customer-orders { margin: 0 3rpx; }
.dispatch-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; }
.dispatch-action {
  display: flex; align-items: center; justify-content: center; width: 100%; min-height: var(--tms-control-height);
  padding: 0 9rpx; gap: 8rpx; border-radius: var(--tms-control-radius); background: var(--tms-primary-soft);
  color: var(--tms-primary); font-size: max(26rpx, 13px); font-weight: 650;
}
.order-search {
  display: flex;
  align-items: center;
  min-width: 0;
  background: var(--tms-surface);
  border: 1px solid var(--tms-line);
  border-radius: var(--tms-control-radius);
}
.order-search:focus-within { outline: 2px solid var(--tms-primary); outline-offset: 2px; }
.order-search__field {
  flex: 1;
  min-width: 0;
  height: var(--tms-control-height);
  padding: 0 20rpx;
  font-size: max(28rpx, 16px);
}
.order-search__submit, .order-search__clear {
  height: var(--tms-control-height);
  min-width: 44px;
  padding: 0 16rpx;
  color: var(--tms-primary);
  font-size: max(24rpx, 13px);
  font-weight: 650;
  display: grid;
  place-items: center;
}
.order-search__clear { color: var(--tms-muted); padding: 0; }
.order-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding: 5rpx;
  gap: 3rpx;
  border: 1px solid var(--tms-line-subtle);
  border-radius: 21rpx;
  background: var(--tms-surface-muted);
}
.order-filter {
  width: 100%;
  min-height: 44px;
  padding: 0 4rpx;
  color: var(--tms-muted);
  font-size: max(22rpx, 12px);
  font-weight: 650;
  text-align: center;
  border-radius: 15rpx;
  white-space: nowrap;
}
.order-filter--active {
  color: var(--tms-primary);
  background: var(--tms-surface);
  box-shadow: 0 2rpx 8rpx rgba(21,32,51,.06);
}
</style>
