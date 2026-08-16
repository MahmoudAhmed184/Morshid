import {
  DownloadIcon,
  FileSpreadsheetIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { useManagedUserMutations } from './use-user-management'
import { downloadUserImportTemplate, parseUserImport } from './user-import.csv'
import type { CreateManagedUserInput } from '@/features/user-management/user-management.api'
import type { UserImport } from '@/features/user-management/managed-user.schema'

type ImportUsersDialogProps = {
  role: CreateManagedUserInput['role']
  userLabel: string
}

export function ImportUsersDialog({ role, userLabel }: ImportUsersDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [userImport, setUserImport] = useState<UserImport | null>(null)
  const { stageUserImport, approveImport, editImportRow, cancelImportRow } =
    useManagedUserMutations()

  const reset = () => {
    setFile(null)
    setErrors([])
    setUserImport(null)
  }

  const handleImport = async () => {
    if (!file) {
      setErrors(['Choose a CSV file to import.'])
      return
    }

    const parsed = await parseUserImport(file, role)
    if (parsed.rows.length === 0) {
      setErrors(parsed.errors)
      return
    }

    try {
      setUserImport(await stageUserImport.mutateAsync(parsed.rows))
      setErrors(parsed.errors)
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : 'Unable to import users.',
      ])
    }
  }

  const handleApprove = async () => {
    if (!userImport) return
    try {
      setUserImport(await approveImport.mutateAsync(userImport.id))
      setErrors([])
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : 'Unable to approve import.',
      ])
    }
  }

  const handleEdit = async (
    rowId: string,
    input: { displayName: string; email: string; password?: string },
  ) => {
    if (!userImport) return
    setUserImport(
      await editImportRow.mutateAsync({
        importId: userImport.id,
        rowId,
        input,
      }),
    )
  }

  const handleRemove = async (rowId: string) => {
    if (!userImport) return
    setUserImport(
      await cancelImportRow.mutateAsync({ importId: userImport.id, rowId }),
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <UploadIcon />
        Import CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheetIcon className="size-5" aria-hidden />
          </span>
          <DialogTitle>Import {userLabel}</DialogTitle>
          <DialogDescription>
            Upload up to 200 accounts, review every row, then approve valid
            accounts. Invalid rows remain visible with their reasons.
          </DialogDescription>
        </DialogHeader>

        {userImport ? null : (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={downloadUserImportTemplate}
          >
            <DownloadIcon />
            Download CSV template
          </Button>
        )}

        {userImport ? null : (
          <div className="space-y-2">
            <label htmlFor="user-csv-file" className="text-sm font-medium">
              Completed CSV file
            </label>
            <Input
              id="user-csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setErrors([])
              }}
            />
          </div>
        )}

        {userImport ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {userImport.rows
              .filter((row) => row.status !== 'CANCELLED')
              .map((row) => (
                <div key={row.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        Row {row.rowNumber}: {row.displayName || 'Missing name'}
                      </p>
                      <p className="text-muted-foreground">
                        {row.email || 'Missing email'} ·{' '}
                        {row.role || 'Invalid role'}
                      </p>
                    </div>
                    <span
                      className={
                        row.status === 'INVALID'
                          ? 'text-destructive'
                          : 'text-emerald-600'
                      }
                    >
                      {row.status === 'VALID'
                        ? 'READY TO APPROVE'
                        : row.status === 'INVALID'
                          ? 'NEEDS FIX'
                          : 'APPROVED'}
                    </span>
                  </div>
                  {row.errors.length > 0 ? (
                    <ul className="mt-2 list-disc pl-4 text-destructive">
                      {row.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  ) : null}
                  {userImport.status === 'PENDING' &&
                  row.status !== 'APPROVED' ? (
                    <div className="flex gap-2">
                      <EditImportRowDialog
                        row={row}
                        pending={editImportRow.isPending}
                        onSave={(input) => handleEdit(row.id, input)}
                      />
                      <RemoveImportRowDialog
                        pending={cancelImportRow.isPending}
                        onRemove={() => handleRemove(row.id)}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        ) : null}

        {errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Import could not be completed</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {errors.slice(0, 8).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
              {errors.length > 8 ? (
                <p className="mt-2">And {errors.length - 8} more errors.</p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter showCloseButton>
          {userImport?.status === 'PENDING' ? (
            <Button
              type="button"
              disabled={
                approveImport.isPending ||
                !userImport.rows.some((row) => row.status === 'VALID') ||
                userImport.rows.some((row) => row.status === 'INVALID')
              }
              onClick={() => void handleApprove()}
            >
              <UploadIcon />
              {approveImport.isPending ? 'Approving...' : 'Approve valid users'}
            </Button>
          ) : userImport?.status === 'APPROVED' ? (
            <p className="text-sm text-emerald-600">
              Valid users were created successfully.
            </p>
          ) : (
            <Button
              type="button"
              disabled={!file || stageUserImport.isPending}
              onClick={() => void handleImport()}
            >
              <UploadIcon />
              {stageUserImport.isPending ? 'Validating...' : 'Review import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveImportRowDialog({
  pending,
  onRemove,
}: {
  pending: boolean
  onRemove: () => Promise<void>
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button className="mt-3" size="sm" variant="outline" disabled={pending}>
          <Trash2Icon /> Remove
        </Button>
      }
      title="Remove this user from the import?"
      description="This row will not be imported."
      confirmLabel="Remove"
      disabled={pending}
      onConfirm={onRemove}
    />
  )
}

type ImportRow = UserImport['rows'][number]

export function EditImportRowDialog({
  row,
  pending,
  onSave,
}: {
  row: ImportRow
  pending: boolean
  onSave: (input: {
    displayName: string
    email: string
    password?: string
  }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(row.displayName ?? '')
  const [email, setEmail] = useState(row.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    setPasswordError(null)
    try {
      await onSave({
        displayName,
        email,
        ...(password === '' ? {} : { password }),
      })
      setOpen(false)
      setPassword('')
      setError(null)
    } catch (cause) {
      if (isApiError(cause)) {
        const validationError = cause.validationErrors.find(
          (issue) => issue.field === 'password',
        )
        if (validationError !== undefined) {
          setPasswordError(validationError.message)
          return
        }
      }
      setError(cause instanceof Error ? cause.message : 'Unable to update row.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setDisplayName(row.displayName ?? '')
          setEmail(row.email ?? '')
          setPassword('')
          setError(null)
          setPasswordError(null)
        }
      }}
    >
      <DialogTrigger
        render={<Button className="mt-3" size="sm" variant="outline" />}
      >
        <PencilIcon /> Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit imported user</DialogTitle>
          <DialogDescription>
            The password is never displayed. Leave it blank to keep the secured
            password already staged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Name</span>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <div className="space-y-1">
            <label
              htmlFor={`import-row-password-${row.id}`}
              className="text-sm font-medium"
            >
              Replace password (optional)
            </label>
            <Input
              id={`import-row-password-${row.id}`}
              type="password"
              value={password}
              autoComplete="new-password"
              placeholder={
                row.hasPassword
                  ? 'Keep existing secured password'
                  : 'Password required'
              }
              onChange={(event) => setPassword(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Leave blank to keep the current password.
            </span>
            {passwordError === null ? null : (
              <p role="alert" className="text-sm text-destructive">
                {passwordError}
              </p>
            )}
          </div>
          {row.errors.length > 0 ? (
            <ul className="list-disc pl-4 text-sm text-destructive">
              {row.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          {error === null ? null : (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter showCloseButton>
          <Button type="button" disabled={pending} onClick={() => void save()}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
