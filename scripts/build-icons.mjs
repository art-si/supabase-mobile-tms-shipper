import { applicationRoot, loadMobilePro } from './mobile-pro.mjs'

const { buildMobileIcons } = await loadMobilePro('build-mobile-icons.mjs')
await buildMobileIcons(applicationRoot)
