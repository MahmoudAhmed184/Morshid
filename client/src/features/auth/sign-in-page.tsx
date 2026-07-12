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
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div className="mb-8 space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Welcome Back
            </h1>
            <p className="text-base text-foreground sm:text-lg">
              Access your dashboard and insights.
            </p>
          </div>

          <Card className="rounded-2xl ring-foreground/10">
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
        </div>
      </AuthLayout>
    </main>
  )
}
