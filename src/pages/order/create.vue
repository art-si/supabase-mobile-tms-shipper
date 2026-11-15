<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { onBackPress, onShow, onUnload } from '@dcloudio/uni-app'
import { userMessage } from '@/api/supabase'
import type { SavedItem, ShipmentContact, ShipmentDraft } from '@/api/types'
import { isContactPhone, normalizeContact } from '@/utils/orders'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import TmsField from '@/components/business/TmsField.vue'
import TmsAction from '@/components/business/TmsAction.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import TmsSelect from '@/components/business/TmsSelect.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'

const { themeName } = usePageTheme()
const { auth, demo, stations, create, savedItems } = useShipper()
const { data: stationOptions, error: optionsError, load: loadOptions } =
  usePageResource(stations, '站点加载失败，请重新加载。')

let nextLineId = 0
function blankLine() {
  return { id: ++nextLineId, name: '', quantity: '', weightKg: '', volumeM3: '' }
}

const stationIds = reactive({ sender: '', receiver: '' })
const contacts = reactive<Record<'sender' | 'receiver', ShipmentContact>>({
  sender: { name: '', phone: '', address: '' },
  receiver: { name: '', phone: '', address: '' }
})
const sides = [
  { id: 'sender', label: '发货', mark: '发' },
  { id: 'receiver', label: '收货', mark: '收' }
] as const
const lines = ref([blankLine()])
const remark = ref('')
const focused = ref('')
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const submitError = ref('')
const addressOptions = ref<SavedItem[]>([])
const cargoOptions = ref<SavedItem[]>([])
const addressChoices = computed(() => addressOptions.value.map(({ id, title }) => ({ id, name: title })))
const cargoChoices = computed(() => cargoOptions.value.map(({ id, title }) => ({ id, name: title })))
const presetError = ref('')
const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const dirty = computed(() => Boolean(
  stationIds.sender || stationIds.receiver || remark.value ||
  Object.values(contacts).some((contact) => contact.name || contact.phone || contact.address) ||
  lines.value.some((line) => line.name || line.quantity || line.weightKg || line.volumeM3)
))
let allowLeave = false
let confirmOpen = false

onShow(() => {
  if (!auth.guard() || auth.staff) return
  if (!stationOptions.value) void loadOptions()
  void loadSavedItems()
})

async function loadSavedItems() {
  const [addresses, cargo] = await Promise.allSettled([savedItems('address'), savedItems('cargo')])
  if (addresses.status === 'fulfilled') addressOptions.value = addresses.value
  if (cargo.status === 'fulfilled') cargoOptions.value = cargo.value
  presetError.value = addresses.status === 'rejected' || cargo.status === 'rejected' ? '常用资料暂时无法加载。' : ''
}

function confirmBack() {
  if (allowLeave || !dirty.value) return Promise.resolve(true)
  if (saving.value || confirmOpen) return Promise.resolve(false)
  confirmOpen = true
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '离开发货委托？',
      content: '本页已填写的信息会丢失。',
      confirmText: '离开',
      success: ({ confirm }) => {
        allowLeave = confirm
        resolve(confirm)
      },
      fail: () => resolve(false),
      complete: () => { confirmOpen = false }
    })
  })
}

// #ifdef H5
onBackPress(() => {
  if (allowLeave || !dirty.value) return false
  void confirmBack().then((confirmed) => { if (confirmed) uni.navigateBack() })
  return true
})
function beforeUnload(event: BeforeUnloadEvent) {
  if (!allowLeave && dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', beforeUnload)
onUnload(() => window.removeEventListener('beforeunload', beforeUnload))
// #endif

function changeStation(side: 'sender' | 'receiver', id: string) {
  stationIds[side] = id
  delete errors.value[`${side}-station`]
}

function fillAddress(side: 'sender' | 'receiver', id: string) {
  const entry = addressOptions.value.find((item) => item.id === id)
  if (!entry?.contact) return
  Object.assign(contacts[side], entry.contact)
  for (const field of ['name', 'phone', 'address']) delete errors.value[`${side}-${field}`]
}

function fillCargo(line: ReturnType<typeof blankLine>, id: string) {
  const item = cargoOptions.value.find((option) => option.id === id)
  if (!item) return
  line.name = item.title
  delete errors.value[`cargo-${line.id}-name`]
}

function removeLine(id: number) {
  if (lines.value.length > 1) lines.value = lines.value.filter((line) => line.id !== id)
}

function validate() {
  const next: Record<string, string> = {}
  for (const side of sides) {
    const contact = normalizeContact(contacts[side.id])
    if (!stationIds[side.id]) next[`${side.id}-station`] = `请选择${side.label}站点。`
    if (!contact.name) next[`${side.id}-name`] = '请输入联系人。'
    if (!isContactPhone(contact.phone)) next[`${side.id}-phone`] = '请输入有效联系电话。'
    if (!contact.address) next[`${side.id}-address`] = '请输入详细地址。'
  }
  for (const line of lines.value) {
    if (!line.name.trim()) next[`cargo-${line.id}-name`] = '请输入货名。'
    if (!/^\d{1,7}$/.test(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 1_000_000) {
      next[`cargo-${line.id}-quantity`] = '请输入 1 至 100 万之间的整数。'
    }
    for (const field of ['weightKg', 'volumeM3'] as const) {
      if (line[field] && (!/^\d{1,8}(\.\d{1,3})?$/.test(line[field]) || Number(line[field]) > 10_000_000)) {
        next[`cargo-${line.id}-${field}`] = '请输入有效数值，最多保留三位小数。'
      }
    }
  }
  errors.value = next
  return Object.keys(next)[0]
}

async function submit() {
  if (saving.value || !stationOptions.value?.length) return
  submitError.value = ''
  const first = validate()
  if (first) {
    focused.value = ''
    await nextTick()
    focused.value = first
    uni.pageScrollTo({ selector: `#${first}`, duration: 0 })
    return
  }

  const draft: ShipmentDraft = {
    originStationId: stationIds.sender,
    destinationStationId: stationIds.receiver,
    sender: normalizeContact(contacts.sender),
    receiver: normalizeContact(contacts.receiver),
    cargo: lines.value.map((line) => ({
      name: line.name.trim(), quantity: Number(line.quantity),
      weightKg: Number(line.weightKg), volumeM3: Number(line.volumeM3)
    })),
    remark: remark.value.trim()
  }
  saving.value = true
  try {
    const result = await create(requestId, draft)
    allowLeave = true
    uni.redirectTo({ url: `/pages/order/detail?id=${encodeURIComponent(result.id)}&created=1` })
  } catch (cause) {
    submitError.value = userMessage(cause, '提交失败，已保留填写内容。请重试。')
    await nextTick()
    uni.pageScrollTo({ selector: '#submit-error', duration: 0 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" title="发货委托" :eyebrow="demo ? '演示模式' : undefined" show-back :confirm-back="confirmBack" />
    <view v-if="auth.staff" class="shipper-content">
      <text class="shipper-copy">请从发货入口进入 Web TMS 开单。</text>
    </view>
    <TmsPageSkeleton v-else-if="!stationOptions" label="正在加载可用站点…" :error="optionsError" @retry="loadOptions" />
    <view v-else-if="!stationOptions.length" class="shipper-content">
      <view class="card shipper-empty">
        <view class="shipper-empty__icon"><TmsIcon name="location" size="46rpx" /></view>
        <text class="section-title">暂无可用站点</text>
        <text class="shipper-copy">请联系服务商启用可用站点。</text>
      </view>
    </view>
    <view v-else class="shipper-content" role="main">
      <view v-if="presetError" class="shipper-heading">
        <text class="shipper-copy">{{ presetError }}</text>
        <TmsAction class="shipper-inline" @click="loadSavedItems">重试</TmsAction>
      </view>
      <view v-for="side in sides" :key="side.id" class="card shipper-card shipment-section">
        <view class="shipment-section__title">
          <view class="shipment-section__mark" :class="{ 'shipment-section__mark--receiver': side.id === 'receiver' }">{{ side.mark }}</view>
          <text class="section-title" role="heading" aria-level="2">{{ side.label }}信息</text>
          <TmsSelect
            v-if="addressChoices.length" :options="addressChoices" :label="`${side.label}使用常用地址`"
            placeholder="选用地址" :disabled="saving" compact @select="fillAddress(side.id, $event)"
          />
        </view>
        <TmsField :field="`${side.id}-station`" :label="`${side.label}站点`" :error="errors[`${side.id}-station`]" required>
          <TmsSelect
            :field="`${side.id}-station`" :model-value="stationIds[side.id]" :options="stationOptions"
            :label="`${side.label}站点`" placeholder="选择站点…" :disabled="saving"
            :invalid="Boolean(errors[`${side.id}-station`])"
            :described-by="errors[`${side.id}-station`] ? `${side.id}-station-error` : undefined"
            @select="changeStation(side.id, $event)"
          />
        </TmsField>
        <view class="shipment-fields">
          <TmsField
            v-model="contacts[side.id].name" :field="`${side.id}-name`" label="联系人" placeholder="姓名…"
            :maxlength="60" :error="errors[`${side.id}-name`]" :focus="focused === `${side.id}-name`" :disabled="saving" required
          />
          <TmsField
            v-model="contacts[side.id].phone" :field="`${side.id}-phone`" label="联系电话" placeholder="手机或座机…"
            :maxlength="24" inputmode="tel" :error="errors[`${side.id}-phone`]" :focus="focused === `${side.id}-phone`"
            :disabled="saving" required
          />
        </view>
        <TmsField
          v-model="contacts[side.id].address" :field="`${side.id}-address`" label="详细地址" placeholder="省市区、街道及门牌…"
          :maxlength="240" :error="errors[`${side.id}-address`]" :focus="focused === `${side.id}-address`" :disabled="saving" required
        >
          <textarea
            :id="`${side.id}-address`" v-model="contacts[side.id].address" class="shipment-textarea" :aria-label="`${side.label}详细地址`"
            :aria-invalid="Boolean(errors[`${side.id}-address`])" :aria-describedby="errors[`${side.id}-address`] ? `${side.id}-address-error` : undefined"
            :focus="focused === `${side.id}-address`" placeholder="省市区、街道及门牌…" :maxlength="240" :disabled="saving"
          />
        </TmsField>
      </view>

      <view class="card shipper-card shipment-section">
        <view class="shipment-section__title">
          <view class="shipment-section__mark"><TmsIcon name="box" size="31rpx" /></view>
          <text class="section-title" role="heading" aria-level="2">货物明细</text>
        </view>
        <view v-for="(line, index) in lines" :key="line.id" class="shipment-cargo">
          <view v-if="lines.length > 1 || cargoOptions.length" class="shipper-heading">
            <text v-if="lines.length > 1" class="shipper-copy">货物 {{ index + 1 }}</text>
            <TmsSelect
              v-if="cargoChoices.length" :options="cargoChoices" label="选用常用货物" placeholder="选用常用货物"
              :disabled="saving" compact @select="fillCargo(line, $event)"
            />
            <TmsAction v-if="lines.length > 1" class="shipper-inline shipment-remove" :disabled="saving" @click="removeLine(line.id)">移除</TmsAction>
          </view>
          <TmsField
            v-model="line.name" :field="`cargo-${line.id}-name`" label="货物名称" placeholder="例如包装纸箱…"
            :maxlength="120" :error="errors[`cargo-${line.id}-name`]" :focus="focused === `cargo-${line.id}-name`" :disabled="saving" required
          />
          <TmsField
            v-model="line.quantity" :field="`cargo-${line.id}-quantity`" label="件数" placeholder="填写件数…"
            :maxlength="7" inputmode="numeric" :error="errors[`cargo-${line.id}-quantity`]"
            :focus="focused === `cargo-${line.id}-quantity`" :disabled="saving" required
          />
          <view class="shipment-fields">
            <TmsField
              v-model="line.weightKg" :field="`cargo-${line.id}-weightKg`" label="总重（kg）" placeholder="选填"
              :maxlength="12" inputmode="decimal" :error="errors[`cargo-${line.id}-weightKg`]"
              :focus="focused === `cargo-${line.id}-weightKg`" :disabled="saving"
            />
            <TmsField
              v-model="line.volumeM3" :field="`cargo-${line.id}-volumeM3`" label="总体积（m³）" placeholder="选填"
              :maxlength="12" inputmode="decimal" :error="errors[`cargo-${line.id}-volumeM3`]"
              :focus="focused === `cargo-${line.id}-volumeM3`" :disabled="saving"
            />
          </view>
        </view>
        <TmsAction
          v-if="lines.length < 12" class="shipper-button shipper-inline shipment-add" :disabled="saving"
          @click="lines.push(blankLine())"
        ><TmsIcon name="add" size="30rpx" /> 添加货物</TmsAction>
      </view>
      <view class="card shipper-card">
        <TmsField field="shipment-remark" label="运输备注">
          <textarea
            id="shipment-remark" v-model="remark" class="shipment-textarea" aria-label="运输备注"
            placeholder="选填，注明取货时间或装卸要求…" :maxlength="500" :disabled="saving"
          />
        </TmsField>
      </view>
      <text v-if="submitError" id="submit-error" class="shipper-error" role="alert">{{ submitError }}</text>
      <wd-button block type="primary" custom-class="tms-primary-action" :loading="saving" :disabled="saving" @click="submit">
        提交发货委托
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.shipment-section { display: grid; gap: 25rpx; }
.shipment-section__title { display: flex; align-items: center; gap: 14rpx; }
.shipment-section__title > uni-picker,
.shipment-section__title > picker,
.shipment-section__title > select { margin-left: auto; }
.shipment-section__mark {
  display: grid;
  place-items: center;
  width: 47rpx;
  height: 47rpx;
  border-radius: 15rpx;
  background: var(--tms-primary-soft);
  color: var(--tms-primary);
  flex: none;
  font-size: max(24rpx, 13px);
  font-weight: 750;
}
.shipment-section__mark--receiver { color: #047857; background: var(--tms-green-soft); }
.shipment-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; }
.shipment-textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--tms-control-height);
  border: 1px solid var(--tms-line);
  border-radius: var(--tms-control-radius);
  background: var(--tms-surface-soft);
  padding: 16rpx 20rpx;
  color: var(--tms-text);
  font-size: max(28rpx, 16px);
  line-height: 1.45;
}
.shipment-textarea { display: block; height: 144rpx; }
.shipment-textarea:focus-within { outline: 2px solid var(--tms-primary); outline-offset: 1px; }
.shipment-cargo { display: grid; gap: 18rpx; min-width: 0; }
.shipment-cargo + .shipment-cargo { padding-top: 15rpx; border-top: 1px solid var(--tms-line-subtle); }
.shipment-add { justify-self: start; }
.shipment-remove { color: #b42318; }
</style>
