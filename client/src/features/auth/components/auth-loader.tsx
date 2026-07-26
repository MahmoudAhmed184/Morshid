import { CubeLoader } from '@/components/ui/custom/cube-loader'

export function AuthLoader() {
  return (
    <main className="flex min-h-[calc(100svh-8rem)] items-center justify-center bg-background px-4">
      <CubeLoader label="Checking authentication" />
    </main>
  )
}
