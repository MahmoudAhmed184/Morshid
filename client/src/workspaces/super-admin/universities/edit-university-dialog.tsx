import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FieldErrors } from 'react-hook-form'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useUniversityMutations } from './use-universities'
import {
  ManagerFields,
  UniversityDialogTabs,
  UniversityFields,
} from './university-form-fields'

type EditUniversityDialogProps = {
  university: UniversityItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditUniversityDialog({
  university,
  open,
  onOpenChange,
}: EditUniversityDialogProps) {
  const [activeTab, setActiveTab] = useState<'university' | 'admin'>(
    'university',
  )
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
  }, [form, open, university])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setActiveTab('university')
      setErrorMessage(null)
      setServerFieldErrors({})
    }
  }

  if (!university) {
    return null
  }

  const onSubmit = async (values: UpdateUniversityFormValues) => {
    setErrorMessage(null)
    setServerFieldErrors({})

    const payload: UpdateUniversityFormValues = {}
    if (values.name && values.name !== university.name) {
      payload.name = values.name
    }
    if (values.code && values.code !== university.code) {
      payload.code = values.code
    }
    if (
      values.ownerDisplayName &&
      values.ownerDisplayName !== university.owner?.displayName
    ) {
      payload.ownerDisplayName = values.ownerDisplayName
    }
    if (values.ownerEmail && values.ownerEmail !== university.owner?.email) {
      payload.ownerEmail = values.ownerEmail
    }
    if (values.ownerPassword && values.ownerPassword !== '') {
      payload.ownerPassword = values.ownerPassword
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
      if (isApiError(error)) {
        if (error.validationErrors.length > 0) {
          const nextErrors: Partial<
            Record<keyof UpdateUniversityFormValues, string>
          > = {}
          for (const issue of error.validationErrors) {
            if (
              issue.field.includes('name') &&
              !issue.field.includes('owner')
            ) {
              nextErrors.name = issue.message
            } else if (issue.field.includes('code')) {
              nextErrors.code = issue.message
            } else if (issue.field.includes('displayName')) {
              nextErrors.ownerDisplayName = issue.message
            } else if (issue.field.includes('email')) {
              nextErrors.ownerEmail = issue.message
            }
          }
          if (Object.keys(nextErrors).length > 0) {
            setServerFieldErrors(nextErrors)
            if (nextErrors.name || nextErrors.code) {
              setActiveTab('university')
            } else {
              setActiveTab('admin')
            }
            return
          }
        }
        setErrorMessage(error.message)
        return
      }

      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to update university.',
      )
    }
  }

  const onInvalid = (errors: FieldErrors<UpdateUniversityFormValues>) => {
    if (errors.name || errors.code) {
      setActiveTab('university')
    } else if (
      errors.ownerDisplayName ||
      errors.ownerEmail ||
      errors.ownerPassword
    ) {
      setActiveTab('admin')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Landmark className="size-5" aria-hidden />
          </div>
          <DialogTitle>Edit University</DialogTitle>
          <DialogDescription>
            Update details for{' '}
            <strong className="font-semibold text-foreground">
              {university.name}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            noValidate
            className="space-y-5"
          >
            <UniversityDialogTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              universityDescription="Basic information about the university and its identifier."
              managerDescription="Primary manager account assigned to this university."
              universityContent={
                <UniversityFields
                  form={form}
                  serverFieldErrors={serverFieldErrors}
                />
              }
              managerContent={
                university.owner ? (
                  <ManagerFields
                    form={form}
                    serverFieldErrors={serverFieldErrors}
                    passwordLabel="New Password"
                    passwordPlaceholder="Leave blank to keep current password"
                    passwordDescription="Minimum 15 characters. Leave blank to keep the current password."
                  />
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                    No primary manager currently assigned to this university.
                  </div>
                )
              }
              onCancel={() => handleOpenChange(false)}
              onNext={async () => {
                const isValid = await form.trigger(['name', 'code'])
                if (isValid) {
                  setActiveTab('admin')
                }
              }}
              submitLabel="Save Changes"
              submittingLabel="Saving..."
              isSubmitting={form.formState.isSubmitting}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
