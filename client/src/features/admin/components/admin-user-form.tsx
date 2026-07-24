import { zodResolver } from '@hookform/resolvers/zod'
import { CheckIcon, Loader2Icon, UserPlusIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PasswordField } from '@/features/auth/components/password-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminCreateUserFormSchema } from '../schemas/admin-managed-user.schema'
import type { AdminCreateUserFormValues } from '../schemas/admin-managed-user.schema'
import { Input } from '@/components/ui/input'

const adminEditUserFormSchema = adminCreateUserFormSchema.extend({
  password: z
    .string()
    .transform((val) => val.trim())
    .refine(
      (val) =>
        val.length === 0 ||
        (val.length >= 8 &&
          val.length <= 50 &&
          /[A-Za-z]/.test(val) &&
          /\d/.test(val) &&
          /[^A-Za-z0-9]/.test(val)),
      {
        message:
          'Password must be 8–50 characters with at least one letter, number, and symbol (or leave blank to keep unchanged).',
      },
    ),
})

type AdminUserFormProps = {
  initialValues?: Partial<AdminCreateUserFormValues>
  isEditing?: boolean
  onSubmit: (values: AdminCreateUserFormValues) => void | Promise<void>
  onCancel?: () => void
}

export function AdminUserForm({
  initialValues,
  isEditing = false,
  onSubmit,
  onCancel,
}: AdminUserFormProps) {
  const form = useForm<AdminCreateUserFormValues>({
    resolver: zodResolver(
      isEditing ? adminEditUserFormSchema : adminCreateUserFormSchema,
    ),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initialValues?.name ?? '',
      email: initialValues?.email ?? '',
      password: '',
      role: initialValues?.role ?? 'STUDENT',
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
                <PasswordField
                  {...field}
                  id="user-password"
                  label={isEditing ? 'New Password (Optional)' : 'Password'}
                  placeholder={
                    isEditing ? 'Leave blank to keep current' : 'e.g., Password1!'
                  }
                  autoComplete="new-password"
                  showForgotPassword={false}
                />
                <p className="text-xs text-muted-foreground">
                  {isEditing
                    ? 'Leave empty to preserve existing password.'
                    : '8–50 characters with at least one letter, number, and symbol.'}
                </p>
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
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                  </SelectContent>
                </Select>
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
            ) : isEditing ? (
              <CheckIcon />
            ) : (
              <UserPlusIcon />
            )}
            {isSubmitting
              ? isEditing
                ? 'Updating...'
                : 'Creating...'
              : isEditing
                ? 'Update User'
                : 'Create User'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
