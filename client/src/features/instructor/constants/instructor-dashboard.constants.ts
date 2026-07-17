export const instructorCourseMetrics = [
  { label: 'Course', value: 'Active' },
  { label: 'Materials', value: 'Placeholder' },
  { label: 'Review Queue', value: '0 Pending' },
] as const

export const reviewQueueFilters = [
  'Pending / 0',
  'AI Concerns',
  'Student Requests',
] as const

export const placeholderPdfMaterials = [
  {
    id: 'materials-placeholder',
    title: 'Materials are not connected yet',
    description:
      'This panel is reserved for Sprint 2 upload, processing, and source readiness status.',
    status: 'Sprint 2',
  },
] as const
