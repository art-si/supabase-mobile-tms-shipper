<script setup lang="ts">
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import type { MobileIconName } from '@mobile-core/icons'

defineProps<{ name: MobileIconName; size?: string | number; color?: string }>()
</script>

<template>
  <MobileIcon :name="name" :size="size" :color="color" container-class="tms-icon" />
</template>
