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
import { useManagedUserMutations } from '@/features/user-management/use-user-management'
import { UserForm } from './user-form'
import type { CreateUserFormValues } from '@/features/user-management/managed-user.schema'

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { createUser } = useManagedUserMutations()

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setErrorMessage(null)
  }

  const handleSubmit = async (values: CreateUserFormValues) => {
    try {
      await createUser.mutateAsync({
        email: values.email,
        displayName: values.name,
        password: values.password,
        role: values.role,
      })
      handleOpenChange(false)
    } catch (error) {
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
        Create User
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlusIcon className="size-5" aria-hidden />
          </span>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Create a student or instructor account.
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <UserForm
          onSubmit={handleSubmit}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
