<script setup lang="ts">
import { computed, ref } from 'vue'
import TmsAction from './TmsAction.vue'
import TmsIcon from './TmsIcon.vue'

const props = defineProps<{
  options: Array<{ id: string; name: string }>
  label: string
  placeholder: string
  field?: string
  compact?: boolean
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}>()
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ select: [id: string] }>()
const options = computed(() => [{ id: '', name: props.placeholder }, ...props.options])
const selectedIndex = computed(() => Math.max(0, options.value.findIndex((option) => option.id === model.value)))
const cycle = ref(0)

function select(value: string) {
  if (!value) return
  if (!props.compact) model.value = value
  emit('select', value)
}

// #ifdef H5
function chooseFromSelect(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  select(target.value)
  if (props.compact) target.value = ''
}
// #endif

function chooseFromPicker(event: { detail: { value: number | string } }) {
  select(options.value[Number(event.detail.value)]?.id || '')
  if (props.compact) cycle.value++
}
</script>

<template>
  <!-- #ifdef H5 -->
  <select
    :id="field" class="tms-select" :class="{ 'tms-select--compact': compact, 'tms-select--invalid': invalid }"
    :value="model" :disabled="disabled" :aria-label="label" :aria-invalid="Boolean(invalid)" :aria-describedby="describedBy"
    @change="chooseFromSelect"
  >
    <option v-for="option in options" :key="option.id" :value="option.id" :disabled="!option.id" :hidden="!option.id">
      {{ option.name }}
    </option>
  </select>
  <!-- #endif -->
  <!-- #ifdef MP-WEIXIN -->
  <picker :key="cycle" :value="selectedIndex" :range="options" range-key="name" :disabled="disabled" @change="chooseFromPicker">
    <TmsAction
      :id="field" class="tms-select tms-select--button"
      :class="{ 'tms-select--compact': compact, 'tms-select--invalid': invalid }"
      :disabled="disabled" :aria-label="label" :aria-invalid="Boolean(invalid)" :aria-describedby="describedBy"
    >
      <text>{{ options[selectedIndex]?.name }}</text>
      <TmsIcon name="arrow-right" size="25rpx" />
    </TmsAction>
  </picker>
  <!-- #endif -->
</template>

<style scoped lang="scss">
.tms-select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--tms-control-height);
  padding: 0 20rpx;
  border: 1px solid var(--tms-line);
  border-radius: var(--tms-control-radius);
  color: var(--tms-text);
  background: var(--tms-surface-soft);
  font: inherit;
  font-size: max(28rpx, 16px);
}
.tms-select:focus-visible { outline: 2px solid var(--tms-primary); outline-offset: 2px; }
.tms-select--button { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.tms-select--button text { min-width: 0; overflow-wrap: anywhere; }
.tms-select--compact {
  width: auto; max-width: 100%; padding: 0 10rpx;
  color: var(--tms-primary); background: transparent; border: 0;
  font-size: max(25rpx, 13px); font-weight: 650;
}
.tms-select--invalid { border-color: #b42318; }
</style>
