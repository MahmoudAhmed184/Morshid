import { BookOpen, CircleCheck, FileText } from 'lucide-react'

export const instructorDashboardStats = [
  {
    key: 'courses',
    label: 'Assigned courses',
    icon: BookOpen,
    description: 'Course workspaces available to you',
  },
  {
    key: 'materials',
    label: 'Total materials',
    icon: FileText,
    description: 'Uploaded sources across assigned courses',
  },
  {
    key: 'readyMaterials',
    label: 'Ready materials',
    icon: CircleCheck,
    description: 'Sources ready for course retrieval',
  },
] as const
