import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Material } from '@/features/materials/material-ingestion/material.schema'
import { MaterialCard } from './material-card'

const failedMaterial: Material = {
  id: '3e533215-42ba-42b8-ad6a-404e7bb3c8d7',
  courseId: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
  title: 'module_03_control_flow_loops_matching',
  originalFilename: 'module_03_control_flow_loops_matching.pdf',
  status: 'FAILED',
  extractedTextLength: null,
  chunkCount: null,
  errorMessage: 'The material could not be parsed.',
  createdAt: '2026-07-21T12:00:00.000Z',
  updatedAt: '2026-07-21T12:01:00.000Z',
}

describe('MaterialCard', () => {
  afterEach(cleanup)

  it('renders material card and opens delete confirm dialog on delete action', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(<MaterialCard material={failedMaterial} onDelete={onDelete} />)

    expect(
      screen.getByText('module_03_control_flow_loops_matching'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The material could not be parsed.'),
    ).toBeInTheDocument()

    const actionsButton = screen.getByRole('button', {
      name: 'Open actions for module_03_control_flow_loops_matching',
    })
    await user.click(actionsButton)

    const deleteMenuItem = await screen.findByRole('menuitem', {
      name: 'Delete material',
    })
    await user.click(deleteMenuItem)

    const dialogHeading = await screen.findByRole('heading', {
      name: 'Delete “module_03_control_flow_loops_matching”?',
    })
    expect(dialogHeading).toBeInTheDocument()
    expect(dialogHeading.className).toContain('min-w-0')
    expect(dialogHeading.className).toMatch(
      /break-words|\[overflow-wrap:anywhere\]/,
    )

    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    await user.click(confirmButton)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('shows retry only for failed materials and disables it while retrying', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = render(
      <MaterialCard material={failedMaterial} onRetry={onRetry} />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Open actions for module_03_control_flow_loops_matching',
      }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'Retry processing' }),
    )
    expect(onRetry).toHaveBeenCalledOnce()

    rerender(
      <MaterialCard material={failedMaterial} onRetry={onRetry} isRetrying />,
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Open actions for module_03_control_flow_loops_matching',
      }),
    )
    const retryItem = await screen.findByRole('menuitem', {
      name: 'Retrying processing...',
    })
    expect(retryItem).toHaveAttribute('aria-disabled', 'true')
    await user.click(retryItem)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it.each(['READY', 'PROCESSING', 'WARNING'] as const)(
    'does not offer retry for %s materials',
    (status) => {
      render(
        <MaterialCard
          material={{ ...failedMaterial, status }}
          onRetry={vi.fn()}
        />,
      )

      expect(
        screen.queryByRole('button', {
          name: 'Open actions for module_03_control_flow_loops_matching',
        }),
      ).not.toBeInTheDocument()
    },
  )
})
