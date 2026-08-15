import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
  afterEach(cleanup)

  it('renders confirmation dialog with wrapped title and text on long strings', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete “module_03_control_flow_loops_matching”?"
        description="This material will no longer be available to the AI Tutor as a source."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
      />,
    )

    const titleElement = screen.getByRole('heading', {
      name: 'Delete “module_03_control_flow_loops_matching”?',
    })
    expect(titleElement).toBeInTheDocument()
    expect(titleElement.className).toContain('min-w-0')
    expect(titleElement.className).toMatch(
      /break-words|\[overflow-wrap:anywhere\]/,
    )
  })
})
