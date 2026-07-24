import React, { Children, useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Variants } from 'framer-motion'

import { cn } from '@/lib/utils'

const ROMAN_NUMERALS = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.'] as const

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  initialStep?: number
  onStepChange?: (step: number) => void
  onFinalStepCompleted?: () => void
  stepCircleContainerClassName?: string
  stepContainerClassName?: string
  contentClassName?: string
  footerClassName?: string
  backButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
  nextButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
  backButtonText?: string
  nextButtonText?: string
  disableStepIndicators?: boolean
  renderStepIndicator?: (props: {
    step: number
    currentStep: number
    onStepClick: (clicked: number) => void
  }) => ReactNode
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = false,
  renderStepIndicator,
  className = '',
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep)
  const [direction, setDirection] = useState<number>(0)
  const stepsArray = Children.toArray(children)
  const totalSteps = stepsArray.length
  const isCompleted = currentStep > totalSteps
  const isLastStep = currentStep === totalSteps

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep)
    if (newStep > totalSteps) {
      onFinalStepCompleted()
    } else {
      onStepChange(newStep)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1)
      updateStep(currentStep - 1)
    }
  }

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1)
      updateStep(currentStep + 1)
    }
  }

  const handleComplete = () => {
    setDirection(1)
    updateStep(totalSteps + 1)
  }

  return (
    <div
      className={cn(
        'flex min-h-full flex-1 flex-col items-center justify-center p-4',
        className,
      )}
      {...rest}
    >
      <div
        className={`mx-auto w-full max-w-md rounded-4xl border border-border bg-card shadow-xl ${stepCircleContainerClassName}`}
      >
        <div
          className={`${stepContainerClassName} flex w-full items-center p-8`}
        >
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1
            const isNotLastStep = index < totalSteps - 1
            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: (clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1)
                      updateStep(clicked)
                    },
                  })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    disableStepIndicators={disableStepIndicators}
                    currentStep={currentStep}
                    onClickStep={(clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1)
                      updateStep(clicked)
                    }}
                  />
                )}
                {isNotLastStep && (
                  <StepConnector isComplete={currentStep > stepNumber} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        <StepContentWrapper
          isCompleted={false}
          currentStep={isCompleted ? totalSteps : currentStep}
          direction={direction}
          className={`space-y-2 px-4 sm:px-8 ${contentClassName}`}
        >
          {stepsArray[(isCompleted ? totalSteps : currentStep) - 1]}
        </StepContentWrapper>

        {isCompleted ? (
          <div className={`px-4 pb-4 sm:px-8 sm:pb-6 ${footerClassName}`}>
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={handleBack}
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground sm:text-sm"
                {...backButtonProps}
              >
                {backButtonText}
              </button>
              <button
                onClick={() => {
                  setDirection(-1)
                  updateStep(1)
                }}
                className="flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow-primary transition hover:bg-primary/90 sm:text-sm"
              >
                Replay steps
              </button>
            </div>
          </div>
        ) : (
          <div className={`px-4 pb-4 sm:px-8 sm:pb-6 ${footerClassName}`}>
            <div
              className={`mt-6 flex ${currentStep !== 1 ? 'justify-between' : 'justify-end'}`}
            >
              {currentStep !== 1 && (
                <button
                  onClick={handleBack}
                  className="text-xs font-medium text-muted-foreground transition hover:text-foreground sm:text-sm"
                  {...backButtonProps}
                >
                  {backButtonText}
                </button>
              )}
              <button
                onClick={isLastStep ? handleComplete : handleNext}
                className="flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow-primary transition hover:bg-primary/90 sm:text-sm"
                {...nextButtonProps}
              >
                {isLastStep ? 'Finish' : nextButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface StepContentWrapperProps {
  isCompleted: boolean
  currentStep: number
  direction: number
  children: ReactNode
  className?: string
}

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className = '',
}: StepContentWrapperProps) {
  return (
    <div
      className={cn('relative w-full overflow-hidden min-h-[90px]', className)}
    >
      <AnimatePresence mode="wait" custom={direction}>
        {!isCompleted && (
          <motion.div
            key={currentStep}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="w-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const stepVariants: Variants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? 35 : -35,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? -35 : 35,
    opacity: 0,
  }),
}

interface StepProps {
  children: ReactNode
}

export function Step({ children }: StepProps) {
  return <div className="px-8">{children}</div>
}

interface StepIndicatorProps {
  step: number
  currentStep: number
  onClickStep: (clicked: number) => void
  disableStepIndicators?: boolean
}

function StepIndicator({
  step,
  currentStep,
  onClickStep,
  disableStepIndicators = false,
}: StepIndicatorProps) {
  const status =
    currentStep === step
      ? 'active'
      : currentStep < step
        ? 'inactive'
        : 'complete'

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) {
      onClickStep(step)
    }
  }

  return (
    <motion.div
      onClick={handleClick}
      className={`relative outline-none focus:outline-none ${disableStepIndicators ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
      animate={status}
      initial={false}
    >
      <motion.div
        variants={{
          inactive: {
            scale: 0.95,
            backgroundColor: 'var(--background)',
            color: 'var(--muted-foreground)',
          },
          active: {
            scale: 1.05,
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
          },
          complete: {
            scale: 1,
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
          },
        }}
        transition={{ duration: 0.3 }}
        className="flex h-8 w-8 items-center justify-center rounded-full font-semibold border border-border/80 shadow-xs"
      >
        {status === 'complete' ? (
          <CheckIcon className="h-4 w-4 text-primary-foreground" />
        ) : (
          <span className="font-serif text-xs font-bold">
            {ROMAN_NUMERALS[step - 1] ?? step}
          </span>
        )}
      </motion.div>
    </motion.div>
  )
}

interface StepConnectorProps {
  isComplete: boolean
}

function StepConnector({ isComplete }: StepConnectorProps) {
  const lineVariants: Variants = {
    incomplete: { width: 0, backgroundColor: 'transparent' },
    complete: { width: '100%', backgroundColor: 'var(--primary)' },
  }

  return (
    <div className="relative mx-3 h-0.5 flex-1 overflow-hidden rounded bg-border">
      <motion.div
        className="absolute left-0 top-0 h-full"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? 'complete' : 'incomplete'}
        transition={{ duration: 0.4 }}
      />
    </div>
  )
}

interface CheckIconProps extends React.SVGProps<SVGSVGElement> {}

function CheckIcon(props: CheckIconProps) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          delay: 0.1,
          type: 'tween',
          ease: 'easeOut',
          duration: 0.3,
        }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  )
}
