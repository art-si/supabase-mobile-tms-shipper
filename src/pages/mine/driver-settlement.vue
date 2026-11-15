<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { fetchDriverLedger, fetchReconciliationDrivers, type DriverLedgerKind, type ReconciliationDriver } from '@/api/staff'
import { usePageResource } from '@/composables/useShipper'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'
import { openWorkspace } from '@/utils/workspace'
import TmsAction from '@/components/business/TmsAction.vue'
import TmsPageSkeleton from '@/components/business/TmsPageSkeleton.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'

const categories: Array<{ key: DriverLedgerKind; label: string; permission: string }> = [
  { key: 'waybill', label: '运单费用', permission: 'FinanceWaybillCost:View' },
  { key: 'loan', label: '借款', permission: 'FinanceLoanApplication:View' },
  { key: 'repayment', label: '还款', permission: 'FinanceRepayment:View' },
  { key: 'reimbursement', label: '报销', permission: 'FinanceExpenseReimbursement:View' }
]
const { themeName } = usePageTheme()
const auth = useAuthStore()
const keyword = ref('')
const driver = ref<ReconciliationDriver>()
const driverOffset = ref(0)
const ledgerOffset = ref(0)
const category = ref<DriverLedgerKind>('waybill')
const visibleCategories = computed(() => categories.filter((item) => auth.demo || auth.staffButtons.includes(item.permission)))

const drivers = usePageResource(async () => {
  await auth.loadStaffAccess()
  if (!auth.permits('driverSettlement')) return { records: [], total: 0 }
  if (auth.demo) {
    const rows = [{ id: 'demo-driver', driver_name: '演示司机' }].filter((item) => item.driver_name.includes(keyword.value))
    return { records: rows, total: rows.length }
  }
  return auth.authenticated((token) => fetchReconciliationDrivers(token, keyword.value.trim(), driverOffset.value))
}, '司机资料加载失败，请重新加载。')
const ledger = usePageResource(async () => {
  const id = driver.value?.id
  if (!id) return { records: [], total: 0 }
  if (auth.demo) {
    return category.value === 'waybill' ? {
      total: 1, records: [{ id: 'demo-cost', number: 'FY-DEMO-001', occurredOn: '2026-11-14', amount: 85.5, note: '过路费', waybillNo: 'YD-DEMO-001-01' }]
    } : { records: [], total: 0 }
  }
  return auth.authenticated((token) => fetchDriverLedger(token, id, category.value, ledgerOffset.value))
}, '费用流水加载失败，请重新加载。')
const activeTotal = computed(() => (driver.value ? ledger.data.value : drivers.data.value)?.total ?? 0)

onShow(() => { if (auth.guard() && !driver.value) void drivers.load() })

function search() {
  if (drivers.busy.value) return
  driverOffset.value = 0
  void drivers.load()
}

function choose(row: ReconciliationDriver) {
  driver.value = row
  const first = visibleCategories.value[0]
  if (first) loadCategory(first.key)
}

function loadCategory(key: DriverLedgerKind) {
  if (ledger.busy.value) return
  category.value = key
  ledgerOffset.value = 0
  void ledger.load()
}

function paginate(step: number) {
  const offset = driver.value ? ledgerOffset : driverOffset
  const resource = driver.value ? ledger : drivers
  if (resource.busy.value) return
  offset.value += step * 20
  void resource.load()
}

function money(value: number | string | null) {
  return value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : `¥${Number(value).toFixed(2)}`
}
</script>

<template>
  <view class="page shipper-page" :class="themeName">
    <TmsTopBar title="司机对账" :eyebrow="auth.demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <template v-if="!driver">
        <view class="card shipper-card shipper-stack">
          <text class="section-title">选择司机</text>
          <view class="shipper-heading">
            <input v-model="keyword" class="ledger-search" aria-label="搜索司机姓名" placeholder="搜索司机姓名…" @confirm="search" />
            <TmsAction class="shipper-inline" @click="search">搜索</TmsAction>
          </view>
        </view>
        <TmsPageSkeleton v-if="drivers.busy.value || drivers.error.value" :error="drivers.error.value" @retry="drivers.load" />
        <template v-else>
          <TmsAction v-for="row in drivers.data.value?.records" :key="row.id" class="card shipper-card ledger-driver" @click="choose(row)">
            {{ row.driver_name || '未命名司机' }}
          </TmsAction>
          <text v-if="!drivers.data.value?.records.length" class="shipper-copy">
            {{ auth.permits('driverSettlement') ? '没有符合条件的司机。' : '此功能需要司机综合查询权限。' }}
          </text>
        </template>
      </template>
      <template v-else>
        <view class="card shipper-card shipper-stack">
          <view class="shipper-heading">
            <text class="section-title">{{ driver.driver_name }}</text>
            <TmsAction class="shipper-inline" :disabled="ledger.busy.value" @click="driver = undefined">更换司机</TmsAction>
          </view>
          <view class="ledger-tabs" role="group" aria-label="费用类型">
            <TmsAction
              v-for="item in visibleCategories" :key="item.key" class="ledger-tab"
              :aria-pressed="category === item.key" :disabled="ledger.busy.value" @click="loadCategory(item.key)"
            >{{ item.label }}</TmsAction>
          </view>
          <text v-if="!visibleCategories.length" class="shipper-copy">账号暂无费用查看权限。</text>
        </view>
        <TmsPageSkeleton v-if="ledger.busy.value || ledger.error.value" :error="ledger.error.value" @retry="ledger.load" />
        <template v-else-if="visibleCategories.length">
          <view v-for="row in ledger.data.value?.records" :key="row.id" class="card shipper-card shipper-stack ledger-row">
            <view class="shipper-heading">
              <text class="section-title">{{ row.number || '费用记录' }}</text>
              <text class="ledger-amount">{{ money(row.amount) }}</text>
            </view>
            <text class="shipper-copy">{{ [row.occurredOn, row.waybillNo, row.note].filter(Boolean).join(' · ') }}</text>
          </view>
          <text v-if="!ledger.data.value?.records.length" class="shipper-copy">该司机暂无此类费用记录。</text>
        </template>
      </template>

      <view v-if="activeTotal > 20" class="shipper-heading">
        <TmsAction class="shipper-inline" :disabled="!(driver ? ledgerOffset : driverOffset)" @click="paginate(-1)">上一页</TmsAction>
        <TmsAction
          class="shipper-inline"
          :disabled="(driver ? ledgerOffset : driverOffset) + 20 >= activeTotal"
          @click="paginate(1)"
        >下一页</TmsAction>
      </view>
      <TmsAction v-if="auth.permits('driverSettlement')" class="shipper-inline" @click="openWorkspace('driverSettlement')">打开 Web 司机综合查询</TmsAction>
    </view>
  </view>
</template>

<style scoped lang="scss">
.ledger-search {
  flex: 1; min-width: 0; min-height: var(--tms-control-height); padding: 0 16rpx;
  border: 1px solid var(--tms-line); border-radius: var(--tms-control-radius); font-size: 16px;
}
.ledger-search:focus { outline: 2px solid var(--tms-primary); }
.ledger-driver { width: 100%; min-height: var(--tms-control-height); background: var(--tms-surface); font-weight: 650; }
.ledger-tabs { display: flex; flex-wrap: wrap; gap: 8rpx; }
.ledger-tab { min-height: var(--tms-control-height); padding: 0 16rpx; border-radius: 14rpx; background: var(--tms-surface-soft); font-size: 13px; }
.ledger-tab[aria-pressed='true'] { color: var(--tms-primary); background: var(--tms-primary-soft); font-weight: 700; }
.ledger-row { gap: 14rpx; overflow-wrap: anywhere; }
.ledger-amount { color: var(--tms-primary); font-weight: 750; }
</style>
