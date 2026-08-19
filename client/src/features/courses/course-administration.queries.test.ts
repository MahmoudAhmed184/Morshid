import { describe, expect, it } from 'vitest'

import {
  courseAdministrationKeys,
  courseAdministrationQueryOptions,
  courseMembersQueryOptions,
} from './course-administration.queries'

const adminId = '8f9c19d1-eed5-43de-8bd9-995919825f9f'
const courseId = '17d1a78d-60be-4f5f-a03d-e3ee326ec796'

describe('Course administration query options', () => {
  it('normalizes search in course list query key and options', () => {
    const options = courseAdministrationQueryOptions(adminId, '  cs101  ')

    expect(options.queryKey).toEqual([
      'admin',
      adminId,
      'courses',
      { search: 'cs101' },
    ])
  })

  it('normalizes search in course members query key and options', () => {
    const options = courseMembersQueryOptions(
      adminId,
      courseId,
      '  demo user  ',
      'STUDENT',
    )

    expect(options.queryKey).toEqual([
      'admin',
      adminId,
      'courses',
      courseId,
      'members',
      { role: 'STUDENT', search: 'demo user' },
    ])
  })

  it('builds canonical key hierarchies', () => {
    expect(courseAdministrationKeys.all(adminId)).toEqual([
      'admin',
      adminId,
      'courses',
    ])
    expect(courseAdministrationKeys.list(adminId, 'algo')).toEqual([
      'admin',
      adminId,
      'courses',
      { search: 'algo' },
    ])
    expect(
      courseAdministrationKeys.members(adminId, courseId, 'algo', 'INSTRUCTOR'),
    ).toEqual([
      'admin',
      adminId,
      'courses',
      courseId,
      'members',
      { role: 'INSTRUCTOR', search: 'algo' },
    ])
  })
})
