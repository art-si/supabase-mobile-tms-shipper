<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { ApiError, userMessage } from '@/api/supabase'
import { useAuthStore } from '@/stores/auth'
import { usePageTheme } from '@/composables/usePageTheme'
import { isWorkspaceKey, workspace, workspaceUrl, type WorkspaceKey } from '@/utils/workspace'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import { watchMobilePageQuery } from '@mobile-core/watchMobilePageQuery'
// #ifdef H5
import { Browser } from '@capacitor/browser'
import { isAndroidApp } from '@mobile-core/platform'
// #endif

const { themeName } = usePageTheme()
const auth = useAuthStore()
const key = ref<WorkspaceKey>()
const busy = ref(true)
const failure = ref<{ title: string; message: string; retryable: boolean }>()
const embedded = ref(false)
const embedError = ref('')
const entry = computed(() => key.value ? workspace(key.value) : undefined)
const link = computed(() => entry.value ? workspaceUrl(entry.value.path, undefined, auth.demo) : '')
const canLaunch = computed(() => Boolean(link.value) && !busy.value && !failure.value)

function dismissEmbed() {
  // #ifdef MP-WEIXIN
  clearEmbedTimeout()
  // #endif
  embedded.value = false
}

function readQuery(query?: Record<string, unknown>) {
  const next = isWorkspaceKey(query?.key) ? query.key : undefined
  if (key.value === next) return false
  key.value = next
  dismissEmbed()
  embedError.value = ''
  return true
}

onLoad(readQuery)
watchMobilePageQuery('/pages/workspace/index', (query) => {
  if (readQuery(query)) void checkAccess()
})
onShow(checkAccess)

let accessVersion = 0
async function checkAccess() {
  if (!auth.guard()) return
  const version = ++accessVersion
  const target = key.value
  busy.value = true
  failure.value = undefined
  try {
    if (!target) {
      failure.value = { title: '找不到此业务入口', message: '请返回所属页面重新进入。', retryable: false }
      return
    }
    const allowed = await auth.checkWorkspaceAccess(target)
    if (version === accessVersion && !allowed) {
      dismissEmbed()
      failure.value = { title: '暂无此业务权限', message: '如需使用，请联系管理员开通。', retryable: false }
    }
  } catch (cause) {
    if (version !== accessVersion) return
    dismissEmbed()
    const status = cause instanceof ApiError ? cause.status : undefined
    failure.value = {
      title: status === 401 ? '登录状态已失效' : status === 403 ? '暂无此业务权限' : '无法核对业务权限',
      message: userMessage(cause, '请稍后重试。'),
      retryable: status !== 401 && status !== 403
    }
  } finally {
    if (version === accessVersion) busy.value = false
  }
}

// #ifdef MP-WEIXIN
const embedTimeoutMs = 12_000
let embedTimeout: ReturnType<typeof setTimeout> | undefined

function clearEmbedTimeout() {
  if (embedTimeout === undefined) return
  clearTimeout(embedTimeout)
  embedTimeout = undefined
}

function recoverEmbed(message: string) {
  if (!embedded.value) return
  dismissEmbed()
  embedError.value = message
}

function launchEmbedded() {
  if (embedded.value || !canLaunch.value) return
  embedError.value = ''
  embedded.value = true
  embedTimeout = setTimeout(() => recoverEmbed('打开 Web TMS 超时，请重试。'), embedTimeoutMs)
}

function embedFailed() {
  recoverEmbed('暂时无法打开 Web TMS。请重试，或联系管理员核对业务域名。')
}

onUnload(dismissEmbed)
// #endif

// #ifdef H5
async function launchExternal(event: MouseEvent) {
  if (!canLaunch.value) {
    event.preventDefault()
    return
  }
  if (!isAndroidApp()) return
  event.preventDefault()
  if (!link.value) return
  embedError.value = ''
  try {
    await Browser.open({ url: link.value })
  } catch {
    embedError.value = '暂时无法打开 Web TMS，请检查设备浏览器后重试。'
  }
}
// #endif
</script>

<template>
  <!-- #ifdef MP-WEIXIN -->
  <web-view v-if="embedded && link" :src="link" @load="clearEmbedTimeout" @error="embedFailed" />
  <!-- #endif -->
  <MobileWorkspace v-if="!embedded" :container-class="['page shipper-page', themeName]">
    <MobileTopBar capsule="always" :title="entry?.title || '业务工作台'" :eyebrow="auth.demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <TmsPageSkeleton v-if="busy" label="正在核对业务权限…" />
      <MobileEmptyState
        v-else-if="failure" class="shipper-card" :icon="failure.retryable ? 'refresh' : 'lock'" :title="failure.title"
        :description="failure.message" announce="alert"
      >
        <MobileAction v-if="failure.retryable" class="tms-secondary-action" @click="checkAccess">重试</MobileAction>
      </MobileEmptyState>
      <template v-else-if="entry">
        <view class="card shipper-card shipper-stack workspace-card">
          <view class="mobile-row mobile-row--static workspace-entry">
            <view class="mobile-row__icon workspace-entry__icon"><MobileIcon :name="entry.icon" size="22px" /></view>
            <view class="mobile-row__body">
              <text class="section-title" role="heading" aria-level="2">Web TMS 工作台</text>
              <text v-if="link" class="shipper-copy">使用已开通相应权限的 Web TMS 账号办理。</text>
              <text v-else class="shipper-copy" role="status">暂未配置 Web TMS 地址，请联系管理员。</text>
            </view>
          </view>
          <text v-if="embedError" class="shipper-error" role="alert">{{ embedError }}</text>
          <!-- #ifdef H5 -->
          <a v-if="link" :href="link" target="_blank" rel="noopener noreferrer" class="workspace-link mobile-action tms-primary-action" @click="launchExternal">
            <MobileInlineLabel label="打开 Web TMS" icon="arrow-right" icon-position="end" />
          </a>
          <!-- #endif -->
          <!-- #ifdef MP-WEIXIN -->
          <MobileAction v-if="link" class="tms-primary-action" @click="launchEmbedded">
            <MobileInlineLabel :label="embedError ? '重试打开 Web TMS' : '打开 Web TMS'" icon="arrow-right" icon-position="end" />
          </MobileAction>
          <!-- #endif -->
        </view>
        <view v-if="entry.instruction" class="workspace-instructions">
          <text class="section-title" role="heading" aria-level="2">操作指引</text>
          <text class="shipper-copy">{{ entry.instruction }}</text>
        </view>
      </template>
    </view>
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.workspace-card { gap: 14px; }
.workspace-entry { padding: 0; }
.workspace-entry__icon { width: 44px; height: 44px; flex-basis: 44px; }
.workspace-link { text-decoration: none; }
.workspace-link:focus-visible { outline: 2px solid var(--mobile-workspace-focus); outline-offset: 2px; }
.workspace-link:active { opacity: .82; }
.workspace-instructions { display: grid; gap: 5px; padding-inline: 2px; }

@media (hover: hover) {
  .workspace-link:hover { filter: brightness(.93); }
}
</style>
