import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const applicationRoot = fileURLToPath(new URL('../', import.meta.url))

export async function loadMobilePro(script = 'mobile-runtime.mjs') {
  const configured = process.env.MOBILE_PRO_ROOT
  const candidates = configured
    ? [resolve(configured)]
    : [resolve(applicationRoot, '../..'), resolve(applicationRoot, '../supabase-mobile-pro')]
  const platform = candidates.find((directory) => existsSync(resolve(directory, 'scripts/mobile-runtime.mjs')))
  if (!platform) {
    throw new Error('未找到 supabase-mobile-pro。请从主仓检出子仓，或将 MOBILE_PRO_ROOT 指向主仓目录。')
  }
  return import(pathToFileURL(resolve(platform, 'scripts', script)).href)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv[2] === 'font:css') {
    const { buildUiFont } = await loadMobilePro('build-ui-font-css.mjs')
    await buildUiFont(process.argv[3])
  } else {
    const { prepareMobileCore } = await loadMobilePro()
    prepareMobileCore(applicationRoot)
  }
}
