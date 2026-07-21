import { useRouter } from '@tanstack/react-router'

import { ErrorState } from '@/components/ui/custom/error-state/error-state'

export function RouteLoadError() {
  const router = useRouter()

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4">
      <div
        className="bg-radial-spot pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
        aria-hidden
      />
      <ErrorState
        className="relative w-full max-w-md"
        title="Unable to load this page"
        description="Morshid could not reach a required service. No local data was changed — try again in a moment."
        retryLabel="Try again"
        onRetry={() => void router.invalidate()}
      />
    </main>
  )
}
