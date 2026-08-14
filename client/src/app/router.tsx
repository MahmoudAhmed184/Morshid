import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { createAppQueryClient } from '@/lib/query/query-client'
import { routeTree } from '../routeTree.gen'

export type AppRouterContext = {
  queryClient: QueryClient
}

export function getRouter() {
  const queryClient = createAppQueryClient()

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

declare module '@tanstack/history' {
  interface HistoryState {
    reviewQueueOverlay?: boolean
  }
}
