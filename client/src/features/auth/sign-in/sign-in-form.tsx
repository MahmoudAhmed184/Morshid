import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Mail, TriangleAlert } from 'lucide-react'
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
        className="space-y-3.5 sm:space-y-4.5"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {/* Quick Demo Credentials Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
          <span className="font-mono text-[0.62rem] sm:text-[0.65rem] uppercase tracking-wider !text-slate-400 dark:!text-slate-400 mr-0.5">
            Autofill:
          </span>
          <button
            type="button"
            onClick={() => fillDemo('instructor')}
            className="rounded-full !border !border-slate-200 dark:!border-slate-200 !bg-slate-100/90 dark:!bg-slate-100/90 px-2.5 py-0.5 font-mono text-[0.62rem] sm:text-[0.65rem] font-medium !text-slate-700 dark:!text-slate-700 transition-colors hover:!bg-slate-200"
          >
            Instructor
          </button>
          <button
            type="button"
            onClick={() => fillDemo('student')}
            className="rounded-full !border !border-slate-200 dark:!border-slate-200 !bg-slate-100/90 dark:!bg-slate-100/90 px-2.5 py-0.5 font-mono text-[0.62rem] sm:text-[0.65rem] font-medium !text-slate-700 dark:!text-slate-700 transition-colors hover:!bg-slate-200"
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => fillDemo('admin')}
            className="rounded-full !border !border-slate-200 dark:!border-slate-200 !bg-slate-100/90 dark:!bg-slate-100/90 px-2.5 py-0.5 font-mono text-[0.62rem] sm:text-[0.65rem] font-medium !text-slate-700 dark:!text-slate-700 transition-colors hover:!bg-slate-200"
          >
            Admin
          </button>
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <div className="space-y-0">
              <div className="space-y-1.5 sm:space-y-2">
                <Label
                  htmlFor={emailInputId}
                  className="text-[0.65rem] sm:text-[0.68rem] font-bold uppercase tracking-wider text-slate-700"
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
                    className="h-10 sm:h-11 md:h-12 rounded-xl !border-slate-200 dark:!border-slate-200 !bg-slate-50/80 dark:!bg-slate-50/80 pr-11 text-sm !text-slate-900 dark:!text-slate-900 placeholder:!text-slate-400 focus-visible:!bg-white focus-visible:ring-1 focus-visible:!ring-[#0d848e]"
                  />
                  <Mail
                    className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 !text-slate-400"
                    aria-hidden
                  />
                </div>
              </div>

              {fieldState.error ? (
                <p
                  id={emailErrorId}
                  role="alert"
                  className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-600"
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
                  className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-600"
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
            className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-200 bg-rose-50/90 dark:bg-rose-50/90 px-3.5 py-2.5 text-sm font-medium text-rose-800 dark:text-rose-800 shadow-xs"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-600"
              aria-hidden
            />
            <span className="leading-snug">{authErrorMessage}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="h-10 sm:h-11 md:h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#111e38] text-sm font-semibold text-white shadow-md transition-all hover:bg-[#081120] hover:shadow-lg mt-2 sm:mt-3"
        >
          <span>Sign in</span>
          <ArrowRight className="size-4 stroke-[2.2]" aria-hidden />
        </Button>
      </form>
    </Form>
  )
}
