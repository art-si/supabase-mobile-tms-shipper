import type { TmsIconName } from '@/components/business/icon-glyphs'

interface WorkspaceEntry {
  title: string
  icon: TmsIconName
  path: string
  menu: string
  permission?: string
  instruction?: string
}

const pending = { path: '/tms/waybill-management/pending', menu: 'TmsPendingWaybillList', icon: 'waybill' } as const

export const WORKSPACES = {
  open: { title: '发货开单', icon: 'box', path: '/tms/order-open', menu: 'TmsOrderOpen' },
  pending: { title: '待配载运单', ...pending },
  loaded: { title: '已配载运单', icon: 'vehicle', path: '/tms/waybill-management/loaded', menu: 'TmsLoadedWaybillList' },
  dispatch: { title: '配载', ...pending, permission: 'TmsPendingWaybillList:Dispatch', instruction: '在待配载列表选择运输单，再点「配载调度」。' },
  merge: { title: '合单', ...pending, permission: 'TmsPendingWaybillList:Merge', instruction: '勾选允许合单的多张运输单，再点「合单配载」。' },
  split: { title: '拆单', ...pending, permission: 'TmsPendingWaybillList:Split', instruction: '选择原始运输单，点「拆单配载」并填各批货量。' },
  cargo: { title: '常用货物', icon: 'box', path: '/tms/basic-data/cargo', menu: 'TmsCargo' },
  address: { title: '地址', icon: 'location', path: '/tms/basic-data/customer-address', menu: 'TmsCustomerAddress' },
  driver: { title: '司机管理', icon: 'user', path: '/tms/basic-data/driver', menu: 'TmsDriver' },
  route: { title: '线路管理', icon: 'nav', path: '/tms/basic-data/favorite-route', menu: 'TmsFavoriteRoute' },
  vehicle: { title: '车辆管理', icon: 'vehicle', path: '/vms/vehicle-archive-manage', menu: 'VehicleArchiveManage' },
  trailer: { title: '挂车管理', icon: 'vehicle', path: '/vms/trailer-manage', menu: 'TrailerManage' },
  customerSettlement: { title: '客户对账', icon: 'receipt', path: '/fms/settlement/customer-settlement', menu: 'FinanceCustomerSettlement' },
  carrierSettlement: { title: '承运商对账', icon: 'document', path: '/fms/settlement/carrier-settlement', menu: 'FinanceCarrierSettlement' },
  driverSettlement: { title: '司机对账', icon: 'user', path: '/tms/driver-query', menu: 'TmsDriverQuery', permission: 'TmsDriverQuery:View', instruction: '选择司机并打开详情，核对司机费用明细、借还款和报销记录。' },
  expenses: { title: '运单费用', icon: 'expense', path: '/fms/settlement/waybill-cost', menu: 'FinanceWaybillCost' }
} satisfies Record<string, WorkspaceEntry>

export type WorkspaceKey = keyof typeof WORKSPACES
export const MASTER_DATA: WorkspaceKey[] = ['cargo', 'address', 'driver', 'route', 'vehicle', 'trailer']
export const SETTLEMENT: WorkspaceKey[] = ['customerSettlement', 'carrierSettlement', 'driverSettlement', 'expenses']
export const DISPATCH_ACTIONS: WorkspaceKey[] = ['dispatch', 'merge', 'split']

export function workspace(key: WorkspaceKey): WorkspaceEntry { return WORKSPACES[key] }

export function isWorkspaceKey(value: unknown): value is WorkspaceKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WORKSPACES, value)
}

export function workspaceUrl(path: string, query?: Record<string, string | number | boolean | null>, demo = false) {
  const configured = import.meta.env.VITE_TMS_WEB_URL?.trim().replace(/\/+$/, '')
  const base = configured || (demo ? 'https://art-si.github.io/art-supabase-pro' : '')
  const secureOrigin = /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^?#]*)?$/i.test(base)
  const localOrigin = import.meta.env.DEV && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^?#]*)?$/.test(base)
  if (!(secureOrigin || localOrigin) || !/^\/[a-z0-9_/-]+$/i.test(path)) return ''
  const params = Object.entries(query || {})
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `${base}/#${path}${params ? `?${params}` : ''}`
}

export function openWorkspace(key: WorkspaceKey) {
  uni.navigateTo({ url: `/pages/workspace/index?key=${key}` })
}
