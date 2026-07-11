import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon, SaveIcon, UserPlusIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAdminUserFormSchema } from '../schemas/admin-user.schema'
import type { AdminUserFormValues } from '../schemas/admin-user.schema'
import type { AdminUser } from '../data/admin-ops.types'

type EditableAdminUser = AdminUser & {
  role: 'Student' | 'Instructor'
}

type AdminUserFormProps = {
  user?: EditableAdminUser
  onSubmit: (values: AdminUserFormValues) => void | Promise<void>
  onCancel?: () => void
}

export function AdminUserForm({
  user,
  onSubmit,
  onCancel,
}: AdminUserFormProps) {
  const mode = user ? 'update' : 'create'
  const schema = useMemo(() => createAdminUserFormSchema(mode), [mode])
  const form = useForm<AdminUserFormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'Student',
      image: null,
    },
  })
  const isSubmitting = form.formState.isSubmitting

  return (
    <Form {...form}>
      <form
        className="space-y-5"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g., Sarah Al-Farsi"
                    autoComplete="name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="sarah@morshid.demo"
                    autoComplete="email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    placeholder={
                      mode === 'create'
                        ? 'Temporary password'
                        : 'Leave blank to keep current'
                    }
                    autoComplete="new-password"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Choose role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Student">Student</SelectItem>
                    <SelectItem value="Instructor">Instructor</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="image"
            render={({ field: { onChange, ref, name } }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Image</FormLabel>
                <FormControl>
                  <Input
                    ref={ref}
                    name={name}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      onChange(event.target.files?.[0] ?? null)
                    }
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Optional. JPG, PNG, or WebP up to 2MB.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2Icon className="animate-spin" />
            ) : user ? (
              <SaveIcon />
            ) : (
              <UserPlusIcon />
            )}
            {isSubmitting
              ? user
                ? 'Saving...'
                : 'Creating...'
              : user
                ? 'Save User'
                : 'Create User'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
