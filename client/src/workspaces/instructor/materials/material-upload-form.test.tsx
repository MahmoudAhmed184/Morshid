import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MaterialUploadForm } from './material-upload-form'

const mutateAsync = vi.hoisted(() => vi.fn())

vi.mock('@/workspaces/instructor/materials/use-materials', () => ({
  useUploadCourseMaterial: () => ({ mutateAsync }),
}))

const configuration = {
  maxUploadBytes: 5 * 1024 * 1024,
  acceptedMimeType: 'application/pdf',
  acceptedFileExtension: '.pdf',
} as const

const courses = [
  {
    id: '4c530c42-67bf-4cbe-a6f3-2c662564ddd1',
    code: 'CS-101',
    title: 'Intro to Computer Science',
  },
  {
    id: '7fc308e8-dc70-43dc-933c-7ee3c548c889',
    code: 'MATH-310',
    title: 'Discrete Mathematics',
  },
]

describe('MaterialUploadForm', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
  })

  afterEach(cleanup)

  it('offers a keyboard-focusable Course select and PDF chooser', async () => {
    const user = userEvent.setup()
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined)

    render(
      <MaterialUploadForm
        courses={courses}
        defaultCourseId={courses[0].id}
        configuration={configuration}
      />,
    )

    await user.tab()
    expect(screen.getByRole('combobox', { name: 'Course' })).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('textbox', { name: 'Material title' }),
    ).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('PDF file')).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Choose PDF file' }),
    ).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(inputClick).toHaveBeenCalledOnce()

    inputClick.mockRestore()
  })

  it('announces upload state and clears the native input when starting over', async () => {
    const user = userEvent.setup()
    let resolveUpload: (() => void) | undefined
    mutateAsync.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve
        }),
    )
    const file = new File(['course'], 'week-one.pdf', {
      type: 'application/pdf',
    })

    render(
      <MaterialUploadForm
        courseId="4c530c42-67bf-4cbe-a6f3-2c662564ddd1"
        configuration={configuration}
      />,
    )

    // The live regions must already exist while the form is idle, otherwise
    // assistive technology can miss the first status change.
    const liveStatus = screen.getByRole('status')
    expect(liveStatus).toBeEmptyDOMElement()

    const input = screen.getByLabelText<HTMLInputElement>('PDF file')
    await user.upload(input, file)
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))

    expect(liveStatus).toHaveTextContent('Uploading week-one.pdf')
    // Progress is not measured, so it must not claim a percentage.
    const progressbar = screen.getByRole('progressbar', {
      name: 'PDF upload in progress',
    })
    expect(progressbar).not.toHaveAttribute('aria-valuenow')
    expect(progressbar).not.toHaveAttribute('aria-valuetext')

    resolveUpload?.()
    expect(
      await screen.findByRole('heading', { name: 'Upload Complete!' }),
    ).toBeVisible()
    expect(liveStatus).toHaveTextContent('Upload complete.')
    await user.click(screen.getByRole('button', { name: 'Upload another' }))
    expect(liveStatus).toBeEmptyDOMElement()

    const resetInput = await screen.findByLabelText('PDF file')
    expect(resetInput).toHaveValue('')
    expect(
      screen.getByRole('button', { name: 'Choose PDF file' }),
    ).toBeVisible()
    await user.upload(resetInput, file)
    expect(screen.getByText('week-one.pdf')).toBeVisible()
  })

  it('announces upload failures as alerts', async () => {
    const user = userEvent.setup()
    mutateAsync.mockRejectedValue(new Error('Network unavailable'))
    const file = new File(['course'], 'week-one.pdf', {
      type: 'application/pdf',
    })

    render(
      <MaterialUploadForm
        courseId="4c530c42-67bf-4cbe-a6f3-2c662564ddd1"
        configuration={configuration}
      />,
    )

    const liveAlert = screen.getByRole('alert')
    expect(liveAlert).toBeEmptyDOMElement()

    await user.upload(screen.getByLabelText('PDF file'), file)
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))

    await waitFor(() => {
      expect(liveAlert).toHaveTextContent(
        'Upload failed. Unable to upload this PDF.',
      )
    })
    expect(screen.getByRole('heading', { name: 'Upload Failed' })).toBeVisible()
  })

  it('allows the instructor to explicitly specify and change the target course', async () => {
    const user = userEvent.setup()
    mutateAsync.mockResolvedValueOnce({
      material: { id: 'm-1', title: 'Calculus Notes', courseId: courses[1].id },
    })
    const file = new File(['%PDF-1.7'], 'calculus.pdf', {
      type: 'application/pdf',
    })

    render(
      <MaterialUploadForm
        courses={courses}
        defaultCourseId={courses[0].id}
        configuration={configuration}
      />,
    )

    const courseSelect = screen.getByRole('combobox', { name: 'Course' })
    expect(courseSelect).toBeVisible()

    await user.click(courseSelect)
    await user.click(
      await screen.findByRole('option', {
        name: 'MATH-310 — Discrete Mathematics',
      }),
    )

    const fileInput = screen.getByLabelText<HTMLInputElement>('PDF file')
    await user.upload(fileInput, file)

    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        courseId: courses[1].id,
        title: 'calculus',
        file,
      })
    })
  })
})
