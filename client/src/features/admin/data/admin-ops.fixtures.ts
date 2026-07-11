import type {
  AdminAuditEvent,
  AdminCourse,
  AdminMaterial,
  AdminUser,
} from './admin-ops.types'

export const adminUsers: AdminUser[] = [
  {
    id: 'USR-001',
    name: 'Mahmoud Ahmed',
    email: 'mahmoud@morshid.demo',
    role: 'Admin',
    status: 'active',
    faculty: 'Operations',
    lastActivity: '2 mins ago',
  },
  {
    id: 'USR-102',
    name: 'Helena Vance',
    email: 'h.vance@morshid.demo',
    role: 'Instructor',
    status: 'active',
    faculty: 'Physics',
    lastActivity: '1 hour ago',
  },
  {
    id: 'USR-284',
    name: 'Julian Sterling',
    email: 'j.sterling@morshid.demo',
    role: 'Student',
    status: 'active',
    faculty: 'Computer Science',
    lastActivity: '12 mins ago',
  },
  {
    id: 'USR-337',
    name: 'Marcus Chen',
    email: 'm.chen@morshid.demo',
    role: 'Student',
    status: 'disabled',
    faculty: 'Mechanical Engineering',
    lastActivity: '3 days ago',
  },
]

export const adminCourses: AdminCourse[] = [
  {
    id: 'CRS-201',
    code: 'PHYS-402',
    title: 'Advanced Quantum Ethics',
    instructor: 'Dr. Helena Vance',
    academicYear: '2024-2025',
    status: 'active',
    materials: 18,
    enrollments: 42,
  },
  {
    id: 'CRS-214',
    code: 'AI-110',
    title: 'AI & Society Foundation',
    instructor: 'Prof. Julian Thorne',
    academicYear: '2024-2025',
    status: 'active',
    materials: 34,
    enrollments: 156,
  },
  {
    id: 'CRS-088',
    code: 'SYS-101',
    title: 'Legacy Systems 101',
    instructor: 'Dr. Sarah Jenkins',
    academicYear: '2023-2024',
    status: 'archived',
    materials: 12,
    enrollments: 88,
  },
]

export const adminMaterials: AdminMaterial[] = [
  {
    id: 'MAT-900',
    title: 'Week 1 Foundations',
    course: 'AI & Society Foundation',
    type: 'PDF',
    status: 'active',
    updatedAt: 'Today',
    owner: 'Julian Thorne',
  },
  {
    id: 'MAT-914',
    title: 'Lab Safety Briefing',
    course: 'Bio-informatics II',
    type: 'Video',
    status: 'draft',
    updatedAt: 'Yesterday',
    owner: 'Lin Zhao',
  },
  {
    id: 'MAT-932',
    title: 'Archive Systems Quiz',
    course: 'Legacy Systems 101',
    type: 'Quiz',
    status: 'archived',
    updatedAt: '3 days ago',
    owner: 'Sarah Jenkins',
  },
]

export const adminAuditEvents: AdminAuditEvent[] = [
  {
    id: 'AUD-501',
    actor: 'System Admin',
    action: 'Reset password',
    target: 'USR-337',
    severity: 'warning',
    createdAt: '10 mins ago',
  },
  {
    id: 'AUD-502',
    actor: 'Mahmoud Ahmed',
    action: 'Created course draft',
    target: 'CRS-214',
    severity: 'info',
    createdAt: '34 mins ago',
  },
  {
    id: 'AUD-503',
    actor: 'RBAC guard',
    action: 'Blocked cross-course access',
    target: 'ASN-431',
    severity: 'critical',
    createdAt: '1 hour ago',
  },
]
