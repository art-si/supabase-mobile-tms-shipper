<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { MASTER_DATA, SETTLEMENT, openWorkspace, workspace, type WorkspaceKey } from '@/utils/workspace'
import TmsAction from '@/components/business/TmsAction.vue'
import TmsBottomNav from '@/components/business/TmsBottomNav.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import TmsTopBar from '@/components/business/TmsTopBar.vue'

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
  <view class="page shipper-page" :class="themeName">
    <TmsTopBar title="我的" :eyebrow="demo ? '演示模式' : undefined" />
    <view class="shipper-content shipper-content--tabbed" role="main">
      <view v-if="data" class="card shipper-card shipper-stack">
        <view class="profile-identity">
          <view class="profile-icon"><TmsIcon name="user" size="50rpx" /></view>
          <view class="profile-name">
            <text class="section-title">{{ data.displayName }}</text>
            <text class="shipper-copy">{{ auth.session?.user?.email || data.customerName }}</text>
          </view>
        </view>
        <view v-if="data.customerName" class="profile-row">
          <text class="shipper-copy">所属客户</text><text>{{ data.customerName }}</text>
        </view>
        <view v-if="data.tenantName" class="profile-row">
          <text class="shipper-copy">物流服务商</text><text>{{ data.tenantName }}</text>
        </view>
      </view>
      <TmsPageSkeleton v-else label="正在加载账号资料…" :error="error" @retry="refresh" />
      <view v-for="group in groups" :key="group.title" class="card shipper-card shipper-stack profile-group">
        <text class="section-title" role="heading" aria-level="2">{{ group.title }}</text>
        <view class="profile-grid">
          <TmsAction
            v-for="key in group.keys" :key="key" class="profile-feature" @click="openFeature(key)"
          >
            <view class="profile-feature__icon"><TmsIcon :name="workspace(key).icon" size="36rpx" /></view>
            <text>{{ workspace(key).title }}</text>
          </TmsAction>
        </view>
      </view>
      <TmsAction class="card shipper-card profile-settings" @click="settings">
        <TmsIcon name="settings" size="38rpx" />
        <text>界面设置</text>
        <TmsIcon name="arrow-right" size="26rpx" />
      </TmsAction>
      <wd-button block custom-class="tms-secondary-action" @click="logout">{{ demo ? '退出演示' : '退出登录' }}</wd-button>
    </view>
    <TmsBottomNav active="mine" />
  </view>
</template>

<style scoped lang="scss">
.profile-identity { display: flex; gap: 18rpx; align-items: center; }
.profile-name { display: grid; min-width: 0; gap: 6rpx; overflow-wrap: anywhere; }
.profile-icon {
  display: grid;
  place-items: center;
  flex: 0 0 96rpx;
  height: 96rpx;
  border-radius: 28rpx;
  color: var(--tms-primary);
  background: var(--tms-primary-soft);
}
.profile-row {
  display: grid;
  grid-template-columns: 132rpx 1fr;
  min-width: 0;
  gap: 12rpx;
  padding-top: 18rpx;
  border-top: 1px solid var(--tms-line-subtle);
  font-size: max(26rpx, 13px);
  overflow-wrap: anywhere;
}
.profile-settings {
  display: flex;
  align-items: center;
  gap: 16rpx;
  width: 100%;
  min-height: var(--tms-control-height);
  background: var(--tms-surface);
  color: var(--tms-primary);
}
.profile-settings text { flex: 1; color: var(--tms-text); font-weight: 650; }
.profile-group { gap: 20rpx; }
.profile-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; }
.profile-feature {
  display: grid; justify-items: center; align-content: start; width: 100%; min-width: 0; min-height: 126rpx;
  padding: 13rpx 6rpx; gap: 10rpx; text-align: center; border-radius: 19rpx; background: var(--tms-surface-soft);
  color: var(--tms-text); font-size: max(24rpx, 12px); line-height: 1.4; font-weight: 650; overflow-wrap: anywhere;
}
.profile-feature__icon {
  width: 59rpx; height: 59rpx; display: grid; place-items: center;
  border-radius: 17rpx; color: var(--tms-primary); background: var(--tms-primary-soft);
}
</style>
