import Droplets from '@/components/canvasui/Droplets'
import { AuthBrandingPanel } from '@/features/auth/components/auth-branding-panel'
import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  children: React.ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <Droplets
      className="min-h-svh w-full bg-background"
      intensity={0.45}
      speed={0.8}
      staticDrops={0.35}
      refraction={0.16}
    >
      <div className="grid min-h-svh gap-6 p-4 lg:grid-cols-2 lg:p-6">
        <AuthBrandingPanel className="hidden lg:flex" />
        <div
          className={cn(
            'flex flex-col justify-center px-4 py-12 sm:px-8 lg:px-12 xl:px-20',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </Droplets>
  )
}
