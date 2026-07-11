import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../src/modules/audit/audit.constants'

const hiddenCourseId = '00000000-0000-4000-8000-000000000102'

describe('Course boundary audit (e2e)', () => {
  /*
   * TODO(Task #15): Production course-boundary HTTP denial flow does not exist yet.
   *
   * CourseAccessService exposes boolean membership/ownership checks only.
   * There are no production :courseId routes that return 403 on cross-course
   * access today, so ACCESS_COURSE_BOUNDARY_DENIED cannot be emitted from an
   * existing authorization path without introducing new enforcement
   * infrastructure.
   *
   * When student/instructor course-scoped endpoints are implemented and wired
   * to deny cross-course access, enable the tests below to verify:
   * - the original 403 response is preserved
   * - ACCESS_COURSE_BOUNDARY_DENIED is persisted with actor, courseId, and
   *   attempted operation metadata
   */
  it.skip('persists ACCESS_COURSE_BOUNDARY_DENIED when a student is denied access to an unassigned course', () => {
    const studentId = '00000000-0000-4000-8000-000000000003'

    expect(AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED).toBe(
      'access.course_boundary_denied',
    )
    expect(AUDIT_TARGET_TYPES.COURSE).toBe('course')
    expect(hiddenCourseId).toBe('00000000-0000-4000-8000-000000000102')
    expect(studentId).toBe('00000000-0000-4000-8000-000000000003')

    // Example future assertion once a production denial endpoint exists:
    // expect(boundaryDeniedEvents).toEqual([
    //   expect.objectContaining({
    //     actorUserId: studentId,
    //     action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED,
    //     targetType: AUDIT_TARGET_TYPES.COURSE,
    //     targetId: hiddenCourseId,
    //     courseId: hiddenCourseId,
    //     metadata: expect.objectContaining({
    //       attemptedCourseId: hiddenCourseId,
    //       operation: 'view',
    //     }),
    //   }),
    // ])
  })

  /*
   * TODO(Task #15): Same blocker as above — no production course-boundary HTTP
   * denial endpoint exists yet for manage operations.
   */
  it.skip('persists ACCESS_COURSE_BOUNDARY_DENIED when manage access to another instructors course is denied', () => {
    expect(AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED).toBe(
      'access.course_boundary_denied',
    )
  })
})
