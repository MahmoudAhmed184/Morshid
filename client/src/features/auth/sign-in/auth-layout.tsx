import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  children: React.ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div
      className="relative flex min-h-svh w-full items-center justify-center overflow-x-hidden overflow-y-auto bg-[#f8f9fa] px-3 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10 text-slate-900 [color-scheme:light]"
      style={{ colorScheme: 'light' }}
    >
      {/* Background artwork: swirling manuscripts vortex */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-100 pointer-events-none"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      {/* Center luminous radial highlight */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.75)_0%,rgba(255,255,255,0.3)_45%,rgba(248,249,250,0.85)_100%)] pointer-events-none" />

      {/* Centered card */}
      <div
        className={cn('relative z-10 w-full max-w-[540px] my-auto', className)}
      >
        {children}
      </div>
    </div>
  )
}
