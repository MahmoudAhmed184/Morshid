export interface ChatCourseSelection {
  courseId?: string
}

export interface ChatSessionSelection extends ChatCourseSelection {
  sessionId?: string
}
