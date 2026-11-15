<script setup lang="ts">
withDefaults(defineProps<{
  field: string
  label: string
  placeholder?: string
  maxlength?: number
  error?: string
  required?: boolean
  disabled?: boolean
  focus?: boolean
  password?: boolean
  inputmode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email'
  autocomplete?: string
}>(), { maxlength: 120, inputmode: 'text', autocomplete: 'off' })

const model = defineModel<string>({ default: '' })
defineEmits<{ confirm: [] }>()
</script>

<template>
  <view class="shipper-field">
    <label class="shipper-field__label" :for="field">
      {{ label }}
      <text v-if="required" class="shipper-field__required" aria-hidden="true">*</text>
    </label>
    <slot>
      <input
        :id="field"
        v-model="model"
        class="shipper-field__input"
        :class="{ 'shipper-field__input--error': error }"
        :name="field"
        :aria-label="label"
        :aria-invalid="Boolean(error)"
        :aria-required="required"
        :aria-describedby="error ? `${field}-error` : undefined"
        :inputmode="inputmode"
        :type="inputmode === 'numeric' ? 'number' : inputmode === 'decimal' ? 'digit' : 'text'"
        :password="password"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        placeholder-class="shipper-field__placeholder"
        :maxlength="maxlength"
        :disabled="disabled"
        :focus="focus"
        @confirm="$emit('confirm')"
      />
    </slot>
    <text v-if="error" :id="`${field}-error`" class="shipper-error" role="alert">{{ error }}</text>
  </view>
</template>

<style lang="scss">
.shipper-field {
  display: grid;
  gap: 10rpx;
  min-width: 0;
}

.shipper-field__label {
  display: flex;
  gap: 7rpx;
  color: var(--tms-text-strong);
  font-size: max(26rpx, 14px);
  line-height: 1.4;
  font-weight: 650;
}

.shipper-field__required { color: #b42318; }

.shipper-field__input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: var(--tms-control-height);
  padding: 0 22rpx;
  border: 1px solid var(--tms-line);
  border-radius: var(--tms-control-radius);
  background: var(--tms-surface-soft);
  color: var(--tms-text);
  font-size: max(28rpx, 16px);
  line-height: 1.35;
}

.shipper-field__input--error { border-color: #b42318; }
.shipper-field__input:focus,
.shipper-field__input:focus-within {
  outline: 2px solid var(--tms-primary);
  outline-offset: 1px;
}

.shipper-field__placeholder { color: var(--tms-muted); font-size: max(26rpx, 14px); }
</style>
