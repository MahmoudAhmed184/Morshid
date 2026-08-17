import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/features/auth/session/interface/authenticated-api-client'
import {
  ExplanationDetailLevel,
  getStudentTutoringPreferences,
  updateStudentTutoringPreferences,
} from './learning-preferences'
import { LearningTabContent } from './learning-tab-content'

vi.mock('./learning-preferences', () => ({
  ExplanationDetailLevel: {
    CONCISE: 'CONCISE',
    STANDARD: 'STANDARD',
    DETAILED: 'DETAILED',
  },
  getStudentTutoringPreferences: vi.fn(),
  updateStudentTutoringPreferences: vi.fn(),
}))

describe('LearningTabContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStudentTutoringPreferences).mockResolvedValue({
      explanationDetailLevel: ExplanationDetailLevel.STANDARD,
    })
    vi.mocked(updateStudentTutoringPreferences).mockResolvedValue({
      explanationDetailLevel: ExplanationDetailLevel.DETAILED,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('loads and renders initial preference with all 3 options and pedagogical guarantee note', async () => {
    render(<LearningTabContent />)

    expect(screen.getByText('Explanation Detail')).toBeInTheDocument()
    expect(screen.getByText('Pedagogical Guarantee')).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /Concise/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('radio', { name: /Standard/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('radio', { name: /Detailed/i }),
      ).toBeInTheDocument()
    })

    const standardRadio = screen.getByRole('radio', { name: /Standard/i })
    expect(standardRadio).toHaveAttribute('aria-checked', 'true')

    const saveButton = screen.getByRole('button', { name: /Save changes/i })
    expect(saveButton).toBeDisabled()
  })

  it('allows selecting a new preference and saving successfully', async () => {
    const user = userEvent.setup()
    render(<LearningTabContent />)

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /Detailed/i }),
      ).toBeInTheDocument()
    })

    const detailedRadio = screen.getByRole('radio', { name: /Detailed/i })
    await user.click(detailedRadio)

    expect(detailedRadio).toHaveAttribute('aria-checked', 'true')

    const saveButton = screen.getByRole('button', { name: /Save changes/i })
    expect(saveButton).not.toBeDisabled()

    await user.click(saveButton)

    expect(updateStudentTutoringPreferences).toHaveBeenCalledWith({
      explanationDetailLevel: ExplanationDetailLevel.DETAILED,
    })

    await waitFor(() => {
      expect(
        screen.getByText('Learning preferences updated successfully.'),
      ).toBeInTheDocument()
    })

    expect(saveButton).toBeDisabled()
  })

  it('displays an error alert when saving fails', async () => {
    vi.mocked(updateStudentTutoringPreferences).mockRejectedValueOnce(
      new ApiError('Network connection failed', 500, 'INTERNAL_SERVER_ERROR'),
    )

    const user = userEvent.setup()
    render(<LearningTabContent />)

    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /Concise/i }),
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('radio', { name: /Concise/i }))
    await user.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      expect(screen.getByText('Network connection failed')).toBeInTheDocument()
    })
  })

  it('handles initial load failure gracefully and defaults to Standard', async () => {
    vi.mocked(getStudentTutoringPreferences).mockRejectedValueOnce(
      new Error('Failed to fetch'),
    )

    render(<LearningTabContent />)

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
    })

    const standardRadio = screen.getByRole('radio', { name: /Standard/i })
    expect(standardRadio).toHaveAttribute('aria-checked', 'true')
  })
})
