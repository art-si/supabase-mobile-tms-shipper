import { defineStore } from 'pinia'
import { fetchShipperProfile } from '@/api/shipper'
import { fetchStaffButtons, fetchStaffMenus } from '@/api/staff'
import { ApiError, demoEnabled, loginWithPassword, refreshToken, revokeSession } from '@/api/supabase'
import type { Session } from '@/api/types'
import { workspace, type WorkspaceKey } from '@/utils/workspace'

const SESSION_KEY = 'tms-shipper-session'
const DEMO_KEY = 'tms-shipper-demo'
const STAFF_KEY = 'tms-shipper-staff'
let refreshing: { token: string; promise: Promise<Session> } | null = null

function useExpiry(session: Session) {
  return { ...session, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null as Session | null,
    demo: false,
    staff: false,
    staffMenus: [] as string[],
    staffButtons: [] as string[],
    hydrated: false
  }),
  getters: {
    active: (state) => state.demo || Boolean(state.session?.access_token)
  },
  actions: {
    hydrate() {
      if (this.hydrated) return
      this.hydrated = true
      try {
        const cached = uni.getStorageSync(SESSION_KEY)
        const value: unknown = typeof cached === 'string' && cached ? JSON.parse(cached) : null
        if (
          value && typeof value === 'object' &&
          'access_token' in value && typeof value.access_token === 'string' &&
          'refresh_token' in value && typeof value.refresh_token === 'string' &&
          'expires_at' in value && typeof value.expires_at === 'number'
        ) {
          this.session = value as Session
          this.staff = uni.getStorageSync(STAFF_KEY) === true
        }
        this.demo = demoEnabled && !this.session && uni.getStorageSync(DEMO_KEY) === true
      } catch {
        this.session = null
      }
    },
    guard() {
      this.hydrate()
      if (this.active) return true
      uni.reLaunch({ url: '/pages/login/index' })
      return false
    },
    saveSession(session: Session) {
      this.session = useExpiry(session)
      uni.setStorageSync(SESSION_KEY, JSON.stringify(this.session))
    },
    clear() {
      this.session = null
      this.demo = false
      this.staff = false
      this.staffMenus = []
      this.staffButtons = []
      uni.removeStorageSync(SESSION_KEY)
      uni.removeStorageSync(DEMO_KEY)
      uni.removeStorageSync(STAFF_KEY)
    },
    async login(email: string, password: string) {
      const session = await loginWithPassword(email, password)
      let menus: string[] = []
      let buttons: string[] = []
      try {
        try {
          await fetchShipperProfile(session.access_token)
        } catch (cause) {
          if (!(cause instanceof ApiError) || !['SHIPPER_NOT_BOUND', 'NOT_FOUND'].includes(cause.code)) throw cause
          menus = await fetchStaffMenus(session.access_token)
          if (!menus.length) throw cause
          buttons = await fetchStaffButtons(session.access_token)
        }
      } catch (error) {
        void revokeSession(session.access_token).catch(() => undefined)
        throw error
      }
      this.clear()
      this.saveSession(session)
      this.staff = menus.length > 0
      this.staffMenus = menus
      this.staffButtons = buttons
      if (this.staff) uni.setStorageSync(STAFF_KEY, true)
    },
    permits(key: WorkspaceKey) {
      if (this.demo) return true
      const entry = workspace(key)
      return this.staff && this.staffMenus.includes(entry.menu) &&
        (!entry.permission || this.staffButtons.includes(entry.permission))
    },
    async loadStaffAccess() {
      if (!this.staff || this.staffMenus.length) return
      const userId = this.session?.user?.id
      const [menus, buttons] = await this.authenticated((token) =>
        Promise.all([fetchStaffMenus(token), fetchStaffButtons(token)])
      )
      if (this.staff && this.session?.user?.id === userId) {
        this.staffMenus = menus
        this.staffButtons = buttons
      }
    },
    startDemo() {
      if (!demoEnabled) return
      this.clear()
      this.demo = true
      uni.setStorageSync(DEMO_KEY, true)
    },
    async refresh(): Promise<Session> {
      const previous = this.session
      if (!previous?.refresh_token) throw new ApiError(401, '')
      if (refreshing?.token === previous.refresh_token) return refreshing.promise

      const promise = refreshToken(previous.refresh_token).then((session) => {
        if (this.session?.refresh_token !== previous.refresh_token) throw new ApiError(401, '')
        this.saveSession(session)
        return session
      }).catch((error: unknown) => {
        if (
          error instanceof ApiError && [400, 401, 403].includes(error.status) &&
          this.session?.refresh_token === previous.refresh_token
        ) {
          this.clear()
          this.guard()
        }
        throw error
      }).finally(() => {
        if (refreshing?.promise === promise) refreshing = null
      })
      refreshing = { token: previous.refresh_token, promise }
      return promise
    },
    async authenticated<T>(operation: (token: string) => Promise<T>): Promise<T> {
      if (!this.guard() || !this.session) throw new ApiError(401, '')
      const session = (this.session.expires_at || 0) * 1000 - Date.now() < 60_000
        ? await this.refresh()
        : this.session
      try {
        return await operation(session.access_token)
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || !this.session) throw error
        const next = this.session.access_token === session.access_token ? await this.refresh() : this.session
        return operation(next.access_token)
      }
    },
    logout() {
      const token = this.session?.access_token
      this.clear()
      if (token) void revokeSession(token).catch(() => undefined)
      uni.reLaunch({ url: '/pages/login/index' })
    }
  }
})
