import type { LucideIcon } from 'lucide-react'
import * as React from 'react'

import { Label } from '@/components/ui/label'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

type AuthFieldProps = Omit<
  React.ComponentProps<'input'>,
  'id' | 'type' | 'placeholder'
> & {
  id: string
  label: string
  icon: LucideIcon
  type?: React.ComponentProps<'input'>['type']
  placeholder?: string
  className?: string
  inputClassName?: string
  labelAction?: React.ReactNode
  trailing?: React.ReactNode
}

export const AuthField = React.forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthFieldInput(
    {
      id,
      label,
      icon: Icon,
      type = 'text',
      placeholder,
      className,
      inputClassName,
      labelAction,
      trailing,
      ...inputProps
    },
    ref,
  ) {
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
            ref={ref}
            id={id}
            type={type}
            placeholder={placeholder}
            className={cn('text-base', inputClassName)}
            {...inputProps}
          />
          {trailing}
        </InputGroup>
      </div>
    )
  },
)
