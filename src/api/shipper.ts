import { request } from './supabase'
import type {
  CustomerStatement, CustomerStatementDetail, Dashboard, OrderCreated, OrderDetail, OrderList, OrderQuery,
  OrderUpdate, SavedItem, SavedItemInput, SavedItemKind, ShipmentDraft, ShipperProfile, Station
} from './types'

export const fetchShipperProfile = (token: string) => shipperRequest<ShipperProfile>(token, 'profile')
export const fetchDashboard = (token: string) => shipperRequest<Dashboard>(token, 'dashboard')
export const fetchOrders = (token: string, query: OrderQuery) => shipperRequest<OrderList>(token, 'list', query)
export const fetchOrder = (token: string, id: string) => shipperRequest<OrderDetail>(token, 'detail', { id })
export const fetchStations = (token: string) => shipperRequest<Station[]>(token, 'stations')
export const createOrder = (token: string, requestId: string, draft: ShipmentDraft) =>
  shipperRequest<OrderCreated>(token, 'create', { requestId, ...draft })
export const fetchUpdates = (token: string) => shipperRequest<OrderUpdate[]>(token, 'messages')
export const readUpdate = (token: string, id: string, createdAt: string) =>
  shipperRequest<boolean>(token, 'read_message', { id, createdAt })
export const fetchSavedItems = (token: string, kind: SavedItemKind) =>
  shipperRequest<SavedItem[]>(token, 'saved_items', { kind })
export const saveItem = (token: string, kind: SavedItemKind, input: SavedItemInput) =>
  shipperRequest<SavedItem>(token, 'save_item', { kind, ...input })
export const deleteItem = (token: string, kind: SavedItemKind, id: string) =>
  shipperRequest<boolean>(token, 'delete_item', { kind, id })
export const fetchStatements = (token: string) => shipperRequest<CustomerStatement[]>(token, 'statements')
export const fetchStatement = (token: string, id: string) =>
  shipperRequest<CustomerStatementDetail>(token, 'statement_detail', { id })

function shipperRequest<T>(token: string, action: string, params: object = {}) {
  return request<T>('/functions/v1/tms-shipper', { action, params }, token)
}
