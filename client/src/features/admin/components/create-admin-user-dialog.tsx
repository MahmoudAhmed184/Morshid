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
import { useAdminUserMutations } from '@/features/admin/hooks/use-admin-users'
import { AdminUserForm } from './admin-user-form'
import type { AdminCreateUserFormValues } from '../schemas/admin-managed-user.schema'

export function CreateAdminUserDialog() {
  const [open, setOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { createUser } = useAdminUserMutations()

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setErrorMessage(null)
  }

  const handleSubmit = async (values: AdminCreateUserFormValues) => {
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
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
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
        <AdminUserForm
          onSubmit={handleSubmit}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
