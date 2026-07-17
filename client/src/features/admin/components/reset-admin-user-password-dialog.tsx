import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRoundIcon, Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { PasswordField } from '@/features/auth/components/password-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { adminResetPasswordFormSchema } from '@/features/admin/schemas/admin-managed-user.schema'
import type {
  AdminManagedUser,
  AdminResetPasswordFormValues,
} from '@/features/admin/schemas/admin-managed-user.schema'

type ResetAdminUserPasswordDialogProps = {
  user: AdminManagedUser
  isPending: boolean
  onResetPassword: (newPassword: string) => Promise<unknown>
}

export function ResetAdminUserPasswordDialog({
  user,
  isPending,
  onResetPassword,
}: ResetAdminUserPasswordDialogProps) {
  const [open, setOpen] = useState(false)
  const form = useForm<AdminResetPasswordFormValues>({
    resolver: zodResolver(adminResetPasswordFormSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (!nextOpen) {
      form.reset()
    }
  }

  const handleSubmit = async ({
    newPassword,
  }: AdminResetPasswordFormValues) => {
    try {
      await onResetPassword(newPassword)
      handleOpenChange(false)
    } catch (error) {
      form.setError('root', {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to reset this password. Please try again.',
      })
    }
  }

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Reset password" />
        }
      >
        <KeyRoundIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.email}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <PasswordField
                    {...field}
                    id={`new-password-${user.id}`}
                    label="New password"
                    autoComplete="new-password"
                    showForgotPassword={false}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <PasswordField
                    {...field}
                    id={`confirm-password-${user.id}`}
                    label="Confirm new password"
                    autoComplete="new-password"
                    showForgotPassword={false}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            {rootError ? (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2Icon className="animate-spin" /> : null}
                Reset password
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
