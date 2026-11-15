import { createSSRApp } from 'vue'
import { installMobilePlugins } from '@mobile-core/app'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  installMobilePlugins(app)
  return { app }
}
