import type { ReactNode } from 'react'
import React from 'react'

interface ScrollStackItemProps {
  itemClassName?: string
  children: ReactNode
  index?: number
}

export const ScrollStackItem: React.FC<ScrollStackItemProps> = ({
  children,
  itemClassName = '',
  index = 0,
}) => {
  const topOffsets = [
    'top-20 sm:top-24',
    'top-24 sm:top-28',
    'top-28 sm:top-32',
    'top-32 sm:top-36',
  ]
  const topClass = topOffsets[index] ?? 'top-24'
  const marginBottomClass = index === 2 ? 'mb-0' : 'mb-6 sm:mb-10'

  return (
    <div
      className={`sticky ${topClass} ${marginBottomClass} -mx-6 sm:-mx-10 md:mx-0 overflow-hidden rounded-none border-x-0 border-y border-border/80 bg-card p-5 sm:p-8 md:rounded-2xl md:border-x shadow-2xl transition-all duration-300 motion-reduce:transition-none ${itemClassName}`.trim()}
    >
      {children}
    </div>
  )
}

interface ScrollStackProps {
  className?: string
  children: ReactNode
}

const ScrollStack: React.FC<ScrollStackProps> = ({
  children,
  className = '',
}) => {
  return <div className={`relative w-full ${className}`.trim()}>{children}</div>
}

export default ScrollStack
