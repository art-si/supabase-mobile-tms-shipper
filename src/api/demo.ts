import { ApiError } from './supabase'
import type {
  CustomerStatementDetail, Dashboard, OrderBatch, OrderDetail, OrderList, OrderQuery,
  SavedItem, SavedItemInput, SavedItemKind, ShipmentCargo, ShipmentDraft, ShipperProfile, Station
} from './types'
import { orderGroup } from '@/utils/orders'

const profile: ShipperProfile = {
  displayName: '陈经理',
  customerName: '杭州澄远商贸',
  tenantName: '亿企工场物流'
}

const stations = [
  { id: 'hangzhou', name: '杭州临平站' },
  { id: 'ningbo', name: '宁波北仑站' },
  { id: 'suzhou', name: '苏州吴中站' },
  { id: 'shanghai', name: '上海松江站' },
  { id: 'jiaxing', name: '嘉兴南湖站' }
] as const satisfies readonly Station[]

const orders = makeDemoOrders()
const updateReads = new Set<string>()
const saved: Record<SavedItemKind, SavedItem[]> = {
  cargo: [{ id: 'demo-cargo', title: '包装纸箱' }],
  address: [{
    id: 'demo-address', title: '临平发货仓',
    contact: { name: '陈经理', phone: '18000000001', address: '临平区示例产业园 1 号仓' }
  }]
}
let savedSequence = 0
const statement: CustomerStatementDetail = {
  id: 'demo-statement', number: 'DZ-DEMO-001', periodStart: '2026-11-01', periodEnd: '2026-11-15',
  amount: 1280, settled: 800,
  lines: [{ id: 'demo-statement-line', orderNo: orders.find((order) => order.status === 'completed')?.orderNo || null,
    origin: '杭州临平站', destination: '嘉兴南湖站', amount: 1280 }]
}

function makeDemoOrders(): OrderDetail[] {
  const today = new Date()
  const prefix = `YD${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
  const time = (hoursAgo: number) => new Date(today.getTime() - hoursAgo * 3_600_000).toISOString()
  const sender = { name: '陈经理', phone: '18000000001', address: '临平区示例产业园 1 号仓' }
  const receiver = { name: '仓库收货处', phone: '18000000002', address: '示例物流园 2 号卸货口' }

  return [
    { status: 'partially_signed', index: 1, cargoName: '家用收纳箱', destination: stations[1], size: 120, batches: ['signed', 'transporting'] },
    { status: 'transporting', index: 2, cargoName: '展示架配件', destination: stations[2], size: 48, batches: ['transporting'] },
    { status: 'pending_load', index: 3, cargoName: '日用耗材', destination: stations[3], size: 36, batches: [] },
    { status: 'completed', index: 4, cargoName: '办公设备', destination: stations[4], size: 24, batches: ['completed'] },
    { status: 'pending_order', index: 5, cargoName: '包装纸箱', destination: stations[1], size: 80, batches: ['pending'] },
    { status: 'signed', index: 6, cargoName: '五金配件', destination: stations[2], size: 64, batches: ['signed'] },
    { status: 'cancelled', index: 7, cargoName: '清洁用品', destination: stations[4], size: 15, batches: [] }
  ].map((row): OrderDetail => {
    const orderNo = `${prefix}-${String(52 - row.index).padStart(3, '0')}`
    const cargo = { name: row.cargoName, quantity: row.size, weightKg: row.size * 5, volumeM3: row.size / 20 }
    const batches = row.batches.map((status, index): OrderBatch => {
      const signed = status === 'signed' || status === 'completed'
      const quantity = row.size / row.batches.length
      return {
        id: `demo-${row.index}-${index}`, waybillNo: `${orderNo}-0${index + 1}`, status, quantity,
        dispatchedAt: time(row.index * 16 - 1),
        departedAt: status === 'pending' ? null : time(row.index * 16 - 2),
        arrivedAt: signed ? time(row.index * 16 - 4) : null,
        receiptAt: signed ? time(row.index * 16 - 5) : null,
        signedQuantity: signed ? quantity : null,
        exceptionQuantity: signed ? 0 : null,
        sharedWaybill: false,
        receiptPaths: signed ? ['/static/demo/receipt.png'] : []
      }
    })
    return {
      id: `demo-${row.index}`, orderNo, status: row.status as OrderDetail['status'],
      origin: stations[0].name, destination: row.destination.name,
      cargoName: cargo.name, cargoQuantity: cargo.quantity, cargoUnit: '件', cargoWeightKg: cargo.weightKg,
      cargoVolumeM3: cargo.volumeM3, createdAt: time(row.index * 16),
      sender, receiver, cargo: [cargo], remark: '工作时间内送达，卸货前请联系收货处。',
      signedAt: row.status === 'signed' || row.status === 'completed' ? batches[0]?.receiptAt ?? null : null,
      batches
    }
  })
}

function summary(order: OrderDetail) {
  const { id, orderNo, status, origin, destination, cargoName, cargoQuantity, cargoUnit, cargoWeightKg, cargoVolumeM3, createdAt } = order
  return { id, orderNo, status, origin, destination, cargoName, cargoQuantity, cargoUnit, cargoWeightKg, cargoVolumeM3, createdAt }
}

export const demoApi = {
  async profile() { return profile },
  async messages() {
    return orders.map((order) => ({
      id: order.id, orderNo: order.orderNo, status: order.status, isRead: updateReads.has(order.id),
      createdAt: order.batches.reduce((latest, batch) =>
        [batch.dispatchedAt, batch.departedAt, batch.arrivedAt, batch.receiptAt].reduce<string>(
          (current, stamp) => stamp && stamp > current ? stamp : current, latest),
      order.createdAt)
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  async readMessage(id: string) { updateReads.add(id) },
  async savedItems(kind: SavedItemKind) { return [...saved[kind]] },
  async saveItem(kind: SavedItemKind, input: SavedItemInput) {
    const item = { ...input, id: input.id || `demo-item-${++savedSequence}` }
    saved[kind] = [item, ...saved[kind].filter(({ id }) => id !== item.id)]
    return item
  },
  async deleteItem(kind: SavedItemKind, id: string) {
    saved[kind] = saved[kind].filter((item) => item.id !== id)
    return true
  },
  async statements() {
    const { lines, ...row } = statement
    return [row]
  },
  async statement(id: string) {
    if (id !== statement.id) throw new ApiError(404, 'SHIPPER_RECORD_NOT_FOUND')
    return statement
  },
  async dashboard(): Promise<Dashboard> {
    const counts = { pending: 0, in_progress: 0, signed: 0, cancelled: 0 }
    for (const order of orders) counts[orderGroup(order.status)]++
    return { profile, counts, recent: orders.slice(0, 3).map(summary) }
  },
  async list({ filter, keyword, cursor }: OrderQuery): Promise<OrderList> {
    const search = keyword.toLowerCase()
    const matches = orders.filter((order) =>
      (filter === 'all' || orderGroup(order.status) === filter) &&
      [order.orderNo, order.origin, order.destination, ...order.cargo.map((cargo) => cargo.name)]
        .some((value) => value.toLowerCase().includes(search))
    )
    const offset = cursor ? matches.findIndex(({ id }) => id === cursor.id) + 1 : 0
    const items = matches.slice(offset, offset + 20).map(summary)
    const last = items[items.length - 1]
    return { items, nextCursor: last && matches.length > offset + 20 ? { id: last.id, createdAt: last.createdAt } : null }
  },
  async detail(id: string) {
    const order = orders.find((item) => item.id === id)
    if (!order) throw new ApiError(404, 'SHIPPER_ORDER_NOT_FOUND')
    return order
  },
  async stations() { return [...stations] },
  async create(requestId: string, draft: ShipmentDraft) {
    const id = `demo-new-${requestId}`
    const saved = orders.find((item) => item.id === id)
    if (saved) return { id, orderNo: saved.orderNo }
    const origin = stations.find((station) => station.id === draft.originStationId)
    const destination = stations.find((station) => station.id === draft.destinationStationId)
    const first = draft.cargo[0]
    if (!origin || !destination || !first) throw new ApiError(400, 'SHIPPER_ORDER_INPUT')
    const sum = (key: 'quantity' | 'weightKg' | 'volumeM3') =>
      draft.cargo.reduce((total, cargo: ShipmentCargo) => total + cargo[key], 0)
    const orderNo = `YD-DEMO-${String(orders.length - 6).padStart(3, '0')}`
    orders.unshift({
      id, orderNo, status: 'pending_load', origin: origin.name, destination: destination.name,
      cargoName: first.name, cargoQuantity: sum('quantity'), cargoUnit: '件', cargoWeightKg: sum('weightKg'),
      cargoVolumeM3: sum('volumeM3'), createdAt: new Date().toISOString(), sender: draft.sender,
      receiver: draft.receiver, cargo: draft.cargo, remark: draft.remark, batches: [], signedAt: null
    })
    return { id, orderNo }
  }
}
