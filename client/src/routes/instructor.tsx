import { createFileRoute } from '@tanstack/react-router'

function InstructorPlaceholderPage() {
  return <main>Instructor</main>
}

export const Route = createFileRoute('/instructor')({
  component: InstructorPlaceholderPage,
  head: () => ({
    meta: [{ title: 'Instructor — Morshid' }],
  }),
})
