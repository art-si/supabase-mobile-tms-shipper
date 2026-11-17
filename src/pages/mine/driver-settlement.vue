<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { fetchDriverLedger, fetchReconciliationDrivers, STAFF_PAGE_SIZE, type DriverLedgerKind, type ReconciliationDriver } from '@/api/staff'
import { usePageResource } from '@/composables/useShipper'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'
import { openWorkspace } from '@/utils/workspace'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileSearch from '@mobile-core/components/MobileSearch.vue'
import MobileSegmented from '@mobile-core/components/MobileSegmented.vue'
import { formatCnyAmount } from '@mobile-core/money'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'

const categories: Array<{ key: DriverLedgerKind; label: string; permission: string }> = [
  { key: 'waybill', label: '运单费用', permission: 'FinanceWaybillCost:View' },
  { key: 'loan', label: '借款', permission: 'FinanceLoanApplication:View' },
  { key: 'repayment', label: '还款', permission: 'FinanceRepayment:View' },
  { key: 'reimbursement', label: '报销', permission: 'FinanceExpenseReimbursement:View' }
]
const { themeName } = usePageTheme()
const auth = useAuthStore()
const searchDraft = ref('')
const keyword = ref('')
const driver = ref<ReconciliationDriver>()
const driverOffset = ref(0)
const ledgerOffset = ref(0)
const category = ref<DriverLedgerKind>('waybill')
const visibleCategories = computed(() => categories.filter((item) => auth.demo || auth.staffButtons.includes(item.permission)))
const categoryOptions = computed(() => visibleCategories.value.map(({ key, label }) => ({ value: key, label })))

const drivers = usePageResource(async () => {
  const query = keyword.value
  const offset = driverOffset.value
  await auth.loadStaffAccess()
  if (!auth.permits('driverSettlement')) return { records: [], total: 0 }
  if (auth.demo) {
    const rows = [{ id: 'demo-driver', driver_name: '演示司机' }].filter((item) => item.driver_name.includes(query))
    return { records: rows, total: rows.length }
  }
  return auth.authenticated((token) => fetchReconciliationDrivers(token, query, offset))
}, '司机资料加载失败，请重新加载。')
const ledger = usePageResource(async () => {
  const id = driver.value?.id
  if (!id) return { records: [], total: 0 }
  const kind = category.value
  const offset = ledgerOffset.value
  if (auth.demo) {
    return kind === 'waybill' ? {
      total: 1, records: [{ id: 'demo-cost', number: 'FY-DEMO-001', occurredOn: '2026-11-14', amount: 85.5, note: '过路费', waybillNo: 'YD-DEMO-001-01' }]
    } : { records: [], total: 0 }
  }
  return auth.authenticated((token) => fetchDriverLedger(token, id, kind, offset))
}, '费用流水加载失败，请重新加载。')
const activeResource = computed(() => driver.value ? ledger : drivers)
const activeOffset = computed(() => driver.value ? ledgerOffset.value : driverOffset.value)
const currentPage = computed(() => Math.floor(activeOffset.value / STAFF_PAGE_SIZE) + 1)
const pageCount = computed(() => Math.ceil((activeResource.value.data.value?.total ?? 0) / STAFF_PAGE_SIZE))

onShow(() => { if (auth.guard() && !driver.value) void drivers.load() })

function search() {
  const next = searchDraft.value.trim()
  if (drivers.busy.value && keyword.value === next && !driverOffset.value) return
  keyword.value = next
  driverOffset.value = 0
  drivers.reset()
  void drivers.load()
}

function choose(row: ReconciliationDriver) {
  driver.value = row
  const first = visibleCategories.value[0]
  if (first) loadCategory(first.key)
}

function clearDriver() {
  driver.value = undefined
  ledger.reset()
}

async function confirmBack() {
  if (!driver.value) return true
  clearDriver()
  return false
}

function loadCategory(key: DriverLedgerKind) {
  if (ledger.busy.value) return
  category.value = key
  ledgerOffset.value = 0
  void ledger.load()
}

function paginate(step: -1 | 1) {
  const next = currentPage.value + step
  if (activeResource.value.busy.value || next < 1 || next > pageCount.value) return
  const offset = driver.value ? ledgerOffset : driverOffset
  offset.value = (next - 1) * STAFF_PAGE_SIZE
  void activeResource.value.load()
}

</script>

<template>
  <MobileWorkspace :container-class="['page shipper-page', themeName]">
    <MobileTopBar
      capsule="always" :title="driver ? '司机费用流水' : '司机对账'"
      :eyebrow="auth.demo ? '演示模式' : undefined"
      show-back back-fallback="/pages/mine/index" :confirm-back="confirmBack"
    />
    <view class="shipper-content" role="main">
      <template v-if="!driver">
        <view>
          <text class="mobile-group-title" role="heading" aria-level="2">选择司机</text>
          <MobileSearch
            v-model="searchDraft" name="driver-name" label="搜索司机姓名" placeholder="搜索司机姓名…"
            @submit="search" @clear="search"
          />
        </view>
        <TmsPageSkeleton v-if="drivers.busy.value || drivers.error.value" :error="drivers.error.value" @retry="drivers.load" />
        <view v-else-if="drivers.data.value?.records.length" class="mobile-group">
          <MobileAction v-for="row in drivers.data.value.records" :key="row.id" class="mobile-row" @click="choose(row)">
            <view class="mobile-row__icon"><MobileIcon name="user" size="17px" /></view>
            <text class="mobile-row__body mobile-row__label">{{ row.driver_name || '未命名司机' }}</text>
            <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" />
          </MobileAction>
        </view>
        <MobileEmptyState
          v-else class="shipper-card" icon="user"
          :title="auth.permits('driverSettlement') ? '没有符合条件的司机' : '当前账号没有查询权限'"
          :description="auth.permits('driverSettlement') ? '试试其他姓名或清除筛选。' : '请联系管理员开通司机综合查询权限。'"
        />
      </template>
      <template v-else>
        <view class="mobile-group">
          <view class="mobile-row mobile-row--static">
            <view class="mobile-row__icon"><MobileIcon name="user" size="17px" /></view>
            <view class="mobile-row__body">
              <text class="mobile-row__detail">当前司机</text>
              <text class="mobile-row__label">{{ driver.driver_name || '未命名司机' }}</text>
            </view>
            <MobileAction class="shipper-inline ledger-change-driver" @click="clearDriver">
              更换司机
            </MobileAction>
          </view>
        </view>
        <MobileSegmented
          v-if="categoryOptions.length"
          :model-value="category" :options="categoryOptions" label="费用类型"
          :disabled="ledger.busy.value" @update:model-value="loadCategory"
        />
        <text v-else class="shipper-copy">账号暂无费用查看权限。</text>
        <TmsPageSkeleton v-if="ledger.busy.value || ledger.error.value" :error="ledger.error.value" @retry="ledger.load" />
        <template v-else-if="visibleCategories.length">
          <view v-if="ledger.data.value?.records.length" class="mobile-group">
            <view v-for="row in ledger.data.value.records" :key="row.id" class="mobile-row mobile-row--static mobile-row--stack-amount">
              <view class="mobile-row__body">
                <text class="mobile-row__label">{{ row.number || '费用记录' }}</text>
                <text v-if="row.occurredOn || row.waybillNo || row.note" class="mobile-row__detail">
                  {{ [row.occurredOn, row.waybillNo, row.note].filter(Boolean).join(' · ') }}
                </text>
              </view>
              <text class="mobile-row__trailing mobile-amount">{{ formatCnyAmount(row.amount) }}</text>
            </view>
          </view>
          <MobileEmptyState v-else class="shipper-card" icon="receipt" title="该司机暂无此类费用记录。" />
        </template>
      </template>

      <view v-if="pageCount > 1" class="shipper-heading ledger-pagination" role="navigation" aria-label="结果分页">
        <MobileAction
          class="shipper-inline"
          :disabled="activeResource.busy.value || currentPage <= 1"
          @click="paginate(-1)"
        >上一页</MobileAction>
        <text class="shipper-copy" role="status">第 {{ currentPage }} / {{ pageCount }} 页</text>
        <MobileAction
          class="shipper-inline"
          :disabled="activeResource.busy.value || currentPage >= pageCount"
          @click="paginate(1)"
        >下一页</MobileAction>
      </view>
      <view v-if="auth.permits('driverSettlement')" class="mobile-group">
        <MobileAction class="mobile-row" @click="openWorkspace('driverSettlement')">
          <view class="mobile-row__icon"><MobileIcon name="document" size="17px" /></view>
          <text class="mobile-row__body mobile-row__label">打开 Web 司机综合查询</text>
          <MobileIcon class="mobile-row__chevron" name="arrow-right" size="15px" />
        </MobileAction>
      </view>
    </view>
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.ledger-change-driver { flex-shrink: 0; }
.ledger-pagination { flex-wrap: wrap; }
</style>
