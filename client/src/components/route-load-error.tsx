import { useRouter } from '@tanstack/react-router'

import { ErrorState } from '@/components/ui/custom/error-state/error-state'

export function RouteLoadError() {
  const router = useRouter()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <ErrorState
        className="w-full max-w-md"
        title="Unable to load this page"
        description="Morshid could not reach a required service. No local data was changed — try again in a moment."
        retryLabel="Try again"
        onRetry={() => void router.invalidate()}
      />
    </main>
  )
}
