import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon, UploadIcon } from 'lucide-react'
import { useState } from 'react'
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
import { isApiError } from '@/features/auth/api/authenticated-api-client'
import { useUploadInstructorMaterial } from '@/features/instructor/hooks/use-instructor-materials'
import { instructorMaterialUploadSchema } from '@/features/instructor/schemas/instructor-material.schema'
import type { InstructorMaterialUpload } from '@/features/instructor/schemas/instructor-material.schema'

export function MaterialUploadForm({ courseId }: { courseId: string }) {
  const uploadMutation = useUploadInstructorMaterial()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const form = useForm<InstructorMaterialUpload>({
    resolver: zodResolver(instructorMaterialUploadSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      title: '',
      file: undefined,
    },
  })

  const handleSubmit = async ({ title, file }: InstructorMaterialUpload) => {
    setSuccessMessage(null)

    try {
      await uploadMutation.mutateAsync({ courseId, title, file })
      form.reset()
      setSuccessMessage('PDF uploaded and queued for processing.')
    } catch (error) {
      form.setError('root', {
        message: isApiError(error)
          ? error.message
          : 'Unable to upload this PDF. Please try again.',
      })
    }
  }

  const requestError = form.formState.errors.root?.message
  const isPending = uploadMutation.isPending || form.formState.isSubmitting

  return (
    <Form {...form}>
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Material title</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g., Week 2 lecture notes"
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="file"
          render={({ field: { onChange, onBlur, name, ref } }) => (
            <FormItem>
              <FormLabel>PDF file</FormLabel>
              <FormControl>
                <Input
                  ref={ref}
                  name={name}
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={isPending}
                  onBlur={onBlur}
                  onChange={(event) => onChange(event.target.files?.[0])}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <UploadIcon aria-hidden />
          )}
          {isPending ? 'Uploading...' : 'Upload PDF'}
        </Button>

        {requestError ? (
          <p role="alert" className="text-sm text-destructive">
            {requestError}
          </p>
        ) : null}
        {successMessage ? (
          <p role="status" className="text-sm text-muted-foreground">
            {successMessage}
          </p>
        ) : null}
      </form>
    </Form>
  )
}
