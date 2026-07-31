import {
  isStudentChatApiError,
  STUDENT_CHAT_ERROR_CODES,
} from '@/features/student/data/student-chat.errors'
import { getStudentSession } from '@/features/student/data/student-sessions.api'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

export async function resolveNotificationCourseId({
  courses,
  sessionId,
}: {
  courses: StudentCourse[]
  sessionId: string
}) {
  for (const course of courses) {
    try {
      const session = await getStudentSession({
        courseId: course.id,
        sessionId,
      })
      if (session.id === sessionId) return course.id
    } catch (error) {
      if (
        isStudentChatApiError(error, STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND)
      ) {
        continue
      }
      throw error
    }
  }

  return null
}
