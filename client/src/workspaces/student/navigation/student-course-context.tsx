import { useRouterState } from '@tanstack/react-router'
import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { useStudentCourses } from '@/workspaces/student/navigation/use-course-access'
import type { StudentCourseAccess } from '@/features/courses/course-access/course-access.schema'

type StudentCourseContextValue = {
  courses: StudentCourseAccess[]
  activeCourse: StudentCourseAccess | null
  unavailableCourseId: string | null
}

const StudentCourseContext = createContext<StudentCourseContextValue | null>(
  null,
)

function storageKey(studentId: string) {
  return `morshid.student.active-course.${studentId}`
}

function validCourse(
  courses: StudentCourseAccess[],
  courseId: string | undefined,
) {
  return courseId
    ? (courses.find((course) => course.id === courseId) ?? null)
    : null
}

export function StudentCourseProvider({ children }: { children: ReactNode }) {
  const studentId = useAuthStore((state) => state.user?.id)
  const routeCourseId = useRouterState({
    select: (state) => {
      const courseId = state.location.search.courseId
      return typeof courseId === 'string' ? courseId : undefined
    },
  })
  const { data: courses } = useStudentCourses()
  const rememberedCourseId = studentId
    ? (window.sessionStorage.getItem(storageKey(studentId)) ?? undefined)
    : undefined

  const explicitCourse = validCourse(courses, routeCourseId)
  const unavailableCourseId =
    routeCourseId !== undefined && explicitCourse === null
      ? routeCourseId
      : null
  const activeCourse =
    routeCourseId !== undefined
      ? explicitCourse
      : (validCourse(courses, rememberedCourseId) ??
        (courses.length === 1 ? (courses[0] ?? null) : null))

  useEffect(() => {
    if (!studentId || !activeCourse) {
      return
    }

    window.sessionStorage.setItem(storageKey(studentId), activeCourse.id)
  }, [activeCourse, studentId])

  const value = useMemo(
    () => ({ courses, activeCourse, unavailableCourseId }),
    [courses, activeCourse, unavailableCourseId],
  )

  return (
    <StudentCourseContext.Provider value={value}>
      {children}
    </StudentCourseContext.Provider>
  )
}

const defaultCourseContextValue: StudentCourseContextValue = {
  courses: [],
  activeCourse: null,
  unavailableCourseId: null,
}

export function useStudentCourseContext() {
  const context = useContext(StudentCourseContext)
  return context ?? defaultCourseContextValue
}
