import { CubeLoader } from '@/components/ui/custom/cube-loader'

export function AuthLoader() {
  return (
    <main className="relative flex min-h-[calc(100svh-8rem)] items-center justify-center overflow-hidden bg-background px-4">
      <div
        className="bg-radial-spot pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <CubeLoader label="Checking authentication" />
      </div>
    </main>
  )
}
