import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Mail, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  SIGN_IN_UNAVAILABLE_MESSAGE,
  loginApi,
} from '@/features/auth/session/session.api'
import { signInSchema } from '@/features/auth/sign-in/sign-in.schema'
import type { SignInFormValues } from '@/features/auth/sign-in/sign-in.schema'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { getDashboardPath } from '@/features/auth/routing/interface/auth-redirect'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'

import { PasswordField } from './password-field'

export function SignInForm() {
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)
  const emailInputId = useId()
  const passwordInputId = useId()
  const emailErrorId = `${emailInputId}-error`
  const passwordErrorId = `${passwordInputId}-error`
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (values: SignInFormValues) => {
    setAuthErrorMessage(null)

    const session = await loginApi(values.email, values.password).catch(
      (error: unknown) => {
        setAuthErrorMessage(
          isApiError(error) ? error.message : SIGN_IN_UNAVAILABLE_MESSAGE,
        )
        return null
      },
    )

    if (!session) {
      return
    }

    setSession(session)
    await navigate({ to: getDashboardPath(session.user.role) })
  }

  const fillDemo = (role: 'instructor' | 'student' | 'admin') => {
    const emails: Record<typeof role, string> = {
      instructor: 'instructor@morshid.demo',
      student: 'student1@morshid.demo',
      admin: 'admin@morshid.demo',
    }
    form.setValue('email', emails[role], { shouldValidate: true })
    form.setValue('password', 'MorshidDemoP0!', { shouldValidate: true })
    setAuthErrorMessage(null)
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-3.5 sm:gap-4.5"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
          <span className="mr-0.5 font-mono text-[0.62rem] tracking-wider text-muted-foreground uppercase sm:text-[0.65rem]">
            Autofill:
          </span>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => fillDemo('instructor')}
            className="h-auto rounded-full px-2.5 py-0.5 font-mono text-[0.62rem] sm:text-[0.65rem]"
          >
            Instructor
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => fillDemo('student')}
            className="h-auto rounded-full px-2.5 py-0.5 font-mono text-[0.62rem] sm:text-[0.65rem]"
          >
            Student
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => fillDemo('admin')}
            className="h-auto rounded-full px-2.5 py-0.5 font-mono text-[0.62rem] sm:text-[0.65rem]"
          >
            Admin
          </Button>
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <Label
                  htmlFor={emailInputId}
                  className="text-[0.65rem] font-bold tracking-wider text-muted-foreground uppercase sm:text-[0.68rem]"
                >
                  Institutional Email
                </Label>
                <div className="relative">
                  <Input
                    {...field}
                    id={emailInputId}
                    type="email"
                    placeholder="instructor@morshid.demo"
                    autoComplete="email"
                    aria-invalid={fieldState.error ? true : undefined}
                    aria-describedby={
                      fieldState.error ? emailErrorId : undefined
                    }
                    className="h-10 rounded-xl pr-11 sm:h-11 md:h-12"
                  />
                  <Mail
                    className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </div>

              {fieldState.error ? (
                <p
                  id={emailErrorId}
                  role="alert"
                  className="text-xs font-semibold text-destructive"
                >
                  {fieldState.error.message}
                </p>
              ) : null}
            </div>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5">
              <PasswordField
                {...field}
                id={passwordInputId}
                aria-invalid={fieldState.error ? true : undefined}
                aria-describedby={
                  fieldState.error ? passwordErrorId : undefined
                }
              />

              {fieldState.error ? (
                <p
                  id={passwordErrorId}
                  role="alert"
                  className="text-xs font-semibold text-destructive"
                >
                  {fieldState.error.message}
                </p>
              ) : null}
            </div>
          )}
        />

        {authErrorMessage ? (
          <Alert
            variant="destructive"
            className="rounded-xl px-3.5 py-2.5 shadow-xs"
          >
            <TriangleAlert aria-hidden />
            <AlertDescription>{authErrorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="mt-2 h-10 w-full cursor-pointer rounded-full shadow-md hover:shadow-lg sm:mt-3 sm:h-11 md:h-12"
        >
          Sign in
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      </form>
    </Form>
  )
}
