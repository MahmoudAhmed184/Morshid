import { describe, expect, it } from 'vitest'

import {
  materialAdministrationKeys,
  materialAdministrationQueryOptions,
} from './material-administration.queries'

const adminId = '8f9c19d1-eed5-43de-8bd9-995919825f9f'
const courseId = '17d1a78d-60be-4f5f-a03d-e3ee326ec796'

describe('Material administration query options', () => {
  it('normalizes search in material administration query key and options', () => {
    const options = materialAdministrationQueryOptions(
      adminId,
      courseId,
      '  syllabus  ',
    )

    expect(options.queryKey).toEqual([
      'admin',
      adminId,
      'courses',
      courseId,
      'materials',
      { search: 'syllabus' },
    ])
  })

  it('builds canonical key hierarchies', () => {
    expect(materialAdministrationKeys.all(adminId, courseId)).toEqual([
      'admin',
      adminId,
      'courses',
      courseId,
      'materials',
    ])
    expect(
      materialAdministrationKeys.list(adminId, courseId, 'lecture'),
    ).toEqual([
      'admin',
      adminId,
      'courses',
      courseId,
      'materials',
      { search: 'lecture' },
    ])
  })
})
