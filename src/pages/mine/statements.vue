<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { CustomerStatementDetail } from '@/api/types'
import { userMessage } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { formatCnyAmount } from '@mobile-core/money'

const { themeName } = usePageTheme()
const { auth, demo, statements, statement } = useShipper()
const { data, busy, error, load } = usePageResource(statements, '对账单加载失败，请重新加载。')
const details = ref<CustomerStatementDetail>()
const opening = ref(false)
const detailError = ref('')

function refresh() { if (auth.guard() && !auth.staff) void load() }
onShow(refresh)

async function showStatement(id: string) {
  if (opening.value) return
  opening.value = true
  detailError.value = ''
  try {
    details.value = await statement(id)
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  } catch (cause) {
    detailError.value = userMessage(cause, '明细加载失败，请重试。')
  } finally {
    opening.value = false
  }
}
</script>

<template>
  <MobileWorkspace class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" title="客户对账" :eyebrow="demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <text v-if="auth.staff" class="shipper-copy">请从「我的」打开客户对账工作台。</text>
      <template v-else-if="details">
        <view class="mobile-group">
          <view class="mobile-row mobile-row--static">
            <view class="mobile-row__icon"><TmsIcon name="receipt" size="18px" /></view>
            <view class="mobile-row__body">
              <text class="mobile-row__label">{{ details.number }}</text>
              <text class="mobile-row__detail">{{ details.periodStart }} 至 {{ details.periodEnd }}</text>
            </view>
            <MobileAction class="shipper-inline statement-back" @click="details = undefined">返回列表</MobileAction>
          </view>
          <view class="mobile-row mobile-row--static statement-totals">
            <view>
              <text class="mobile-row__detail">对账金额</text>
              <text class="statement-money">{{ formatCnyAmount(details.amount) }}</text>
            </view>
            <view>
              <text class="mobile-row__detail">已结算</text>
              <text class="statement-money">{{ formatCnyAmount(details.settled) }}</text>
            </view>
          </view>
        </view>
        <view>
          <text class="mobile-group-title" role="heading" aria-level="2">对账明细</text>
          <view v-if="details.lines.length" class="mobile-group">
            <view v-for="line in details.lines" :key="line.id" class="mobile-row mobile-row--static">
              <view class="mobile-row__body">
                <text class="mobile-row__label">{{ line.orderNo || '运输单' }}</text>
                <text v-if="line.origin && line.destination" class="mobile-row__detail">{{ line.origin }} → {{ line.destination }}</text>
              </view>
              <text class="mobile-row__trailing statement-line-money">{{ formatCnyAmount(line.amount) }}</text>
            </view>
          </view>
          <text v-else class="shipper-copy">暂无对账明细。</text>
        </view>
      </template>
      <TmsPageSkeleton v-else-if="busy || error" label="正在加载对账单…" :error="error" @retry="refresh" />
      <template v-else-if="data?.length">
        <text v-if="detailError" class="shipper-error" role="alert">{{ detailError }}</text>
        <text v-else-if="opening" class="shipper-copy" role="status" aria-live="polite">正在加载明细…</text>
        <view class="mobile-group">
          <MobileAction
            v-for="item in data" :key="item.id" class="mobile-row statement-row"
            :disabled="opening" @click="showStatement(item.id)"
          >
            <view class="mobile-row__body">
              <text class="mobile-row__label">{{ item.number }}</text>
              <text class="mobile-row__detail">{{ item.periodStart }} 至 {{ item.periodEnd }}</text>
              <text class="mobile-row__detail">已结算 {{ formatCnyAmount(item.settled) }}</text>
            </view>
            <text class="mobile-row__trailing statement-line-money">{{ formatCnyAmount(item.amount) }}</text>
            <TmsIcon class="mobile-row__chevron" name="chevron" size="14px" />
          </MobileAction>
        </view>
      </template>
      <view v-else class="shipper-empty">
        <view class="shipper-empty__icon"><TmsIcon name="receipt" size="44rpx" /></view>
        <text class="section-title">暂无已确认的对账单</text>
        <text class="shipper-copy">服务商确认后，可在这里核对明细。</text>
      </view>
    </view>
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.statement-back { flex-shrink: 0; }
.statement-totals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  padding-block: 14px;
}
.statement-totals > view { display: grid; min-width: 0; gap: 4px; }
.statement-totals > view + view {
  padding-inline-start: 12px;
  border-inline-start: 1px solid var(--mobile-workspace-line);
}
.statement-money,
.statement-line-money {
  color: var(--mobile-workspace-ink);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.statement-money { font-size: clamp(17px, 5vw, 22px); line-height: 1.24; }
.statement-line-money { max-width: 42%; }
.statement-row { padding-block: 14px; }
</style>
