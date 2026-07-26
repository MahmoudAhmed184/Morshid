import { createFileRoute } from '@tanstack/react-router'

import { LandingPage } from '@/features/landing/landing-page'

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    meta: [
      {
        title: 'Morshid — Master Your Courses with Socratic AI',
      },
      {
        name: 'description',
        content:
          'Morshid guides you through complex university coursework using proven Socratic questioning techniques.',
      },
    ],
  }),
})
