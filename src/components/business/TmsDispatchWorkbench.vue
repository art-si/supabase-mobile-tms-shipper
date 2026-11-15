<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchWorkbench, type WorkbenchMode } from '@/api/staff'
import { usePageResource } from '@/composables/useShipper'
import { useAuthStore } from '@/stores/auth'
import { openWorkspace } from '@/utils/workspace'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileRoute from '@mobile-core/components/MobileRoute.vue'
import MobileSegmented from '@mobile-core/components/MobileSegmented.vue'
import TmsIcon from './TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import TmsStatusTag from './TmsStatusTag.vue'

const auth = useAuthStore()
const mode = ref<WorkbenchMode>('pending')
const offset = ref(0)
const options = computed(() => ([
  { value: 'pending', label: '待配载运单' },
  { value: 'loaded', label: '已配载运单' }
] as const).filter(({ value }) => auth.permits(value)))
const { data, busy, error, load } = usePageResource(async () => {
  await auth.loadStaffAccess()
  const fallback = options.value[0]?.value
  if (!fallback) return { records: [], total: 0 }
  if (!auth.permits(mode.value)) mode.value = fallback
  return auth.authenticated((token) => fetchWorkbench(token, mode.value, offset.value))
}, '运单工作台加载失败，请重新加载。')
const page = computed(() => Math.floor(offset.value / 20) + 1)

function select(next: WorkbenchMode) {
  if (busy.value || mode.value === next) return
  mode.value = next
  offset.value = 0
  void load()
}
function move(step: number) {
  if (busy.value) return
  offset.value += step * 20
  void load()
}

defineExpose({ load })
void load()
</script>

<template>
  <view class="shipper-stack dispatch-workbench">
    <text class="section-title dispatch-label" role="heading" aria-level="2">配载运单</text>
    <MobileSegmented
      v-if="options.length"
      :model-value="mode" :options="options" :disabled="busy"
      label="配载状态" @update:model-value="select"
    />
    <view v-if="options.length" class="dispatch-list-heading">
      <text v-if="data && !busy && !error" class="shipper-copy" role="status">共 {{ data.total }} 张运单</text>
      <MobileAction class="shipper-inline dispatch-link" @click="openWorkspace(mode)">
        打开业务工作台 <TmsIcon name="arrow-right" size="24rpx" aria-hidden="true" />
      </MobileAction>
    </view>
    <TmsPageSkeleton v-if="busy || error" compact label="正在加载运单…" :error="error" @retry="load" />
    <template v-else-if="data?.records.length">
      <view v-for="row in data.records" :key="row.id" class="card shipper-card shipper-stack dispatch-row">
        <view class="shipper-heading">
          <text class="dispatch-row__number" translate="no">{{ row.waybill_no || row.order_no || '暂无单号' }}</text>
          <TmsStatusTag
            :status="mode === 'pending' ? row.order_status || 'pending_load' : row.waybill_status || row.status || ''"
            :batch="mode === 'loaded'"
          />
        </view>
        <MobileRoute
          :origin="row.origin_station || row.origin_city || '发货地待确认'"
          :destination="row.destination_station || row.destination_city || '收货地待确认'"
        />
        <text class="shipper-copy dispatch-row__cargo">
          {{ row.cargo_name || row.cargo_items?.[0]?.cargo_name || '货物' }}
          <template v-if="row.execution_kind === 'merge'"> · 合单</template>
          <template v-else-if="row.execution_kind === 'split'"> · 拆单</template>
        </text>
      </view>
      <view v-if="data.total > 20" class="shipper-heading dispatch-pagination">
        <MobileAction class="shipper-inline" :disabled="!offset" @click="move(-1)">上一页</MobileAction>
        <text class="shipper-copy">第 {{ page }} 页</text>
        <MobileAction class="shipper-inline" :disabled="offset + 20 >= data.total" @click="move(1)">下一页</MobileAction>
      </view>
    </template>
    <view v-else class="card shipper-card shipper-empty">
      <view class="shipper-empty__icon" aria-hidden="true"><TmsIcon name="waybill" size="39rpx" /></view>
      <text class="section-title">{{ auth.permits(mode) ? '当前暂无运单' : '账号暂无运单查看权限' }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.dispatch-label { margin-inline: 2px; }
.dispatch-list-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 8px;
  padding-inline-start: 2px;
}
.dispatch-link { margin-inline-start: auto; }
.dispatch-row { gap: 10px; }
.dispatch-row__number {
  color: var(--mobile-workspace-muted);
  font-size: max(23rpx, 12px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.dispatch-row__cargo { padding-top: 8px; border-top: 1px solid var(--mobile-workspace-line); }
.dispatch-pagination { flex-wrap: wrap; }
</style>
