<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { fetchStaffMessages, readStaffMessage, type StaffMessage } from '@/api/staff'
import { userMessage } from '@/api/supabase'
import type { OrderUpdate } from '@/api/types'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { usePageTheme } from '@/composables/usePageTheme'
import { formatTime, openOrder, statusAppearance } from '@/utils/orders'
import { workspaceUrl } from '@/utils/workspace'
import TmsAction from '@/components/business/TmsAction.vue'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'

type Message = { id: string; title: string; content: string; createdAt: string; isRead: boolean } &
  ({ order: OrderUpdate } | { staff: StaffMessage })

const { themeName } = usePageTheme()
const { auth, demo, messages, readMessage } = useShipper()
const unreadOnly = ref(false)
const selected = ref<Message>()
const marking = ref(false)
const actionError = ref('')

const { data, busy, error, load } = usePageResource<Message[]>(async () => {
  if (auth.staff) {
    const rows = await auth.authenticated(fetchStaffMessages)
    return rows.map((row) => ({
      id: row.id, title: row.title, content: row.content || '', isRead: row.isRead,
      createdAt: row.createdAt, staff: row
    }))
  }
  const rows = await messages()
  return rows.map((row) => ({
    id: row.id, title: `运输动态 · ${statusAppearance(row.status, false).label}`,
    content: row.orderNo, isRead: row.isRead, createdAt: row.createdAt, order: row
  }))
}, '消息加载失败，请重新加载。')

const visible = computed(() => (data.value || []).filter((item) => !unreadOnly.value || !item.isRead))
const unread = computed(() => (data.value || []).filter((item) => !item.isRead).length)
const staffLink = computed(() => selected.value && 'staff' in selected.value && selected.value.staff.routePath
  ? workspaceUrl(selected.value.staff.routePath, selected.value.staff.routeQuery) : '')

function refresh() { return auth.guard() ? load() : Promise.resolve() }
onShow(refresh)
onPullDownRefresh(async () => { await refresh(); uni.stopPullDownRefresh() })

async function choose(item: Message) {
  if (marking.value) return
  actionError.value = ''
  marking.value = true
  try {
    if (!item.isRead) {
      if ('order' in item) await readMessage(item.id, item.createdAt)
      else if (item.staff.category !== 'todo') await auth.authenticated((token) => readStaffMessage(token, item.staff))
      if ('order' in item || item.staff.category !== 'todo') {
        data.value = data.value?.map((row) => row.id === item.id ? { ...row, isRead: true } : row) || null
      }
    }
    if ('order' in item) openOrder(item.id)
    else selected.value = item
  } catch (cause) {
    actionError.value = userMessage(cause, '无法打开消息，请重试。')
  } finally {
    marking.value = false
  }
}
</script>

<template>
  <view class="page shipper-page" :class="themeName">
    <TmsTopBar title="消息" :eyebrow="demo ? '演示模式' : undefined" />
    <view class="shipper-content shipper-content--tabbed" role="main">
      <template v-if="selected">
        <view class="card shipper-card shipper-stack">
          <view class="shipper-heading">
            <text class="section-title">{{ selected.title }}</text>
            <TmsAction class="shipper-inline" @click="selected = undefined">返回列表</TmsAction>
          </view>
          <text class="shipper-copy">{{ formatTime(selected.createdAt, true) }}</text>
          <text class="message-content">{{ selected.content || '暂无消息详情。' }}</text>
          <!-- #ifdef H5 -->
          <a v-if="staffLink" :href="staffLink" target="_blank" rel="noopener noreferrer" class="message-link">查看关联业务</a>
          <!-- #endif -->
        </view>
      </template>
      <template v-else>
        <view class="shipper-heading">
          <text class="section-title">{{ auth.staff ? '通知与待办' : '运输动态' }}</text>
          <TmsAction class="shipper-inline" :aria-pressed="unreadOnly" @click="unreadOnly = !unreadOnly">
            {{ unreadOnly ? '显示全部' : `仅未读（${unread}）` }}
          </TmsAction>
        </view>
        <text v-if="actionError" class="shipper-error" role="alert">{{ actionError }}</text>
        <TmsPageSkeleton v-if="busy || error" compact label="正在加载消息…" :error="error" @retry="refresh" />
        <template v-else-if="visible.length">
          <TmsAction
            v-for="item in visible" :key="item.id" class="card shipper-card message-row"
            :disabled="marking" @click="choose(item)"
          >
            <view class="message-row__icon"><TmsIcon name="message" size="35rpx" /></view>
            <view class="message-row__copy">
              <text class="message-row__title">{{ item.title }}</text>
              <text v-if="item.content" class="shipper-copy message-row__content">{{ item.content }}</text>
              <text class="shipper-copy">{{ formatTime(item.createdAt) }}</text>
            </view>
            <text v-if="!item.isRead" class="message-unread">未读</text>
            <TmsIcon v-else name="arrow-right" size="25rpx" />
          </TmsAction>
        </template>
        <view v-else class="card shipper-empty">
          <view class="shipper-empty__icon"><TmsIcon name="message" size="44rpx" /></view>
          <text class="section-title">{{ unreadOnly ? '暂无未读消息' : '暂无消息' }}</text>
          <text v-if="!unreadOnly && !auth.staff" class="shipper-copy">订单有新进展时，可在这里查看。</text>
        </view>
      </template>
    </view>
    <TmsBottomNav active="message" />
  </view>
</template>

<style scoped lang="scss">
.message-row { display: flex; width: 100%; gap: 18rpx; align-items: flex-start; background: var(--tms-surface); }
.message-row__icon {
  width: 70rpx; height: 70rpx; color: var(--tms-primary); background: var(--tms-primary-soft);
  flex: none; display: grid; place-items: center; border-radius: 19rpx;
}
.message-row__copy { display: grid; gap: 7rpx; flex: 1; min-width: 0; }
.message-row__title { color: var(--tms-text); font-size: max(28rpx, 14px); font-weight: 700; overflow-wrap: anywhere; }
.message-row__content { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.message-unread {
  color: #92400e; background: var(--tms-orange-soft); padding: 4rpx 12rpx;
  border-radius: 999rpx; font-size: max(22rpx, 12px); white-space: nowrap;
}
.message-content { color: var(--tms-text); white-space: pre-wrap; overflow-wrap: anywhere; }
.message-link { color: var(--tms-primary); font-weight: 650; }
</style>
