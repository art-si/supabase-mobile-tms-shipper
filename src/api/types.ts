export interface Session {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in: number
  user: { id: string; email?: string }
}

export type OrderStatus =
  | 'created'
  | 'pending_load'
  | 'partially_dispatched'
  | 'pending_order'
  | 'pending_pickup'
  | 'transporting'
  | 'partially_signed'
  | 'signed'
  | 'completed'
  | 'cancelled'

export type OrderGroup = 'pending' | 'in_progress' | 'signed' | 'cancelled'
export type OrderFilter = 'all' | OrderGroup

export interface ShipperProfile {
  displayName: string
  customerName: string
  tenantName: string
}

export interface Station {
  id: string
  name: string
}

export interface ShipmentContact {
  name: string
  phone: string
  address: string
}

export interface ShipmentCargo {
  name: string
  quantity: number
  weightKg: number
  volumeM3: number
  unit?: string
}

export interface ShipmentDraft {
  originStationId: string
  destinationStationId: string
  sender: ShipmentContact
  receiver: ShipmentContact
  cargo: ShipmentCargo[]
  remark: string
}

export interface OrderSummary {
  id: string
  orderNo: string
  status: OrderStatus
  origin: string
  destination: string
  cargoName: string
  cargoQuantity: number
  cargoUnit?: string | null
  cargoWeightKg: number
  cargoVolumeM3: number
  createdAt: string
}

export interface OrderBatch {
  id: string
  waybillNo: string
  status: string
  quantity: number
  dispatchedAt: string
  departedAt: string | null
  arrivedAt: string | null
  receiptAt: string | null
  signedQuantity: number | null
  exceptionQuantity: number | null
  sharedWaybill: boolean
  receiptPaths: string[]
}

export interface OrderDetail extends OrderSummary {
  sender: ShipmentContact
  receiver: ShipmentContact
  remark: string | null
  signedAt: string | null
  cargo: ShipmentCargo[]
  batches: OrderBatch[]
}

export interface Dashboard {
  profile: ShipperProfile
  counts: Record<OrderGroup, number>
  recent: OrderSummary[]
}

export interface OrderCursor {
  createdAt: string
  id: string
}

export interface OrderList {
  items: OrderSummary[]
  nextCursor: OrderCursor | null
}

export interface OrderQuery {
  filter: OrderFilter
  keyword: string
  cursor: OrderCursor | null
}

export interface OrderCreated {
  id: string
  orderNo: string
}

export type SavedItemKind = 'cargo' | 'address'

export interface SavedItemInput {
  id?: string
  title: string
  contact?: ShipmentContact | null
}

export interface SavedItem extends SavedItemInput {
  id: string
}

export interface OrderUpdate {
  id: string
  orderNo: string
  status: OrderStatus
  createdAt: string
  isRead: boolean
}

export interface CustomerStatement {
  id: string
  number: string
  periodStart: string
  periodEnd: string
  amount: number
  settled: number
}

export interface CustomerStatementDetail extends CustomerStatement {
  lines: Array<{ id: string; orderNo: string | null; origin: string | null; destination: string | null; amount: number }>
}
