import { cn } from '@/lib/utils'

import './cube-loader.css'

type CubeLoaderProps = React.ComponentProps<'div'> & {
  label?: string
}

export function CubeLoader({
  className,
  label = 'Loading',
  ...props
}: CubeLoaderProps) {
  return (
    <div
      aria-label={label}
      className={cn('morshid-cube-loader', className)}
      role="status"
      {...props}
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div
          className={`morshid-cube-loader__box morshid-cube-loader__box${index.toString()}`}
          key={index}
        >
          <div />
        </div>
      ))}
      <div className="morshid-cube-loader__ground">
        <div />
      </div>
    </div>
  )
}
