import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark, Plus } from 'lucide-react'
import { useState } from 'react'
import type { FieldErrors } from 'react-hook-form'
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
  FormDescription,
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
import { createUniversityFormSchema } from '@/features/universities/universities.schema'
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
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<keyof CreateUniversityFormValues, string>>
  >({})

  const { createUniversity } = useUniversityMutations()

  const form = useForm<CreateUniversityFormValues>({
    resolver: zodResolver(createUniversityFormSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
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
      setServerFieldErrors({})
    }
  }

  const onSubmit = async (values: CreateUniversityFormValues) => {
    setErrorMessage(null)
    setServerFieldErrors({})

    try {
      await createUniversity.mutateAsync(values)
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

  const onInvalid = (errors: FieldErrors<CreateUniversityFormValues>) => {
    if (errors.name || errors.code || errors.status) {
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
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" aria-hidden />
        Create University
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Landmark className="size-5" aria-hidden />
          </div>
          <DialogTitle>Create University</DialogTitle>
          <DialogDescription>
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
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            noValidate
            className="space-y-5"
          >
            <UniversityDialogTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              universityDescription="Basic information about the university and its lifecycle status."
              managerDescription="The primary manager account responsible for managing this university."
              universityContent={
                <>
                  <UniversityFields
                    form={form}
                    serverFieldErrors={serverFieldErrors}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Initial Status{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          items={STATUS_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
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
                        <FormDescription className="text-xs">
                          Set the initial lifecycle status.
                        </FormDescription>
                        <FormMessage />
                        {serverFieldErrors.status ? (
                          <p className="text-xs font-semibold text-destructive">
                            {serverFieldErrors.status}
                          </p>
                        ) : null}
                      </FormItem>
                    )}
                  />
                </>
              }
              managerContent={
                <ManagerFields
                  form={form}
                  serverFieldErrors={serverFieldErrors}
                  passwordLabel="Initial Password"
                />
              }
              onCancel={() => handleOpenChange(false)}
              onNext={async () => {
                const isValid = await form.trigger(['name', 'code', 'status'])
                if (isValid) {
                  setActiveTab('admin')
                }
              }}
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
