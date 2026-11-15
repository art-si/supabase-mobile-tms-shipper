<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import type { OrderBatch } from '@/api/types'
import { ApiError, receiptUrl } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { formatTime, openOrders } from '@/utils/orders'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsAction from '@/components/business/TmsAction.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import TmsStatusTag from '@/components/business/TmsStatusTag.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'

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
  <view class="page shipper-page" :class="themeName">
    <TmsTopBar title="订单详情" :eyebrow="demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <template v-if="order">
        <view v-if="created" class="detail-success" role="status">
          <TmsIcon name="check" size="32rpx" />
          <text>发货委托已提交，服务商将安排运输。</text>
        </view>
        <view class="card shipper-card shipper-stack">
          <view class="shipper-heading">
            <text class="section-title">原始运输单</text>
            <TmsStatusTag :status="order.status" />
          </view>
          <view class="shipper-heading">
            <text class="detail-number" selectable>{{ order.orderNo }}</text>
            <TmsAction class="shipper-inline" @click="copyNumber(order.orderNo)">复制</TmsAction>
          </view>
          <view class="detail-route">
            <text>{{ order.origin }}</text>
            <TmsIcon name="route-arrow" size="32rpx" />
            <text>{{ order.destination }}</text>
          </view>
          <text class="shipper-copy">委托时间 {{ formatTime(order.createdAt, true) }}</text>
        </view>

        <view class="card shipper-card shipper-stack">
          <view class="shipper-heading">
            <text class="section-title" role="heading" aria-level="2">运输批次与回单</text>
            <text v-if="order.batches.length" class="shipper-copy">{{ order.batches.length }} 个批次</text>
          </view>
          <view v-if="!order.batches.length" class="detail-no-batch">
            <TmsIcon :name="order.signedAt ? 'receipt' : 'time'" size="36rpx" />
            <text class="shipper-copy">
              {{ order.signedAt ? `签收时间 ${formatTime(order.signedAt, true)}，暂无可查看的回单。`
                : order.status === 'cancelled' ? '此订单已取消。' : '服务商配载后，批次进度将在此更新。' }}
            </text>
          </view>
          <text v-if="previewError" class="shipper-error" role="alert">{{ previewError }}</text>
          <view v-for="batch in order.batches" :key="batch.id" class="detail-batch">
            <view class="shipper-heading">
              <text class="detail-batch__number">{{ batch.waybillNo }}</text>
              <TmsStatusTag :status="batch.status" batch />
            </view>
            <text class="shipper-copy">本单发运 {{ batch.quantity }} {{ order.cargoUnit || '' }}</text>
            <view class="detail-events">
              <view v-for="event in batchEvents(batch)" :key="event.label" class="detail-event">
                <text>{{ event.label }}</text><text>{{ formatTime(event.time) }}</text>
              </view>
            </view>
            <view v-if="batch.receiptAt || batch.receiptPaths.length" class="detail-receipt">
              <view class="detail-receipt__title">
                <TmsIcon name="receipt" size="32rpx" /><text>签收回单</text>
              </view>
              <text v-if="batch.signedQuantity !== null" class="shipper-copy">
                签收 {{ batch.signedQuantity }} {{ order.cargoUnit || '' }}<template v-if="batch.exceptionQuantity"> · 异常 {{ batch.exceptionQuantity }} {{ order.cargoUnit || '' }}</template>
              </text>
              <view v-if="batch.receiptPaths.length" class="detail-receipt__files">
                <TmsAction
                  v-for="(path, index) in batch.receiptPaths" :key="path"
                  class="shipper-button detail-receipt__file" :aria-label="`查看回单 ${index + 1}`"
                  @click="preview(batch.receiptPaths, index)"
                >
                  <image :src="receiptUrl(path)" mode="aspectFill" lazy-load class="detail-receipt__image" aria-hidden="true" />
                  <text>回单 {{ index + 1 }}</text>
                </TmsAction>
              </view>
              <text v-else class="shipper-copy">
                {{ batch.sharedWaybill ? '合单已登记本单签收结果。如需回单图片，请联系服务商。' : '回单图片归档后可在此查看。' }}
              </text>
            </view>
          </view>
        </view>

        <view class="card shipper-card shipper-stack">
          <text class="section-title" role="heading" aria-level="2">收发货信息</text>
          <view v-for="item in contacts" :key="item.direction" class="detail-contact">
            <view class="detail-contact__mark" :class="{ 'detail-contact__mark--receiver': item.direction === '收' }">
              {{ item.direction }}
            </view>
            <view class="detail-contact__body">
              <text class="detail-batch__number">{{ item.title }}</text>
              <text class="shipper-copy" selectable>{{ item.contact.address }}</text>
              <text class="shipper-copy" selectable>{{ item.contact.name }} · {{ item.contact.phone }}</text>
            </view>
          </view>
        </view>
        <view class="card shipper-card shipper-stack">
          <text class="section-title" role="heading" aria-level="2">货物明细</text>
          <view v-for="(item, index) in order.cargo" :key="index" class="detail-cargo">
            <text class="detail-batch__number">{{ item.name }}</text>
            <text class="shipper-copy">
              {{ item.quantity }} {{ item.unit || '件' }}<template v-if="item.weightKg"> · {{ item.weightKg }} kg</template><template v-if="item.volumeM3"> · {{ item.volumeM3 }} m³</template>
            </text>
          </view>
          <text v-if="!order.cargo.length" class="shipper-copy">合计 {{ order.cargoQuantity }} {{ order.cargoUnit || '件' }}</text>
          <text v-if="order.remark" class="shipper-copy">运输备注 · {{ order.remark }}</text>
        </view>
      </template>
      <view v-else class="shipper-stack">
        <TmsPageSkeleton label="正在加载订单详情…" :error="error" @retry="refresh" />
        <wd-button v-if="error" block custom-class="tms-secondary-action" @click="openOrders()">返回订单</wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.detail-success {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 24rpx;
  color: #047857;
  background: var(--tms-green-soft);
  border-radius: var(--tms-radius-md);
  font-size: max(26rpx, 13px);
}
.detail-number {
  color: var(--tms-text-strong);
  font-size: max(33rpx, 17px);
  font-weight: 750;
  overflow-wrap: anywhere;
}
.detail-route { display: flex; align-items: center; gap: 16rpx; color: var(--tms-primary); }
.detail-route text { color: var(--tms-text); font-weight: 700; overflow-wrap: anywhere; }
.detail-no-batch, .detail-batch {
  border-radius: var(--tms-radius-md);
  border: 1px solid var(--tms-line-subtle);
  background: var(--tms-surface-soft);
  padding: 22rpx;
}
.detail-no-batch { display: flex; gap: 13rpx; align-items: center; color: var(--tms-primary); }
.detail-batch { display: grid; gap: 10rpx; }
.detail-batch__number { color: var(--tms-text-strong); font-size: max(27rpx, 14px); font-weight: 700; overflow-wrap: anywhere; }
.detail-events { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx 14rpx; padding: 10rpx 0; }
.detail-event { display: grid; gap: 4rpx; color: var(--tms-muted); font-size: max(24rpx, 12px); }
.detail-event text:first-child { color: var(--tms-text); font-weight: 650; }
.detail-receipt { display: grid; gap: 12rpx; padding-top: 18rpx; border-top: 1px solid var(--tms-line-subtle); }
.detail-receipt__title {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: var(--tms-primary);
  font-weight: 700;
  font-size: max(27rpx, 14px);
}
.detail-receipt__files { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; }
.detail-receipt__file {
  display: grid;
  width: 100%;
  min-width: 0;
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
.detail-receipt__file text { padding: 10rpx 4rpx; }
.detail-receipt__image { display: block; width: 100%; height: 108rpx; background: var(--tms-surface-muted); }
.detail-contact { display: flex; gap: 15rpx; align-items: flex-start; }
.detail-contact__mark {
  flex: none;
  display: grid;
  place-items: center;
  width: 46rpx;
  height: 46rpx;
  border-radius: 50%;
  background: var(--tms-primary-soft);
  color: var(--tms-primary);
  font-weight: 750;
  font-size: max(23rpx, 12px);
}
.detail-contact__mark--receiver { color: #047857; background: var(--tms-green-soft); }
.detail-contact__body,.detail-cargo { display: grid; min-width: 0; gap: 5rpx; }
.detail-cargo { padding: 14rpx 0; border-bottom: 1px solid var(--tms-line-subtle); }
</style>
