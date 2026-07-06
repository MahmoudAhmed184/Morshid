import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

type CopyButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  value: string
  copiedLabel?: React.ReactNode
}

/*
Usage:
<CopyButton value={course.id} variant="outline" size="sm">
  Copy ID
</CopyButton>
*/
export function CopyButton({
  value,
  copiedLabel = 'Copied',
  children = 'Copy',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copyValue = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button onClick={() => void copyValue()} {...props}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? copiedLabel : children}
    </Button>
  )
}
