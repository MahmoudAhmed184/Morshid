import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'motion/react'
import { Children, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const ROMAN_NUMERALS = ['i.', 'ii.', 'iii.'] as const

export function Step({ children }: { children: ReactNode }) {
  return <div className="px-8">{children}</div>
}

export function Stepper({
  children,
  className,
  stepCircleContainerClassName,
  contentClassName,
}: {
  children: ReactNode
  className?: string
  stepCircleContainerClassName?: string
  contentClassName?: string
}) {
  const steps = Children.toArray(children)
  const [currentStep, setCurrentStep] = useState(0)
  const reducedMotion = useReducedMotion()

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-reduced-motion={reducedMotion || undefined}
        className={cn(
          'flex min-h-full flex-1 flex-col items-center justify-center p-4',
          className,
        )}
      >
        <div
          className={cn(
            'mx-auto w-full max-w-md rounded-3xl border border-border bg-card shadow-xl',
            stepCircleContainerClassName,
          )}
        >
          <div
            role="group"
            aria-label="Steps"
            className="flex w-full items-center p-8"
          >
            {steps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center',
                  index < steps.length - 1 && 'flex-1',
                )}
              >
                <button
                  type="button"
                  aria-label={`Step ${index + 1}`}
                  aria-current={currentStep === index ? 'step' : undefined}
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full border text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none',
                    index <= currentStep
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {ROMAN_NUMERALS[index] ?? index + 1}
                </button>
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      'mx-3 h-0.5 flex-1 rounded transition-colors motion-reduce:transition-none',
                      index < currentStep ? 'bg-primary' : 'bg-border',
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div
            className={cn(
              'relative min-h-[90px] w-full overflow-hidden space-y-2 px-4 sm:px-8',
              contentClassName,
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={reducedMotion ? false : { x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reducedMotion ? undefined : { x: -24, opacity: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 350, damping: 30 }
                }
              >
                {steps[currentStep]}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between px-4 pb-4 sm:px-8 sm:pb-6">
            <button
              type="button"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
              className="text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:invisible motion-reduce:transition-none"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentStep((step) =>
                  step === steps.length - 1 ? 0 : step + 1,
                )
              }
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 motion-reduce:transition-none"
            >
              {currentStep === steps.length - 1 ? 'Replay steps' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}
