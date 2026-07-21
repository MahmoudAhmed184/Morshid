import { Logo } from '@/components/logo'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { AuthLayout } from './components/auth-layout'
import { SignInForm } from './components/sign-in-form'

export function SignInPage() {
  return (
    <main>
      <AuthLayout>
        <div className="animate-fade-up mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo />
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Morshid
            </span>
          </div>

          <div className="mb-8 space-y-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              Welcome Back
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              Sign in to continue guiding — and being guided.
            </p>
          </div>

          <Card className="rounded-2xl shadow-lg ring-foreground/10">
            <CardHeader className="sr-only">
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Enter your institutional email and password to access the
                portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-(--card-spacing)">
              <SignInForm />
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to Morshid?{' '}
            <a
              href="#"
              className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
            >
              Request access
            </a>
          </p>
        </div>
      </AuthLayout>
    </main>
  )
}
