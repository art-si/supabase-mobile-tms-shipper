<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { fetchDriverLedger, fetchReconciliationDrivers, type DriverLedgerKind, type ReconciliationDriver } from '@/api/staff'
import { usePageResource } from '@/composables/useShipper'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'
import { openWorkspace } from '@/utils/workspace'
import MobileAction from '@mobile-core/components/MobileAction.vue'
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
const keyword = ref('')
const driver = ref<ReconciliationDriver>()
const driverOffset = ref(0)
const ledgerOffset = ref(0)
const category = ref<DriverLedgerKind>('waybill')
const visibleCategories = computed(() => categories.filter((item) => auth.demo || auth.staffButtons.includes(item.permission)))
const categoryOptions = computed(() => visibleCategories.value.map(({ key, label }) => ({ value: key, label })))

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

</script>

<template>
  <MobileWorkspace class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" title="司机对账" :eyebrow="auth.demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <template v-if="!driver">
        <view>
          <text class="mobile-group-title" role="heading" aria-level="2">选择司机</text>
          <MobileSearch v-model="keyword" name="driver-name" label="搜索司机姓名" placeholder="搜索司机姓名…" @submit="search" @clear="search" />
        </view>
        <TmsPageSkeleton v-if="drivers.busy.value || drivers.error.value" :error="drivers.error.value" @retry="drivers.load" />
        <view v-else-if="drivers.data.value?.records.length" class="mobile-group">
          <MobileAction v-for="row in drivers.data.value.records" :key="row.id" class="mobile-row ledger-driver" @click="choose(row)">
            <view class="mobile-row__icon"><MobileIcon name="user" size="17px" /></view>
            <text class="mobile-row__body mobile-row__label">{{ row.driver_name || '未命名司机' }}</text>
            <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" />
          </MobileAction>
        </view>
        <view v-else class="shipper-empty">
          <view class="shipper-empty__icon"><MobileIcon name="user" size="22px" /></view>
          <text class="section-title">{{ auth.permits('driverSettlement') ? '没有符合条件的司机' : '当前账号没有查询权限' }}</text>
          <text v-if="!auth.permits('driverSettlement')" class="shipper-copy">请联系管理员开通司机综合查询权限。</text>
        </view>
      </template>
      <template v-else>
        <view class="mobile-group">
          <view class="mobile-row mobile-row--static">
            <view class="mobile-row__icon"><MobileIcon name="user" size="17px" /></view>
            <view class="mobile-row__body">
              <text class="mobile-row__detail">当前司机</text>
              <text class="mobile-row__label">{{ driver.driver_name || '未命名司机' }}</text>
            </view>
            <MobileAction class="shipper-inline ledger-change-driver" :disabled="ledger.busy.value" @click="driver = undefined">
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
            <view v-for="row in ledger.data.value.records" :key="row.id" class="mobile-row mobile-row--static ledger-row">
              <view class="mobile-row__body">
                <text class="mobile-row__label">{{ row.number || '费用记录' }}</text>
                <text v-if="row.occurredOn || row.waybillNo || row.note" class="mobile-row__detail">
                  {{ [row.occurredOn, row.waybillNo, row.note].filter(Boolean).join(' · ') }}
                </text>
              </view>
              <text class="mobile-row__trailing ledger-amount">{{ formatCnyAmount(row.amount) }}</text>
            </view>
          </view>
          <view v-else class="shipper-empty">
            <view class="shipper-empty__icon"><MobileIcon name="receipt" size="22px" /></view>
            <text class="section-title">该司机暂无此类费用记录。</text>
          </view>
        </template>
      </template>

      <view v-if="activeTotal > 20" class="shipper-heading">
        <MobileAction class="shipper-inline" :disabled="!(driver ? ledgerOffset : driverOffset)" @click="paginate(-1)">上一页</MobileAction>
        <MobileAction
          class="shipper-inline"
          :disabled="(driver ? ledgerOffset : driverOffset) + 20 >= activeTotal"
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
.ledger-amount {
  max-width: 42%;
  color: var(--mobile-workspace-ink);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
</style>
