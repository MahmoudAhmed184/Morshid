import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Form, FormField } from '@/components/ui/form'
import { Label } from '@/components/ui/label'

import {
  SIGN_IN_UNAVAILABLE_MESSAGE,
  loginApi,
} from '@/features/auth/api/auth.api'
import { signInSchema } from '@/features/auth/schemas/sign-in.schema'
import type { SignInFormValues } from '@/features/auth/schemas/sign-in.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { getDashboardPath } from '@/features/auth/utils/auth-redirect'
import { isApiError } from '@/features/auth/api/authenticated-api-client'

import { PasswordField } from './password-field'
import { RuledFieldInput } from './ruled-field-input'

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

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <div className="space-y-0">
              <div className="space-y-2.5">
                <Label htmlFor={emailInputId} className="smallcaps-label">
                  Institutional Email
                </Label>
                <RuledFieldInput
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
            className="flex items-start gap-2.5 rounded-md border border-rubric/40 bg-rubric/5 px-3.5 py-3 text-sm text-rubric"
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
          className="w-full"
        >
          Sign in
        </Button>
      </form>
    </Form>
  )
}
