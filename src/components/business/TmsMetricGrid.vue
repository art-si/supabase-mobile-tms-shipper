<script setup lang="ts">
import type { OrderGroup } from '@/api/types'
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'

interface MetricItem {
  key: OrderGroup
  label: string
  value: number
}

const props = defineProps<{
  items: MetricItem[]
}>()
const emit = defineEmits<{ select: [group: OrderGroup] }>()
function select(index: number) {
  const item = props.items[index]
  if (item) emit('select', item.key)
}
</script>

<template>
  <MobileMetricGrid :items="items" selectable @select="select" />
</template>
