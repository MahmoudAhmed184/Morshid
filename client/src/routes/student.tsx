import { createFileRoute } from '@tanstack/react-router'

function StudentPlaceholderPage() {
  return <main>Student</main>
}

export const Route = createFileRoute('/student')({
  component: StudentPlaceholderPage,
  head: () => ({
    meta: [{ title: 'Student — Morshid' }],
  }),
})
