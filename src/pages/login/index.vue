<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import MobileLogin from '@mobile-core/components/MobileLogin.vue'
import { parseLoginAccount } from '@mobile-core/account'
import { isWechatPhoneLoginEnabled, wechatPhoneLoginError } from '@mobile-core/wechat-phone-login'
import { useAuthStore } from '@/stores/auth'
import { usePageTheme } from '@/composables/usePageTheme'
import { demoEnabled, hasSupabaseConfig, userMessage } from '@/api/supabase'

const auth = useAuthStore()
const { theme } = usePageTheme()
const brand = {
  name: 'TMS',
  badge: '货主端',
  eyebrow: '亿企工场 · 智慧物流',
  title: '每一票货，都有迹可循',
  description: '发货委托、运输进度与签收回单集中查看。',
  benefits: ['运单进度同步', '签收回单可查']
}

function goHome() {
  uni.reLaunch({ url: '/pages/home/index' })
}

onShow(() => {
  auth.hydrate()
  if (auth.active) goHome()
})

function validateAccount(account: string) {
  return parseLoginAccount(account) ? '' : '请输入有效的手机号或邮箱。'
}

async function authenticate(account: string, password: string) {
  await auth.login(account, password)
}

const authenticatePhone = isWechatPhoneLoginEnabled && hasSupabaseConfig
  ? (code: string) => auth.loginWithWechatPhone(code)
  : undefined

function explainError(error: unknown, channel?: 'phone') {
  return channel === 'phone' ? wechatPhoneLoginError(error) : userMessage(error, '登录失败，请检查账号与密码。')
}

function startDemo() {
  auth.startDemo()
  goHome()
}
</script>

<template>
  <view class="shipper-page">
    <MobileLogin
      :theme-name="'tms-' + theme.preset"
      :brand="brand"
      account-label="登录账号"
      account-placeholder="请输入手机号或邮箱"
      account-hint="使用物流服务商开通的 TMS 账号"
      remember-key="tms-shipper-account"
      help-text="首次使用请联系物流服务商开通账号。"
      forgot-password-text="请联系物流服务商重置密码"
      :authenticate="authenticate"
      :authenticate-phone="authenticatePhone"
      :explain-error="explainError"
      :validate-account="validateAccount"
      :demo="demoEnabled ? startDemo : undefined"
      :notice="hasSupabaseConfig ? undefined : '当前未连接货主服务，请联系管理员。'"
      @success="goHome"
    />
  </view>
</template>
