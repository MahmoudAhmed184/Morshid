import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContextValue = {
  value: string
  onValueChange: (value: string) => void
  orientation?: 'horizontal' | 'vertical'
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

type TabsProps = React.ComponentProps<'div'> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: 'horizontal' | 'vertical'
}

function Tabs({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  orientation = 'horizontal',
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : uncontrolledValue

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [isControlled, onValueChange],
  )

  return (
    <TabsContext.Provider
      value={{ value, onValueChange: handleValueChange, orientation }}
    >
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn('flex flex-col gap-2', className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

type TabsListProps = React.ComponentProps<'div'>

function TabsList({ className, children, ...props }: TabsListProps) {
  const { orientation } = useTabsContext()

  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      aria-orientation={orientation}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

type TabsTriggerProps = React.ComponentProps<'button'> & {
  value: string
}

function TabsTrigger({
  value,
  className,
  disabled,
  children,
  onClick,
  onKeyDown,
  ...props
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange, orientation } = useTabsContext()
  const isSelected = selectedValue === value

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (!disabled) {
      onValueChange(value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e)
    if (disabled) return

    const tabList = e.currentTarget.parentElement
    if (!tabList) return

    const tabs = Array.from(
      tabList.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not([disabled])',
      ),
    )
    const currentIndex = tabs.indexOf(e.currentTarget)
    if (currentIndex === -1) return

    let nextIndex = -1
    const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'

    if (e.key === prevKey) {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === nextKey) {
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1
    }

    if (nextIndex !== -1) {
      e.preventDefault()
      const nextTab = tabs[nextIndex]
      nextTab.focus()
      nextTab.click()
    }
  }

  return (
    <button
      role="tab"
      type="button"
      data-slot="tabs-trigger"
      aria-selected={isSelected}
      data-state={isSelected ? 'active' : 'inactive'}
      disabled={disabled}
      tabIndex={isSelected ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

type TabsContentProps = React.ComponentProps<'div'> & {
  value: string
  forceMount?: boolean
}

function TabsContent({
  value,
  forceMount = false,
  className,
  children,
  ...props
}: TabsContentProps) {
  const { value: selectedValue } = useTabsContext()
  const isSelected = selectedValue === value

  if (!isSelected && !forceMount) {
    return null
  }

  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      data-state={isSelected ? 'active' : 'inactive'}
      hidden={!isSelected}
      tabIndex={0}
      className={cn(
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
