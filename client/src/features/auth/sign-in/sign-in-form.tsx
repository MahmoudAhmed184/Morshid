import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'

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
import { useAuthStore } from '@/features/auth/session/session.store'
import { getDashboardPath } from '@/features/auth/routing/auth-redirect'
import { isApiError } from '@/features/auth/session/authenticated-api-client'

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
        className="space-y-5"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {/* Quick Demo Credentials Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground mr-1">
            Autofill:
          </span>
          <button
            type="button"
            onClick={() => fillDemo('instructor')}
            className="rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 font-mono text-[0.68rem] font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-foreground"
          >
            Instructor
          </button>
          <button
            type="button"
            onClick={() => fillDemo('student')}
            className="rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 font-mono text-[0.68rem] font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-foreground"
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => fillDemo('admin')}
            className="rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 font-mono text-[0.68rem] font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-foreground"
          >
            Admin
          </button>
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <div className="space-y-0">
              <div className="space-y-2.5">
                <Label htmlFor={emailInputId} className="smallcaps-label">
                  Institutional Email
                </Label>
                <Input
                  {...field}
                  id={emailInputId}
                  type="email"
                  placeholder="instructor@morshid.demo"
                  autoComplete="email"
                  aria-invalid={fieldState.error ? true : undefined}
                  aria-describedby={fieldState.error ? emailErrorId : undefined}
                />
              </div>

              {fieldState.error ? (
                <p
                  id={emailErrorId}
                  role="alert"
                  className="mt-2 text-sm text-rubric"
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
            <div className="space-y-0">
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
                  className="mt-2 text-sm text-rubric"
                >
                  {fieldState.error.message}
                </p>
              ) : null}
            </div>
          )}
        />

        {authErrorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rubric/40 bg-rubric/5 px-3.5 py-3 text-sm text-rubric"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{authErrorMessage}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          variant="default"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="h-12 w-full gap-2 rounded-full px-7 text-base"
        >
          Sign in
        </Button>
      </form>
    </Form>
  )
}
