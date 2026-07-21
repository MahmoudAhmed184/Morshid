import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'
import { useInstructorMaterialsByCourse } from '@/features/instructor/hooks/use-instructor-materials'
import { InstructorDashboardPage } from '@/features/instructor/pages/instructor-dashboard-page'

export function InstructorDashboardShell() {
  const coursesQuery = useInstructorCourses()
  const courses = coursesQuery.data ?? []
  const materialQueries = useInstructorMaterialsByCourse(
    courses.map((course) => course.id),
  )
  const isMaterialsPending = materialQueries.some((query) => query.isPending)
  const isMaterialsError = materialQueries.some((query) => query.isError)
  const isMaterialsFetching = materialQueries.some((query) => query.isFetching)

  if (coursesQuery.isPending || isMaterialsPending) {
    return <InstructorDashboardPage state={{ status: 'loading' }} />
  }

  if (coursesQuery.isError || isMaterialsError) {
    return (
      <InstructorDashboardPage
        state={{
          status: 'error',
          onRetry: () => {
            if (coursesQuery.isError) {
              void coursesQuery.refetch()
              return
            }

            void Promise.all(materialQueries.map((query) => query.refetch()))
          },
          isRetrying: coursesQuery.isFetching || isMaterialsFetching,
        }}
      />
    )
  }

  if (courses.length === 0) {
    return <InstructorDashboardPage state={{ status: 'empty' }} />
  }

  const materials = materialQueries.flatMap((query) => query.data ?? [])

  return (
    <InstructorDashboardPage
      state={{
        status: 'ready',
        courses,
        materialCount: materials.length,
        readyMaterialCount: materials.filter(
          (material) => material.status === 'READY',
        ).length,
        processingMaterialCount: materials.filter(
          (material) => material.status === 'PROCESSING',
        ).length,
        attentionMaterialCount: materials.filter(
          (material) =>
            material.status === 'WARNING' || material.status === 'FAILED',
        ).length,
      }}
    />
  )
}
