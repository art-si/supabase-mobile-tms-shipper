<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import type { OrderBatch } from '@/api/types'
import { ApiError, receiptUrl } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { formatTime, openOrders } from '@/utils/orders'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import TmsStatusTag from '@/components/business/TmsStatusTag.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileRoute from '@mobile-core/components/MobileRoute.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'

const { themeName } = usePageTheme()
const { auth, demo, detail } = useShipper()
const id = ref('')
const created = ref(false)
const previewError = ref('')
const { data: order, error, load } = usePageResource(
  () => id.value ? detail(id.value) : Promise.reject(new ApiError(404, 'SHIPPER_ORDER_NOT_FOUND')),
  '详情加载失败，请重新加载。'
)
const contacts = computed(() => order.value ? [
  { direction: '发', title: '发货信息', contact: order.value.sender },
  { direction: '收', title: '收货信息', contact: order.value.receiver }
] : [])
const batchEvents = (batch: OrderBatch) => [
  { label: '配载', time: batch.dispatchedAt },
  { label: '发车', time: batch.departedAt },
  { label: '到达', time: batch.arrivedAt },
  { label: '签收', time: batch.receiptAt }
].filter(({ time }) => time)

onLoad((query) => {
  id.value = typeof query?.id === 'string' ? query.id : ''
  created.value = query?.created === '1'
})
function refresh() { return auth.guard() ? load() : Promise.resolve() }
onShow(refresh)
onPullDownRefresh(async () => { await refresh(); uni.stopPullDownRefresh() })

function preview(paths: string[], index: number) {
  previewError.value = ''
  const urls = paths.map(receiptUrl)
  uni.previewImage({
    current: urls[index],
    urls,
    fail: () => { previewError.value = '回单预览失败，请稍后重试。' }
  })
}

function copyNumber(number: string) {
  uni.setClipboardData({
    data: number,
    fail: () => uni.showToast({ title: '复制失败，请长按订单号', icon: 'none' })
  })
}
</script>

<template>
  <MobileWorkspace class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" title="订单详情" :eyebrow="demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <template v-if="order">
        <view v-if="created" class="detail-success" role="status">
          <TmsIcon name="check" size="32rpx" aria-hidden="true" />
          <text>发货委托已提交，服务商将安排运输。</text>
        </view>
        <view class="card shipper-card shipper-stack detail-overview">
          <view class="shipper-heading">
            <text class="detail-label" role="heading" aria-level="2">原始运输单</text>
            <TmsStatusTag :status="order.status" />
          </view>
          <MobileRoute
            class="detail-route"
            :origin="order.origin || '发货地待确认'"
            :destination="order.destination || '收货地待确认'"
          />
          <view class="shipper-heading detail-overview__meta">
            <view class="detail-overview__numbers">
              <text class="detail-number" selectable translate="no">{{ order.orderNo }}</text>
              <text class="shipper-copy detail-time">委托时间 {{ formatTime(order.createdAt, true) }}</text>
            </view>
            <MobileAction class="shipper-inline" aria-label="复制订单号" @click="copyNumber(order.orderNo)">复制</MobileAction>
          </view>
        </view>

        <view class="shipper-stack">
          <view class="shipper-heading detail-section-heading">
            <text class="section-title" role="heading" aria-level="2">运输批次与回单</text>
            <text v-if="order.batches.length" class="shipper-copy">{{ order.batches.length }} 个批次</text>
          </view>
          <view v-if="!order.batches.length" class="card shipper-card detail-no-batch">
            <TmsIcon :name="order.signedAt ? 'receipt' : 'time'" size="36rpx" aria-hidden="true" />
            <text class="shipper-copy">
              {{ order.signedAt ? `签收时间 ${formatTime(order.signedAt, true)}，暂无可查看的回单。`
                : order.status === 'cancelled' ? '此订单已取消。' : '服务商配载后，批次进度将在此更新。' }}
            </text>
          </view>
          <text v-if="previewError" class="shipper-error" role="alert">{{ previewError }}</text>
          <view v-for="batch in order.batches" :key="batch.id" class="card shipper-card detail-batch">
            <view class="shipper-heading">
              <text class="detail-batch__number" translate="no">{{ batch.waybillNo }}</text>
              <TmsStatusTag :status="batch.status" batch />
            </view>
            <text class="shipper-copy">本单发运 {{ batch.quantity }} {{ order.cargoUnit || '' }}</text>
            <view class="detail-events">
              <view v-for="event in batchEvents(batch)" :key="event.label" class="detail-event">
                <text class="detail-event__label">{{ event.label }}</text>
                <text class="detail-time">{{ formatTime(event.time) }}</text>
              </view>
            </view>
            <view v-if="batch.receiptAt || batch.receiptPaths.length" class="detail-receipt">
              <view class="detail-receipt__title">
                <TmsIcon name="receipt" size="32rpx" aria-hidden="true" /><text>签收回单</text>
              </view>
              <text v-if="batch.signedQuantity !== null" class="shipper-copy">
                签收 {{ batch.signedQuantity }} {{ order.cargoUnit || '' }}<template v-if="batch.exceptionQuantity"> · 异常 {{ batch.exceptionQuantity }} {{ order.cargoUnit || '' }}</template>
              </text>
              <view v-if="batch.receiptPaths.length" class="detail-receipt__files">
                <MobileAction
                  v-for="(path, index) in batch.receiptPaths" :key="path"
                  class="detail-receipt__file" :aria-label="`查看回单 ${index + 1}`"
                  @click="preview(batch.receiptPaths, index)"
                >
                  <image :src="receiptUrl(path)" mode="aspectFill" lazy-load class="detail-receipt__image" aria-hidden="true" />
                  <text>回单 {{ index + 1 }}</text>
                </MobileAction>
              </view>
              <text v-else class="shipper-copy">
                {{ batch.sharedWaybill ? '合单已登记本单签收结果。如需回单图片，请联系服务商。' : '回单图片归档后可在此查看。' }}
              </text>
            </view>
          </view>
        </view>

        <view class="shipper-stack">
          <text class="section-title detail-section-heading" role="heading" aria-level="2">收发货信息</text>
          <view class="card shipper-card detail-group">
            <view v-for="item in contacts" :key="item.direction" class="detail-contact">
              <view class="detail-contact__mark" :class="{ 'detail-contact__mark--receiver': item.direction === '收' }" aria-hidden="true">
                {{ item.direction }}
              </view>
              <view class="detail-contact__body">
                <text class="detail-batch__number">{{ item.title }}</text>
                <text class="shipper-copy" selectable>{{ item.contact.address || '地址待确认' }}</text>
                <text
                  v-if="item.contact.name || item.contact.phone" class="shipper-copy" selectable
                >{{ [item.contact.name, item.contact.phone].filter(Boolean).join(' · ') }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="shipper-stack">
          <text class="section-title detail-section-heading" role="heading" aria-level="2">货物明细</text>
          <view class="card shipper-card detail-group">
            <view v-for="(item, index) in order.cargo" :key="index" class="detail-cargo">
              <text class="detail-batch__number">{{ item.name }}</text>
              <text class="shipper-copy detail-time">
                {{ item.quantity }} {{ item.unit || '件' }}<template v-if="item.weightKg"> · {{ item.weightKg }} kg</template><template v-if="item.volumeM3"> · {{ item.volumeM3 }} m³</template>
              </text>
            </view>
            <text v-if="!order.cargo.length" class="shipper-copy detail-cargo">合计 {{ order.cargoQuantity }} {{ order.cargoUnit || '件' }}</text>
            <text v-if="order.remark" class="shipper-copy detail-cargo">运输备注 · {{ order.remark }}</text>
          </view>
        </view>
      </template>
      <view v-else class="shipper-stack">
        <TmsPageSkeleton label="正在加载订单详情…" :error="error" @retry="refresh" />
        <MobileAction v-if="error" class="tms-secondary-action" @click="openOrders()">返回订单</MobileAction>
      </view>
    </view>
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.detail-success {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  color: var(--tms-green-strong);
  background: var(--tms-green-soft);
  border-radius: 14px;
  font-size: max(26rpx, 13px);
}
.detail-label {
  color: var(--mobile-workspace-muted);
  font-size: max(23rpx, 12px);
  font-weight: 650;
}
.detail-overview { gap: 12px; }
.detail-overview__meta {
  padding-top: 8px;
  border-top: 1px solid var(--mobile-workspace-line);
}
.detail-overview__meta .shipper-inline { flex: none; min-width: 44px; }
.detail-overview__numbers { display: grid; min-width: 0; gap: 2px; }
.detail-number {
  color: var(--mobile-workspace-ink);
  font-size: max(26rpx, 14px);
  font-weight: 680;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.detail-route { --mobile-route-size: clamp(20px, 5vw, 24px); }
.detail-time { font-variant-numeric: tabular-nums; }
.detail-section-heading { margin-inline: 2px; }
.detail-no-batch { display: flex; gap: 10px; align-items: center; color: var(--mobile-workspace-accent); }
.detail-batch { display: grid; gap: 9px; }
.detail-batch__number {
  color: var(--mobile-workspace-ink);
  font-size: max(27rpx, 14px);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.detail-events {
  display: grid;
  padding-inline-start: 4px;
}
.detail-event {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
  position: relative;
  min-width: 0;
  padding: 7px 0 7px 15px;
  border-inline-start: 1px solid var(--mobile-workspace-line);
  color: var(--mobile-workspace-muted);
  font-size: max(24rpx, 13px);
}
.detail-event::before {
  position: absolute;
  inset-inline-start: -4px;
  inset-block-start: calc(14px - 1px);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--mobile-workspace-accent);
  content: '';
}
.detail-event__label { color: var(--mobile-workspace-ink); font-weight: 650; }
.detail-receipt { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--mobile-workspace-line); }
.detail-receipt__title {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: var(--mobile-workspace-accent);
  font-weight: 700;
  font-size: max(27rpx, 14px);
}
.detail-receipt__files { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; }
.detail-receipt__file {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: 1px solid var(--tms-line);
  border-radius: 12rpx;
  background: var(--tms-surface);
  color: var(--tms-primary);
  font-size: max(22rpx, 12px);
  font-weight: 650;
  text-align: center;
  overflow: hidden;
}
.detail-receipt__file text { padding: 6px 4px; }
.detail-receipt__image { display: block; width: 100%; height: 108rpx; background: var(--tms-surface-muted); }
.detail-group { display: grid; padding-block: 0; }
.detail-contact { display: flex; gap: 12px; align-items: flex-start; }
.detail-contact, .detail-cargo { padding-block: 14px; }
.detail-contact + .detail-contact, .detail-cargo + .detail-cargo { border-top: 1px solid var(--mobile-workspace-line); }
.detail-contact__mark {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--tms-primary-soft);
  color: var(--tms-primary);
  font-weight: 750;
  font-size: max(23rpx, 12px);
}
.detail-contact__mark--receiver { color: var(--tms-green-strong); background: var(--tms-green-soft); }
.detail-contact__body,.detail-cargo { display: grid; min-width: 0; gap: 3px; }
</style>
