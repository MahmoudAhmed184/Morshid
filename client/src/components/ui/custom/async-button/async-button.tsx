import { useState } from 'react'
import { Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'

type AsyncButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  onClick: () => void | Promise<void>
  loadingText?: React.ReactNode
  isLoading?: boolean
}

/*
Usage:
<AsyncButton onClick={saveCourse} loadingText="Saving...">
  Save
</AsyncButton>
*/
export function AsyncButton({
  onClick,
  loadingText,
  isLoading,
  disabled,
  children,
  ...props
}: AsyncButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const loading = isLoading ?? internalLoading

  const handleClick = async () => {
    if (loading) {
      return
    }

    try {
      setInternalLoading(true)
      await onClick()
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <Button
      disabled={disabled || loading}
      onClick={() => void handleClick()}
      {...props}
    >
      {loading ? <Loader2Icon className="animate-spin" /> : null}
      {loading ? (loadingText ?? children) : children}
    </Button>
  )
}
