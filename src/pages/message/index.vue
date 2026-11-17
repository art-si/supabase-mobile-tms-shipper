<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { fetchStaffMessages, readStaffMessage, type StaffMessage } from '@/api/staff'
import { userMessage } from '@/api/supabase'
import type { OrderUpdate } from '@/api/types'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { usePageTheme } from '@/composables/usePageTheme'
import { formatTime, openOrder, statusAppearance } from '@/utils/orders'
import { workspaceUrl } from '@/utils/workspace'
import TmsAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileLoadingStatus from '@mobile-core/components/MobileLoadingStatus.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { createLatestRequest } from '@mobile-core/latest-request'
// #ifdef H5
import { elementOf, type ElementTarget } from '@mobile-core/form-focus'
// #endif

type Message = { id: string; title: string; content: string; createdAt: string; isRead: boolean } &
  ({ order: OrderUpdate } | { staff: StaffMessage })

const { themeName } = usePageTheme()
const { auth, demo, messages, readMessage, shipmentOwner, shipmentRevision } = useShipper()
const unreadOnly = ref(false)
const selected = ref<Message>()
const marking = ref(new Set<string>())
const acknowledged = new Set<string>()
const markRequests = createLatestRequest()
const actionError = ref('')
const detailReadError = ref('')
// #ifdef H5
const backToList = ref<ElementTarget>()
// #endif
let shownRevision = -1

const { data, busy, error, load, reset } = usePageResource<Message[]>(async () => {
  const rows = auth.staff
    ? (await auth.authenticated(fetchStaffMessages)).map((row) => ({
      id: row.id, title: row.title, content: row.content || '', isRead: row.isRead,
      createdAt: row.createdAt, staff: row
    }))
    : (await messages()).map((row) => ({
      id: row.id, title: `运输动态 · ${statusAppearance(row.status, false).label}`,
      content: row.orderNo, isRead: row.isRead, createdAt: row.createdAt, order: row
    }))
  // A refresh started before a read acknowledgement can still return the older unread snapshot.
  return rows.map((row) => !row.isRead && acknowledged.has(messageKey(row)) ? { ...row, isRead: true } : row)
}, '消息加载失败，请重新加载。')
onScopeDispose(markRequests.invalidate)
watch(shipmentOwner, () => {
  markRequests.invalidate()
  acknowledged.clear()
  marking.value.clear()
  selected.value = undefined
  actionError.value = ''
  detailReadError.value = ''
  shownRevision = -1
  reset()
}, { flush: 'sync' })

function messageKey(item: Message) {
  return 'staff' in item ? `${item.staff.category}:${item.id}` : `${item.id}:${item.createdAt}`
}

function isTodo(item: Message) {
  return 'staff' in item && item.staff.category === 'todo'
}

function isUnread(item: Message) {
  return !isTodo(item) && !item.isRead
}

const visible = computed(() => unreadOnly.value ? (data.value || []).filter(isUnread) : (data.value || []))
const unread = computed(() => (data.value || []).filter(isUnread).length)
const markingSelected = computed(() => selected.value && marking.value.has(messageKey(selected.value)))
const staffLink = computed(() => selected.value && 'staff' in selected.value && selected.value.staff.routePath
  ? workspaceUrl(selected.value.staff.routePath, selected.value.staff.routeQuery) : '')

function refresh() {
  if (!auth.guard()) return Promise.resolve()
  shownRevision = shipmentRevision.value
  return load()
}
onShow(() => {
  if (shownRevision !== shipmentRevision.value) void refresh()
  else auth.guard()
})
onPullDownRefresh(async () => { await refresh(); uni.stopPullDownRefresh() })

function choose(item: Message) {
  if (marking.value.has(messageKey(item))) return
  actionError.value = ''
  detailReadError.value = ''
  if ('order' in item) openOrder(item.id)
  else selected.value = item
  void markRead(item)
}

async function markRead(item: Message) {
  const key = messageKey(item)
  if (!isUnread(item) || marking.value.has(key)) return
  const isCurrent = markRequests.snapshot()
  detailReadError.value = ''
  marking.value.add(key)
  try {
    if ('order' in item) await readMessage(item.id, item.createdAt)
    else await auth.authenticated((token) => readStaffMessage(token, item.staff))
    if (!isCurrent()) return
    acknowledged.add(key)
    data.value = data.value?.map((row) => messageKey(row) === key ? { ...row, isRead: true } : row) || null
    if (selected.value && messageKey(selected.value) === key) selected.value = { ...selected.value, isRead: true }
  } catch (cause) {
    if (!isCurrent()) return
    if ('order' in item) actionError.value = userMessage(cause, '暂时无法更新已读状态，消息内容仍可查看。')
    else if (selected.value && messageKey(selected.value) === key) {
      detailReadError.value = userMessage(cause, '消息内容仍可查看。')
    }
  } finally {
    if (isCurrent()) marking.value.delete(key)
  }
}

async function retrySelectedRead() {
  const item = selected.value
  if (!item) return
  await markRead(item)
  // #ifdef H5
  if (selected.value?.isRead && messageKey(selected.value) === messageKey(item)) {
    await nextTick()
    elementOf(backToList.value)?.focus({ preventScroll: true })
  }
  // #endif
}
</script>

<template>
  <MobileWorkspace :container-class="['page shipper-page', themeName]">
    <MobileTopBar capsule="always" title="消息" :eyebrow="demo ? '演示模式' : undefined" />
    <view class="shipper-content shipper-content--tabbed" role="main">
      <text v-if="actionError" class="shipper-error" role="alert">{{ actionError }}</text>
      <template v-if="selected">
        <view class="card shipper-card shipper-stack">
          <view class="shipper-heading message-detail-heading">
            <text class="section-title message-detail-title" role="heading" aria-level="2">{{ selected.title }}</text>
            <TmsAction ref="backToList" class="shipper-inline" @click="selected = undefined">返回列表</TmsAction>
          </view>
          <text class="message-time">{{ formatTime(selected.createdAt, true) }}</text>
          <text class="message-content">{{ selected.content || '暂无消息详情。' }}</text>
          <!-- #ifdef H5 -->
          <a v-if="staffLink" :href="staffLink" target="_blank" rel="noopener noreferrer" class="message-link">查看关联业务</a>
          <!-- #endif -->
        </view>
        <MobileLoadingStatus v-if="markingSelected" block label="正在标记已读…" />
        <MobileLoadError v-else-if="detailReadError" title="暂时无法更新已读状态"
          :message="detailReadError" retry-text="重试标记已读" @retry="retrySelectedRead" />
      </template>
      <template v-else>
        <view class="shipper-heading message-heading">
          <text class="mobile-group-title" role="heading" aria-level="2">{{ auth.staff ? '通知与待办' : '运输动态' }}</text>
          <TmsAction class="shipper-inline message-filter" :aria-pressed="unreadOnly" @click="unreadOnly = !unreadOnly">
            仅未读（{{ unread }}）
          </TmsAction>
        </view>
        <TmsPageSkeleton v-if="busy || error" compact label="正在加载消息…" :error="error" @retry="refresh" />
        <view v-else-if="visible.length" class="mobile-group">
          <TmsAction
            v-for="item in visible" :key="messageKey(item)" class="mobile-row message-row"
            :disabled="marking.has(messageKey(item))" :aria-busy="marking.has(messageKey(item)) || undefined" @click="choose(item)"
          >
            <view class="mobile-row__icon"><MobileIcon name="message" size="18px" /></view>
            <view class="mobile-row__body">
              <text class="mobile-row__label">{{ item.title }}</text>
              <text v-if="item.content" class="mobile-row__detail message-row__content">{{ item.content }}</text>
            </view>
            <view class="message-row__meta">
              <text class="message-time">{{ formatTime(item.createdAt) }}</text>
              <text v-if="isTodo(item)" class="message-state message-state--todo">待处理</text>
              <text v-else-if="isUnread(item)" class="message-state">未读</text>
              <MobileIcon v-else class="mobile-row__chevron" name="chevron" size="14px" />
            </view>
          </TmsAction>
        </view>
        <MobileEmptyState
          v-else class="shipper-card" icon="message" :title="unreadOnly ? '暂无未读消息' : '暂无消息'"
          :description="!unreadOnly && !auth.staff ? '订单有新进展时，可在这里查看。' : undefined"
        />
      </template>
    </view>
    <TmsBottomNav active="message" />
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.message-heading { margin-bottom: -7px; }
.message-heading .mobile-group-title { margin-block: 0; }
.message-detail-title { min-width: 0; overflow-wrap: anywhere; }
.message-detail-heading .shipper-inline { flex: none; }
.message-filter[aria-pressed="true"] { background: var(--tms-primary-soft); }
.message-row { min-height: 68px; }
.message-row__content { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.message-row__meta { flex: none; display: grid; justify-items: end; gap: 5px; }
.message-time { color: var(--mobile-workspace-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.message-state {
  color: var(--tms-primary-strong); background: var(--tms-primary-soft); padding: 2px 7px;
  border-radius: 999px; font-size: 12px; font-weight: 650; white-space: nowrap;
}
.message-state--todo { color: var(--mobile-workspace-ink); background: var(--tms-orange-soft); }
.message-content { color: var(--tms-text); white-space: pre-wrap; overflow-wrap: anywhere; }
.message-link { min-height: 44px; color: var(--tms-primary); font-weight: 650; display: flex; align-items: center; }
</style>
