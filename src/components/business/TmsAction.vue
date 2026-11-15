<script setup lang="ts">
const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()

function activate() {
  if (!props.disabled) emit('click')
}

function keydown(event: KeyboardEvent) {
  if (event.repeat || props.disabled) return
  // #ifdef H5
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.click()
    return
  }
  // #endif
  activate()
}
</script>

<template>
  <button
    class="shipper-button"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :disabled="disabled"
    :aria-disabled="Boolean(disabled)"
    @click="activate"
    @keydown.enter.prevent="keydown"
    @keydown.space.prevent="keydown"
  >
    <slot />
  </button>
</template>
