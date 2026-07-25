import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SpeakerLabelProps = {
  children: React.ReactNode
  tone: 'student' | 'morshid'
}

function SpeakerLabel({ children, tone }: SpeakerLabelProps) {
  return (
    <p
      className={cn(
        'smallcaps-label',
        tone === 'student' ? 'text-rubric!' : 'text-info!',
      )}
    >
      {children}
    </p>
  )
}

function Citation({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 align-super text-[0.7em] font-medium text-info">
      {n}
    </sup>
  )
}

const transcriptSheets = [
  {
    id: 'cs-101',
    title: 'Transcript — Data Structures, Week 8',
    turns: [
      { tone: 'student', text: 'Why does quicksort average O(n log n)?' },
      {
        tone: 'morshid',
        text: 'Let us reason it out. If each pivot splits the array roughly in half, how many times can you halve n before reaching 1?',
        citation: 1,
      },
      { tone: 'student', text: 'About log n times.' },
      {
        tone: 'morshid',
        text: 'Exactly — and every level touches each element once. So what is the total work?',
        citation: 2,
      },
    ],
    footnotes: [
      { n: 1, label: '1 — Lecture 08 · Quicksort — p. 12' },
      { n: 2, label: '2 — Problem Set 3 · Analysis — p. 4' },
    ],
  },
  {
    id: 'math-201',
    title: 'Transcript — Linear Algebra, Week 4',
    turns: [
      {
        tone: 'student',
        text: 'What is the geometric meaning of an eigenvector?',
      },
      {
        tone: 'morshid',
        text: 'Think of a matrix transformation. What happens to most vectors when multiplied by it?',
        citation: 1,
      },
      { tone: 'student', text: 'They rotate and change direction.' },
      {
        tone: 'morshid',
        text: 'Right — but eigenvectors stay on their original line. They only stretch or shrink by λ!',
        citation: 2,
      },
    ],
    footnotes: [
      { n: 1, label: '1 — Ch 4 · Vector Spaces — p. 88' },
      { n: 2, label: '2 — Midterm Review · Matrix Ops — p. 15' },
    ],
  },
  {
    id: 'chem-301',
    title: 'Transcript — Organic Chemistry, Week 12',
    turns: [
      { tone: 'student', text: 'Why does SN2 invert stereochemistry?' },
      {
        tone: 'morshid',
        text: 'Look at the nucleophile trajectory. Does it approach from the front or backside?',
        citation: 1,
      },
      {
        tone: 'student',
        text: 'From the backside, opposite the leaving group.',
      },
      {
        tone: 'morshid',
        text: 'Precisely — like an umbrella flipping inside out in strong wind!',
        citation: 2,
      },
    ],
    footnotes: [
      { n: 1, label: '1 — Unit 3 · Mechanisms — p. 42' },
      { n: 2, label: '2 — Lab Notes · Reactions — p. 9' },
    ],
  },
] as const

export function HeroTranscriptStack() {
  const reducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [exitVector, setExitVector] = useState({ x: 0, y: 0 })

  const total = transcriptSheets.length
  const currentSheet = transcriptSheets[activeIndex]
  const nextSheet = transcriptSheets[(activeIndex + 1) % total]
  const thirdSheet = transcriptSheets[(activeIndex + 2) % total]

  const triggerSwipeNext = (vector = { x: 250, y: 0 }) => {
    if (isExiting) return

    if (reducedMotion) {
      setActiveIndex((previous) => (previous + 1) % total)
      return
    }

    setExitVector(vector)
    setIsExiting(true)
  }

  const handleAnimationComplete = () => {
    if (isExiting) {
      setActiveIndex((prev) => (prev + 1) % total)
      setIsExiting(false)
      setExitVector({ x: 0, y: 0 })
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative mx-auto w-full max-w-md select-none"
        data-reduced-motion={reducedMotion || undefined}
      >
        {/* Pull hint */}
        <div className="mb-2 flex items-center justify-between px-2 text-xs text-muted-foreground">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground/80">
            Sheet {activeIndex + 1} of {total}
          </span>
          <button
            type="button"
            onClick={() => triggerSwipeNext({ x: 250, y: 0 })}
            className="flex items-center gap-1.5 font-mono text-[0.68rem] text-primary transition-colors hover:text-primary/80"
          >
            <span>Next transcript</span>
            <span className="motion-safe:animate-bounce" aria-hidden>
              →
            </span>
          </button>
        </div>

        <div className="relative h-[430px] w-full sm:h-[450px]">
          {/* Layer 3 (Deepest Background Sheet with FULL content) */}
          <div
            className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-5 opacity-50 sm:rounded-3xl sm:p-8"
            aria-hidden
          >
            <div>
              <figcaption className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
                <span className="smallcaps-label text-xs opacity-70">
                  {thirdSheet.title}
                </span>
              </figcaption>
              <div className="mt-4 space-y-3.5 opacity-50 sm:mt-5 sm:space-y-4">
                {thirdSheet.turns.map((turn, idx) => (
                  <div key={idx}>
                    <SpeakerLabel tone={turn.tone}>
                      {turn.tone === 'student' ? 'Student.' : 'Morshid.'}
                    </SpeakerLabel>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">
                      {turn.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rule mt-auto space-y-1 pt-3 sm:pt-4">
              {thirdSheet.footnotes.map((fn) => (
                <p
                  key={fn.n}
                  className="footnote text-[0.68rem] text-muted-foreground"
                >
                  {fn.label}
                </p>
              ))}
            </div>
          </div>

          {/* Layer 2 (Middle Background Sheet with 100% EXACT FULL content) */}
          <div
            className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-5 opacity-95 sm:rounded-3xl sm:p-8"
            aria-hidden
          >
            <div>
              <figcaption className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
                <span className="smallcaps-label text-xs">
                  {nextSheet.title}
                </span>
                <Logo
                  iconClassName="size-4 sm:size-5"
                  className="size-4 text-foreground sm:size-5"
                />
              </figcaption>

              <div className="mt-4 space-y-3.5 sm:mt-5 sm:space-y-4">
                {nextSheet.turns.map((turn, idx) => (
                  <div key={idx}>
                    <SpeakerLabel tone={turn.tone}>
                      {turn.tone === 'student' ? 'Student.' : 'Morshid.'}
                    </SpeakerLabel>
                    <p
                      className={cn(
                        'mt-1 leading-relaxed text-foreground',
                        turn.tone === 'student'
                          ? 'font-display text-base italic sm:text-[1.15rem]'
                          : 'text-xs sm:text-sm',
                      )}
                    >
                      {turn.text}
                      {'citation' in turn ? (
                        <Citation n={turn.citation} />
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rule mt-auto space-y-1 pt-3 sm:pt-4">
              {nextSheet.footnotes.map((fn) => (
                <p
                  key={fn.n}
                  className="footnote text-[0.68rem] text-muted-foreground"
                >
                  {fn.label}
                </p>
              ))}
            </div>
          </div>

          {/* Layer 1 (Top Active Draggable Card) */}
          <motion.figure
            key={currentSheet.id}
            initial={false}
            drag={!isExiting && !reducedMotion}
            dragConstraints={{ left: -150, right: 150, top: -50, bottom: 200 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              const distance = Math.hypot(info.offset.x, info.offset.y)
              if (
                distance > 70 ||
                Math.hypot(info.velocity.x, info.velocity.y) > 250
              ) {
                triggerSwipeNext({
                  x: info.offset.x !== 0 ? info.offset.x * 2 : 250,
                  y: info.offset.y !== 0 ? info.offset.y * 2 : 50,
                })
              }
            }}
            animate={
              reducedMotion
                ? { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }
                : isExiting
                  ? {
                      x: exitVector.x !== 0 ? exitVector.x : 280,
                      y: exitVector.y !== 0 ? exitVector.y : 0,
                      opacity: 0,
                      scale: 0.9,
                      rotate: exitVector.x >= 0 ? 15 : -15,
                    }
                  : { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }
            }
            onAnimationComplete={handleAnimationComplete}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 320, damping: 26 }
            }
            className={cn(
              'relative z-30 flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-5 sm:rounded-3xl sm:p-8',
              !reducedMotion && 'cursor-grab active:cursor-grabbing',
            )}
          >
            <div>
              <figcaption className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
                <span className="smallcaps-label text-xs">
                  {currentSheet.title}
                </span>
                <Logo
                  iconClassName="size-4 sm:size-5"
                  className="size-4 text-foreground sm:size-5"
                />
              </figcaption>

              <div className="mt-4 space-y-3.5 sm:mt-5 sm:space-y-4">
                {currentSheet.turns.map((turn, idx) => (
                  <div key={idx}>
                    <SpeakerLabel tone={turn.tone}>
                      {turn.tone === 'student' ? 'Student.' : 'Morshid.'}
                    </SpeakerLabel>
                    <p
                      className={cn(
                        'mt-1 leading-relaxed text-foreground',
                        turn.tone === 'student'
                          ? 'font-display text-base italic sm:text-[1.15rem]'
                          : 'text-xs sm:text-sm',
                      )}
                    >
                      {turn.text}
                      {'citation' in turn ? (
                        <Citation n={turn.citation} />
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rule mt-auto space-y-1 pt-3 sm:pt-4">
              {currentSheet.footnotes.map((fn) => (
                <p
                  key={fn.n}
                  className="footnote text-[0.68rem] text-muted-foreground"
                >
                  {fn.label}
                </p>
              ))}
            </div>
          </motion.figure>
        </div>
      </div>
    </MotionConfig>
  )
}

export function HeroSection() {
  return (
    <section className="atmosphere overflow-x-clip pt-20 sm:pt-28">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 sm:pb-24 md:px-10">
        <div className="grid gap-6 sm:gap-12 lg:grid-cols-12">
          {/* Left — cols 1–7 */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2.5">
              <span className="rubric-square" aria-hidden />
              <span className="smallcaps-label">
                A Socratic tutor, bound to your course
              </span>
            </div>

            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-foreground sm:mt-6 sm:text-5xl lg:text-6xl">
              Every answer has a page number.
            </h1>

            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
              Morshid reads the syllabus, slides, and notes your professor
              actually assigned — then tutors you the Socratic way: asking
              before answering, and citing the page when it does.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4 sm:mt-9 sm:gap-6">
              <Button
                nativeButton={false}
                render={<Link to="/login" />}
                size="lg"
                className="h-10 gap-2 rounded-full px-6 text-sm font-semibold shadow-md sm:h-12 sm:px-7 sm:text-base"
              >
                Begin studying
              </Button>
              <a
                href="#method"
                className="link-editorial font-mono text-xs text-foreground sm:text-sm"
              >
                Read the method ↓
              </a>
            </div>
          </div>

          {/* Right — cols 8–12: Interactive Draggable Paper Stack (Desktop only) */}
          <div className="hidden lg:block lg:col-span-5">
            <HeroTranscriptStack />
          </div>
        </div>
      </div>
    </section>
  )
}
