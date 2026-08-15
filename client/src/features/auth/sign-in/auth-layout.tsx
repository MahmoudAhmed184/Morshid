import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  children: React.ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-y-auto md:overflow-hidden bg-[#f8f9fa] dark:bg-[#070c14] px-4 py-4 sm:px-6 md:py-5 lg:px-8 text-slate-900 dark:text-slate-100">
      {/* Background artwork: swirling manuscripts vortex */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-100 pointer-events-none dark:hidden"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-100 pointer-events-none hidden dark:block"
        style={{ backgroundImage: "url('/login-bg-dark.jpg')" }}
      />
      {/* Center luminous radial highlight */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.75)_0%,rgba(255,255,255,0.3)_45%,rgba(248,249,250,0.85)_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(11,19,34,0.75)_0%,rgba(8,14,26,0.6)_45%,rgba(5,9,17,0.92)_100%)] pointer-events-none" />

      {/* Centered card */}
      <div
        className={cn('relative z-10 w-full max-w-[480px] my-auto', className)}
      >
        {children}
      </div>
    </div>
  )
}
