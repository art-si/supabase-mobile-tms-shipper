<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { demoEnabled, hasSupabaseConfig, userMessage } from '@/api/supabase'
import { useAuthStore } from '@/stores/auth'
import { usePageTheme } from '@/composables/usePageTheme'
import TmsField from '@/components/business/TmsField.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'

const { themeName } = usePageTheme()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const emailError = ref('')
const passwordError = ref('')
const focused = ref('')

function goHome() { uni.reLaunch({ url: '/pages/home/index' }) }

onShow(() => {
  auth.hydrate()
  if (auth.active) goHome()
})

async function submit() {
  if (busy.value) return
  error.value = ''
  emailError.value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : '请输入有效的邮箱地址。'
  passwordError.value = password.value ? '' : '请输入密码。'
  if (emailError.value || passwordError.value) {
    focused.value = ''
    await nextTick()
    focused.value = emailError.value ? 'email' : 'password'
    return
  }
  busy.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    password.value = ''
    goHome()
  } catch (cause) {
    error.value = userMessage(cause, '登录失败，请稍后重试。')
  } finally {
    busy.value = false
  }
}

function enterDemo() {
  auth.startDemo()
  goHome()
}
</script>

<template>
  <view class="page shipper-page login-page" :class="themeName">
    <view class="shipper-hero login-hero">
      <view class="login-brand">
        <view class="login-brand__mark"><TmsIcon name="box" size="50rpx" /></view>
        <text>亿企工场 · TMS</text>
      </view>
      <text class="shipper-hero__title" role="heading" aria-level="1">货主端</text>
      <text class="shipper-hero__meta">发货委托、运输进度与签收回单</text>
    </view>

    <view class="shipper-content login-content" role="main">
      <view class="card shipper-card shipper-stack login-card">
        <text class="section-title" role="heading" aria-level="2">登录 TMS 账号</text>
        <TmsField
          v-model="email" field="email" label="登录邮箱" inputmode="email" autocomplete="username"
          placeholder="例如 name@company.cn…" :maxlength="254" :error="emailError" :focus="focused === 'email'"
          :disabled="busy" required
        />
        <TmsField
          v-model="password" field="password" label="密码" autocomplete="current-password"
          placeholder="输入登录密码…" :maxlength="256" :error="passwordError" :focus="focused === 'password'"
          :disabled="busy" password required @confirm="submit"
        />
        <text v-if="error" class="shipper-error" role="alert">{{ error }}</text>
        <text v-else-if="!hasSupabaseConfig" class="shipper-copy">正式登录需配置服务地址和公开密钥。</text>
        <wd-button block type="primary" custom-class="tms-primary-action" :loading="busy" :disabled="busy" @click="submit">
          登录
        </wd-button>
        <view v-if="demoEnabled" class="login-demo">
          <button class="shipper-button shipper-inline" :disabled="busy" @click="enterDemo">
            进入演示 <TmsIcon name="arrow-right" size="26rpx" />
          </button>
        </view>
      </view>
      <text class="shipper-copy login-help">首次使用请联系物流服务商开通账号。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-hero { padding-bottom: 114rpx; }
.login-hero .shipper-hero__title { font-size: max(66rpx, 36px); margin-top: 32rpx; }
.login-brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: max(25rpx, 13px);
  font-weight: 700;
  letter-spacing: .04em;
}
.login-brand__mark {
  display: grid;
  place-items: center;
  width: 80rpx;
  height: 80rpx;
  border: 1px solid rgba(255,255,255,.22);
  border-radius: 23rpx;
  background: rgba(255,255,255,.15);
}
.login-content { margin-top: -74rpx; position: relative; }
.login-card { gap: 27rpx; }
.login-demo { border-top: 1px solid var(--tms-line-subtle); display: flex; justify-content: center; }
.login-help { text-align: center; }
</style>
