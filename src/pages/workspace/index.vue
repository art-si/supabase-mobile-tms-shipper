<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { userMessage } from '@/api/supabase'
import { useAuthStore } from '@/stores/auth'
import { usePageTheme } from '@/composables/usePageTheme'
import { isWorkspaceKey, workspace, workspaceUrl, type WorkspaceKey } from '@/utils/workspace'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'

const { themeName } = usePageTheme()
const auth = useAuthStore()
const key = ref<WorkspaceKey>()
const busy = ref(true)
const error = ref('')
const embedded = ref(false)
const embedError = ref('')
const entry = computed(() => key.value ? workspace(key.value) : undefined)
const link = computed(() => entry.value ? workspaceUrl(entry.value.path, undefined, auth.demo) : '')

onLoad((query) => { if (isWorkspaceKey(query?.key)) key.value = query.key })
onShow(checkAccess)

async function checkAccess() {
  if (!auth.guard()) return
  busy.value = true
  error.value = ''
  try {
    await auth.loadStaffAccess()
    if (!key.value || !auth.permits(key.value)) error.value = '此功能需要相应的 TMS 业务权限。'
  } catch (cause) {
    error.value = userMessage(cause, '权限加载失败，请稍后重试。')
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
</script>

<template>
  <!-- #ifdef MP-WEIXIN -->
  <web-view v-if="embedded && link" :src="link" @error="embedFailed" />
  <!-- #endif -->
  <view v-if="!embedded" class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" :title="entry?.title || '业务工作台'" :eyebrow="auth.demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <TmsPageSkeleton v-if="busy" label="正在核对业务权限…" />
      <view v-else-if="error" class="card shipper-empty">
        <view class="shipper-empty__icon"><TmsIcon name="lock" size="44rpx" /></view>
        <text class="shipper-copy" role="alert">{{ error }}</text>
        <wd-button custom-class="tms-secondary-action" @click="checkAccess">重试</wd-button>
      </view>
      <view v-else-if="entry" class="card shipper-empty">
        <view class="shipper-empty__icon"><TmsIcon :name="entry.icon" size="46rpx" /></view>
        <text class="section-title">{{ entry.title }}</text>
        <text v-if="entry.instruction" class="shipper-copy">{{ entry.instruction }}</text>
        <text v-if="!link" class="shipper-copy">配置 Web TMS 地址后，可打开对应的业务工作台。</text>
        <text v-else class="shipper-copy">使用已开通相应权限的 Web TMS 账号办理。</text>
        <text v-if="embedError" class="shipper-error" role="alert">{{ embedError }}</text>
        <!-- #ifdef H5 -->
        <a v-if="link" :href="link" target="_blank" rel="noopener noreferrer" class="workspace-link tms-primary-action">
          打开 Web TMS <TmsIcon name="arrow-right" size="26rpx" />
        </a>
        <!-- #endif -->
        <!-- #ifdef MP-WEIXIN -->
        <wd-button v-if="link" type="primary" custom-class="tms-primary-action" @click="launchEmbedded">
          打开 Web TMS
        </wd-button>
        <!-- #endif -->
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.workspace-link { display: inline-flex; gap: 12rpx; align-items: center; text-decoration: none; }
</style>
