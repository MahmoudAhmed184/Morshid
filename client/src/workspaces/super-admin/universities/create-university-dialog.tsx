import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import {
  createUniversityDetailsFormSchema,
  createUniversityFormSchema,
} from '@/features/universities/universities.schema'
import type {
  CreateUniversityFormValues,
  UniversityStatus,
} from '@/features/universities/universities.schema'
import { useUniversityMutations } from './use-universities'
import {
  ManagerFields,
  UniversityDialogTabs,
  UniversityFields,
} from './university-form-fields'

const STATUS_OPTIONS: Array<{ value: UniversityStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

export function CreateUniversityDialog() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'university' | 'admin'>(
    'university',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showManagerValidation, setShowManagerValidation] = useState(false)
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<keyof CreateUniversityFormValues, string>>
  >({})

  const { createUniversity } = useUniversityMutations()

  const form = useForm<CreateUniversityFormValues>({
    shouldUnregister: false,
    defaultValues: {
      name: '',
      code: '',
      status: 'ACTIVE',
      ownerDisplayName: '',
      ownerEmail: '',
      ownerPassword: '',
    },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      form.reset()
      setActiveTab('university')
      setErrorMessage(null)
      setShowManagerValidation(false)
      setServerFieldErrors({})
    }
  }

  const validateUniversityStep = () => {
    form.clearErrors(['name', 'code', 'status'])
    const values = form.getValues()
    const result = createUniversityDetailsFormSchema.safeParse(values)

    if (result.success) {
      form.clearErrors(['ownerDisplayName', 'ownerEmail', 'ownerPassword'])
      return true
    }

    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof CreateUniversityFormValues
      if (field === 'name' || field === 'code' || field === 'status') {
        form.setError(field, { type: 'manual', message: issue.message })
      }
    }
    return false
  }

  const handleTabChange = (nextTab: 'university' | 'admin') => {
    if (nextTab === 'admin') {
      if (validateUniversityStep()) {
        setShowManagerValidation(false)
        form.clearErrors(['ownerDisplayName', 'ownerEmail', 'ownerPassword'])
        setActiveTab('admin')
      }
    } else {
      setShowManagerValidation(false)
      form.clearErrors(['ownerDisplayName', 'ownerEmail', 'ownerPassword'])
      setActiveTab('university')
    }
  }

  const handleNext = () => {
    if (validateUniversityStep()) {
      setShowManagerValidation(false)
      form.clearErrors(['ownerDisplayName', 'ownerEmail', 'ownerPassword'])
      setActiveTab('admin')
    }
  }

  const handleCreate = async () => {
    form.clearErrors()
    const values = form.getValues()
    const result = createUniversityFormSchema.safeParse(values)

    if (!result.success) {
      let hasUniversityError = false
      let hasManagerError = false

      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof CreateUniversityFormValues
        form.setError(field, { type: 'manual', message: issue.message })
        if (field === 'name' || field === 'code' || field === 'status') {
          hasUniversityError = true
        } else {
          hasManagerError = true
        }
      }

      if (hasUniversityError) {
        setActiveTab('university')
        setShowManagerValidation(false)
      } else if (hasManagerError) {
        setShowManagerValidation(true)
      }
      return
    }

    setShowManagerValidation(true)
    setErrorMessage(null)
    setServerFieldErrors({})

    try {
      await createUniversity.mutateAsync(result.data)
      handleOpenChange(false)
    } catch (error) {
      if (isApiError(error)) {
        if (error.validationErrors.length > 0) {
          const nextFieldErrors: Partial<
            Record<keyof CreateUniversityFormValues, string>
          > = {}

          for (const issue of error.validationErrors) {
            if (issue.field.includes('name')) {
              nextFieldErrors.name = issue.message
            } else if (issue.field.includes('code')) {
              nextFieldErrors.code = issue.message
            } else if (issue.field.includes('owner.displayName')) {
              nextFieldErrors.ownerDisplayName = issue.message
            } else if (issue.field.includes('owner.email')) {
              nextFieldErrors.ownerEmail = issue.message
            } else if (issue.field.includes('owner.password')) {
              nextFieldErrors.ownerPassword = issue.message
            } else if (issue.field.includes('status')) {
              nextFieldErrors.status = issue.message
            }
          }

          if (Object.keys(nextFieldErrors).length > 0) {
            setServerFieldErrors(nextFieldErrors)
            if (
              nextFieldErrors.name ||
              nextFieldErrors.code ||
              nextFieldErrors.status
            ) {
              setActiveTab('university')
            } else if (
              nextFieldErrors.ownerDisplayName ||
              nextFieldErrors.ownerEmail ||
              nextFieldErrors.ownerPassword
            ) {
              setActiveTab('admin')
            }
            return
          }
        }

        setErrorMessage(error.message)
        return
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create university. Please try again.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" aria-hidden />
        Create University
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create University</DialogTitle>
          <DialogDescription className="text-xs">
            Provision a new university tenant along with its initial primary
            manager account.
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form
            onSubmit={(event) => event.preventDefault()}
            noValidate
            className="space-y-4"
          >
            <UniversityDialogTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              universityDescription="Basic information about the university and its lifecycle status."
              managerDescription="The primary manager account responsible for managing this university."
              universityContent={
                <div className="space-y-3.5">
                  <UniversityFields
                    form={form}
                    serverFieldErrors={serverFieldErrors}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          Initial Status{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          items={STATUS_OPTIONS}
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            form.clearErrors('status')
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select status">
                                {(val) =>
                                  STATUS_OPTIONS.find(
                                    (opt) => opt.value === val,
                                  )?.label ?? 'Select status'
                                }
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {serverFieldErrors.status ? (
                          <p className="text-xs font-semibold text-destructive">
                            {serverFieldErrors.status}
                          </p>
                        ) : null}
                      </FormItem>
                    )}
                  />
                </div>
              }
              managerContent={
                <ManagerFields
                  form={form}
                  serverFieldErrors={serverFieldErrors}
                  passwordLabel="Initial Password"
                  showValidationErrors={showManagerValidation}
                />
              }
              onCancel={() => handleOpenChange(false)}
              onNext={handleNext}
              onSubmit={handleCreate}
              submitLabel="Create University"
              submittingLabel="Creating..."
              isSubmitting={form.formState.isSubmitting}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
