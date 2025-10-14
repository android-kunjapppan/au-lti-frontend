import type { NavigationGuard } from 'vue-router'
export type MiddlewareKey = "conversation-auth" | "dashboard-auth" | "test-navigation"
declare module "../../node_modules/.pnpm/nuxt@3.15.1_@parcel+watcher@2.5.0_@types+node@22.10.6_db0@0.2.1_eslint@9.17.0_jiti@2.4.2__ior_naijn5ddtjyoe377a4d7pnamkm/node_modules/nuxt/dist/pages/runtime/composables" {
  interface PageMeta {
    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>
  }
}
declare module 'nitropack' {
  interface NitroRouteConfig {
    appMiddleware?: MiddlewareKey | MiddlewareKey[] | Record<MiddlewareKey, boolean>
  }
}