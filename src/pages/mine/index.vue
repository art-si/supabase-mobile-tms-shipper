<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { MASTER_DATA, SETTLEMENT, openWorkspace, workspace, type WorkspaceKey } from '@/utils/workspace'
import MobileAccountIdentity from '@mobile-core/components/MobileAccountIdentity.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileSectionHeading from '@mobile-core/components/MobileSectionHeading.vue'
import MobileSignOutDialog from '@mobile-core/components/MobileSignOutDialog.vue'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWechatPhoneBinding from '@mobile-core/components/MobileWechatPhoneBinding.vue'
import { isWechatPhoneLoginEnabled } from '@mobile-core/wechat-phone-login'
import { hasSupabaseConfig } from '@/api/supabase'

const { themeName } = usePageTheme()
const { auth, demo, profile } = useShipper()
const logoutOpen = ref(false)
const logoutLabel = computed(() => demo.value ? '退出演示' : '退出登录')
const canBindWechatPhone = computed(() => isWechatPhoneLoginEnabled && hasSupabaseConfig && !demo.value &&
  Boolean(auth.session?.access_token && auth.session.user?.id))
const bindWechatPhone = (code: string) => auth.bindWechatPhone(code)
const { data, error, load } = usePageResource(async () => {
  if (!auth.staff) return profile()
  await auth.loadStaffAccess()
  return { displayName: 'TMS 业务账号', customerName: '', tenantName: '' }
}, '账号资料加载失败，请重新加载。')
const accountDetail = computed(() => {
  const email = auth.session?.user?.email
  return email === data.value?.displayName ? undefined : email
})
const groups = computed(() => [
  { title: '基础数据', keys: auth.staff || demo.value ? MASTER_DATA.filter((key) => auth.permits(key)) : ['cargo', 'address'] as WorkspaceKey[] },
  { title: '业务结算', keys: auth.staff || demo.value ? SETTLEMENT.filter((key) => auth.permits(key)) : ['customerSettlement'] as WorkspaceKey[] }
].filter((item) => item.keys.length))
function refresh() { if (auth.guard()) void load() }
onShow(refresh)

function settings() { uni.navigateTo({ url: '/pages/settings/index' }) }

function openFeature(key: WorkspaceKey) {
  if (!auth.staff && (key === 'cargo' || key === 'address')) {
    uni.navigateTo({ url: `/pages/mine/saved?kind=${key}` })
  } else if (!auth.staff && key === 'customerSettlement') {
    uni.navigateTo({ url: '/pages/mine/statements' })
  } else if (key === 'driverSettlement') {
    uni.navigateTo({ url: '/pages/mine/driver-settlement' })
  } else {
    openWorkspace(key)
  }
}

</script>

<template>
  <MobileWorkspace :container-class="['page shipper-page', themeName]">
    <MobileTopBar capsule="always" title="我的" :eyebrow="demo ? '演示模式' : undefined" />
    <view class="shipper-content shipper-content--tabbed" role="main">
      <MobileAccountIdentity v-if="data" :name="data.displayName" :detail="accountDetail">
        <template #details>
          <view v-if="data.customerName" class="mobile-row mobile-row--static">
            <view class="mobile-row__body">
              <text class="mobile-row__detail">所属客户</text>
              <text class="mobile-row__label" translate="no">{{ data.customerName }}</text>
            </view>
          </view>
          <view v-if="data.tenantName" class="mobile-row mobile-row--static">
            <view class="mobile-row__body">
              <text class="mobile-row__detail">物流服务商</text>
              <text class="mobile-row__label" translate="no">{{ data.tenantName }}</text>
            </view>
          </view>
        </template>
      </MobileAccountIdentity>
      <TmsPageSkeleton v-else label="正在加载账号资料…" :error="error" @retry="refresh" />
      <view v-for="group in groups" :key="group.title" class="mobile-group-section">
        <MobileSectionHeading :title="group.title" />
        <view class="mobile-group">
          <MobileAction v-for="key in group.keys" :key="key" class="mobile-row" @click="openFeature(key)">
            <view class="mobile-row__icon"><MobileIcon :name="workspace(key).icon" size="17px" /></view>
            <text class="mobile-row__body mobile-row__label">{{ workspace(key).title }}</text>
            <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" />
          </MobileAction>
        </view>
      </view>
      <view class="mobile-group-section">
        <MobileSectionHeading title="设置与账号" />
        <view class="mobile-group">
          <MobileAction class="mobile-row" @click="settings">
            <view class="mobile-row__icon"><MobileIcon name="settings" size="17px" /></view>
            <text class="mobile-row__body mobile-row__label">界面设置</text>
            <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" />
          </MobileAction>
          <MobileWechatPhoneBinding v-if="canBindWechatPhone" :key="auth.session?.user?.id" :bind-phone="bindWechatPhone" />
        </view>
        <view class="mobile-group mine-sign-out">
          <MobileAction class="mobile-row mobile-row--danger" @click="logoutOpen = true">
            <text class="mobile-row__label">{{ logoutLabel }}</text>
          </MobileAction>
        </view>
      </view>
    </view>
    <TmsBottomNav active="mine" />
    <MobileSignOutDialog v-model="logoutOpen" :sign-out="auth.logout" :demo="demo" />
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.mine-sign-out { margin-top: 4px; }
</style>
