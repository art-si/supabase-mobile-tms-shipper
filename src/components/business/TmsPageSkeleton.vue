<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    compact?: boolean
    error?: string
  }>(),
  {
    label: '正在加载页面信息…',
    compact: false
  }
)

defineEmits<{
  retry: []
}>()
</script>

<template>
    <view
      class="page-skeleton"
      :class="{ 'page-skeleton--compact': compact }"
      :role="error ? 'alert' : 'status'"
      :aria-live="error ? 'assertive' : 'polite'"
    >
    <view v-if="error" class="page-skeleton__error">
      <view class="page-skeleton__error-icon">!</view>
      <text class="page-skeleton__error-title">页面加载失败</text>
      <text class="page-skeleton__error-message">{{ error }}</text>
      <button class="page-skeleton__retry" @click="$emit('retry')">重新加载</button>
    </view>
    <template v-else>
    <view class="page-skeleton__status">
      <view class="page-skeleton__spinner" />
      <text>{{ label }}</text>
    </view>
    <view class="page-skeleton__card">
      <view class="page-skeleton__row">
        <view class="page-skeleton__circle" />
        <view class="page-skeleton__lines">
          <view class="page-skeleton__line page-skeleton__line--medium" />
          <view class="page-skeleton__line page-skeleton__line--short" />
        </view>
      </view>
      <view class="page-skeleton__tiles">
        <view /><view />
      </view>
    </view>
    <view class="page-skeleton__card page-skeleton__card--form">
      <view class="page-skeleton__line page-skeleton__line--short" />
      <view class="page-skeleton__input" />
      <view class="page-skeleton__line page-skeleton__line--medium" />
      <view class="page-skeleton__uploads"><view /><view /><view /></view>
    </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.page-skeleton {
  padding: 24rpx 26rpx 56rpx;
}

.page-skeleton__error {
  min-height: 480rpx;
  padding: 72rpx 44rpx;
  border: 1rpx solid var(--tms-line);
  border-radius: 24rpx;
  background: var(--tms-material-regular);
  box-shadow: var(--tms-shadow-sm);
  backdrop-filter: blur(18rpx) saturate(140%);
  -webkit-backdrop-filter: blur(18rpx) saturate(140%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.page-skeleton__error-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: 24rpx;
  color: var(--tms-primary);
  background: var(--tms-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38rpx;
  font-weight: 700;
}

.page-skeleton__error-title,
.page-skeleton__error-message {
  display: block;
}

.page-skeleton__error-title {
  margin-top: 24rpx;
  color: var(--tms-text);
  font-size: 30rpx;
  font-weight: 700;
}

.page-skeleton__error-message {
  max-width: 520rpx;
  margin-top: 12rpx;
  color: var(--tms-muted);
  font-size: max(23rpx, 12px);
  line-height: 1.65;
}

.page-skeleton__retry {
  height: var(--tms-control-height);
  margin-top: 30rpx;
  padding: 0 40rpx;
  border: 0;
  border-radius: var(--tms-control-radius);
  color: #fff;
  background: var(--tms-primary);
  box-shadow: var(--tms-shadow-primary);
  font-size: var(--tms-control-font-size);
  font-weight: 700;
  line-height: var(--tms-control-height);
}

.page-skeleton__status {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 4rpx 4rpx 22rpx;
  color: var(--tms-muted);
  font-size: max(23rpx, 12px);
}

.page-skeleton__spinner {
  width: 25rpx;
  height: 25rpx;
  border: 4rpx solid var(--tms-primary-soft-strong);
  border-top-color: var(--tms-primary);
  border-radius: 50%;
  animation: skeleton-spin 0.8s linear infinite;
}

.page-skeleton__card {
  padding: 28rpx;
  background: var(--tms-material-regular);
  border: 1rpx solid var(--tms-line);
  border-radius: 24rpx;
  box-shadow: var(--tms-shadow-sm);
  backdrop-filter: blur(18rpx) saturate(140%);
  -webkit-backdrop-filter: blur(18rpx) saturate(140%);
}

.page-skeleton__card + .page-skeleton__card {
  margin-top: 20rpx;
}

.page-skeleton__row {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.page-skeleton__circle {
  width: 66rpx;
  height: 66rpx;
  border-radius: 50%;
  background: var(--tms-surface-muted);
}

.page-skeleton__lines {
  flex: 1;
}

.page-skeleton__line,
.page-skeleton__input,
.page-skeleton__tiles view,
.page-skeleton__uploads view,
.page-skeleton__circle {
  overflow: hidden;
  background: linear-gradient(100deg, var(--tms-surface-muted) 30%, var(--tms-surface-soft) 50%, var(--tms-surface-muted) 70%);
  background-size: 240% 100%;
  animation: skeleton-shimmer 1.35s ease-in-out infinite;
}

.page-skeleton__line {
  width: 100%;
  height: 22rpx;
  border-radius: 999rpx;
}

.page-skeleton__line + .page-skeleton__line {
  margin-top: 14rpx;
}

.page-skeleton__line--medium {
  width: 58%;
}

.page-skeleton__line--short {
  width: 34%;
}

.page-skeleton__tiles,
.page-skeleton__uploads {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 26rpx;
}

.page-skeleton__tiles view {
  height: 86rpx;
  border-radius: 16rpx;
}

.page-skeleton__card--form > .page-skeleton__line:nth-child(3) {
  margin-top: 30rpx;
}

.page-skeleton__input {
  height: 86rpx;
  margin-top: 18rpx;
  border-radius: 16rpx;
}

.page-skeleton__uploads {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18rpx;
}

.page-skeleton__uploads view {
  aspect-ratio: 1;
  border-radius: 16rpx;
}

.page-skeleton--compact {
  padding: 22rpx 26rpx 36rpx;
}

.page-skeleton--compact .page-skeleton__card--form {
  display: none;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@keyframes skeleton-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
