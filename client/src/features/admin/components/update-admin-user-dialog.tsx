import { PencilIcon } from 'lucide-react'
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
import type { AdminUser } from '../data/admin-ops.types'
import type { AdminUserFormValues } from '../schemas/admin-user.schema'

export type EditableAdminUser = AdminUser & {
  role: 'Student' | 'Instructor'
}

export function UpdateAdminUserDialog({ user }: { user: EditableAdminUser }) {
  const [open, setOpen] = useState(false)

  const handleSubmit = async (values: AdminUserFormValues) => {
    await submitAdminUserForm(values)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">Update user</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Update User</DialogTitle>
          <DialogDescription>
            Update profile and role fields before wiring the user API.
          </DialogDescription>
        </DialogHeader>
        <AdminUserForm
          user={user}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
