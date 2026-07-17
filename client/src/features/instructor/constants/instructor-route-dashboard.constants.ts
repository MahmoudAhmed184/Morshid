import { FileText, Inbox } from 'lucide-react'

export const instructorDashboardStats = [
  {
    key: 'materials',
    label: 'Course materials',
    icon: FileText,
    description: 'Uploaded sources available to this course',
  },
  {
    key: 'reviewQueue',
    label: 'Review queue',
    icon: Inbox,
    description: 'Flagged exchanges awaiting review',
  },
] as const

export const instructorDashboardPanels = [
  {
    id: 'materials',
    headingId: 'materials-heading',
    title: 'Course materials',
    description:
      'Upload and source management will connect in the next sprint.',
    emptyTitle: 'No course materials yet',
    emptyDescription:
      'The materials API is not connected yet. This area is ready for Python course sources.',
    icon: FileText,
    action: 'upload',
  },
  {
    id: 'reviews',
    headingId: 'reviews-heading',
    title: 'Review queue',
    description: 'Only flagged exchanges from this course will appear here.',
    emptyTitle: 'No reviews waiting',
    emptyDescription:
      'Flagged and student-requested reviews will appear after the review API is connected.',
    icon: Inbox,
    action: null,
  },
] as const
