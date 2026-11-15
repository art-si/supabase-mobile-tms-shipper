<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ApiError, userMessage } from '@/api/supabase'
import { useAuthStore } from '@/stores/auth'
import { usePageTheme } from '@/composables/usePageTheme'
import { isWorkspaceKey, workspace, workspaceUrl, type WorkspaceKey } from '@/utils/workspace'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
// #ifdef H5
import { Browser } from '@capacitor/browser'
import { isAndroidApp } from '@mobile-core/platform'
// #endif

const { themeName } = usePageTheme()
const auth = useAuthStore()
const key = ref<WorkspaceKey>()
const busy = ref(true)
const failure = ref<{ message: string; retryable: boolean }>()
const embedded = ref(false)
const embedError = ref('')
const entry = computed(() => key.value ? workspace(key.value) : undefined)
const link = computed(() => entry.value ? workspaceUrl(entry.value.path, undefined, auth.demo) : '')

onLoad((query) => { if (isWorkspaceKey(query?.key)) key.value = query.key })
onShow(checkAccess)

async function checkAccess() {
  if (!auth.guard()) return
  busy.value = true
  failure.value = undefined
  try {
    if (!key.value) {
      failure.value = { message: '找不到此业务入口，请从所属页面重新进入。', retryable: false }
      return
    }
    await auth.loadStaffAccess()
    if (!auth.permits(key.value)) failure.value = { message: '此功能需要相应的 TMS 业务权限。', retryable: false }
  } catch (cause) {
    const denied = cause instanceof ApiError && [401, 403].includes(cause.status)
    failure.value = { message: userMessage(cause, '权限加载失败，请稍后重试。'), retryable: !denied }
  } finally {
    busy.value = false
  }
}

function launchEmbedded() {
  embedError.value = ''
  embedded.value = true
}

function embedFailed() {
  embedded.value = false
  embedError.value = '页面打开失败，请核对小程序业务域名。'
}

// #ifdef H5
async function launchExternal(event: MouseEvent) {
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
  <web-view v-if="embedded && link" :src="link" @error="embedFailed" />
  <!-- #endif -->
  <MobileWorkspace v-if="!embedded" class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" :title="entry?.title || '业务工作台'" :eyebrow="auth.demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <TmsPageSkeleton v-if="busy" label="正在核对业务权限…" />
      <view v-else-if="failure" class="card shipper-card shipper-empty">
        <view class="shipper-empty__icon" aria-hidden="true"><TmsIcon name="lock" size="42rpx" /></view>
        <text class="section-title" role="heading" aria-level="2">暂时无法打开工作台</text>
        <text class="shipper-copy" role="alert">{{ failure.message }}</text>
        <MobileAction v-if="failure.retryable" class="tms-secondary-action" @click="checkAccess">重试</MobileAction>
      </view>
      <template v-else-if="entry">
        <view class="card shipper-card shipper-stack workspace-card">
          <view class="workspace-entry">
            <view class="shipper-empty__icon" aria-hidden="true"><TmsIcon :name="entry.icon" size="42rpx" /></view>
            <view class="workspace-entry__copy">
              <text class="section-title" role="heading" aria-level="2">Web TMS 工作台</text>
              <text v-if="link" class="shipper-copy">使用已开通相应权限的 Web TMS 账号办理。</text>
              <text v-else class="shipper-copy">配置 Web TMS 地址后，可从此处打开工作台。</text>
            </view>
          </view>
          <text v-if="embedError" class="shipper-error" role="alert">{{ embedError }}</text>
          <!-- #ifdef H5 -->
          <a v-if="link" :href="link" target="_blank" rel="noopener noreferrer" class="workspace-link tms-primary-action" @click="launchExternal">
            打开 Web TMS <TmsIcon name="arrow-right" size="26rpx" aria-hidden="true" />
          </a>
          <!-- #endif -->
          <!-- #ifdef MP-WEIXIN -->
          <MobileAction v-if="link" class="tms-primary-action" @click="launchEmbedded">
            打开 Web TMS
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
.workspace-entry {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}
.workspace-entry .shipper-empty__icon { flex: none; }
.workspace-entry__copy { display: grid; min-width: 0; gap: 4px; }
.workspace-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: var(--mobile-workspace-action-height);
  border-radius: var(--tms-control-radius);
  color: #fff;
  background: var(--mobile-workspace-accent);
  font-weight: 650;
  text-decoration: none;
  touch-action: manipulation;
}
.workspace-link:focus-visible { outline: 2px solid var(--mobile-workspace-focus); outline-offset: 2px; }
.workspace-link:active { opacity: .82; }
.workspace-instructions { display: grid; gap: 5px; padding-inline: 2px; }

@media (hover: hover) {
  .workspace-link:hover { filter: brightness(.93); }
}
</style>
