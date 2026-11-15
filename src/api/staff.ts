import { request } from './supabase'

interface PermissionRow { name: string; type?: string }
const applications = ['tms', 'fms', 'vms']

function rpc<T>(token: string, fn: string, params: object = {}) {
  return request<T>(`/rest/v1/rpc/${fn}`, params, token)
}

export async function fetchStaffMenus(token: string) {
  const result = await rpc<Record<string, PermissionRow[]>>(token, 'get_menus_for_current_applications', {
    p_app_codes: applications
  })
  return applications.flatMap((app) => (result[app] || []).filter((row) => row.type !== 'button').map((row) => row.name))
}

export async function fetchStaffButtons(token: string) {
  const result = await rpc<PermissionRow[]>(token, 'get_current_user_button_permissions')
  return result.map((row) => row.name)
}

export type WorkbenchMode = 'pending' | 'loaded'

export interface WorkbenchRow {
  id: string
  order_no?: string
  waybill_no?: string
  order_status?: string
  waybill_status?: string
  status?: string
  origin_station?: string
  destination_station?: string
  origin_city?: string
  destination_city?: string
  execution_kind?: 'single' | 'merge' | 'split'
  cargo_name?: string
  cargo_items?: Array<{ cargo_name?: string }>
}

export const fetchWorkbench = (token: string, mode: WorkbenchMode, from = 0) =>
  rpc<{ records: WorkbenchRow[]; total: number }>(token, 'tms_list_dispatch_workbench_secure', {
    p_mode: mode, p_from: from, p_to: from + 19, p_count_only: false, p_filters: {}
  })

export interface StaffMessage {
  id: string
  title: string
  content?: string | null
  category: 'notice' | 'message' | 'todo'
  isRead: boolean
  createdAt: string
  routePath?: string | null
  routeQuery?: Record<string, string | number | boolean | null>
}

export async function fetchStaffMessages(token: string) {
  const result = await rpc<{ notices: StaffMessage[]; messages: StaffMessage[]; todos: StaffMessage[] }>(
    token, 'get_header_notification_center', { p_limit: 30 }
  )
  return [...(result.notices || []), ...(result.messages || []), ...(result.todos || [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export const readStaffMessage = (token: string, message: StaffMessage) =>
  rpc<number>(token, 'mark_header_notifications_read', {
    p_category: message.category, p_notification_ids: [message.id]
  })

export interface ReconciliationDriver {
  id: string
  driver_name: string
}

export const fetchReconciliationDrivers = (token: string, keyword: string, from = 0) =>
  rpc<{ records: ReconciliationDriver[]; total: number }>(token, 'tms_list_drivers_secure', {
    p_from: from, p_to: from + 19, p_keyword: keyword || null, p_purpose: 'list'
  })

export type DriverLedgerKind = 'waybill' | 'loan' | 'repayment' | 'reimbursement'

export interface DriverLedgerRow {
  id: string
  number: string | null
  occurredOn: string | null
  amount: number | string | null
  note: string | null
  waybillNo?: string | null
}

export async function fetchDriverLedger(token: string, driverId: string, kind: DriverLedgerKind, from = 0) {
  const page = { p_driver_id: driverId, p_from: from, p_to: from + 19 }
  if (kind === 'waybill') {
    const { records, total } = await rpc<{ records: Array<{
      id: string; cost_no: string | null; occurred_on: string | null; amount: number | string | null
      expense_item?: { item_name?: string }; waybill_no_snapshot?: string | null
    }>; total: number }>(token, 'tms_list_mainline_costs_secure', { ...page, p_vehicle_id: null })
    return { total, records: records.map((row): DriverLedgerRow => ({
      id: row.id, number: row.cost_no, occurredOn: row.occurred_on, amount: row.amount,
      note: row.expense_item?.item_name ?? null, waybillNo: row.waybill_no_snapshot
    })) }
  }
  const { records, total } = await rpc<{ records: Array<{
    id: string; no: string | null; occurredOn: string | null; amount: number | string | null; reason: string | null
  }>; total: number }>(token, 'tms_list_driver_finance_records_secure', { ...page, p_kind: kind })
  return { total, records: records.map((row): DriverLedgerRow => ({
    id: row.id, number: row.no, occurredOn: row.occurredOn, amount: row.amount, note: row.reason
  })) }
}
