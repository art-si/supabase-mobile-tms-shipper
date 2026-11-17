<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, nextTick, reactive, ref } from 'vue'
import { onBackPress, onLoad, onShow } from '@dcloudio/uni-app'
import type { SavedItem, SavedItemKind, ShipmentContact } from '@/api/types'
import { userMessage } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { isContactPhone, normalizeContact } from '@/utils/orders'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileConfirmDialog from '@mobile-core/components/MobileConfirmDialog.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileField from '@mobile-core/components/MobileField.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import { revealControl } from '@mobile-core/form-focus'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { watchMobilePageQuery } from '@mobile-core/watchMobilePageQuery'

const { themeName } = usePageTheme()
const { auth, demo, savedItems, saveItem, deleteItem } = useShipper()
const kind = ref<SavedItemKind>('cargo')
const title = computed(() => kind.value === 'cargo' ? '常用货物' : '地址')
const isAddress = computed(() => kind.value === 'address')
const { data, busy, error, load, reset } = usePageResource(
  () => savedItems(kind.value), '资料加载失败，请重新加载。'
)
const editing = ref(false)
const id = ref('')
const itemTitle = ref('')
const contact = reactive<ShipmentContact>({ name: '', phone: '', address: '' })
const errors = ref<Record<string, string>>({})
const focused = ref('')
const saving = ref(false)
const editorError = ref('')
const deleteError = ref<{ id: string; message: string }>()
const discardOpen = ref(false)
const deleteOpen = ref(false)
const pendingDelete = ref<SavedItem>()
const addControlId = 'saved-add'
const editControlId = (id: string) => `saved-edit-${id}`
const retryControlId = (id: string) => `saved-retry-${id}`
let editorBaseline = ''
let discardedEditorOpener = ''
let deleteReturnControl = ''
let contextVersion = 0

function readQuery(query?: Record<string, unknown>) {
  const next = query?.kind === 'address' ? 'address' : 'cargo'
  if (kind.value === next) return false
  contextVersion++
  kind.value = next
  editing.value = false
  saving.value = false
  discardOpen.value = false
  discardedEditorOpener = ''
  deleteOpen.value = false
  pendingDelete.value = undefined
  deleteReturnControl = ''
  editorError.value = ''
  deleteError.value = undefined
  reset()
  return true
}

onLoad(readQuery)
watchMobilePageQuery('/pages/mine/saved', (query) => {
  if (readQuery(query)) refresh()
})
onShow(refresh)
function refresh() {
  if (auth.guard() && !auth.staff) void load()
}
function start(item?: SavedItem) {
  if (saving.value) return
  id.value = item?.id || ''
  itemTitle.value = item?.title || ''
  Object.assign(contact, item?.contact || { name: '', phone: '', address: '' })
  errors.value = {}
  focused.value = ''
  editorError.value = ''
  editorBaseline = editorSnapshot()
  editing.value = true
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}

function editorSnapshot() {
  return JSON.stringify([itemTitle.value.trim(), isAddress.value ? normalizeContact(contact) : null])
}

function editorOpener() { return id.value ? editControlId(id.value) : addControlId }

function resetEditor() {
  editing.value = false
  editorError.value = ''
}

function closeEditor(returnId = editorOpener()) {
  resetEditor()
  void revealControl(returnId)
}

function discardEditor() {
  discardedEditorOpener = editorOpener()
  resetEditor()
}

function restoreDiscardFocus() {
  const target = discardedEditorOpener
  discardedEditorOpener = ''
  if (target && !editing.value) void revealControl(target)
}

function cancelEditing() {
  if (saving.value || discardOpen.value) return
  if (editorSnapshot() !== editorBaseline) discardOpen.value = true
  else closeEditor()
}

async function confirmBack() {
  if (saving.value || discardOpen.value || deleteOpen.value) return false
  if (!editing.value) return true
  cancelEditing()
  return false
}

// #ifdef H5
onBackPress(() => {
  if (saving.value) return true
  if (discardOpen.value) {
    discardOpen.value = false
    return true
  }
  if (deleteOpen.value) {
    deleteOpen.value = false
    return true
  }
  if (!editing.value) return false
  cancelEditing()
  return true
})
// #endif

async function save() {
  if (saving.value) return
  const titleValue = itemTitle.value.trim()
  const normalized = normalizeContact(contact)
  const next: Record<string, string> = {}
  if (!titleValue) next.title = isAddress.value ? '请输入地址名称。' : '请输入货物名称。'
  if (isAddress.value) {
    if (!normalized.name) next.name = '请输入联系人。'
    if (!isContactPhone(normalized.phone)) next.phone = '请输入有效联系电话。'
    if (!normalized.address) next.address = '请输入详细地址。'
  }
  errors.value = next
  const firstError = Object.keys(next)[0]
  if (firstError) {
    focused.value = ''
    await nextTick()
    focused.value = firstError
    await revealControl(`saved-${firstError}`)
    return
  }
  saving.value = true
  editorError.value = ''
  const version = contextVersion
  try {
    const item = await saveItem(kind.value, {
      id: id.value || undefined, title: titleValue, contact: isAddress.value ? normalized : null
    })
    if (version === contextVersion) {
      data.value = [item, ...(data.value || []).filter((row) => row.id !== item.id)]
      closeEditor(editControlId(item.id))
    }
  } catch (cause) {
    if (version === contextVersion) editorError.value = userMessage(cause, '保存失败，已保留填写内容。请重试。')
  } finally {
    if (version === contextVersion) saving.value = false
  }
}

function requestDelete(item: SavedItem) {
  if (saving.value) return
  deleteReturnControl = ''
  pendingDelete.value = item
  deleteOpen.value = true
}

async function remove() {
  const item = pendingDelete.value
  if (!item || saving.value) return
  saving.value = true
  deleteError.value = undefined
  const version = contextVersion
  try {
    await deleteItem(kind.value, item.id)
    if (version !== contextVersion) return
    data.value = (data.value || []).filter((row) => row.id !== item.id)
    deleteReturnControl = addControlId
  } catch (cause) {
    if (version === contextVersion) {
      deleteError.value = { id: item.id, message: userMessage(cause, '删除失败，资料仍保留。') }
      deleteReturnControl = retryControlId(item.id)
    }
  } finally {
    if (version === contextVersion) {
      saving.value = false
      deleteOpen.value = false
    }
  }
}

function restoreDeleteFocus() {
  if (deleteOpen.value) return
  pendingDelete.value = undefined
  const target = deleteReturnControl
  deleteReturnControl = ''
  if (target) void revealControl(target)
}
</script>

<template>
  <MobileWorkspace :container-class="['page shipper-page', themeName]">
    <MobileTopBar capsule="always" :title="title" :eyebrow="demo ? '演示模式' : undefined" show-back back-fallback="/pages/mine/index" :confirm-back="confirmBack" />
    <view class="shipper-content" role="main">
      <text v-if="auth.staff" class="shipper-copy">请从「我的」打开所属业务工作台。</text>
      <template v-else>
        <view v-if="editing" class="card shipper-card shipper-stack">
          <view class="shipper-heading">
            <text class="section-title">{{ id ? '编辑' : '新增' }}{{ isAddress ? '地址' : '货物' }}</text>
            <MobileAction class="shipper-inline" :disabled="saving" @click="cancelEditing">取消</MobileAction>
          </view>
          <MobileField
            v-model="itemTitle" field="saved-title" :label="isAddress ? '地址名称' : '货物名称'"
            :placeholder="isAddress ? '例如临平发货仓…' : '例如包装纸箱…'"
            :disabled="saving" :error="errors.title" :focus="focused === 'title'" required
          />
          <template v-if="isAddress">
            <MobileField
              v-model="contact.name" field="saved-name" label="联系人" placeholder="姓名…" :maxlength="60"
              :disabled="saving" :error="errors.name" :focus="focused === 'name'" required
            />
            <MobileField
              v-model="contact.phone" field="saved-phone" label="联系电话" inputmode="tel" placeholder="手机或座机…"
              :maxlength="24" :disabled="saving" :error="errors.phone" :focus="focused === 'phone'" required
            />
            <MobileField
              v-model="contact.address" field="saved-address" label="详细地址" placeholder="省市区、街道及门牌…"
              :maxlength="240" :disabled="saving" :error="errors.address" :focus="focused === 'address'" multiline required
            />
          </template>
          <text v-if="editorError" class="shipper-error" role="alert">{{ editorError }}</text>
          <MobileAction class="tms-primary-action" :aria-busy="saving" :disabled="saving" @click="save">
            {{ saving ? '正在保存…' : '保存' }}
          </MobileAction>
        </view>
        <TmsPageSkeleton v-else-if="busy || error" label="正在加载资料…" :error="error" @retry="refresh" />
        <template v-else>
          <view class="mobile-group">
            <MobileAction :id="addControlId" class="mobile-row saved-add" :disabled="saving" @click="start()">
              <view class="mobile-row__icon"><MobileIcon name="add" size="18px" /></view>
              <text>{{ isAddress ? '新增地址' : '新增货物' }}</text>
            </MobileAction>
            <view v-for="item in data" :key="item.id" class="mobile-row mobile-row--static saved-item">
              <MobileAction :id="editControlId(item.id)" class="saved-entry" :disabled="saving" :aria-label="`编辑 ${item.title}`" @click="start(item)">
                <view class="mobile-row__icon"><MobileIcon :name="isAddress ? 'location' : 'box'" size="17px" /></view>
                <view class="mobile-row__body">
                  <text class="mobile-row__label">{{ item.title }}</text>
                  <template v-if="item.contact">
                    <text class="mobile-row__detail">{{ item.contact.name }} · {{ item.contact.phone }}</text>
                    <text class="mobile-row__detail">{{ item.contact.address }}</text>
                  </template>
                </view>
                <MobileIcon class="mobile-row__chevron" name="chevron" size="13px" />
              </MobileAction>
              <MobileAction class="saved-delete" :disabled="saving" :aria-label="`删除 ${item.title}`" @click="requestDelete(item)">删除</MobileAction>
              <view v-if="deleteError?.id === item.id" class="saved-delete-error">
                <text class="shipper-error saved-delete-error__message" role="alert">{{ deleteError.message }}</text>
                <MobileAction
                  :id="retryControlId(item.id)" class="shipper-inline saved-delete-error__retry" :disabled="saving"
                  :aria-label="`重试删除 ${item.title}`" @click="requestDelete(item)"
                >重试删除</MobileAction>
              </view>
            </view>
          </view>
          <MobileEmptyState
            v-if="!data?.length" class="shipper-card" :icon="isAddress ? 'location' : 'box'" :title="`暂无${title}`"
            description="保存后可在发货时快速选用。"
          />
        </template>
      </template>
    </view>
    <MobileConfirmDialog
      v-model="deleteOpen" :title="isAddress ? '删除常用地址' : '删除常用货物'"
      :confirm-text="saving ? '正在删除…' : '删除'" :busy="saving" keep-open-on-confirm
      :message="pendingDelete ? `确认删除「${pendingDelete.title}」？` : undefined"
      @confirm="remove" @after-close="restoreDeleteFocus"
    />
    <MobileConfirmDialog
      v-model="discardOpen" title="放弃未保存的修改？" message="本次填写的内容不会保存。"
      cancel-text="继续编辑" confirm-text="放弃修改" @confirm="discardEditor" @after-close="restoreDiscardFocus"
    />
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.mobile-row.saved-add {
  color: var(--mobile-workspace-accent);
  font-size: 15px;
  font-weight: 650;
}
.mobile-row.saved-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  padding-block: 4px;
}
.saved-entry {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding-block: 8px;
}
.saved-delete {
  display: grid;
  min-width: 44px;
  min-height: 44px;
  place-items: center;
  border-radius: 8px;
  color: var(--tms-red-strong);
  font-size: 13px;
}
.saved-delete-error {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  padding: 2px 8px 2px 10px;
  border-radius: 10px;
  background: var(--tms-red-soft);
}
.saved-delete-error__message { flex: 1 1 120px; min-width: 0; overflow-wrap: anywhere; }
.saved-delete-error__retry { padding-inline: 8px; }
</style>
