import { AuthLayout } from './auth-layout'
import { SignInForm } from './sign-in-form'

export function SignInPage() {
  return (
    <main className="[color-scheme:light]">
      <AuthLayout>
        <div className="w-full rounded-2xl sm:rounded-[2.25rem] md:rounded-[2.75rem] bg-white/95 dark:bg-white/95 text-slate-900 dark:text-slate-900 backdrop-blur-md px-5 py-6 sm:px-10 sm:py-9 md:px-12 md:py-10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] motion-safe:animate-fade-up border border-slate-100/80 dark:border-slate-100/80">
          {/* Top Brand Header */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo.png"
              alt="Morshid Logo"
              className="h-10 sm:h-13 md:h-16 w-auto object-contain mb-1.5 sm:mb-2.5"
            />
            <span className="font-serif text-[0.6rem] sm:text-[0.68rem] font-medium tracking-[0.2em] sm:tracking-[0.25em] text-slate-400 dark:text-slate-400 uppercase">
              EST. MMXXVI
            </span>
            <h1 className="font-serif text-2xl sm:text-[2.5rem] md:text-[2.85rem] font-normal tracking-[0.22em] sm:tracking-[0.28em] text-[#0f1c34] dark:text-[#0f1c34] mt-1 sm:mt-1.5 leading-none select-none">
              MORSHID
            </h1>
            <p className="mt-1.5 sm:mt-2.5 text-[0.62rem] sm:text-[0.72rem] md:text-[0.78rem] font-semibold tracking-[0.14em] sm:tracking-[0.16em] uppercase text-slate-600 dark:text-slate-600">
              A SOCRATIC TUTOR. BOUND TO{' '}
              <span className="font-bold text-[#0d848e] dark:text-[#0d848e]">
                YOUR COURSE MATERIALS.
              </span>
            </p>
          </div>

          {/* Thin separator */}
          <div className="my-4 sm:my-6 md:my-7 border-t border-slate-100 dark:border-slate-100" />

          {/* Welcome section */}
          <div className="mb-4 sm:mb-6 space-y-0.5 sm:space-y-1 text-left">
            <p className="text-[0.65rem] sm:text-[0.72rem] font-bold tracking-[0.16em] uppercase text-[#0d848e] dark:text-[#0d848e]">
              SIGN IN
            </p>
            <h2 className="text-xl sm:text-2xl md:text-[2.1rem] font-bold tracking-tight text-slate-900 dark:text-slate-900 leading-tight">
              Welcome back.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 mt-0.5 sm:mt-1">
              Your sessions and citations are where you left them.
            </p>
          </div>

          <SignInForm />

          <p className="mt-5 sm:mt-7 text-center text-xs text-slate-400 dark:text-slate-400">
            New to Morshid? Ask your instructor for access.
          </p>
        </div>
      </AuthLayout>
    </main>
  )
}
