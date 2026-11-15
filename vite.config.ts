import { defineConfig, loadEnv } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
import { applicationRoot, loadMobilePro } from './scripts/mobile-pro.mjs'

function assertPublicKey(key: string) {
  if (!key || key.startsWith('sb_publishable_')) return
  try {
    const [, claims] = key.split('.')
    if (claims && JSON.parse(Buffer.from(claims, 'base64url').toString()).role === 'anon') return
  } catch {
    // An invalid key gets the same configuration error without echoing its value.
  }
  throw new Error('VITE_SUPABASE_KEY 必须是 publishable key 或旧版 anon key。')
}

export default defineConfig(async ({ mode }) => {
  const { VITE_SUPABASE_KEY = '' } = loadEnv(mode, applicationRoot, 'VITE_')
  assertPublicKey(VITE_SUPABASE_KEY.trim())
  const { createMobileViteConfig } = await loadMobilePro()
  return createMobileViteConfig(applicationRoot, uniPlugin)
})
