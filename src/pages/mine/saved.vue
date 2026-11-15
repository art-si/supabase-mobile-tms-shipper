<script setup lang="ts">
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import type { SavedItem, SavedItemKind, ShipmentContact } from '@/api/types'
import { userMessage } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { usePageResource, useShipper } from '@/composables/useShipper'
import { isContactPhone, normalizeContact } from '@/utils/orders'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileField from '@mobile-core/components/MobileField.vue'
import TmsIcon from '@/components/business/TmsIcon.vue'
import TmsPageSkeleton from '@mobile-core/components/TmsPageSkeleton.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { MOBILE_DANGER_COLOR } from '@mobile-core/theme'

const { themeName } = usePageTheme()
const { auth, demo, savedItems, saveItem, deleteItem } = useShipper()
const kind = ref<SavedItemKind>('cargo')
const title = computed(() => kind.value === 'cargo' ? '常用货物' : '地址')
const isAddress = computed(() => kind.value === 'address')
const { data, busy, error, load } = usePageResource(
  () => savedItems(kind.value), '资料加载失败，请重新加载。'
)
const editing = ref(false)
const id = ref('')
const itemTitle = ref('')
const contact = reactive<ShipmentContact>({ name: '', phone: '', address: '' })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const actionError = ref('')

onLoad((query) => { if (query?.kind === 'address') kind.value = 'address' })
onShow(refresh)
function refresh() {
  if (auth.guard() && !auth.staff) void load()
}
function start(item?: SavedItem) {
  id.value = item?.id || ''
  itemTitle.value = item?.title || ''
  Object.assign(contact, item?.contact || { name: '', phone: '', address: '' })
  errors.value = {}
  actionError.value = ''
  editing.value = true
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}

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
  if (Object.keys(next).length) return
  saving.value = true
  actionError.value = ''
  try {
    const item = await saveItem(kind.value, {
      id: id.value || undefined, title: titleValue, contact: isAddress.value ? normalized : null
    })
    data.value = [item, ...(data.value || []).filter((row) => row.id !== item.id)]
    editing.value = false
  } catch (cause) {
    actionError.value = userMessage(cause, '保存失败，请稍后重试。')
  } finally {
    saving.value = false
  }
}

function remove(item: SavedItem) {
  if (saving.value) return
  uni.showModal({
    title: '删除常用资料',
    content: `确认删除「${item.title}」？`,
    confirmText: '删除',
    confirmColor: MOBILE_DANGER_COLOR,
    success: async ({ confirm }) => {
      if (!confirm || saving.value) return
      saving.value = true
      actionError.value = ''
      try {
        await deleteItem(kind.value, item.id)
        data.value = (data.value || []).filter((row) => row.id !== item.id)
      } catch (cause) {
        actionError.value = userMessage(cause, '删除失败，请稍后重试。')
      } finally {
        saving.value = false
      }
    }
  })
}
</script>

<template>
  <MobileWorkspace class="page shipper-page" :class="themeName">
    <MobileTopBar capsule="always" :title="title" :eyebrow="demo ? '演示模式' : undefined" show-back />
    <view class="shipper-content" role="main">
      <text v-if="auth.staff" class="shipper-copy">请从「我的」打开所属业务工作台。</text>
      <template v-else>
        <view v-if="editing" class="card shipper-card shipper-stack">
          <view class="shipper-heading">
            <text class="section-title">{{ id ? '编辑' : '新增' }}{{ isAddress ? '地址' : '货物' }}</text>
            <MobileAction class="shipper-inline" :disabled="saving" @click="editing = false">取消</MobileAction>
          </view>
          <MobileField
            v-model="itemTitle" field="saved-title" :label="isAddress ? '地址名称' : '货物名称'"
            :placeholder="isAddress ? '例如临平发货仓…' : '例如包装纸箱…'"
            :disabled="saving" :error="errors.title" required
          />
          <template v-if="isAddress">
            <MobileField v-model="contact.name" field="saved-name" label="联系人" placeholder="姓名…" :maxlength="60" :disabled="saving" :error="errors.name" required />
            <MobileField v-model="contact.phone" field="saved-phone" label="联系电话" inputmode="tel" placeholder="手机或座机…" :maxlength="24" :disabled="saving" :error="errors.phone" required />
            <MobileField v-model="contact.address" field="saved-address" label="详细地址" placeholder="省市区、街道及门牌…" :maxlength="240" :disabled="saving" :error="errors.address" required />
          </template>
          <text v-if="actionError" class="shipper-error" role="alert">{{ actionError }}</text>
          <MobileAction class="tms-primary-action" :aria-busy="saving" :disabled="saving" @click="save">
            {{ saving ? '正在保存…' : '保存' }}
          </MobileAction>
        </view>
        <TmsPageSkeleton v-else-if="busy || error" label="正在加载资料…" :error="error" @retry="refresh" />
        <template v-else>
          <text v-if="actionError" class="shipper-error" role="alert">{{ actionError }}</text>
          <view class="mobile-group">
            <MobileAction class="mobile-row saved-add" :disabled="saving" @click="start()">
              <view class="mobile-row__icon"><TmsIcon name="add" size="18px" /></view>
              <text>{{ isAddress ? '新增地址' : '新增货物' }}</text>
            </MobileAction>
            <view v-for="item in data" :key="item.id" class="mobile-row mobile-row--static saved-item">
              <MobileAction class="saved-entry" :disabled="saving" :aria-label="`编辑 ${item.title}`" @click="start(item)">
                <view class="mobile-row__icon"><TmsIcon :name="isAddress ? 'location' : 'box'" size="17px" /></view>
                <view class="mobile-row__body">
                  <text class="mobile-row__label">{{ item.title }}</text>
                  <template v-if="item.contact">
                    <text class="mobile-row__detail">{{ item.contact.name }} · {{ item.contact.phone }}</text>
                    <text class="mobile-row__detail">{{ item.contact.address }}</text>
                  </template>
                </view>
                <TmsIcon class="mobile-row__chevron" name="chevron" size="13px" />
              </MobileAction>
              <MobileAction class="saved-delete" :disabled="saving" :aria-label="`删除 ${item.title}`" @click="remove(item)">删除</MobileAction>
            </view>
          </view>
          <view v-if="!data?.length" class="shipper-empty">
            <view class="shipper-empty__icon"><TmsIcon :name="isAddress ? 'location' : 'box'" size="44rpx" /></view>
            <text class="section-title">暂无{{ title }}</text>
            <text class="shipper-copy">保存后可在发货时快速选用。</text>
          </view>
        </template>
      </template>
    </view>
  </MobileWorkspace>
</template>

<style scoped lang="scss">
.mobile-row.saved-add {
  color: var(--mobile-workspace-accent);
  font-size: 15px;
  font-weight: 650;
}
.saved-item { gap: 8px; padding-block: 4px; }
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
</style>
