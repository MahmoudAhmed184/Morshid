import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark, Loader2, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { updateUniversityFormSchema } from '@/features/universities/universities.schema'
import type {
  UniversityItem,
  UpdateUniversityFormValues,
} from '@/features/universities/universities.schema'
import { ManagerFields, UniversityFields } from './university-form-fields'
import { useUniversityMutations } from './use-universities'

type EditUniversityDialogProps = {
  university: UniversityItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  section?: 'university' | 'manager'
}

export function EditUniversityDialog({
  university,
  open,
  onOpenChange,
  section = 'university',
}: EditUniversityDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<keyof UpdateUniversityFormValues, string>>
  >({})
  const { updateUniversity } = useUniversityMutations()

  const form = useForm<UpdateUniversityFormValues>({
    resolver: zodResolver(updateUniversityFormSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      name: university?.name ?? '',
      code: university?.code ?? '',
      ownerDisplayName: university?.owner?.displayName ?? '',
      ownerEmail: university?.owner?.email ?? '',
      ownerPassword: '',
    },
  })

  useEffect(() => {
    if (university && open) {
      form.reset({
        name: university.name,
        code: university.code,
        ownerDisplayName: university.owner?.displayName ?? '',
        ownerEmail: university.owner?.email ?? '',
        ownerPassword: '',
      })
    }
  }, [form, open, section, university])

  if (!university) return null

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setErrorMessage(null)
      setServerFieldErrors({})
    }
  }

  const onSubmit = async (values: UpdateUniversityFormValues) => {
    setErrorMessage(null)
    setServerFieldErrors({})

    const payload: UpdateUniversityFormValues = {}
    if (section === 'university') {
      if (values.name && values.name !== university.name) {
        payload.name = values.name
      }
      if (values.code && values.code !== university.code) {
        payload.code = values.code
      }
    } else {
      if (
        values.ownerDisplayName &&
        values.ownerDisplayName !== university.owner?.displayName
      ) {
        payload.ownerDisplayName = values.ownerDisplayName
      }
      if (values.ownerEmail && values.ownerEmail !== university.owner?.email) {
        payload.ownerEmail = values.ownerEmail
      }
      if (values.ownerPassword) {
        payload.ownerPassword = values.ownerPassword
      }
    }

    if (Object.keys(payload).length === 0) {
      handleOpenChange(false)
      return
    }

    try {
      await updateUniversity.mutateAsync({
        universityId: university.id,
        input: payload,
      })
      handleOpenChange(false)
    } catch (error) {
      if (isApiError(error) && error.validationErrors.length > 0) {
        const nextErrors: Partial<
          Record<keyof UpdateUniversityFormValues, string>
        > = {}
        for (const issue of error.validationErrors) {
          if (issue.field.includes('displayName')) {
            nextErrors.ownerDisplayName = issue.message
          } else if (issue.field.includes('email')) {
            nextErrors.ownerEmail = issue.message
          } else if (issue.field.includes('name')) {
            nextErrors.name = issue.message
          } else if (issue.field.includes('code')) {
            nextErrors.code = issue.message
          }
        }
        setServerFieldErrors(nextErrors)
        return
      }
      setErrorMessage(
        isApiError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to update university.',
      )
    }
  }

  const editingManager = section === 'manager'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {editingManager ? (
              <User className="size-5" aria-hidden />
            ) : (
              <Landmark className="size-5" aria-hidden />
            )}
          </div>
          <DialogTitle>
            {editingManager ? 'Edit Manager' : 'Edit University'}
          </DialogTitle>
          <DialogDescription>
            {editingManager
              ? `Update the primary administrator for ${university.name}.`
              : `Update the institution details for ${university.name}.`}
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            {editingManager ? (
              university.owner ? (
                <ManagerFields
                  form={form}
                  serverFieldErrors={serverFieldErrors}
                  passwordLabel="New Password"
                  passwordPlaceholder="Leave blank to keep current password"
                  passwordDescription="Minimum 15 characters. Leave blank to keep the current password."
                />
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No primary manager is assigned to this university.
                </div>
              )
            ) : (
              <UniversityFields
                form={form}
                serverFieldErrors={serverFieldErrors}
              />
            )}

            <DialogFooter className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
