import { computed, onScopeDispose, readonly, ref, shallowRef } from 'vue'
import { createLatestRequest } from '@mobile-core/latest-request'
import { demoApi } from '@/api/demo'
import {
  createOrder, deleteItem, fetchDashboard, fetchOrder, fetchOrders, fetchSavedItems, fetchShipperProfile,
  fetchStatement, fetchStatementsPage, fetchStations, fetchUpdates, readUpdate, saveItem
} from '@/api/shipper'
import { userMessage } from '@/api/supabase'
import type { CustomerStatementCursor, OrderCreated, OrderQuery, SavedItemInput, SavedItemKind, ShipmentDraft } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

const shipmentRevision = ref(0)
const lastShipment = shallowRef<{ owner: string; receipt: OrderCreated }>()

export function useShipper() {
  const auth = useAuthStore()
  const shipmentOwner = computed(() => auth.demo ? 'demo' : auth.session?.user?.id)
  return {
    auth,
    demo: computed(() => auth.demo),
    shipmentOwner,
    shipmentRevision: readonly(shipmentRevision),
    shipmentReceipt: (id: string) => {
      const recent = lastShipment.value
      return recent?.receipt.id === id && recent.owner === shipmentOwner.value ? recent.receipt : undefined
    },
    profile: () => auth.demo ? demoApi.profile() : auth.authenticated(fetchShipperProfile),
    dashboard: () => auth.demo ? demoApi.dashboard() : auth.authenticated(fetchDashboard),
    list: (query: OrderQuery) => auth.demo ? demoApi.list(query) : auth.authenticated((token) => fetchOrders(token, query)),
    detail: (id: string) => auth.demo ? demoApi.detail(id) : auth.authenticated((token) => fetchOrder(token, id)),
    stations: () => auth.demo ? demoApi.stations() : auth.authenticated(fetchStations),
    messages: () => auth.demo ? demoApi.messages() : auth.authenticated(fetchUpdates),
    readMessage: (id: string, createdAt: string) => auth.demo
      ? demoApi.readMessage(id) : auth.authenticated((token) => readUpdate(token, id, createdAt)),
    savedItems: (kind: SavedItemKind) => auth.demo
      ? demoApi.savedItems(kind) : auth.authenticated((token) => fetchSavedItems(token, kind)),
    saveItem: (kind: SavedItemKind, input: SavedItemInput) => auth.demo
      ? demoApi.saveItem(kind, input) : auth.authenticated((token) => saveItem(token, kind, input)),
    deleteItem: (kind: SavedItemKind, id: string) => auth.demo
      ? demoApi.deleteItem(kind, id) : auth.authenticated((token) => deleteItem(token, kind, id)),
    statementsPage: (cursor: CustomerStatementCursor | null) => auth.demo
      ? demoApi.statementsPage(cursor) : auth.authenticated((token) => fetchStatementsPage(token, cursor)),
    statement: (id: string) => auth.demo ? demoApi.statement(id) : auth.authenticated((token) => fetchStatement(token, id)),
    create: async (requestId: string, draft: ShipmentDraft) => {
      const owner = shipmentOwner.value
      const result = auth.demo
        ? await demoApi.create(requestId, draft)
        : await auth.authenticated((token) => createOrder(token, requestId, draft))
      if (owner && owner === shipmentOwner.value) lastShipment.value = { owner, receipt: result }
      shipmentRevision.value++
      return result
    }
  }
}

export function usePageResource<T>(fetch: () => Promise<T>, fallback: string) {
  const data = shallowRef<T | null>(null)
  const busy = ref(false)
  const error = ref('')
  const requests = createLatestRequest()
  onScopeDispose(requests.invalidate)
  function reset() {
    requests.invalidate()
    data.value = null
    busy.value = false
    error.value = ''
  }
  async function load() {
    if (busy.value) return
    const isCurrent = requests.start()
    busy.value = true
    error.value = ''
    try {
      const result = await fetch()
      if (isCurrent()) data.value = result
    } catch (cause) {
      if (isCurrent()) {
        data.value = null
        error.value = userMessage(cause, fallback)
      }
    } finally {
      if (isCurrent()) busy.value = false
    }
  }
  return { data, busy, error, load, reset }
}
