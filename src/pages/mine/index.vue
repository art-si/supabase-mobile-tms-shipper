<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { MASTER_DATA, SETTLEMENT, openWorkspace, workspace, type WorkspaceKey } from '@/utils/workspace'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'

const { themeName } = usePageTheme()
const { auth, demo, profile } = useShipper()
const { data, error, load } = usePageResource(async () => {
  if (!auth.staff) return profile()
  await auth.loadStaffAccess()
  return { displayName: 'TMS 业务账号', customerName: '', tenantName: '' }
}, '账号资料加载失败，请重新加载。')
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

function logout() {
  uni.showModal({
    title: demo.value ? '退出演示' : '退出登录',
    content: '确认返回登录页面？',
    confirmText: '退出',
    success: ({ confirm }) => { if (confirm) auth.logout() }
  })
}
</script>

<template>
  <MobileWorkspace class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" title="我的" :eyebrow="demo ? '演示模式' : undefined" />
    <view class="shipper-content shipper-content--tabbed" role="main">
      <view v-if="data" class="mobile-group">
        <view class="mobile-row mobile-row--static profile-identity">
          <view class="mobile-row__icon profile-avatar"><TmsIcon name="user" size="22px" /></view>
          <view class="mobile-row__body">
            <text class="profile-name">{{ data.displayName }}</text>
            <text v-if="auth.session?.user?.email || data.customerName" class="mobile-row__detail">
              {{ auth.session?.user?.email || data.customerName }}
            </text>
          </view>
        </view>
        <view v-if="data.customerName" class="mobile-row mobile-row--static profile-fact">
          <text class="mobile-row__detail">所属客户</text>
          <text>{{ data.customerName }}</text>
        </view>
        <view v-if="data.tenantName" class="mobile-row mobile-row--static profile-fact">
          <text class="mobile-row__detail">物流服务商</text>
          <text>{{ data.tenantName }}</text>
        </view>
      </view>
      <TmsPageSkeleton v-else label="正在加载账号资料…" :error="error" @retry="refresh" />
      <view v-for="group in groups" :key="group.title">
        <text class="mobile-group-title" role="heading" aria-level="2">{{ group.title }}</text>
        <view class="mobile-group">
          <MobileAction
            v-for="key in group.keys" :key="key" class="mobile-row profile-feature" @click="openFeature(key)"
          >
            <view class="mobile-row__icon"><TmsIcon :name="workspace(key).icon" size="17px" /></view>
            <text class="mobile-row__body mobile-row__label">{{ workspace(key).title }}</text>
            <TmsIcon class="mobile-row__chevron" name="chevron" size="14px" />
          </MobileAction>
        </view>
      </view>
      <view class="mobile-group">
        <MobileAction class="mobile-row profile-settings" @click="settings">
          <view class="mobile-row__icon"><TmsIcon name="settings" size="17px" /></view>
          <text class="mobile-row__body mobile-row__label">界面设置</text>
          <TmsIcon class="mobile-row__chevron" name="chevron" size="14px" />
        </MobileAction>
        <MobileAction class="mobile-row profile-signout" @click="logout">
          {{ demo ? '退出演示' : '退出登录' }}
        </MobileAction>
      </view>
    </view>
    <TmsBottomNav active="mine" />
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.profile-identity { padding-block: 16px; }
.profile-avatar {
  width: 48px;
  height: 48px;
  flex-basis: 48px;
  border-radius: 15px;
}
.profile-name {
  color: var(--mobile-workspace-ink);
  font-size: 20px;
  font-weight: 720;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.profile-fact {
  display: grid;
  grid-template-columns: minmax(80px, .45fr) minmax(0, 1fr);
  font-size: 14px;
  overflow-wrap: anywhere;
}
.profile-fact > text:last-child { text-align: end; }
.mobile-row.profile-signout {
  justify-content: center;
  color: var(--tms-red-strong);
  font-size: 15px;
  font-weight: 650;
}
</style>
