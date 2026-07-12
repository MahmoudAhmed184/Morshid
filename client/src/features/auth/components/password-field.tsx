import { Eye, EyeOff, Lock } from 'lucide-react'
import * as React from 'react'
import { useState } from 'react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type PasswordFieldProps = Omit<
  React.ComponentProps<'input'>,
  'id' | 'type' | 'placeholder'
> & {
  id?: string
  label?: string
  placeholder?: string
  forgotPasswordHref?: string
  className?: string
}

export const PasswordField = React.forwardRef<
  HTMLInputElement,
  PasswordFieldProps
>(function PasswordFieldInput(
  {
    id = 'password',
    label = 'Password',
    placeholder = '••••••••',
    forgotPasswordHref = '#',
    className,
    ...inputProps
  },
  ref,
) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={id}
          className="text-xs font-medium tracking-[0.12em] text-foreground uppercase sm:text-sm"
        >
          {label}
        </Label>
        <a
          href={forgotPasswordHref}
          className={cn(
            'text-sm font-medium text-primary transition-colors hover:text-primary/80 sm:text-base',
          )}
        >
          Forgot Password?
        </a>
      </div>
      <InputGroup className="h-12 rounded-full px-1">
        <InputGroupAddon align="inline-start" className="pl-3">
          <Lock className="size-[1.125rem] text-foreground" aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete="current-password"
          className="text-base"
          {...inputProps}
        />
        <InputGroupAddon align="inline-end" className="pr-1">
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
})
