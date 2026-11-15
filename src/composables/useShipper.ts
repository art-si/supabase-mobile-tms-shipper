import { computed, ref, shallowRef } from 'vue'
import { demoApi } from '@/api/demo'
import {
  createOrder, deleteItem, fetchDashboard, fetchOrder, fetchOrders, fetchSavedItems, fetchShipperProfile,
  fetchStatement, fetchStatements, fetchStations, fetchUpdates, readUpdate, saveItem
} from '@/api/shipper'
import { userMessage } from '@/api/supabase'
import type { OrderQuery, SavedItemInput, SavedItemKind, ShipmentDraft } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

export function useShipper() {
  const auth = useAuthStore()
  return {
    auth,
    demo: computed(() => auth.demo),
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
    statements: () => auth.demo ? demoApi.statements() : auth.authenticated(fetchStatements),
    statement: (id: string) => auth.demo ? demoApi.statement(id) : auth.authenticated((token) => fetchStatement(token, id)),
    create: (requestId: string, draft: ShipmentDraft) => auth.demo
      ? demoApi.create(requestId, draft)
      : auth.authenticated((token) => createOrder(token, requestId, draft))
  }
}

export function usePageResource<T>(fetch: () => Promise<T>, fallback: string) {
  const data = shallowRef<T | null>(null)
  const busy = ref(false)
  const error = ref('')
  async function load() {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      data.value = await fetch()
    } catch (cause) {
      data.value = null
      error.value = userMessage(cause, fallback)
    } finally {
      busy.value = false
    }
  }
  return { data, busy, error, load }
}
