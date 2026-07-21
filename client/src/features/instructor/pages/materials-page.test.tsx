import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'
import {
  useInstructorMaterials,
  useUploadInstructorMaterial,
} from '@/features/instructor/hooks/use-instructor-materials'

import { MaterialsPage } from './materials-page'

vi.mock('@/features/instructor/hooks/use-instructor-courses')
vi.mock('@/features/instructor/hooks/use-instructor-materials')

const useInstructorCoursesMock = vi.mocked(useInstructorCourses)
const useInstructorMaterialsMock = vi.mocked(useInstructorMaterials)
const useUploadInstructorMaterialMock = vi.mocked(useUploadInstructorMaterial)

const course = {
  id: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
  code: 'CS-201',
  title: 'Data Structures',
}
const secondCourse = {
  id: '7fc308e8-dc70-43dc-933c-7ee3c548c889',
  code: 'MATH-310',
  title: 'Discrete Mathematics',
}
const material = {
  id: '3e533215-42ba-42b8-ad6a-404e7bb3c8d7',
  courseId: course.id,
  title: 'Linked Lists',
  originalFilename: 'linked-lists.pdf',
  status: 'WARNING',
  extractedTextLength: 4_820,
  chunkCount: 6,
  errorMessage: 'Some text could not be extracted.',
  createdAt: '2026-07-21T12:00:00.000Z',
  updatedAt: '2026-07-21T12:01:00.000Z',
} as const
const secondCourseMaterial = {
  ...material,
  id: 'bc55d2cb-b0b1-4f19-8dd5-2607f52a224f',
  courseId: secondCourse.id,
  title: 'Graph Theory',
  originalFilename: 'graph-theory.pdf',
  status: 'READY',
  extractedTextLength: 9_600,
  chunkCount: 12,
  errorMessage: null,
} as const

const refetchCourses = vi.fn()
const refetchMaterials = vi.fn()
const uploadMaterial = vi.fn()

function queryResult<T>(data: T, overrides: Record<string, unknown> = {}) {
  return {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: vi.fn(),
    ...overrides,
  }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function renderMaterialsPage() {
  return render(<MaterialsPage />, { wrapper: createWrapper() })
}

describe('MaterialsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useInstructorCoursesMock.mockReturnValue(
      queryResult([course], {
        refetch: refetchCourses,
      }) as unknown as ReturnType<typeof useInstructorCourses>,
    )
    useInstructorMaterialsMock.mockReturnValue(
      queryResult([], {
        refetch: refetchMaterials,
      }) as unknown as ReturnType<typeof useInstructorMaterials>,
    )
    useUploadInstructorMaterialMock.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: uploadMaterial,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useUploadInstructorMaterial>)
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the workspace visible while courses are loading', () => {
    useInstructorCoursesMock.mockReturnValue(
      queryResult(undefined, {
        isPending: true,
      }) as unknown as ReturnType<typeof useInstructorCourses>,
    )

    renderMaterialsPage()

    expect(
      screen.getByRole('heading', { name: 'Course Materials' }),
    ).toBeVisible()
    expect(screen.getByText('Material repository')).toBeVisible()
    expect(
      screen.getByRole('status', { name: 'Loading materials' }),
    ).toBeVisible()
  })

  it('shows the assigned-course empty state', () => {
    useInstructorCoursesMock.mockReturnValue(
      queryResult([]) as unknown as ReturnType<typeof useInstructorCourses>,
    )

    renderMaterialsPage()

    expect(
      screen.getByRole('heading', { name: 'No assigned course' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Upload PDF' })).toBeNull()
  })

  it('shows a retryable materials error', async () => {
    useInstructorMaterialsMock.mockReturnValue(
      queryResult(undefined, {
        isError: true,
        error: new Error('Request failed'),
        refetch: refetchMaterials,
      }) as unknown as ReturnType<typeof useInstructorMaterials>,
    )
    const user = userEvent.setup()

    renderMaterialsPage()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      screen.getByRole('heading', { name: 'Unable to load materials' }),
    ).toBeVisible()
    expect(refetchMaterials).toHaveBeenCalledOnce()
  })

  it('renders the Figma-aligned summary, repository, and material metadata', () => {
    useInstructorMaterialsMock.mockReturnValue(
      queryResult([material]) as unknown as ReturnType<
        typeof useInstructorMaterials
      >,
    )

    renderMaterialsPage()

    expect(screen.getByLabelText('Select assigned course')).toBeVisible()
    expect(useInstructorMaterialsMock).toHaveBeenCalledWith(course.id)
    expect(screen.getByRole('heading', { name: material.title })).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Material summary' }),
    ).toBeVisible()
    expect(screen.getAllByText(material.originalFilename)).not.toHaveLength(0)
    expect(screen.getAllByText('WARNING')).not.toHaveLength(0)
    expect(screen.getByRole('columnheader', { name: 'Chunks' })).toBeVisible()
    expect(screen.getAllByText(material.errorMessage)).not.toHaveLength(0)
    expect(
      screen.getByRole('button', { name: 'Upload Material' }),
    ).toBeVisible()
  })

  it('filters the repository by material title or filename', async () => {
    useInstructorMaterialsMock.mockReturnValue(
      queryResult([material]) as unknown as ReturnType<
        typeof useInstructorMaterials
      >,
    )
    const user = userEvent.setup()

    renderMaterialsPage()
    await user.type(screen.getByLabelText('Search materials'), 'missing file')

    expect(
      screen.getByRole('heading', { name: 'No matching materials' }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: material.title })).toBeNull()
  })

  it('switches material data, summaries, and upload target with the selected course', async () => {
    useInstructorCoursesMock.mockReturnValue(
      queryResult([course, secondCourse]) as unknown as ReturnType<
        typeof useInstructorCourses
      >,
    )
    useInstructorMaterialsMock.mockImplementation(
      (courseId) =>
        queryResult(
          courseId === secondCourse.id ? [secondCourseMaterial] : [material],
        ) as unknown as ReturnType<typeof useInstructorMaterials>,
    )
    uploadMaterial.mockResolvedValue({ material: secondCourseMaterial })
    const user = userEvent.setup()

    renderMaterialsPage()

    expect(useInstructorMaterialsMock).toHaveBeenLastCalledWith(course.id)
    expect(screen.getByLabelText('Select assigned course')).toHaveTextContent(
      `${course.code} — ${course.title}`,
    )
    expect(
      screen.getByLabelText('Select assigned course'),
    ).not.toHaveTextContent(course.id)
    expect(screen.getByRole('heading', { name: material.title })).toBeVisible()

    await user.click(screen.getByLabelText('Select assigned course'))
    await user.click(
      await screen.findByRole('option', {
        name: `${secondCourse.code} — ${secondCourse.title}`,
      }),
    )

    expect(useInstructorMaterialsMock).toHaveBeenLastCalledWith(secondCourse.id)
    expect(screen.getByLabelText('Select assigned course')).toHaveTextContent(
      `${secondCourse.code} — ${secondCourse.title}`,
    )
    expect(
      screen.getByRole('heading', { name: secondCourseMaterial.title }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: material.title })).toBeNull()

    const summary = screen.getByRole('region', { name: 'Material summary' })
    expect(within(summary).getByText(secondCourse.code)).toBeVisible()
    const readyCard = within(summary)
      .getByText('Ready')
      .closest('[data-slot="card"]')
    const attentionCard = within(summary)
      .getByText('Needs attention')
      .closest('[data-slot="card"]')
    expect(readyCard).not.toBeNull()
    expect(attentionCard).not.toBeNull()
    expect(within(readyCard as HTMLElement).getByText('1')).toBeVisible()
    expect(within(attentionCard as HTMLElement).getByText('0')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Upload Material' }))
    const file = new File(['%PDF-1.7'], 'graph-theory.pdf', {
      type: 'application/pdf',
    })
    await user.type(screen.getByLabelText('Material title'), 'Graph Theory')
    await user.upload(screen.getByLabelText('PDF file'), file)
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))

    await waitFor(() =>
      expect(uploadMaterial).toHaveBeenCalledWith({
        courseId: secondCourse.id,
        title: 'Graph Theory',
        file,
      }),
    )
  })

  it('shows inline upload validation errors', async () => {
    const user = userEvent.setup()
    renderMaterialsPage()

    await user.click(screen.getByRole('button', { name: 'Upload Material' }))
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))

    expect(screen.getByText('Title is required')).toBeVisible()
    expect(uploadMaterial).not.toHaveBeenCalled()
  })

  it('uploads a valid PDF and resets the form after success', async () => {
    uploadMaterial.mockResolvedValue({ material })
    const user = userEvent.setup()
    const file = new File(['%PDF-1.7'], 'linked-lists.pdf', {
      type: 'application/pdf',
    })
    renderMaterialsPage()

    await user.click(screen.getByRole('button', { name: 'Upload Material' }))
    const titleInput = screen.getByLabelText('Material title')
    await user.type(titleInput, 'Linked Lists')
    await user.upload(screen.getByLabelText('PDF file'), file)
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))

    await waitFor(() =>
      expect(uploadMaterial).toHaveBeenCalledWith({
        courseId: course.id,
        title: 'Linked Lists',
        file,
      }),
    )
    expect(
      await screen.findByText('PDF uploaded and queued for processing.'),
    ).toBeVisible()
    expect(titleInput).toHaveValue('')
  })
})
