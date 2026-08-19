import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NumberedPagination } from './numbered-pagination'

describe('NumberedPagination', () => {
  afterEach(cleanup)

  it('renders page info and navigation buttons for single page', () => {
    const { container } = render(
      <NumberedPagination
        page={1}
        totalPages={1}
        totalCount={5}
        limit={10}
        onPageChange={vi.fn()}
        itemName="items"
      />,
    )

    expect(container.textContent).toContain('Showing 1 to 5 of 5 items')
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders all page numbers when totalPages <= 7', () => {
    const handlePageChange = vi.fn()
    render(
      <NumberedPagination
        page={3}
        totalPages={5}
        totalCount={50}
        limit={10}
        onPageChange={handlePageChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Page 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument()
  })

  it('renders ellipsis when totalPages > 7 and navigates on click', async () => {
    const user = userEvent.setup()
    const handlePageChange = vi.fn()

    render(
      <NumberedPagination
        page={1}
        totalPages={10}
        totalCount={100}
        limit={10}
        onPageChange={handlePageChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 10' })).toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Page 5' }))
    expect(handlePageChange).toHaveBeenCalledWith(5)

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(handlePageChange).toHaveBeenCalledWith(2)
  })

  it('handles middle pages with ellipsis on both sides', () => {
    render(
      <NumberedPagination
        page={6}
        totalPages={12}
        totalCount={120}
        limit={10}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 6' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Page 7' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 12' })).toBeInTheDocument()
    expect(screen.getAllByText('…')).toHaveLength(2)
  })

  it('handles empty state totalCount = 0 safely', () => {
    const { container } = render(
      <NumberedPagination
        page={1}
        totalPages={0}
        totalCount={0}
        limit={10}
        onPageChange={vi.fn()}
      />,
    )

    expect(container.textContent).toContain('Showing 0 to 0 of 0 items')
  })
})
