import { DownloadIcon, FileSpreadsheetIcon, UploadIcon } from 'lucide-react'
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
  const { stageUserImport, approveImport } = useManagedUserMutations()

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
            {userImport.rows.map((row) => (
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
                    {row.status}
                  </span>
                </div>
                {row.errors.length > 0 ? (
                  <ul className="mt-2 list-disc pl-4 text-destructive">
                    {row.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
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
                !userImport.rows.some((row) => row.status === 'VALID')
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
