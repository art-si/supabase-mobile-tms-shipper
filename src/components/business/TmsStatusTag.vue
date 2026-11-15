<script setup lang="ts">
import { computed } from 'vue'
import MobileStatusTag from '@mobile-core/components/MobileStatusTag.vue'
import { statusAppearance } from '@/utils/orders'

const props = defineProps<{
  status: string
  batch?: boolean
}>()

const appearance = computed(() => statusAppearance(props.status, Boolean(props.batch)))
</script>

<template>
  <MobileStatusTag :label="appearance.label" :tone="appearance.tone" />
</template>
