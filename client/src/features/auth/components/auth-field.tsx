import type { LucideIcon } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

type AuthFieldProps = {
  id: string
  label: string
  icon: LucideIcon
  type?: React.ComponentProps<'input'>['type']
  placeholder?: string
  autoComplete?: string
  className?: string
  inputClassName?: string
  labelAction?: React.ReactNode
  trailing?: React.ReactNode
}

export function AuthField({
  id,
  label,
  icon: Icon,
  type = 'text',
  placeholder,
  autoComplete,
  className,
  inputClassName,
  labelAction,
  trailing,
}: AuthFieldProps) {
  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={id}
          className="text-xs font-medium tracking-[0.12em] text-foreground uppercase sm:text-sm"
        >
          {label}
        </Label>
        {labelAction}
      </div>
      <InputGroup className="h-12 rounded-full px-1">
        <InputGroupAddon align="inline-start" className="pl-3">
          <Icon className="size-[1.125rem] text-foreground" aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn('text-base', inputClassName)}
        />
        {trailing}
      </InputGroup>
    </div>
  )
}
