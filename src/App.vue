<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

onLaunch(() => useAuthStore().hydrate())
</script>

<style lang="scss">
@use '@mobile-core/styles/global.scss' as mobile;
@use './styles/shipper.scss';

@include mobile.apply('tms', 'TMS Icons', '~@/static/icons/tms-icons.ttf');
@include shipper.apply();

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
