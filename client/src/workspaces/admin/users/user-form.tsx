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
import { PasswordField } from '@/features/auth/sign-in/password-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUserFormSchema } from '@/features/user-management/managed-user.schema'
import type { CreateUserFormValues } from '@/features/user-management/managed-user.schema'
import { Input } from '@/components/ui/input'

const editUserFormSchema = createUserFormSchema.extend({
  password: z.literal(''),
})

type UserFormProps = {
  initialValues?: Partial<CreateUserFormValues>
  isEditing?: boolean
  lockedRole?: CreateUserFormValues['role']
  createLabel?: string
  onSubmit: (values: CreateUserFormValues) => void | Promise<void>
  onCancel?: () => void
  serverErrors?: Partial<Record<keyof CreateUserFormValues, string[]>>
}

export function UserForm({
  initialValues,
  isEditing = false,
  lockedRole,
  createLabel = 'User',
  onSubmit,
  onCancel,
  serverErrors = {},
}: UserFormProps) {
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(
      isEditing ? editUserFormSchema : createUserFormSchema,
    ),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initialValues?.name ?? '',
      email: initialValues?.email ?? '',
      password: '',
      role: lockedRole ?? initialValues?.role ?? 'STUDENT',
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
                {serverErrors.name?.map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
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
                {serverErrors.email?.map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
              </FormItem>
            )}
          />

          {isEditing ? (
            <p className="self-end text-xs text-muted-foreground">
              To change credentials, use Reset password from the user actions.
            </p>
          ) : (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className={lockedRole ? 'sm:col-span-2' : undefined}>
                  <PasswordField
                    {...field}
                    id="user-password"
                    label="Password"
                    placeholder="e.g., Password1!"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use 9–128 characters.
                  </p>
                  <FormMessage />
                  {serverErrors.password?.map((message) => (
                    <p key={message} className="text-sm text-destructive">
                      {message}
                    </p>
                  ))}
                </FormItem>
              )}
            />
          )}

          {lockedRole ? null : (
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
                  {serverErrors.role?.map((message) => (
                    <p key={message} className="text-sm text-destructive">
                      {message}
                    </p>
                  ))}
                </FormItem>
              )}
            />
          )}
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
                : `Create ${createLabel}`}
          </Button>
        </div>
      </form>
    </Form>
  )
}
