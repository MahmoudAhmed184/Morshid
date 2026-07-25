import { zodResolver } from '@hookform/resolvers/zod'
import { BookPlusIcon, CheckIcon, Loader2Icon } from 'lucide-react'
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
import { Input } from '@/components/ui/input'

const adminCourseFormSchema = z.object({
  code: z.string().min(2, 'Course code must be at least 2 characters.'),
  title: z.string().min(3, 'Course title must be at least 3 characters.'),
})

export type AdminCourseFormValues = z.infer<typeof adminCourseFormSchema>

type AdminCourseFormProps = {
  initialValues?: Partial<AdminCourseFormValues>
  isEditing?: boolean
  onSubmit: (values: AdminCourseFormValues) => void | Promise<void>
  onCancel?: () => void
}

export function AdminCourseForm({
  initialValues,
  isEditing = false,
  onSubmit,
  onCancel,
}: AdminCourseFormProps) {
  const form = useForm<AdminCourseFormValues>({
    resolver: zodResolver(adminCourseFormSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      code: initialValues?.code ?? '',
      title: initialValues?.title ?? '',
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
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course Code</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g., CS-101"
                    className="font-mono"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course Title</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g., Data Structures & Algorithms"
                  />
                </FormControl>
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
              <BookPlusIcon />
            )}
            {isSubmitting
              ? isEditing
                ? 'Updating...'
                : 'Creating...'
              : isEditing
                ? 'Update Course'
                : 'Create Course'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
