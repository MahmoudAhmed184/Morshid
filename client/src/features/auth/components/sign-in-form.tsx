import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight, Mail, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Form, FormField } from '@/components/ui/form'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
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
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor={emailInputId}
                    className="text-xs font-medium tracking-[0.12em] text-foreground uppercase sm:text-sm"
                  >
                    Institutional Email
                  </Label>
                </div>
                <InputGroup className="h-12 rounded-full px-1">
                  <InputGroupAddon align="inline-start" className="pl-3">
                    <Mail
                      className="size-[1.125rem] text-foreground"
                      aria-hidden
                    />
                  </InputGroupAddon>
                  <InputGroupInput
                    {...field}
                    id={emailInputId}
                    type="email"
                    placeholder="instructor@morshid.demo"
                    autoComplete="email"
                    aria-invalid={fieldState.error ? true : undefined}
                    aria-describedby={
                      fieldState.error ? emailErrorId : undefined
                    }
                    className="text-base"
                  />
                </InputGroup>
              </div>

              {fieldState.error ? (
                <p
                  id={emailErrorId}
                  role="alert"
                  className="mt-2 text-sm text-destructive"
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
                  className="mt-2 text-sm text-destructive"
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
            className="flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive ring-1 ring-destructive/15"
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
          className="group/submit h-12 w-full gap-2 rounded-full text-lg font-medium hover:shadow-glow-primary"
        >
          Sign In to Portal
          <ChevronRight
            className="size-4 transition-transform duration-200 group-hover/submit:translate-x-0.5"
            aria-hidden
          />
        </Button>
      </form>
    </Form>
  )
}
