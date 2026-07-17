import { useState } from 'react'
import { Plus } from 'lucide-react'

import { AsyncButton } from '@/components/ui/custom/async-button'

interface StudentCreateSessionButtonProps {
  isPending: boolean
  onCreate: () => Promise<void>
}

export function StudentCreateSessionButton({
  isPending,
  onCreate,
}: StudentCreateSessionButtonProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCreate = async () => {
    setErrorMessage(null)

    try {
      await onCreate()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create a conversation.',
      )
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <AsyncButton
        type="button"
        size="sm"
        isLoading={isPending}
        loadingText="Creating..."
        onClick={handleCreate}
      >
        <Plus aria-hidden />
        New chat
      </AsyncButton>
      {errorMessage ? (
        <p
          role="alert"
          className="max-w-36 text-right text-xs text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
