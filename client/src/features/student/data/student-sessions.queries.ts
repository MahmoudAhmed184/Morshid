import { queryOptions } from '@tanstack/react-query'

import {
  getStudentSessionMessages,
  listStudentSessions,
} from '@/features/student/data/student-sessions.api'
import type {
  ListChatMessagesInput,
  ListChatSessionsInput,
} from '@/features/student/schemas/student-chat.schema'

interface StudentCourseScope {
  studentId: string
  courseId: string
}

interface StudentSessionScope extends StudentCourseScope {
  sessionId: string
}

interface StudentSessionsQueryParams extends StudentCourseScope {
  input?: ListChatSessionsInput
}

interface StudentMessagesQueryParams extends StudentSessionScope {
  input?: ListChatMessagesInput
}

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
  sessionList: ({ input = {}, ...scope }: StudentSessionsQueryParams) =>
    [...studentSessionKeys.sessionLists(scope), input] as const,
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
  messageList: ({ input = {}, ...scope }: StudentMessagesQueryParams) =>
    [...studentSessionKeys.messages(scope), input] as const,
}

export function studentSessionsQueryOptions({
  studentId,
  courseId,
  input = {},
}: StudentSessionsQueryParams) {
  return queryOptions({
    queryKey: studentSessionKeys.sessionList({
      studentId,
      courseId,
      input,
    }),
    queryFn: () => listStudentSessions({ courseId, input }),
  })
}

export function studentSessionMessagesQueryOptions({
  studentId,
  courseId,
  sessionId,
  input = {},
}: StudentMessagesQueryParams) {
  return queryOptions({
    queryKey: studentSessionKeys.messageList({
      studentId,
      courseId,
      sessionId,
      input,
    }),
    queryFn: () => getStudentSessionMessages({ courseId, sessionId, input }),
  })
}
