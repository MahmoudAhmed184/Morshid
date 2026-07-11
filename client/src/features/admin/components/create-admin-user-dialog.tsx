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
import { AdminUserForm } from './admin-user-form'
import { submitAdminUserForm } from '../data/admin-user-form.api'
import type { AdminUserFormValues } from '../schemas/admin-user.schema'

export function CreateAdminUserDialog() {
  const [open, setOpen] = useState(false)

  const handleSubmit = async (values: AdminUserFormValues) => {
    await submitAdminUserForm(values)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon />
        Create User
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Shell form for the P0 user creation API contract.
          </DialogDescription>
        </DialogHeader>
        <AdminUserForm
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
