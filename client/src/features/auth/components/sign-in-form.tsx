import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ControllerRenderProps } from 'react-hook-form'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  useFormField,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import {
  INVALID_CREDENTIALS_MESSAGE,
  isAuthApiError,
  loginApi,
} from '@/features/auth/api/auth.api'
import { signInSchema } from '@/features/auth/schemas/sign-in.schema'
import type { SignInFormValues } from '@/features/auth/schemas/sign-in.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'

import { AuthField } from './auth-field'
import { AuthLogo } from './auth-logo'
import { PasswordField } from './password-field'

type SignInFormProps = {
  className?: string
  onSubmitDelay?: number
}

const SUCCESS_MESSAGE = 'Signed in successfully.'

function SignInEmailField({
  field,
}: {
  field: ControllerRenderProps<SignInFormValues, 'email'>
}) {
  const { error, formMessageId, formItemId } = useFormField()

  return (
    <AuthField
      {...field}
      id={formItemId}
      label="Institutional Email"
      icon={Mail}
      type="email"
      placeholder="instructor@morshid.demo"
      autoComplete="email"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? formMessageId : undefined}
    />
  )
}

function SignInPasswordField({
  field,
}: {
  field: ControllerRenderProps<SignInFormValues, 'password'>
}) {
  const { error, formMessageId, formItemId } = useFormField()

  return (
    <PasswordField
      {...field}
      id={formItemId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? formMessageId : undefined}
    />
  )
}

export function SignInForm({ className, onSubmitDelay }: SignInFormProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)
  const setSession = useAuthStore((state) => state.setSession)

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  })

  useEffect(() => {
    if (!successMessage) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 4000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [successMessage])

  const onSubmit = async (values: SignInFormValues) => {
    setSuccessMessage(null)
    setAuthErrorMessage(null)

    if (onSubmitDelay) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, onSubmitDelay)
      })
    }

    try {
      const session = await loginApi(values.email, values.password)
      setSession(session)
      setSuccessMessage(SUCCESS_MESSAGE)
    } catch (error) {
      setAuthErrorMessage(
        isAuthApiError(error) ? error.message : INVALID_CREDENTIALS_MESSAGE,
      )
    }
  }

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
          <Form {...form}>
            <form
              className="space-y-6"
              noValidate
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <SignInEmailField field={field} />
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <SignInPasswordField field={field} />
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <div className="flex items-center gap-2.5">
                      <FormControl>
                        <Checkbox
                          id="remember-me"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <Label
                        htmlFor="remember-me"
                        className="text-base font-normal text-foreground"
                      >
                        Keep me signed in for 30 days
                      </Label>
                    </div>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              {authErrorMessage ? (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {authErrorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p
                  role="status"
                  className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary"
                >
                  {successMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="default"
                size="lg"
                disabled={form.formState.isSubmitting}
                className="h-12 w-full rounded-full text-lg font-medium"
              >
                Sign In to Portal
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
