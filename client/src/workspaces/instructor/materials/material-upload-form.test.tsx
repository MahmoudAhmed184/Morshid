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

describe('MaterialUploadForm', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
  })

  afterEach(cleanup)

  it('offers a keyboard-focusable PDF chooser', async () => {
    const user = userEvent.setup()
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined)

    render(
      <MaterialUploadForm
        courseId="4c530c42-67bf-4cbe-a6f3-2c662564ddd1"
        configuration={configuration}
      />,
    )

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
})
