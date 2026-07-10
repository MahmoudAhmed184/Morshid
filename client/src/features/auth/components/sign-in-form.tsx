import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight, Mail } from 'lucide-react'
import { useState } from 'react'
import type { ControllerRenderProps } from 'react-hook-form'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
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

import {
  INVALID_CREDENTIALS_MESSAGE,
  isAuthApiError,
  loginApi,
} from '@/features/auth/api/auth.api'
import { signInSchema } from '@/features/auth/schemas/sign-in.schema'
import type { SignInFormValues } from '@/features/auth/schemas/sign-in.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { getAuthRedirectPath } from '@/features/auth/utils/auth-redirect'

import { AuthField } from './auth-field'
import { PasswordField } from './password-field'

type SignInFormProps = {
  onSubmitDelay?: number
}

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

export function SignInForm({ onSubmitDelay }: SignInFormProps) {
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()
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

  const onSubmit = async (values: SignInFormValues) => {
    setAuthErrorMessage(null)

    if (onSubmitDelay) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, onSubmitDelay)
      })
    }

    const session = await loginApi(values.email, values.password).catch(
      (error: unknown) => {
        setAuthErrorMessage(
          isAuthApiError(error) ? error.message : INVALID_CREDENTIALS_MESSAGE,
        )
        return null
      },
    )

    if (!session) {
      return
    }

    setSession(session)
    await navigate({ to: getAuthRedirectPath(session.user.role) })
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
  )
}
