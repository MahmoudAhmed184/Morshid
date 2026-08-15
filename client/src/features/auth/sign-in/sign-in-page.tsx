import { AuthLayout } from './auth-layout'
import { SignInForm } from './sign-in-form'

export function SignInPage() {
  return (
    <main>
      <AuthLayout>
        <div className="w-full rounded-2xl sm:rounded-3xl md:rounded-[2rem] bg-white/95 dark:bg-[#0b1322]/90 text-slate-900 dark:text-slate-100 backdrop-blur-md px-5 py-4 sm:px-7 sm:py-5 md:px-8 md:py-5 lg:px-9 lg:py-6 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08)] motion-safe:animate-fade-up border border-slate-100/80 dark:border-slate-800/80">
          {/* Top Brand Header */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo.png"
              alt="Morshid Logo"
              className="h-8 sm:h-9 md:h-10 w-auto object-contain mb-1 dark:hidden"
            />
            <img
              src="/logo-white.png"
              alt="Morshid Logo"
              className="h-8 sm:h-9 md:h-10 w-auto object-contain mb-1 hidden dark:block"
            />
            <span className="font-serif text-[0.58rem] sm:text-[0.62rem] font-medium tracking-[0.2em] sm:tracking-[0.25em] text-slate-400 dark:text-slate-400 uppercase">
              EST. MMXXVI
            </span>
            <h1 className="font-serif text-xl sm:text-2xl md:text-[1.85rem] lg:text-[2rem] font-normal tracking-[0.22em] sm:tracking-[0.26em] text-[#0f1c34] dark:text-slate-100 mt-0.5 sm:mt-1 leading-none select-none">
              MORSHID
            </h1>
            <p className="mt-1 sm:mt-1.5 text-[0.58rem] sm:text-[0.65rem] md:text-[0.68rem] font-semibold tracking-[0.14em] sm:tracking-[0.16em] uppercase text-slate-600 dark:text-slate-400">
              A SOCRATIC TUTOR. BOUND TO{' '}
              <span className="font-bold text-[#0d848e] dark:text-[#2dd4bf]">
                YOUR COURSE MATERIALS.
              </span>
            </p>
          </div>

          {/* Thin separator */}
          <div className="my-2.5 sm:my-3 md:my-3.5 border-t border-slate-100 dark:border-slate-800/80" />

          {/* Welcome section */}
          <div className="mb-2.5 sm:mb-3 md:mb-3.5 space-y-0.5 text-left">
            <p className="text-[0.6rem] sm:text-[0.65rem] font-bold tracking-[0.16em] uppercase text-[#0d848e] dark:text-[#2dd4bf]">
              SIGN IN
            </p>
            <h2 className="text-lg sm:text-xl md:text-[1.35rem] lg:text-[1.45rem] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              Welcome back.
            </h2>
            <p className="text-[0.75rem] sm:text-xs text-slate-500 dark:text-slate-400">
              Your sessions and citations are where you left them.
            </p>
          </div>

          <SignInForm />

          <p className="mt-3 sm:mt-3.5 md:mt-4 text-center text-[0.68rem] sm:text-xs text-slate-400 dark:text-slate-500">
            New to Morshid? Ask your instructor for access.
          </p>
        </div>
      </AuthLayout>
    </main>
  )
}
