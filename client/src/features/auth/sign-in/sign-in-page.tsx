import { Logo } from '@/components/branding/logo'
import { Separator } from '@/components/ui/separator'

import { AuthLayout } from './auth-layout'
import { SignInForm } from './sign-in-form'

export function SignInPage() {
  return (
    <main>
      <AuthLayout>
        <div className="motion-safe:animate-fade-up w-full rounded-2xl bg-card/95 px-5 py-6 text-card-foreground shadow-xl backdrop-blur-md sm:px-10 sm:py-9 md:px-12 md:py-10">
          <div className="flex flex-col items-center text-center">
            <Logo
              className="mb-1.5 size-auto sm:mb-2.5"
              iconClassName="h-10 w-auto sm:h-13 md:h-16"
            />
            <span className="font-serif text-[0.6rem] font-medium tracking-[0.2em] text-muted-foreground uppercase sm:text-[0.68rem] sm:tracking-[0.25em]">
              EST. MMXXVI
            </span>
            <h1 className="mt-1 font-serif text-2xl leading-none font-normal tracking-[0.22em] text-card-foreground select-none sm:mt-1.5 sm:text-[2.5rem] sm:tracking-[0.28em] md:text-[2.85rem]">
              MORSHID
            </h1>
            <p className="mt-1.5 text-[0.62rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase sm:mt-2.5 sm:text-[0.72rem] sm:tracking-[0.16em] md:text-[0.78rem]">
              A SOCRATIC TUTOR. BOUND TO{' '}
              <span className="font-bold text-primary">
                YOUR COURSE MATERIALS.
              </span>
            </p>
          </div>

          <Separator className="my-4 sm:my-6 md:my-7" />

          <div className="mb-4 flex flex-col gap-0.5 text-left sm:mb-6 sm:gap-1">
            <p className="text-[0.65rem] font-bold tracking-[0.16em] text-primary uppercase sm:text-[0.72rem]">
              SIGN IN
            </p>
            <h2 className="text-xl leading-tight font-bold tracking-tight text-card-foreground sm:text-2xl md:text-[2.1rem]">
              Welcome back.
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
              Your sessions and citations are where you left them.
            </p>
          </div>

          <SignInForm />

          <p className="mt-5 text-center text-xs text-muted-foreground sm:mt-7">
            New to Morshid? Ask your instructor for access.
          </p>
        </div>
      </AuthLayout>
    </main>
  )
}
