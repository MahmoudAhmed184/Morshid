export interface StudentCourseSelection {
  courseId?: string
}

export interface StudentSessionSelection extends StudentCourseSelection {
  sessionId?: string
}
