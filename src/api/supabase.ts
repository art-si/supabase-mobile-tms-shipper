import { parseLoginAccount } from '@mobile-core/account'
import type { Session } from './types'

const URL = (
  // #ifdef MP-WEIXIN
  import.meta.env.VITE_SUPABASE_MP_URL ||
  // #endif
  import.meta.env.VITE_SUPABASE_URL || ''
).replace(/\/+$/, '')
const KEY = import.meta.env.VITE_SUPABASE_KEY?.trim() || ''

export const hasSupabaseConfig = Boolean(URL && KEY)
export const demoEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true'

const errorMessages: Record<string, string> = {
  invalid_credentials: '手机号、邮箱或密码不正确。',
  invalid_account: '请输入有效的手机号或邮箱。',
  email_not_confirmed: '请验证邮箱后再登录。',
  phone_not_confirmed: '请验证手机号后再登录。',
  SHIPPER_NOT_BOUND: '此账号尚未开通货主服务，请联系物流服务商。',
  SHIPPER_ORDER_NOT_FOUND: '找不到这张订单，请返回订单列表。',
  SHIPPER_RECORD_NOT_FOUND: '此记录已变更或不可查看。',
  SHIPPER_ORDER_INPUT: '请核对站点、收发货信息和货物数量。',
  SHIPPER_NUMBER_RULE: '服务商尚未启用运输单自动编号，请联系服务商。',
  SHIPPER_REQUEST_USED: '这次提交已处理，请到订单列表核对。',
  SHIPPER_UNAVAILABLE: '货主服务暂时不可用，请稍后重试。'
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly networkMessage?: string) {
    super(code)
    this.name = 'ApiError'
  }
}

export function userMessage(error: unknown, fallback = '请求失败，请稍后重试。'): string {
  if (!(error instanceof ApiError)) return fallback
  const known = Object.prototype.hasOwnProperty.call(errorMessages, error.code) ? errorMessages[error.code] : undefined
  if (known) return known
  if (error.status === 401) return '登录已过期，请重新登录。'
  if (error.status === 403 || error.code === '42501') return '账号暂无此项权限，请联系管理员。'
  if (error.status === 429) return '操作过于频繁，请稍后再试。'
  if (error.status === 404 && error.code === 'NOT_FOUND') return '货主服务尚未发布，请联系服务商。'
  return error.networkMessage ?? fallback
}

function errorCode(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  if ('error_code' in value && typeof value.error_code === 'string') return value.error_code
  return 'code' in value && typeof value.code === 'string' ? value.code : ''
}

export function request<T>(path: string, data: object = {}, token?: string): Promise<T> {
  if (!hasSupabaseConfig) {
    return Promise.reject(new ApiError(0, '', '尚未配置货主服务，请联系管理员。'))
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${URL}${path}`,
      method: 'POST',
      timeout: 15_000,
      header: {
        apikey: KEY,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      data,
      success({ statusCode, data: body }) {
        if (statusCode >= 200 && statusCode < 300) {
          resolve(body as T)
        } else {
          reject(new ApiError(statusCode, errorCode(body)))
        }
      },
      fail({ errMsg }) {
        const message = /domain list|合法域名/i.test(errMsg)
          ? '小程序请求域名尚未配置，请联系管理员。'
          : '网络连接失败，请检查网络后重试。'
        reject(new ApiError(0, '', message))
      }
    })
  })
}

export async function loginWithPassword(identifier: string, password: string) {
  const account = parseLoginAccount(identifier)
  if (!account) throw new ApiError(400, 'invalid_account')
  const passwordEndpoint = '/auth/v1/token?grant_type=password'
  if (account.type === 'email') return request<Session>(passwordEndpoint, { email: account.value, password })

  try {
    return await request<Session>(passwordEndpoint, { phone: account.value, password })
  } catch (error) {
    if (!(error instanceof ApiError) || !['invalid_credentials', 'phone_provider_disabled'].includes(error.code)) throw error
    // Existing Web TMS accounts may store the phone in their business profile.
    const result = await request<{ session: Session }>('/functions/v1/login-with-phone', { phone: account.local, password }, KEY)
    if (!result?.session?.access_token) throw new ApiError(502, 'INVALID_LOGIN_SESSION', '登录服务暂时不可用，请稍后重试。')
    return result.session
  }
}

export const refreshToken = (refresh_token: string) =>
  request<Session>('/auth/v1/token?grant_type=refresh_token', { refresh_token })

export const revokeSession = (token: string) => request<void>('/auth/v1/logout?scope=local', {}, token)

export function receiptUrl(path: string) {
  if (path.startsWith('/static/demo/')) return `${import.meta.env.BASE_URL}${path.slice(1)}`
  return `${URL}/storage/v1/object/public/attachments/${path.split('/').map(encodeURIComponent).join('/')}`
}
