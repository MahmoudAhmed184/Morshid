import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import {
  getStudentSession,
  getStudentSessionMessages,
  listStudentSessions,
} from '@/features/student/data/student-sessions.api'

interface StudentCourseScope {
  studentId: string
  courseId: string
}

interface StudentSessionScope extends StudentCourseScope {
  sessionId: string
}

const sessionPageSize = 25
const messagePageSize = 50

export const studentSessionKeys = {
  sessionLists: ({ studentId, courseId }: StudentCourseScope) =>
    [
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      'list',
    ] as const,
  sessionList: (scope: StudentCourseScope) =>
    [...studentSessionKeys.sessionLists(scope)] as const,
  detail: ({ studentId, courseId, sessionId }: StudentSessionScope) =>
    [
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'detail',
    ] as const,
  messages: ({ studentId, courseId, sessionId }: StudentSessionScope) =>
    [
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'messages',
    ] as const,
  messageList: (scope: StudentSessionScope) =>
    [...studentSessionKeys.messages(scope)] as const,
}

export function studentSessionQueryOptions({
  studentId,
  courseId,
  sessionId,
}: StudentSessionScope) {
  return queryOptions({
    queryKey: studentSessionKeys.detail({ studentId, courseId, sessionId }),
    queryFn: () => getStudentSession({ courseId, sessionId }),
  })
}

export function studentSessionsQueryOptions({
  studentId,
  courseId,
}: StudentCourseScope) {
  return infiniteQueryOptions({
    queryKey: studentSessionKeys.sessionList({
      studentId,
      courseId,
    }),
    queryFn: ({ pageParam }) =>
      listStudentSessions({
        courseId,
        input: { limit: sessionPageSize, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function studentSessionMessagesQueryOptions({
  studentId,
  courseId,
  sessionId,
}: StudentSessionScope) {
  return infiniteQueryOptions({
    queryKey: studentSessionKeys.messageList({
      studentId,
      courseId,
      sessionId,
    }),
    queryFn: ({ pageParam }) =>
      getStudentSessionMessages({
        courseId,
        sessionId,
        input: { limit: messagePageSize, after: pageParam },
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}
