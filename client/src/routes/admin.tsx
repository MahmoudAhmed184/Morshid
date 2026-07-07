import { createFileRoute } from '@tanstack/react-router'

function AdminPlaceholderPage() {
  return <main>Admin</main>
}

export const Route = createFileRoute('/admin')({
  component: AdminPlaceholderPage,
  head: () => ({
    meta: [{ title: 'Admin — Morshid' }],
  }),
})
