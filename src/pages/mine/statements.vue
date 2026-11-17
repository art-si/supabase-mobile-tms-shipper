<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { userMessage } from '@/api/supabase'
import type { CustomerStatement, CustomerStatementCursor } from '@/api/types'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileListFooter from '@mobile-core/components/MobileListFooter.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileLoadingStatus from '@mobile-core/components/MobileLoadingStatus.vue'
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'
import MobileRoute from '@mobile-core/components/MobileRoute.vue'
import MobileSectionHeading from '@mobile-core/components/MobileSectionHeading.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { formatCnyAmount } from '@mobile-core/money'
import { createLatestRequest } from '@mobile-core/latest-request'
import { mergePageRows } from '@mobile-core/list-rows'
import { watchMobilePageQuery } from '@mobile-core/watchMobilePageQuery'

const { themeName } = usePageTheme()
const { auth, demo, shipmentOwner, statementsPage, statement } = useShipper()
const statementId = ref('')
const data = shallowRef<CustomerStatement[] | null>(null)
const nextCursor = shallowRef<CustomerStatementCursor | null>(null)
const listBusy = ref(false)
const moreBusy = ref(false)
const listError = ref('')
const moreError = ref('')
const requests = createLatestRequest()
const loadedPages = ref(0)
const { data: details, error: detailError, load: loadDetails, reset: resetDetails } = usePageResource(
  () => statement(statementId.value), '明细加载失败，请重试。'
)

function stopListRequests() {
  requests.invalidate()
  listBusy.value = moreBusy.value = false
}

watch([shipmentOwner, () => auth.staff], () => {
  stopListRequests()
  data.value = nextCursor.value = null
  listError.value = moreError.value = ''
  loadedPages.value = 0
  resetDetails()
}, { flush: 'sync' })
onScopeDispose(stopListRequests)
onHide(stopListRequests)

function readQuery(query?: Record<string, unknown>) {
  const nextId = typeof query?.id === 'string' ? query.id : ''
  if (statementId.value === nextId) return false
  stopListRequests()
  statementId.value = nextId
  resetDetails()
  return true
}

onLoad(readQuery)
watchMobilePageQuery('/pages/mine/statements', (query) => {
  if (readQuery(query)) refresh()
})
function refresh() {
  if (!auth.guard() || auth.staff) return
  void (statementId.value ? loadDetails() : refreshList())
}
onShow(refresh)

function isBeforeInList(left: CustomerStatementCursor, right: CustomerStatementCursor) {
  if (left.periodEnd === right.periodEnd) return left.id > right.id
  return left.periodEnd === null || (right.periodEnd !== null && left.periodEnd > right.periodEnd)
}

async function refreshList() {
  if (statementId.value || listBusy.value || !auth.guard() || auth.staff) return
  const isCurrent = requests.start()
  listBusy.value = true
  moreBusy.value = false
  listError.value = moreError.value = ''
  const pagesToCheck = Math.max(1, loadedPages.value)
  const oldestShown = data.value?.[data.value.length - 1]
  let cursor: CustomerStatementCursor | null = null
  const rows: CustomerStatement[] = []
  let checked = 0
  try {
    // Rebuild through the old tail even when a new statement moves it to the next page.
    do {
      const page = await statementsPage(cursor)
      if (!isCurrent()) return
      rows.push(...page.items)
      cursor = page.nextCursor
      checked++
    } while (cursor && (checked < pagesToCheck || (oldestShown && isBeforeInList(cursor, oldestShown))))
    data.value = mergePageRows([], rows, (row) => row.id)
    nextCursor.value = cursor
    loadedPages.value = checked
  } catch (cause) {
    if (isCurrent()) listError.value = userMessage(cause, '对账单暂未更新，请重新加载。')
  } finally {
    if (isCurrent()) listBusy.value = false
  }
}

async function loadMore() {
  const cursor = nextCursor.value
  if (!cursor || statementId.value || listBusy.value || moreBusy.value || !auth.guard() || auth.staff) return
  const isCurrent = requests.snapshot()
  moreBusy.value = true
  moreError.value = ''
  try {
    const page = await statementsPage(cursor)
    if (!isCurrent()) return
    data.value = mergePageRows(data.value ?? [], page.items, (row) => row.id)
    nextCursor.value = page.nextCursor
    loadedPages.value++
  } catch (cause) {
    if (isCurrent()) moreError.value = userMessage(cause, '已保留之前的对账单，请重试加载。')
  } finally {
    if (isCurrent()) moreBusy.value = false
  }
}

function periodText({ periodStart, periodEnd }: CustomerStatement) {
  if (periodStart && periodEnd) return `${periodStart} 至 ${periodEnd}`
  if (periodStart) return `自 ${periodStart} 起`
  if (periodEnd) return `截至 ${periodEnd}`
  return '账期未填写'
}

function showStatement(id: string) {
  uni.navigateTo({ url: `/pages/mine/statements?id=${encodeURIComponent(id)}` })
}
</script>

<template>
  <MobileWorkspace :container-class="['page shipper-page', themeName]">
    <MobileTopBar
      capsule="always" :title="statementId ? '对账单详情' : '客户对账'"
      :eyebrow="demo ? '演示模式' : undefined" show-back
      :back-fallback="statementId ? '/pages/mine/statements' : '/pages/mine/index'"
    />
    <view class="shipper-content" role="main">
      <text v-if="auth.staff" class="shipper-copy">请从「我的」打开客户对账工作台。</text>
      <template v-else-if="details">
        <view class="mobile-group">
          <view class="mobile-row mobile-row--static">
            <view class="mobile-row__icon"><MobileIcon name="receipt" size="18px" /></view>
            <view class="mobile-row__body">
              <text class="mobile-row__label" user-select translate="no">{{ details.number }}</text>
              <text class="mobile-row__detail">{{ periodText(details) }}</text>
            </view>
          </view>
          <MobileMetricGrid summary :items="[
            { label: '对账金额', value: formatCnyAmount(details.amount), emphasis: true },
            { label: '已结算', value: formatCnyAmount(details.settled) }
          ]" />
        </view>
        <view class="mobile-group-section">
          <MobileSectionHeading title="对账明细" />
          <view v-if="details.lines.length" class="mobile-group">
            <view v-for="line in details.lines" :key="line.id" class="mobile-row mobile-row--static mobile-row--stack-amount">
              <view class="mobile-row__body">
                <text class="mobile-row__label" user-select translate="no">{{ line.orderNo || '运输单' }}</text>
                <MobileRoute v-if="line.origin && line.destination" class="statement-route" :origin="line.origin" :destination="line.destination" />
              </view>
              <text class="mobile-row__trailing mobile-amount">{{ formatCnyAmount(line.amount) }}</text>
            </view>
          </view>
          <MobileEmptyState v-else class="shipper-card" icon="receipt" title="暂无对账明细" />
        </view>
      </template>
      <TmsPageSkeleton v-else-if="statementId" compact label="正在加载明细…" :error="detailError" @retry="refresh" />
      <TmsPageSkeleton v-else-if="!data || (!data.length && (listBusy || listError))" compact
        label="正在加载对账单…" :error="listError" @retry="refreshList" />
      <template v-else-if="data?.length">
        <view class="mobile-group">
          <MobileAction
            v-for="item in data" :key="item.id" class="mobile-row mobile-row--stack-amount statement-row"
            @click="showStatement(item.id)"
          >
            <view class="mobile-row__body">
              <text class="mobile-row__label" translate="no">{{ item.number }}</text>
              <text class="mobile-row__detail">{{ periodText(item) }}</text>
              <text class="mobile-row__detail">已结算 {{ formatCnyAmount(item.settled) }}</text>
            </view>
            <text class="mobile-row__trailing mobile-amount">{{ formatCnyAmount(item.amount) }}</text>
            <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" />
          </MobileAction>
        </view>
        <MobileLoadingStatus v-if="listBusy" label="正在更新对账单…" />
        <MobileLoadError v-else-if="listError" title="对账单暂未更新" :message="listError"
          retry-text="重新加载" @retry="refreshList" />
        <MobileListFooter v-else :loading="moreBusy" :can-load-more="Boolean(nextCursor)"
          :finished="loadedPages > 1 && !nextCursor" :count="data.length" :error="moreError"
          error-title="无法加载更多对账单" retry-text="重试加载" @more="loadMore" />
      </template>
      <MobileEmptyState v-else class="shipper-card" icon="receipt" title="暂无已确认的对账单"
        description="服务商确认后，可在这里核对明细。" />
    </view>
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.mobile-row.statement-row { padding-block: 14px; }
.statement-route {
  --mobile-route-ink: var(--mobile-workspace-muted);
  --mobile-route-size: max(24rpx, 12px);
}
</style>
