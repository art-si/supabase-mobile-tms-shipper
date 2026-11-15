import { defineConfig, loadEnv } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const uni = (uniPlugin as unknown as { default?: typeof uniPlugin }).default || uniPlugin

/**
 * GitHub Pages 会将以下划线开头的资源交给 Jekyll 处理；此标记可禁用该行为。
 * 使用构建钩子确保每次 H5 打包的根目录都会包含 .nojekyll。
 */
const noJekyllPlugin = () => ({
  name: 'h5-nojekyll',
  apply: 'build' as const,
  writeBundle(outputOptions: { dir?: string }) {
    if (process.env.UNI_PLATFORM !== 'h5' || !outputOptions.dir) return

    const outputPath = resolve(outputOptions.dir, '.nojekyll')
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, '')
  }
})

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

export default defineConfig(({ mode }) => {
  const { VITE_SUPABASE_KEY = '' } = loadEnv(mode, process.cwd(), 'VITE_')
  assertPublicKey(VITE_SUPABASE_KEY.trim())
  return {
    // 使用相对资源路径，兼容静态站点的子目录部署。
    base: process.env.UNI_PLATFORM === 'h5' ? './' : '/',
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true,
          silenceDeprecations: ['import', 'global-builtin']
        }
      }
    },
    build: {
      rolldownOptions: {
        checks: { pluginTimings: false }
      }
    },
    plugins: [uni(), noJekyllPlugin()]
  }
})
