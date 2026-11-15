import type { OrderFilter, OrderGroup, OrderStatus, ShipmentContact } from '@/api/types'

export const ORDER_FILTERS: Array<{ value: OrderFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待发运' },
  { value: 'in_progress', label: '履约中' },
  { value: 'signed', label: '已签收' },
  { value: 'cancelled', label: '已取消' }
]

const ORDER_STATUS: Record<OrderStatus, { label: string; group: OrderGroup }> = {
  created: { label: '已提交', group: 'pending' },
  pending_load: { label: '待配载', group: 'pending' },
  partially_dispatched: { label: '部分配载', group: 'pending' },
  pending_order: { label: '待接单', group: 'pending' },
  pending_pickup: { label: '待提货', group: 'pending' },
  transporting: { label: '运输中', group: 'in_progress' },
  partially_signed: { label: '部分签收', group: 'in_progress' },
  signed: { label: '已签收', group: 'signed' },
  completed: { label: '已完成', group: 'signed' },
  cancelled: { label: '已取消', group: 'cancelled' }
}

const BATCH_LABELS: Record<string, string> = {
  pending: '待接单',
  accepted: '待提货',
  loading: '装货中',
  transporting: '运输中',
  unloading: '待签收',
  signed: '已签收',
  completed: '已完成',
  cancelled: '已取消'
}

const GROUP_TONES: Record<OrderGroup, string> = {
  pending: 'orange',
  in_progress: 'blue',
  signed: 'green',
  cancelled: 'gray'
}

export function orderGroup(status: OrderStatus): OrderGroup {
  return ORDER_STATUS[status]?.group ?? 'pending'
}

export function statusAppearance(status: string, batch: boolean) {
  if (!batch) {
    const order = ORDER_STATUS[status as OrderStatus]
    return order ? { label: order.label, tone: GROUP_TONES[order.group] } : { label: '待同步', tone: 'gray' }
  }
  if (status === 'signed' || status === 'completed') return { label: BATCH_LABELS[status], tone: 'green' }
  if (status === 'cancelled') return { label: BATCH_LABELS[status], tone: 'gray' }
  if (status === 'pending' || status === 'accepted') return { label: BATCH_LABELS[status], tone: 'orange' }
  return { label: BATCH_LABELS[status] || '待同步', tone: 'blue' }
}

export function formatTime(value: string | null, includeYear = false) {
  if (!value) return '—'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '—'
  const chinaTime = new Date(timestamp + 8 * 60 * 60 * 1000).toISOString()
  return chinaTime.slice(includeYear ? 0 : 5, 16).replace('T', ' ')
}

export function openOrder(id: string) {
  uni.navigateTo({ url: `/pages/order/detail?id=${encodeURIComponent(id)}` })
}

export function openOrders(filter: OrderFilter = 'all') {
  uni.reLaunch({ url: `/pages/order/index?filter=${filter}` })
}

export function openShipmentForm() {
  uni.navigateTo({ url: '/pages/order/create' })
}

export function normalizeContact(contact: ShipmentContact): ShipmentContact {
  return { name: contact.name.trim(), phone: contact.phone.trim(), address: contact.address.trim() }
}

export function isContactPhone(value: string) {
  return /^\+?[0-9][0-9() \-]{4,22}[0-9]$/.test(value)
}
