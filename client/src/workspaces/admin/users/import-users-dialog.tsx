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

type ImportUsersDialogProps = {
  role: CreateManagedUserInput['role']
  userLabel: string
}

export function ImportUsersDialog({ role, userLabel }: ImportUsersDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const { bulkCreateUsers } = useManagedUserMutations()

  const reset = () => {
    setFile(null)
    setErrors([])
  }

  const handleImport = async () => {
    if (!file) {
      setErrors(['Choose a CSV file to import.'])
      return
    }

    const parsed = await parseUserImport(file, role)
    if (parsed.errors.length > 0) {
      setErrors(parsed.errors)
      return
    }

    try {
      await bulkCreateUsers.mutateAsync(parsed.users)
      setOpen(false)
      reset()
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : 'Unable to import users.',
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
            Upload up to 200 accounts. Required columns are displayName, email,
            and password. The import is all-or-nothing.
          </DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={downloadUserImportTemplate}
        >
          <DownloadIcon />
          Download CSV template
        </Button>

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
          <Button
            type="button"
            disabled={!file || bulkCreateUsers.isPending}
            onClick={() => void handleImport()}
          >
            <UploadIcon />
            {bulkCreateUsers.isPending ? 'Importing...' : 'Import users'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
