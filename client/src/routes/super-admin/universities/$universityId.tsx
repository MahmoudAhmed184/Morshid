import { createFileRoute } from '@tanstack/react-router'

import { UniversityDetailPage } from '@/workspaces/super-admin/universities/university-detail-page'

export const Route = createFileRoute('/super-admin/universities/$universityId')(
  {
    component: UniversityDetailRoute,
  },
)

function UniversityDetailRoute() {
  const { universityId } = Route.useParams()
  return <UniversityDetailPage universityId={universityId} />
}
