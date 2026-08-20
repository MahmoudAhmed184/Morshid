import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NumberedPagination } from './numbered-pagination'

describe('NumberedPagination', () => {
  afterEach(() => {
    cleanup()
  })
  it('renders page numbers, item summary, and navigation buttons', () => {
    render(
      <NumberedPagination
        page={1}
        totalPages={5}
        total={95}
        pageSize={20}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByText(/Showing/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('triggers onPageChange when clicking next and specific page number', async () => {
    const user = userEvent.setup()
    const handlePageChange = vi.fn()

    render(
      <NumberedPagination
        page={2}
        totalPages={5}
        total={100}
        pageSize={20}
        onPageChange={handlePageChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(handlePageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByRole('button', { name: 'Page 4' }))
    expect(handlePageChange).toHaveBeenCalledWith(4)

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(handlePageChange).toHaveBeenCalledWith(1)
  })

  it('disables next button on the last page', () => {
    render(
      <NumberedPagination
        page={5}
        totalPages={5}
        total={100}
        pageSize={20}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).not.toBeDisabled()
  })

  it('renders ellipses for large page counts', () => {
    render(
      <NumberedPagination
        page={5}
        totalPages={10}
        total={200}
        pageSize={20}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 6' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 10' })).toBeInTheDocument()
  })

  it('handles 0 total items cleanly', () => {
    render(
      <NumberedPagination
        page={1}
        totalPages={1}
        total={0}
        pageSize={20}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByText('0 results')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })
})
