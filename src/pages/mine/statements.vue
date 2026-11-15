<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { CustomerStatementDetail } from '@/api/types'
import { userMessage } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import TmsAction from '@/components/business/TmsAction.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@/components/business/TmsPageSkeleton.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'

const { themeName } = usePageTheme()
const { auth, demo, statements, statement } = useShipper()
const { data, busy, error, load } = usePageResource(statements, '对账单加载失败，请重新加载。')
const details = ref<CustomerStatementDetail>()
const opening = ref(false)
const detailError = ref('')

function money(value: number) { return `¥${Number(value).toFixed(2)}` }
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
  <view class="page shipper-page" :class="themeName">
    <TmsTopBar title="客户对账" :eyebrow="demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <text v-if="auth.staff" class="shipper-copy">请从「我的」打开客户对账工作台。</text>
      <template v-else-if="details">
        <view class="card shipper-card shipper-stack">
          <view class="shipper-heading">
            <text class="section-title">{{ details.number }}</text>
            <TmsAction class="shipper-inline" @click="details = undefined">返回列表</TmsAction>
          </view>
          <text class="shipper-copy">{{ details.periodStart }} 至 {{ details.periodEnd }}</text>
          <view class="statement-amounts">
            <view><text class="shipper-copy">对账金额</text><text>{{ money(details.amount) }}</text></view>
            <view><text class="shipper-copy">已结算</text><text>{{ money(details.settled) }}</text></view>
          </view>
        </view>
        <view class="card shipper-card shipper-stack">
          <text class="section-title">对账明细</text>
          <view v-for="line in details.lines" :key="line.id" class="statement-line">
            <view class="statement-label">
              <text>{{ line.orderNo || '运输单' }}</text>
              <text v-if="line.origin && line.destination" class="shipper-copy">{{ line.origin }} → {{ line.destination }}</text>
            </view>
            <text class="statement-money">{{ money(line.amount) }}</text>
          </view>
          <text v-if="!details.lines.length" class="shipper-copy">暂无对账明细。</text>
        </view>
      </template>
      <TmsPageSkeleton v-else-if="busy || error" label="正在加载对账单…" :error="error" @retry="refresh" />
      <template v-else-if="data?.length">
        <text v-if="detailError" class="shipper-error" role="alert">{{ detailError }}</text>
        <TmsAction
          v-for="item in data" :key="item.id" class="card shipper-card statement-row"
          :disabled="opening" @click="showStatement(item.id)"
        >
          <view class="shipper-heading">
            <text class="section-title">{{ item.number }}</text>
            <TmsIcon name="arrow-right" size="27rpx" />
          </view>
          <text class="shipper-copy">{{ item.periodStart }} 至 {{ item.periodEnd }}</text>
          <view class="statement-amounts">
            <view><text class="shipper-copy">对账金额</text><text>{{ money(item.amount) }}</text></view>
            <view><text class="shipper-copy">已结算</text><text>{{ money(item.settled) }}</text></view>
          </view>
        </TmsAction>
      </template>
      <view v-else class="card shipper-empty">
        <view class="shipper-empty__icon"><TmsIcon name="receipt" size="44rpx" /></view>
        <text class="section-title">暂无已确认的对账单</text>
        <text class="shipper-copy">服务商确认后，可在这里核对明细。</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.statement-row { display: grid; gap: 16rpx; width: 100%; background: var(--tms-surface); color: var(--tms-primary); }
.statement-amounts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; }
.statement-amounts > view { display: grid; gap: 5rpx; padding: 18rpx; background: var(--tms-surface-soft); border-radius: var(--tms-radius-md); }
.statement-amounts > view > text:last-child, .statement-money { color: var(--tms-text-strong); font-weight: 750; overflow-wrap: anywhere; }
.statement-line { display: flex; justify-content: space-between; gap: 12rpx; padding-top: 15rpx; border-top: 1px solid var(--tms-line-subtle); }
.statement-label { display: grid; min-width: 0; overflow-wrap: anywhere; }
</style>
