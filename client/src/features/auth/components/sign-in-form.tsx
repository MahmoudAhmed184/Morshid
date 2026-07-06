import { ChevronRight, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { AuthField } from './auth-field'
import { AuthLogo } from './auth-logo'
import { PasswordField } from './password-field'

type SignInFormProps = {
  className?: string
}

export function SignInForm({ className }: SignInFormProps) {
  return (
    <div className={cn('mx-auto w-full max-w-md', className)}>
      <div className="mb-8 lg:hidden">
        <AuthLogo />
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
            Enter your institutional email and security key to access the
            portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-(--card-spacing)">
          <form
            className="space-y-6"
            onSubmit={(event) => event.preventDefault()}
          >
            <AuthField
              id="email"
              label="Institutional Email"
              icon={Mail}
              type="email"
              placeholder="instructor@institution.edu"
              autoComplete="email"
            />

            <PasswordField />

            <div className="flex items-center gap-2.5">
              <Checkbox id="remember-me" defaultChecked />
              <Label
                htmlFor="remember-me"
                className="text-base font-normal text-foreground"
              >
                Keep me signed in for 30 days
              </Label>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="h-12 w-full rounded-full text-lg font-medium"
            >
              Sign In to Portal
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
