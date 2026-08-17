import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { primaryChatSessionFixture } from '@/features/chat/testing/chat.fixtures'
import { StudentSessionActionsMenu } from './session-actions-menu'

describe('StudentSessionActionsMenu', () => {
  afterEach(cleanup)

  it('renders menu options including rename, export, and delete', async () => {
    const onStartRename = vi.fn()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const onExport = vi.fn().mockResolvedValue(undefined)

    render(
      <StudentSessionActionsMenu
        session={primaryChatSessionFixture}
        isPending={false}
        isDeleting={false}
        onStartRename={onStartRename}
        onDelete={onDelete}
        onExport={onExport}
      />,
    )

    const trigger = screen.getByRole('button', {
      name: `Open actions for ${primaryChatSessionFixture.title}`,
    })
    fireEvent.click(trigger)

    expect(
      await screen.findByRole('menuitem', { name: /Rename/i }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('menuitem', { name: /Export as Markdown/i }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('menuitem', { name: /Delete/i }),
    ).toBeInTheDocument()
  })

  it('triggers onExport when clicking Export as Markdown', async () => {
    const onStartRename = vi.fn()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const onExport = vi.fn().mockResolvedValue(undefined)

    render(
      <StudentSessionActionsMenu
        session={primaryChatSessionFixture}
        isPending={false}
        isDeleting={false}
        onStartRename={onStartRename}
        onDelete={onDelete}
        onExport={onExport}
      />,
    )

    const trigger = screen.getByRole('button', {
      name: `Open actions for ${primaryChatSessionFixture.title}`,
    })
    fireEvent.click(trigger)

    const exportItem = await screen.findByRole('menuitem', {
      name: /Export as Markdown/i,
    })
    fireEvent.click(exportItem)

    expect(onExport).toHaveBeenCalledOnce()
  })

  it('disables actions when isExporting is true', () => {
    const onStartRename = vi.fn()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const onExport = vi.fn().mockResolvedValue(undefined)

    render(
      <StudentSessionActionsMenu
        session={primaryChatSessionFixture}
        isPending={false}
        isDeleting={false}
        isExporting={true}
        onStartRename={onStartRename}
        onDelete={onDelete}
        onExport={onExport}
      />,
    )

    const trigger = screen.getByRole('button', {
      name: `Open actions for ${primaryChatSessionFixture.title}`,
    })
    expect(trigger).toBeDisabled()
  })
})
