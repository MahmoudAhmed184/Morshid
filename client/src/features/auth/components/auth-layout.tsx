import { cn } from '@/lib/utils'

import { AuthBrandingPanel } from '@/features/auth/components/auth-branding-panel'

type AuthLayoutProps = {
  children: React.ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh gap-6 bg-background p-4 lg:grid-cols-2 lg:p-6">
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
  )
}
