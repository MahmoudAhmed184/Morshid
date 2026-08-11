import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import {
  getChatMessages,
  getChatSession,
  listChatSessions,
} from '@/features/chat/sessions/chat-sessions.api'

interface StudentCourseScope {
  studentId: string
  courseId: string
}

interface ChatSessionScope extends StudentCourseScope {
  sessionId: string
}

const sessionPageSize = 25
const messagePageSize = 50

export const chatSessionKeys = {
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
    [...chatSessionKeys.sessionLists(scope)] as const,
  detail: ({ studentId, courseId, sessionId }: ChatSessionScope) =>
    [
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'detail',
    ] as const,
  messages: ({ studentId, courseId, sessionId }: ChatSessionScope) =>
    [
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'messages',
    ] as const,
  messageList: (scope: ChatSessionScope) =>
    [...chatSessionKeys.messages(scope)] as const,
}

export function chatSessionQueryOptions({
  studentId,
  courseId,
  sessionId,
}: ChatSessionScope) {
  return queryOptions({
    queryKey: chatSessionKeys.detail({ studentId, courseId, sessionId }),
    queryFn: () => getChatSession({ courseId, sessionId }),
  })
}

export function chatSessionsQueryOptions({
  studentId,
  courseId,
}: StudentCourseScope) {
  return infiniteQueryOptions({
    queryKey: chatSessionKeys.sessionList({
      studentId,
      courseId,
    }),
    queryFn: ({ pageParam }) =>
      listChatSessions({
        courseId,
        input: { limit: sessionPageSize, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function chatMessagesQueryOptions({
  studentId,
  courseId,
  sessionId,
}: ChatSessionScope) {
  return infiniteQueryOptions({
    queryKey: chatSessionKeys.messageList({
      studentId,
      courseId,
      sessionId,
    }),
    queryFn: ({ pageParam }) =>
      getChatMessages({
        courseId,
        sessionId,
        input:
          pageParam === undefined
            ? { limit: messagePageSize, page: 'latest' }
            : { limit: messagePageSize, before: pageParam },
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}
