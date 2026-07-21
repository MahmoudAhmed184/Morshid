import { Logo } from '@/components/logo'

import { AuthLayout } from './components/auth-layout'
import { SignInForm } from './components/sign-in-form'

export function SignInPage() {
  return (
    <main>
      <AuthLayout>
        <div className="animate-fade-up mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Logo iconClassName="size-5" />
            <span className="font-display text-xl font-semibold text-foreground">
              Morshid
            </span>
          </div>

          <div className="mb-8 space-y-3">
            <p className="smallcaps-label">SIGN IN</p>
            <h1 className="font-display text-[2rem] leading-[1.1] font-semibold text-foreground">
              Welcome back.
            </h1>
            <p className="leading-relaxed text-muted-foreground">
              Your sessions and citations are where you left them.
            </p>
          </div>

          <SignInForm />

          <p className="footnote mt-8">
            New to Morshid? Ask your instructor for access.
          </p>
        </div>
      </AuthLayout>
    </main>
  )
}
