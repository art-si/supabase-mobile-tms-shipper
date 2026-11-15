<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
// #ifdef H5
import { App as NativeApp } from '@capacitor/app'
import { registerAndroidBackHandler } from '@mobile-core/android-back'
// #endif

onLaunch(() => {
  useAuthStore().hydrate()
  // #ifdef H5
  registerAndroidBackHandler(NativeApp)
  // #endif
})
</script>

<style lang="scss">
@use '@mobile-core/styles/global.scss' as mobile;
@use '@mobile-core/styles/workspace.scss';
@use '@mobile-core/styles/grouped-list.scss' as grouped-list;

@include mobile.apply('tms');
@include workspace.apply('shipper');
@include grouped-list.styles();

page {
  min-height: 100%;
  background: var(--tms-bg);
  color: var(--tms-text);
  font-family: var(--tms-font-family);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

/* #ifdef H5 */
html,
body {
  margin: 0;
  background: var(--tms-bg);
}
/* #endif */
</style>
