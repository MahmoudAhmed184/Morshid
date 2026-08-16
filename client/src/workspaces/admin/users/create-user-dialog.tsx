import { UserPlusIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useManagedUserMutations } from '@/workspaces/admin/users/use-user-management'
import { UserForm } from './user-form'
import type { CreateUserFormValues } from '@/features/user-management/managed-user.schema'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'

type CreateUserDialogProps = {
  role?: CreateUserFormValues['role']
  userLabel?: string
}

export function CreateUserDialog({
  role,
  userLabel = 'User',
}: CreateUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CreateUserFormValues, string[]>>
  >({})
  const { createUser } = useManagedUserMutations()

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setErrorMessage(null)
    setFieldErrors({})
  }

  const handleSubmit = async (values: CreateUserFormValues) => {
    setErrorMessage(null)
    setFieldErrors({})
    try {
      await createUser.mutateAsync({
        email: values.email,
        displayName: values.name,
        password: values.password,
        role: values.role,
      })
      handleOpenChange(false)
    } catch (error) {
      if (isApiError(error) && error.validationErrors.length > 0) {
        const nextErrors: Partial<
          Record<keyof CreateUserFormValues, string[]>
        > = {}
        for (const issue of error.validationErrors) {
          const field = issue.field === 'displayName' ? 'name' : issue.field
          if (
            field === 'name' ||
            field === 'email' ||
            field === 'password' ||
            field === 'role'
          ) {
            nextErrors[field] = [...(nextErrors[field] ?? []), issue.message]
          }
        }
        if (Object.keys(nextErrors).length > 0) {
          setFieldErrors(nextErrors)
          setErrorMessage(null)
          return
        }
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create this user. Please try again.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon />
        Create {userLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlusIcon className="size-5" aria-hidden />
          </span>
          <DialogTitle>Create {userLabel}</DialogTitle>
          <DialogDescription>
            Create a {userLabel.toLowerCase()} account.
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <UserForm
          serverErrors={fieldErrors}
          lockedRole={role}
          onSubmit={handleSubmit}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
