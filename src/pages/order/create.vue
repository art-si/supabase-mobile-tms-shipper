<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, nextTick, reactive, ref } from 'vue'
import { onBackPress, onShow, onUnload } from '@dcloudio/uni-app'
import { userMessage } from '@/api/supabase'
import type { SavedItem, ShipmentContact, ShipmentDraft } from '@/api/types'
import { isContactPhone, normalizeContact } from '@/utils/orders'
import { clearShipmentDraft, rememberShipmentDraft, takeShipmentDraft, type ShipmentFormCargo } from '@/utils/shipment-draft'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileConfirmDialog from '@mobile-core/components/MobileConfirmDialog.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileField from '@mobile-core/components/MobileField.vue'
import MobileSelect from '@mobile-core/components/MobileSelect.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import { revealControl } from '@mobile-core/form-focus'

const { theme, themeName } = usePageTheme()
const { auth, demo, stations, create, savedItems, shipmentOwner: draftOwner } = useShipper()
const { data: stationOptions, error: optionsError, load: loadOptions } =
  usePageResource(stations, '站点加载失败，请重新加载。')

let nextLineId = 0
function blankLine(): ShipmentFormCargo {
  return { id: ++nextLineId, name: '', quantity: '', weightKg: '', volumeM3: '' }
}

const stationIds = reactive({ sender: '', receiver: '' })
const contacts = reactive<Record<'sender' | 'receiver', ShipmentContact>>({
  sender: { name: '', phone: '', address: '' },
  receiver: { name: '', phone: '', address: '' }
})
const sides = [
  { id: 'sender', label: '发货', icon: 'location' },
  { id: 'receiver', label: '收货', icon: 'flag' }
] as const
const lines = ref([blankLine()])
const remark = ref('')
const remarkOpen = ref(false)
const focused = ref('')
const fieldsToValidate = ref<string[]>([])
const errors = computed<Record<string, string>>(() => {
  if (!fieldsToValidate.value.length) return {}
  const current = validate()
  const shown: Record<string, string> = {}
  for (const key of fieldsToValidate.value) {
    const message = current[key]
    if (message) shown[key] = message
  }
  return shown
})
const saving = ref(false)
const submitError = ref('')
const addressOptions = ref<SavedItem[]>([])
const cargoOptions = ref<SavedItem[]>([])
const addressChoices = computed(() => addressOptions.value.map(({ id, title }) => ({ id, name: title })))
const cargoChoices = computed(() => cargoOptions.value.map(({ id, title }) => ({ id, name: title })))
const presetsLoading = ref(false)
const presetError = ref(false)
const removeOpen = ref(false)
const pendingRemoval = ref<{ id: number; label: string }>()
let requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const maxCargoLines = 12
const dirty = computed(() => Boolean(
  stationIds.sender || stationIds.receiver || remark.value ||
  Object.values(contacts).some((contact) => contact.name || contact.phone || contact.address) ||
  lines.value.some(hasCargoDetails)
))
let allowLeave = false
const leaveOpen = ref(false)
let resolveLeave: ((confirmed: boolean) => void) | undefined
const draftRecovered = ref(false)
let loadedDraftOwner: string | undefined
let unloaded = false

onShow(() => {
  if (!auth.guard() || auth.staff) return
  // #ifdef H5
  if (draftOwner.value && !loadedDraftOwner) {
    loadedDraftOwner = draftOwner.value
    const draft = takeShipmentDraft(loadedDraftOwner)
    if (draft) {
      requestId = draft.requestId
      Object.assign(stationIds, draft.stationIds)
      Object.assign(contacts, draft.contacts)
      lines.value = draft.cargo
      nextLineId = Math.max(...draft.cargo.map((line) => line.id))
      remark.value = draft.remark
      remarkOpen.value = draft.remarkOpen
      draftRecovered.value = true
    }
  }
  // #endif
  if (!stationOptions.value) void loadOptions()
  void loadSavedItems()
})

async function loadSavedItems() {
  if (presetsLoading.value) return
  presetsLoading.value = true
  try {
    const [addresses, cargo] = await Promise.allSettled([savedItems('address'), savedItems('cargo')])
    if (addresses.status === 'fulfilled') addressOptions.value = addresses.value
    if (cargo.status === 'fulfilled') cargoOptions.value = cargo.value
    presetError.value = addresses.status === 'rejected' || cargo.status === 'rejected'
  } finally {
    presetsLoading.value = false
  }
}

function confirmBack() {
  if (saving.value) return Promise.resolve(false)
  if (allowLeave || !dirty.value) return Promise.resolve(true)
  if (leaveOpen.value) return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    resolveLeave = resolve
    leaveOpen.value = true
  })
}

function settleLeave(confirmed: boolean) {
  allowLeave = confirmed
  resolveLeave?.(confirmed)
  resolveLeave = undefined
}

onUnload(() => {
  unloaded = true
  // #ifdef H5
  if (loadedDraftOwner && draftOwner.value === loadedDraftOwner && !allowLeave && dirty.value) {
    rememberShipmentDraft(loadedDraftOwner, {
      requestId,
      stationIds: { ...stationIds },
      contacts: { sender: { ...contacts.sender }, receiver: { ...contacts.receiver } },
      cargo: lines.value.map((line) => ({ ...line })),
      remark: remark.value,
      remarkOpen: remarkOpen.value
    })
  }
  // #endif
  if (resolveLeave) settleLeave(false)
})

// #ifdef H5
onBackPress(() => {
  if (!saving.value && (allowLeave || !dirty.value)) return false
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

function fillAddress(side: 'sender' | 'receiver', id: string) {
  const entry = addressOptions.value.find((item) => item.id === id)
  if (!entry?.contact) return
  Object.assign(contacts[side], entry.contact)
}

function fillCargo(line: ShipmentFormCargo, id: string) {
  const item = cargoOptions.value.find((option) => option.id === id)
  if (!item) return
  line.name = item.title
}

function hasCargoDetails(line: ShipmentFormCargo) {
  return Boolean(line.name.trim() || line.quantity || line.weightKg || line.volumeM3)
}

function addLine() {
  if (saving.value || lines.value.length >= maxCargoLines) return
  const line = blankLine()
  lines.value.push(line)
  void revealControl(`cargo-${line.id}-name`)
}

function openRemark() {
  remarkOpen.value = true
  void revealControl('shipment-remark')
}

function requestRemoval(line: ShipmentFormCargo, index: number) {
  if (saving.value || lines.value.length < 2) return
  if (!hasCargoDetails(line)) {
    removeLine(line.id)
    return
  }
  pendingRemoval.value = { id: line.id, label: line.name.trim() || `货物 ${index + 1}` }
  removeOpen.value = true
}

function removeLine(id: number) {
  const index = lines.value.findIndex((line) => line.id === id)
  if (index < 0 || lines.value.length < 2) return
  const neighbor = lines.value[index + 1] || lines.value[index - 1]
  lines.value = lines.value.filter((line) => line.id !== id)
  fieldsToValidate.value = fieldsToValidate.value.filter((field) => !field.startsWith(`cargo-${id}-`))
  void revealControl(lines.value.length > 1 && neighbor ? `cargo-${neighbor.id}-remove` : 'shipment-add-cargo')
}

function confirmRemoval() {
  if (pendingRemoval.value) removeLine(pendingRemoval.value.id)
  pendingRemoval.value = undefined
}

function validate() {
  const next: Record<string, string> = {}
  for (const side of sides) {
    const contact = normalizeContact(contacts[side.id])
    if (!stationIds[side.id]) next[`${side.id}-station`] = `请选择${side.label}站点。`
    if (!contact.name) next[`${side.id}-name`] = '请输入联系人。'
    if (!contact.phone) next[`${side.id}-phone`] = '请输入联系电话。'
    else if (!isContactPhone(contact.phone)) next[`${side.id}-phone`] = '请检查电话号码。'
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
  return next
}

async function submit() {
  if (saving.value || !stationOptions.value?.length) return
  submitError.value = ''
  fieldsToValidate.value = Object.keys(validate())
  const first = fieldsToValidate.value[0]
  if (first) {
    focused.value = ''
    await nextTick()
    focused.value = first
    await revealControl(first)
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
    if (unloaded) {
      clearShipmentDraft(requestId)
      return
    }
    allowLeave = true
    uni.redirectTo({ url: `/pages/order/detail?id=${encodeURIComponent(result.id)}&created=1` })
  } catch (cause) {
    submitError.value = userMessage(cause, '提交失败，已保留填写内容。请重试。')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <wd-config-provider :theme="'tms-' + theme.preset">
  <MobileWorkspace :container-class="['page shipper-page mobile-workspace--sticky-dock', themeName]">
    <MobileTopBar capsule="always" title="发货委托" :eyebrow="demo ? '演示模式' : undefined" show-back :confirm-back="confirmBack" />
    <view v-if="auth.staff" class="shipper-content">
      <text class="shipper-copy">请从发货入口进入 Web TMS 开单。</text>
    </view>
    <TmsPageSkeleton v-else-if="!stationOptions" label="正在加载可用站点…" :error="optionsError" @retry="loadOptions" />
    <view v-else-if="!stationOptions.length" class="shipper-content">
      <MobileEmptyState class="shipper-card" icon="location" title="暂无可用站点"
        description="请联系服务商启用可用站点。" />
    </view>
    <view v-else class="shipper-content shipment-form" role="main">
      <view v-if="draftRecovered" class="shipment-recovery mobile-inline-pair mobile-inline-pair--start" role="status">
        <view class="mobile-inline-pair__icon"><MobileIcon name="check" size="16px" /></view>
        <text>已恢复上次未提交的发货内容。</text>
      </view>
      <text class="shipment-required shipper-copy"><text aria-hidden="true">*</text> 为必填项</text>
      <view v-if="presetsLoading || presetError" class="shipper-heading shipment-notice">
        <text class="shipper-copy" role="status">{{ presetsLoading ? '正在加载常用资料…' : '常用资料暂时无法加载，仍可手动填写。' }}</text>
        <MobileAction v-if="presetError" class="shipper-inline" :disabled="presetsLoading" @click="loadSavedItems">重试</MobileAction>
      </view>
      <view v-for="side in sides" :key="side.id" class="shipment-group">
        <view class="shipper-heading shipment-group__header">
          <view class="mobile-inline-pair shipment-group__heading">
            <MobileIcon :name="side.icon" size="18px" align-to-label />
            <text class="mobile-inline-pair__label section-title" role="heading" aria-level="2">{{ side.label }}信息</text>
          </view>
          <MobileSelect
            v-if="addressChoices.length" :options="addressChoices" :label="`${side.label}使用常用地址`"
            placeholder="常用地址" :disabled="saving" compact @select="fillAddress(side.id, $event)"
          />
        </view>
        <view class="shipper-card shipment-section">
          <MobileField :field="`${side.id}-station`" :label="`${side.label}站点`" :error="errors[`${side.id}-station`]" required>
            <MobileSelect
              v-model="stationIds[side.id]" :field="`${side.id}-station`" :options="stationOptions"
              :label="`${side.label}站点`" placeholder="选择站点…" :disabled="saving"
              :invalid="Boolean(errors[`${side.id}-station`])"
              :described-by="errors[`${side.id}-station`] ? `${side.id}-station-error` : undefined"
            />
          </MobileField>
          <view class="shipment-fields">
            <MobileField
              v-model="contacts[side.id].name" :field="`${side.id}-name`" label="联系人" :input-label="`${side.label}联系人`"
              placeholder="姓名…" :maxlength="60" :error="errors[`${side.id}-name`]"
              :focus="focused === `${side.id}-name`" :disabled="saving" required
            />
            <MobileField
              v-model="contacts[side.id].phone" :field="`${side.id}-phone`" label="联系电话" :input-label="`${side.label}联系电话`"
              placeholder="手机或座机…" :maxlength="24" inputmode="tel" :error="errors[`${side.id}-phone`]"
              :focus="focused === `${side.id}-phone`" :disabled="saving" required
            />
          </view>
          <MobileField
            v-model="contacts[side.id].address" :field="`${side.id}-address`" label="详细地址" :input-label="`${side.label}详细地址`"
            placeholder="省市区、街道及门牌…" :maxlength="240" :error="errors[`${side.id}-address`]"
            :focus="focused === `${side.id}-address`" :disabled="saving" multiline required
          />
        </view>
      </view>

      <view class="shipment-group">
        <view class="shipper-heading shipment-group__header">
          <view class="mobile-inline-pair shipment-group__heading">
            <MobileIcon name="box" size="18px" align-to-label />
            <text class="mobile-inline-pair__label section-title" role="heading" aria-level="2">货物明细</text>
          </view>
          <text class="shipper-copy shipment-count" role="status">{{ lines.length }} 种货物</text>
        </view>
        <view class="shipper-card shipment-section shipment-section--cargo">
          <view v-for="(line, index) in lines" :key="line.id" class="shipment-cargo">
            <view v-if="lines.length > 1 || cargoChoices.length" class="shipment-cargo__header">
              <text v-if="lines.length > 1" class="shipment-cargo__label">货物 {{ index + 1 }}</text>
              <view class="shipment-cargo__tools">
                <MobileSelect
                  v-if="cargoChoices.length" :options="cargoChoices" label="选用常用货物" placeholder="常用货物"
                  :disabled="saving" compact @select="fillCargo(line, $event)"
                />
                <MobileAction
                  v-if="lines.length > 1" :id="`cargo-${line.id}-remove`"
                  class="shipper-inline shipment-remove" :aria-label="`移除货物 ${index + 1}`"
                  :disabled="saving" @click="requestRemoval(line, index)"
                >移除</MobileAction>
              </view>
            </view>
            <MobileField
              v-model="line.name" :field="`cargo-${line.id}-name`" label="货物名称" placeholder="例如包装纸箱…"
              :maxlength="120" :error="errors[`cargo-${line.id}-name`]" :focus="focused === `cargo-${line.id}-name`" :disabled="saving" required
            />
            <view class="shipment-fields shipment-fields--measurements">
              <MobileField
                v-model="line.quantity" :field="`cargo-${line.id}-quantity`" class="shipment-quantity" label="件数" placeholder="例如 10…"
                :maxlength="7" inputmode="numeric" :error="errors[`cargo-${line.id}-quantity`]"
                :focus="focused === `cargo-${line.id}-quantity`" :disabled="saving" required
              />
              <MobileField
                v-model="line.weightKg" :field="`cargo-${line.id}-weightKg`" label="总重（kg）" placeholder="选填"
                :maxlength="12" inputmode="decimal" :error="errors[`cargo-${line.id}-weightKg`]"
                :focus="focused === `cargo-${line.id}-weightKg`" :disabled="saving"
              />
              <MobileField
                v-model="line.volumeM3" :field="`cargo-${line.id}-volumeM3`" label="总体积（m³）" placeholder="选填"
                :maxlength="12" inputmode="decimal" :error="errors[`cargo-${line.id}-volumeM3`]"
                :focus="focused === `cargo-${line.id}-volumeM3`" :disabled="saving"
              />
            </view>
          </view>
          <MobileAction
            v-if="lines.length < maxCargoLines" id="shipment-add-cargo" class="shipper-inline shipment-add" :disabled="saving"
            @click="addLine"
          >
            <MobileInlineLabel label="添加货物" icon="add" />
          </MobileAction>
          <text v-else class="shipper-copy" role="status">已添加 {{ maxCargoLines }} 种货物，达到单次委托上限。</text>
        </view>
      </view>

      <view v-if="remarkOpen" class="shipper-card">
        <MobileField
          v-model="remark" field="shipment-remark" label="运输备注" placeholder="选填，注明取货时间或装卸要求…"
          :maxlength="500" :disabled="saving" multiline
        />
      </view>
      <view v-else class="mobile-group">
        <MobileAction class="mobile-row" :disabled="saving" @click="openRemark">
          <view class="mobile-row__icon"><MobileIcon name="document" size="17px" /></view>
          <view class="mobile-row__body">
            <text class="mobile-row__label">添加运输备注</text>
            <text class="mobile-row__detail">选填 · 取货时间、装卸要求等</text>
          </view>
          <MobileIcon class="mobile-row__chevron" name="add" size="16px" />
        </MobileAction>
      </view>
    </view>
    <view v-if="!auth.staff && stationOptions?.length" class="mobile-dock mobile-dock--sticky" aria-label="发货委托操作">
      <text v-if="submitError" id="submit-error" class="mobile-dock__note mobile-dock__note--error" role="alert">{{ submitError }}</text>
      <MobileAction class="tms-primary-action mobile-dock__action" :aria-busy="saving" :disabled="saving" @click="submit">
        {{ saving ? '正在提交…' : '提交发货委托' }}
      </MobileAction>
    </view>
    <MobileConfirmDialog
      v-model="leaveOpen" title="离开发货委托？" message="本页已填写的信息会丢失。"
      confirm-text="离开" @confirm="settleLeave(true)" @cancel="settleLeave(false)"
    />
    <MobileConfirmDialog
      v-model="removeOpen" title="移除这项货物？" confirm-text="移除"
      :message="pendingRemoval ? `「${pendingRemoval.label}」的填写内容会丢失。` : undefined"
      @confirm="confirmRemoval" @cancel="pendingRemoval = undefined"
    />
  </MobileWorkspace>
  </wd-config-provider>
</template>

<style scoped lang="scss">
.shipment-form { gap: 20px; padding-bottom: 24px; }
.shipment-recovery {
  --mobile-inline-pair-gap: 8px;
  padding: 12px 16px;
  border-radius: var(--tms-control-radius);
  background: var(--tms-primary-soft);
  color: var(--tms-primary-strong);
  font-size: 14px;
  line-height: 1.5;
}
.shipment-required text { color: var(--tms-red-strong); }
.shipment-notice {
  padding: 0 12px;
  border: 1px solid var(--mobile-workspace-line);
  border-radius: 12px;
  background: var(--mobile-workspace-surface);
}

.shipment-group { display: grid; min-width: 0; gap: 7px; }
.shipment-group__header { min-height: 44px; padding-inline: 4px 0; }
.shipment-group__heading {
  --mobile-inline-pair-gap: 8px;
  color: var(--mobile-workspace-accent);
}

.shipment-section,
.shipment-cargo { display: grid; min-width: 0; gap: 16px; }
.shipment-count { font-variant-numeric: tabular-nums; }
.shipment-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
.shipment-quantity { grid-column: span 2; }

.shipment-cargo + .shipment-cargo { padding-top: 16px; border-top: 1px solid var(--mobile-workspace-line); }
.shipment-cargo__header { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
.shipment-cargo__label { color: var(--mobile-workspace-muted); font-size: 14px; font-weight: 650; }
.shipment-cargo__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.shipment-add {
  justify-self: start;
  padding-inline: 12px;
  border-radius: var(--tms-control-radius);
  background: var(--tms-primary-soft);
}
.shipment-remove { min-width: 44px; color: var(--tms-red-strong); }

@media (min-width: 420px) {
  .shipment-fields--measurements { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .shipment-quantity { grid-column: auto; }
}

</style>
