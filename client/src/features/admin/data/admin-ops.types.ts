export type AdminEntityStatus = 'active' | 'disabled' | 'draft' | 'archived'

export type AdminUserRole = 'Admin' | 'Instructor' | 'Student'

export type AdminUser = {
  id: string
  name: string
  email: string
  role: AdminUserRole
  status: Extract<AdminEntityStatus, 'active' | 'disabled'>
  faculty: string
  lastActivity: string
}

export type AdminCourse = {
  id: string
  code: string
  title: string
  instructor: string
  academicYear: string
  status: Extract<AdminEntityStatus, 'active' | 'archived' | 'draft'>
  materials: number
  enrollments: number
}

export type AdminMaterial = {
  id: string
  title: string
  course: string
  type: 'PDF' | 'Video' | 'Quiz' | 'Link'
  status: Extract<AdminEntityStatus, 'active' | 'draft' | 'archived'>
  updatedAt: string
  owner: string
}

export type AdminAuditEvent = {
  id: string
  actor: string
  action: string
  target: string
  severity: 'info' | 'warning' | 'critical'
  createdAt: string
}
