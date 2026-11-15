<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchWorkbench, type WorkbenchMode } from '@/api/staff'
import { userMessage } from '@/api/supabase'
import { usePageResource } from '@/composables/useShipper'
import { useAuthStore } from '@/stores/auth'
import { openWorkspace } from '@/utils/workspace'
import TmsAction from './TmsAction.vue'
import TmsIcon from './TmsIcon.vue'
import TmsPageSkeleton from './TmsPageSkeleton.vue'
import TmsStatusTag from './TmsStatusTag.vue'

const auth = useAuthStore()
const mode = ref<WorkbenchMode>('pending')
const offset = ref(0)
const { data, busy, error, load } = usePageResource(async () => {
  await auth.loadStaffAccess()
  const permitted = (['pending', 'loaded'] as const).filter((key) => auth.permits(key))
  const fallback = permitted[0]
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
    <view v-if="auth.permits('pending') || auth.permits('loaded')" class="dispatch-tabs" role="group" aria-label="配载状态">
      <TmsAction
        v-if="auth.permits('pending')" class="dispatch-tab" :aria-pressed="mode === 'pending'"
        :disabled="busy" @click="select('pending')"
      >待配载运单</TmsAction>
      <TmsAction
        v-if="auth.permits('loaded')" class="dispatch-tab" :aria-pressed="mode === 'loaded'"
        :disabled="busy" @click="select('loaded')"
      >已配载运单</TmsAction>
    </view>
    <TmsPageSkeleton v-if="busy || error" compact label="正在加载运单…" :error="error" @retry="load" />
    <template v-else-if="data?.records.length">
      <view class="shipper-heading">
        <text class="shipper-copy">共 {{ data.total }} 张运单</text>
        <TmsAction class="shipper-inline" @click="openWorkspace(mode)">打开业务工作台 <TmsIcon name="arrow-right" size="24rpx" /></TmsAction>
      </view>
      <view v-for="row in data.records" :key="row.id" class="card shipper-card shipper-stack dispatch-row">
        <view class="shipper-heading">
          <text class="dispatch-row__number">{{ row.waybill_no || row.order_no }}</text>
          <TmsStatusTag
            :status="mode === 'pending' ? row.order_status || 'pending_load' : row.waybill_status || row.status || ''"
            :batch="mode === 'loaded'"
          />
        </view>
        <text class="section-title">{{ row.origin_station || row.origin_city || '—' }} → {{ row.destination_station || row.destination_city || '—' }}</text>
        <text class="shipper-copy">
          {{ row.cargo_name || row.cargo_items?.[0]?.cargo_name || '货物' }}
          <template v-if="row.execution_kind === 'merge'"> · 合单</template>
          <template v-else-if="row.execution_kind === 'split'"> · 拆单</template>
        </text>
      </view>
      <view v-if="data.total > 20" class="shipper-heading">
        <TmsAction class="shipper-inline" :disabled="!offset" @click="move(-1)">上一页</TmsAction>
        <text class="shipper-copy">第 {{ page }} 页</text>
        <TmsAction class="shipper-inline" :disabled="offset + 20 >= data.total" @click="move(1)">下一页</TmsAction>
      </view>
    </template>
    <view v-else class="card shipper-empty">
      <view class="shipper-empty__icon"><TmsIcon name="waybill" size="44rpx" /></view>
      <text class="section-title">{{ auth.permits(mode) ? '当前暂无运单' : '账号暂无运单查看权限' }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.dispatch-workbench { gap: 19rpx; }
.dispatch-tabs { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 9rpx; padding: 6rpx; border-radius: 20rpx; background: var(--tms-surface-muted); }
.dispatch-tab { width: 100%; min-height: var(--tms-control-height); border-radius: 15rpx; text-align: center; font-size: max(27rpx, 14px); font-weight: 650; color: var(--tms-muted); }
.dispatch-tab[aria-pressed=true] { color: var(--tms-primary); background: var(--tms-surface); box-shadow: var(--tms-shadow-sm); }
.dispatch-row { gap: 15rpx; }
.dispatch-row__number { color: var(--tms-muted); font-size: max(25rpx, 13px); font-weight: 650; overflow-wrap: anywhere; }
.dispatch-row .section-title { overflow-wrap: anywhere; }
</style>
