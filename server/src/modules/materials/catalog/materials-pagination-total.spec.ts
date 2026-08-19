import { MaterialStatus } from '../interface/material-status'
import {
  MaterialsRepository,
  type SafeMaterialRecord,
} from './materials.repository'

function fakeMaterial(index: number, courseId: string): SafeMaterialRecord {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    courseId,
    title: `Material ${String(index)}`,
    originalFilename: `material-${String(index)}.pdf`,
    status: MaterialStatus.READY,
    extractedTextLength: 100 * index,
    chunkCount: index,
    errorMessage: null,
    createdAt: new Date(`2026-07-01T00:00:00.000Z`),
    updatedAt: new Date(`2026-07-01T00:01:00.000Z`),
    uploadedById: '00000000-0000-4000-8000-000000000002',
  }
}

/**
 * Uses the abstract base class's in-memory `paginateMaterials` path
 * (via `listCourseMaterialsPage` default) to validate total+pagination
 * semantics without a live database.
 */
class InMemoryMaterialsRepository extends MaterialsRepository {
  protected readonly repositoryName = 'InMemoryMaterialsRepository'
  private materials: SafeMaterialRecord[] = []

  seed(materials: SafeMaterialRecord[]) {
    this.materials = materials
  }

  listCourseMaterials(courseId: string): Promise<SafeMaterialRecord[]> {
    return Promise.resolve(
      this.materials.filter((m) => m.courseId === courseId),
    )
  }

  // Stubs for abstract methods not exercised here
  createProcessingMaterial = jest.fn()
  findCourseMaterial = jest.fn()
  findCourseMaterialStatus = jest.fn()
  claimMaterialProcessing = jest.fn()
  completeMaterialProcessing = jest.fn()
  failMaterialProcessing = jest.fn()
  markUploadCleanupRequired = jest.fn()
  deleteMaterial = jest.fn()
  quarantineMaterialForDeletion = jest.fn()
}

const courseId = '00000000-0000-4000-8000-000000000101'

describe('MaterialsRepository pagination with total', () => {
  let repository: InMemoryMaterialsRepository

  beforeEach(() => {
    repository = new InMemoryMaterialsRepository()
  })

  it('returns 15 items and total=40 for the first page of 40 materials', async () => {
    const materials = Array.from({ length: 40 }, (_, i) =>
      fakeMaterial(i + 1, courseId),
    )
    repository.seed(materials)

    const page = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
    })

    expect(page.materials).toHaveLength(15)
    expect(page.total).toBe(40)
    expect(page.nextCursor).toBeDefined()
  })

  it('returns total=40 on the second page', async () => {
    const materials = Array.from({ length: 40 }, (_, i) =>
      fakeMaterial(i + 1, courseId),
    )
    repository.seed(materials)

    const firstPage = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
    })

    const secondPage = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
      cursor: firstPage.nextCursor,
    })

    expect(secondPage.materials).toHaveLength(15)
    expect(secondPage.total).toBe(40)
    expect(secondPage.nextCursor).toBeDefined()
  })

  it('returns the last 10 materials on the third page with no nextCursor', async () => {
    const materials = Array.from({ length: 40 }, (_, i) =>
      fakeMaterial(i + 1, courseId),
    )
    repository.seed(materials)

    const firstPage = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
    })
    const secondPage = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
      cursor: firstPage.nextCursor,
    })
    const thirdPage = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
      cursor: secondPage.nextCursor,
    })

    expect(thirdPage.materials).toHaveLength(10)
    expect(thirdPage.total).toBe(40)
    expect(thirdPage.nextCursor).toBeUndefined()
  })

  it('returns the correct filtered total when searching', async () => {
    const materials = [
      { ...fakeMaterial(1, courseId), title: 'Python Variables' },
      { ...fakeMaterial(2, courseId), title: 'Python Functions' },
      { ...fakeMaterial(3, courseId), title: 'Java Loops' },
      { ...fakeMaterial(4, courseId), title: 'Python Classes' },
    ]
    repository.seed(materials)

    const page = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
      search: 'Python',
    })

    expect(page.materials).toHaveLength(3)
    expect(page.total).toBe(3)
    expect(page.nextCursor).toBeUndefined()
  })

  it('scopes total to the requested course', async () => {
    const otherCourseId = '00000000-0000-4000-8000-000000000102'
    const materials = [
      ...Array.from({ length: 5 }, (_, i) => fakeMaterial(i + 1, courseId)),
      ...Array.from({ length: 3 }, (_, i) =>
        fakeMaterial(i + 100, otherCourseId),
      ),
    ]
    repository.seed(materials)

    const page = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
    })

    expect(page.materials).toHaveLength(5)
    expect(page.total).toBe(5)
  })

  it('returns total=0 when a course has no materials', async () => {
    repository.seed([])

    const page = await repository.listCourseMaterialsPage(courseId, {
      limit: 15,
    })

    expect(page.materials).toHaveLength(0)
    expect(page.total).toBe(0)
    expect(page.nextCursor).toBeUndefined()
  })
})
