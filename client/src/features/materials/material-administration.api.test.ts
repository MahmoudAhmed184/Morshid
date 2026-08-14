import { describe, expect, it } from 'vitest'

import { updateMaterialAdministration } from './material-administration.api'

const courseId = '4c530c42-67bf-4cbe-a6f3-2c662564ddd1'
const materialId = 'c6432e4c-69b0-42c6-a778-70c54f684720'
const user = {
  id: 'acace6a5-7430-4dbf-b327-d76f3d51542a',
  email: 'student@morshid.demo',
  displayName: 'Demo Student',
  role: 'STUDENT',
  status: 'ACTIVE',
}

describe('material administration API', () => {
  it('updates material metadata with the Materials-owned contract', async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('PATCH')
      expect(JSON.parse(String(init?.body))).toEqual({ title: 'Week 1' })
      return Response.json({
        material: {
          id: materialId,
          courseId,
          uploadedBy: {
            email: user.email,
            displayName: user.displayName,
          },
          title: 'Week 1',
          originalFilename: 'week-1.pdf',
          status: 'READY',
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-11T10:00:00.000Z',
        },
      })
    }

    await expect(
      updateMaterialAdministration(courseId, materialId, 'Week 1', {
        fetchImpl: fetchMock,
      }),
    ).resolves.toMatchObject({ title: 'Week 1', status: 'READY' })
  })
})
